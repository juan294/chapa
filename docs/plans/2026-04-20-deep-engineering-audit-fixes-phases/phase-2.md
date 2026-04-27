# Phase 2 — Verification v2 payload + secret assertion + timing-safe lookup

**Source findings:** §3.2 (all four sub-observations except accepted 128-bit truncation)
**Depends on:** none
**Batch:** [batch-eligible]
**Policy:** Q3a — add missing fields, bump `v` byte, accept legacy 32-char hashes for 90-day window.

## Status

- [x] Implemented on 2026-04-22
- [x] Verified with `pnpm run typecheck`, targeted `eslint` on changed phase-2 files, and `pnpm run test`

## Goal

Extend the verification payload so two profiles with different real-world stats no longer collide, make the missing-secret failure mode loud (in production only), and compare stored hashes via `crypto.timingSafeEqual`.

## Files touched

- `apps/web/lib/verification/hmac.ts`
- `apps/web/app/api/verify/[hash]/route.ts`
- `apps/web/lib/verification/store.ts`
- `packages/shared/src/types.ts` (extend `MetricsSnapshot` only if needed for payload)
- Tests: `hmac.test.ts`, `verify/[hash]/route.test.ts`, `store.test.ts`

## Accepted-risk guard

This phase **does not** modify `hmac.ts:35` (the `.slice(0, 32)` truncation). #401 is preserved.

## TDD — Red tests first

```ts
// hmac.test.ts
describe("buildPayload v2", () => {
  it("includes version byte at position 0", () => {
    const payload = buildPayload(stats, impact, "2026-04-20");
    expect(payload.startsWith("v2|")).toBe(true);
  });
  it("includes activeDays, reposContributed, dimensions.craft", () => {
    const payload = buildPayload(stats, impact, "2026-04-20");
    expect(payload).toContain(`|${stats.activeDays}|`);
    expect(payload).toContain(`|${stats.reposContributed}|`);
    expect(payload).toContain(`|${Math.round(impact.dimensions.craft ?? 0)}|`);
  });
  it("collision: two profiles differing ONLY in reposContributed produce different hashes", () => {
    const a = buildPayload({...stats, reposContributed: 5}, impact, D);
    const b = buildPayload({...stats, reposContributed: 12}, impact, D);
    expect(computeHash(a, SECRET)).not.toBe(computeHash(b, SECRET));
  });
});

describe("generateVerificationCode in production w/o secret", () => {
  it("throws when CHAPA_VERIFICATION_SECRET is unset AND VERCEL_ENV=production", () => {
    delete process.env.CHAPA_VERIFICATION_SECRET;
    process.env.VERCEL_ENV = "production";
    expect(() => generateVerificationCode(stats, impact)).toThrow(/CHAPA_VERIFICATION_SECRET/);
  });
  it("returns null in non-production when secret is unset (dev/preview graceful)", () => {
    delete process.env.CHAPA_VERIFICATION_SECRET;
    process.env.VERCEL_ENV = "preview";
    expect(generateVerificationCode(stats, impact)).toBeNull();
  });
});

// verify/[hash]/route.test.ts
describe("legacy hash acceptance window", () => {
  it("accepts 8/16/32-char legacy hashes through 2026-07-19 (90 days)", async () => {
    const res = await GET(mockReq(), {params: Promise.resolve({hash: legacy32})});
    expect(res.status).not.toBe(400);
  });
});

// store.test.ts
describe("getVerificationRecord", () => {
  it("compares stored hash to query hash via timingSafeEqual", async () => {
    // Fetch all same-day same-handle rows, then constant-time compare
    const spy = vi.spyOn(crypto, "timingSafeEqual");
    await getVerificationRecord(hash);
    expect(spy).toHaveBeenCalled();
  });
});
```

## Green — implementation pseudocode

```ts
// hmac.ts — v2 payload
const PAYLOAD_VERSION = "v2";

export function buildPayload(stats: StatsData, impact: ImpactV6Result, date: string): string {
  return [
    PAYLOAD_VERSION,
    stats.handle.toLowerCase(),
    impact.adjustedComposite,
    impact.confidence,
    impact.tier,
    impact.archetype,
    Math.round(impact.dimensions.delivery),
    Math.round(impact.dimensions.quality),
    Math.round(impact.dimensions.consistency),
    Math.round(impact.dimensions.breadth),
    Math.round(impact.dimensions.craft ?? 0),      // NEW
    stats.commitsTotal,
    stats.prsMergedCount,
    stats.reviewsSubmittedCount,
    stats.activeDays,                              // NEW
    stats.reposContributed,                        // NEW
    date,
  ].join("|");
}

export function generateVerificationCode(stats, impact) {
  const secret = process.env.CHAPA_VERIFICATION_SECRET?.trim();
  if (!secret) {
    if (process.env.VERCEL_ENV === "production") {
      throw new Error("CHAPA_VERIFICATION_SECRET is required in production");
    }
    console.warn("[verify] CHAPA_VERIFICATION_SECRET unset — verification disabled (non-production)");
    return null;
  }
  const date = toDateString(new Date());
  return { hash: computeHash(buildPayload(stats, impact, date), secret), date };
}
```

```ts
// store.ts — timing-safe compare
export async function getVerificationRecord(hash: string) {
  // Load by indexed (handle,date) key rather than by hash directly is not possible
  // because verification starts from hash. So:
  // 1. SELECT by hash (indexed) as before (DB does NOT expose timing to the client).
  // 2. Once a row returns, constant-time compare the stored hash to the query hash.
  const row = await supabase.from("verification_records").select("*").eq("hash", hash).maybeSingle();
  if (!row.data) return null;
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(row.data.hash, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return row.data;
}
```

```ts
// verify/[hash]/route.ts — unchanged regex (already supports 8/16/32)
// Add a comment: "Legacy 32-char window: pre-v2 payload hashes accepted through 2026-07-19"
const HASH_PATTERN = /^(?:[0-9a-f]{8}|[0-9a-f]{16}|[0-9a-f]{32})$/;
const LEGACY_PRE_V2_DEADLINE = "2026-07-19"; // 90 days from plan date
```

## Automated success criteria

- New tests in `hmac.test.ts`, `store.test.ts`, `verify/[hash]/route.test.ts` all green.
- `pnpm run typecheck` clean (new `dimensions.craft` access guarded with `?? 0`).
- `pnpm run test` overall green.
- Golden HMAC vectors in `__fixtures__/hmac-v2.json` — file committed with this phase (seed values chosen once; future phase 10 covers HMAC golden vectors more broadly).

## Manual success criteria

- Deploy to preview, visit `/verify/:legacyHash` for a pre-existing badge — resolves 200 with "legacy payload, verified" marker (UI copy TBD).
- Generate a new badge; confirm its `/verify/:hash` URL resolves and the stored payload contains `v2|`.
- Confirm the plan doc note about the 90-day window is reflected in code comments at the two call sites.

## Notes

- We do not migrate existing verification records. They keep their `v1` hashes and continue to verify via the legacy regex path for 90 days. A follow-up task (not in this plan) will tighten the regex after 2026-07-19.
- The env-check is gated on `VERCEL_ENV === "production"` (already present in the codebase per `CLAUDE.md` env-var section) so dev/preview runs don't break.
