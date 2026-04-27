# Phase 7 — Data-layer hygiene

**Source findings:** B7, B8, B9, B10, B11, B13
**Depends on:** none
**Batch:** [batch-eligible]

## Goal

Bring `lib/db/campaigns.ts` and the email send path in line with the rest of `lib/db/*` (Zod row parsing, status enum, atomic quota), handle Resend partial-batch failures, move `captured_at` to a DB default, and add a rate limit to `og-image`.

## Files touched

- `apps/web/lib/db/campaigns.ts` (B7, B8)
- `apps/web/lib/email/campaigns.ts` (B9, B10)
- `apps/web/lib/history/snapshot.ts` (B11)
- `apps/web/app/u/[handle]/og-image/route.ts` (B13)
- `supabase/migrations/YYYYMMDDHHMMSS_metrics_snapshots_default_captured_at.sql` (NEW)
- Tests: `db/campaigns.test.ts`, `email/campaigns.test.ts`, `history/snapshot.test.ts`, `og-image/route.test.ts`

## TDD — Red tests first

```ts
// db/campaigns.test.ts
describe("mapCampaignRow (B7)", () => {
  it("rejects rows with missing required fields", () => {
    expect(() => mapCampaignRow({})).toThrow(/validation/i);
  });
  it("uses Zod parseRow like sibling db modules", () => {
    // Import parseRow from a neighbor (snapshots.ts) to ensure consistency
    expect(typeof CampaignRowSchema.parse).toBe("function");
  });
});

describe("dbUpdateCampaign status whitelist (B8)", () => {
  it("rejects statuses outside ['draft','scheduled','sending','sent','cancelled']", async () => {
    await expect(dbUpdateCampaign(id, {status: "bogus" as any})).rejects.toThrow();
  });
});

// email/campaigns.test.ts
describe("sendCampaignBatch quota atomicity (B9)", () => {
  it("uses a single Redis pipeline for check+increment", async () => {
    const pipelineSpy = vi.spyOn(redis, "pipeline");
    await sendCampaignBatch(...);
    expect(pipelineSpy).toHaveBeenCalled();
  });
});

describe("resend.batch.send partial failure (B10)", () => {
  it("treats partial result as { sentIds, failedIds } instead of whole-batch failure", async () => {
    mockResend.batch.send.mockResolvedValue({
      data: [
        { id: "ok-1" },
        { id: null, error: { message: "rejected" } },
      ],
    });
    const result = await sendCampaignBatch(...);
    expect(result.sentIds).toEqual(["ok-1"]);
    expect(result.failedIds).toHaveLength(1);
  });
});

// history/snapshot.test.ts
describe("persistSnapshot (B11)", () => {
  it("does not set capturedAt in the app — DB default populates it", async () => {
    const insertSpy = vi.spyOn(supabase.from("metrics_snapshots"), "insert");
    await persistSnapshot(snapshot);
    const args = insertSpy.mock.calls[0][0];
    expect(args.captured_at).toBeUndefined();
  });
});

// og-image/route.test.ts
describe("GET /u/:handle/og-image (B13)", () => {
  it("rate-limits to 30/IP/60s", async () => {
    for (let i=0; i<30; i++) await GET(mockReq(), {params: Promise.resolve({handle: "juan"})});
    const res = await GET(mockReq(), {params: Promise.resolve({handle: "juan"})});
    expect(res.status).toBe(429);
  });
});
```

## Green — implementation pseudocode

```ts
// db/campaigns.ts — parseRow/Zod
import { z } from "zod";
const CampaignRowSchema = z.object({
  id: z.string(),
  status: z.enum(["draft","scheduled","sending","sent","cancelled"]),
  subject: z.string(),
  // ... rest ...
});
export function mapCampaignRow(row: unknown) { return CampaignRowSchema.parse(row); }

const CAMPAIGN_STATUSES = ["draft","scheduled","sending","sent","cancelled"] as const;
export async function dbUpdateCampaign(id: string, patch: CampaignPatch) {
  if (patch.status && !CAMPAIGN_STATUSES.includes(patch.status as any)) {
    throw new Error(`Invalid campaign status: ${patch.status}`);
  }
  // ... existing update ...
}
```

```ts
// email/campaigns.ts — atomic quota + partial handling
const pipeline = redis.pipeline();
pipeline.get(quotaKey);
pipeline.incr(quotaKey);
pipeline.expire(quotaKey, 86_400);
const [current, _, __] = await pipeline.exec<[string | null, number, number]>();
if ((Number(current) ?? 0) >= DAILY_QUOTA) return { sentIds: [], failedIds: recipients, skipped: true };

// Resend partial
const { data } = await resend.batch.send(batch);
const sentIds = data.filter(d => d.id && !d.error).map(d => d.id!);
const failedIds = data.filter(d => !d.id || d.error).map((d,i) => batch[i].to);
```

```sql
-- migration
ALTER TABLE metrics_snapshots
  ALTER COLUMN captured_at SET DEFAULT now();
```

```ts
// history/snapshot.ts — drop app-side capturedAt setting
await db.from("metrics_snapshots").insert({
  handle,
  yyyymmdd,
  // captured_at removed — DB default fires
  snapshot: JSON.stringify(snapshot),
});
```

```ts
// og-image/route.ts — rate limit (mirrors verify/[hash] pattern)
const ip = getClientIp(request);
const rl = await rateLimit(`ratelimit:og:${ip}`, 30, 60);
if (!rl.allowed) return new Response("Too many requests", { status: 429, headers: { "Retry-After": "60" }});
```

## Automated success criteria

- All new tests green.
- `grep -rn "as any" apps/web/lib/db/campaigns.ts` returns 0.
- `pnpm run typecheck` clean (campaign status now a discriminated union).
- `pnpm run test` overall green.

## Manual success criteria

- Send a test campaign in staging; confirm partial-failure metrics report individual sent/failed counts.
- Insert a `metrics_snapshots` row without `captured_at` in the insert — confirm row has a valid timestamp from the DB default.
- `curl -i /u/:handle/og-image` 31 times in 60s — 31st returns 429.

## Notes

- `mapSendRow` gets the same Zod treatment as `mapCampaignRow` — included in this phase.
- The Resend partial-failure shape is SDK-version-dependent. If the installed version returns `data: ResendResult[]`, the pseudocode above holds. If it returns a single `{data, error}`, the test adapts to the actual mock shape in implementation.

## Status

- [x] Implemented on 2026-04-22
- [x] Verified with `pnpm run typecheck`, `pnpm run lint`, and `pnpm run test`
- [x] Adjusted the campaign status whitelist to match live code reality by allowing `failed` alongside `draft`, `scheduled`, `sending`, `sent`, and `cancelled`
- [x] Used the existing `parseRow` runtime-validation pattern instead of adding a new `zod` dependency in this phase
- [x] Added an idempotent migration to reaffirm the existing `metrics_snapshots.captured_at DEFAULT now()` contract while removing app-side `captured_at` on inserts
