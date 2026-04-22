# Phase 10 — Test coverage: close observed gaps

**Source findings:** §7 (7 observed gaps)
**Depends on:** P1, P2, P3, P4 (this phase tests the shapes those phases finalize)
**Batch:** no (test files may overlap with earlier phase test adjustments)

## Goal

Close the seven test gaps surfaced in §7. Some are already partially covered in phases P2/P3 (missing-secret path, telemetry route); this phase adds the ones none of the earlier phases absorb: true end-to-end pipeline, concurrent render, HMAC golden vectors.

## Files touched

- `apps/web/lib/impact/pipeline.test.ts` (extend — currently 2 `it` blocks at lines 17, 49)
- `apps/web/lib/verification/__fixtures__/hmac-v2-golden-vectors.json` (NEW)
- `apps/web/lib/verification/hmac.test.ts` (extend with golden-vector round-trip)
- `apps/web/app/u/[handle]/badge.svg/concurrent.test.ts` (NEW)
- `apps/web/lib/email/campaigns.test.ts` (extend — P7 already adds partial-failure; this phase adds the multi-row failure shapes)

## Gaps already covered by earlier phases (for audit completeness)

- §7 #2 "missing-secret path in `generateVerificationCode`" — covered by P2.
- §7 #3 "insights upload invalidates snapshot cache" — covered by P4.
- §7 #5 "`/api/telemetry` authentication semantics" — covered by P3 (route behavior test).
- §7 #6 "`resend.batch.send` partial-failure" — covered by P7.

## Gaps this phase adds

### §7 #1 — True end-to-end pipeline including verification write

```ts
// pipeline.test.ts (extend)
describe("end-to-end: GraphQL → scored snapshot → verification record on disk", () => {
  it("produces a deterministic verification record for a frozen fixture", async () => {
    const rawGraphQL = readFixture("github/juan-frozen-2026-04-20.json");
    const stats = await aggregate(rawGraphQL);
    const merged = mergeSupplemental(stats, null);
    const impact = computeImpactV6(merged);
    const snap = buildSnapshot(merged, impact);
    const payload = buildPayload(merged, impact, "2026-04-20");
    const hash = computeHash(payload, TEST_SECRET);
    // Assert every field through every stage
    expect(snap.adjustedComposite).toBe(GOLDEN_COMPOSITE);
    expect(hash).toBe(GOLDEN_HASH);
    // Side-effect: verification record was written
    expect(dbInsertVerificationSpy).toHaveBeenCalledWith(expect.objectContaining({ hash, handle: "juan" }));
  });
});
```

### §7 #4 — Concurrent badge render

```ts
// badge.svg/concurrent.test.ts (NEW)
describe("GET /u/:handle/badge.svg — cold-cache concurrency", () => {
  it("renders SVG exactly once when two requests arrive simultaneously", async () => {
    // Mock cache empty, render spy
    const renderSpy = vi.spyOn(render, "renderBadgeSvg");
    const [r1, r2] = await Promise.all([
      GET(mockReq(), {params: Promise.resolve({handle: "juan"})}),
      GET(mockReq(), {params: Promise.resolve({handle: "juan"})}),
    ]);
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(renderSpy).toHaveBeenCalledTimes(1);  // lock held on second caller
  });
});
```

This test depends on P12's badge-render lock. If P12 is not merged before this phase lands, skip this single `it` with `.todo`.

### §7 #7 — HMAC golden vectors

```json
// __fixtures__/hmac-v2-golden-vectors.json
[
  {
    "label": "minimal-solo",
    "stats": { "handle": "solo-a", "commitsTotal": 50, "prsMergedCount": 10, "reviewsSubmittedCount": 0, "activeDays": 30, "reposContributed": 3, /* ... */ },
    "impact": { "adjustedComposite": 55, "confidence": 80, "tier": "B", "archetype": "marathoner", "dimensions": { "delivery": 60, "quality": 50, "consistency": 70, "breadth": 40, "craft": 30 } },
    "date": "2026-04-20",
    "secret": "test-secret-32-chars-0123456789ab",
    "expectedHash": "…precomputed 32 hex chars…"
  },
  /* 5–10 more vectors covering: collaborative, no-craft, all-zero dims, EMU handle, unicode display name, edge dates */
]
```

```ts
// hmac.test.ts (extend)
describe("HMAC v2 golden vectors", () => {
  it.each(readFixture("hmac-v2-golden-vectors.json"))(
    "$label",
    ({stats, impact, date, secret, expectedHash}) => {
      const payload = buildPayload(stats, impact, date);
      expect(computeHash(payload, secret)).toBe(expectedHash);
    }
  );
});
```

## Automated success criteria

- `pnpm run test -- pipeline.test.ts` now runs 3+ `it` blocks and they're green.
- `pnpm run test -- concurrent.test.ts` green (depends on P12 — skipped if P12 not landed).
- Golden-vector fixture exists and round-trips.
- `pnpm run test:coverage` — lines covered in `hmac.ts` reach 100%, `pipeline` end-to-end path reaches 100%.

## Manual success criteria

- Review golden-vector fixture values manually to confirm they weren't generated from buggy code. Run `pnpm run test -- hmac` with a locally recomputed hash.
- Confirm concurrent render test reliably passes 10/10 runs locally (no flake).

## Notes

- Golden vectors are generated once, committed, and then act as regression gate. If a future scoring change intentionally changes outputs, regenerate and note in the commit body.
- The pipeline test must NOT mock the verification layer — it exercises it. Use an in-memory Supabase mock via the existing `lib/db/supabase.ts` test pattern.
