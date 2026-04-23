# Phase 12 — Performance hardening

**Source findings:** §5 (all five observations)
**Depends on:** P4 (badge-render lock uses the versioned cache key)
**Batch:** no (touches several unrelated files — sequential keeps reviewability)

## Goal

Five targeted performance fixes for unbounded-cost call sites the audit surfaced. None of them change user-visible behavior; they just cap cost.

## Files touched

- `apps/web/lib/db/campaigns.ts:425-463` (stats aggregation)
- `apps/web/lib/db/feature-flags.ts:72-105` (Supabase fallback timeout)
- `apps/web/lib/validation.ts` + `apps/web/app/api/insights/route.ts` (byte cap)
- `apps/web/lib/db/supabase.ts` (client memoization)
- `apps/web/app/u/[handle]/badge.svg/route.ts` (concurrent render lock)
- Tests: five corresponding `.test.ts` files

## TDD — Red tests first

```ts
// db/campaigns.test.ts
describe("dbGetCampaignStats", () => {
  it("does not SELECT * — uses a counting/grouping query", async () => {
    const selectSpy = vi.spyOn(supabase.from("campaign_sends"), "select");
    await dbGetCampaignStats(campaignId);
    const call = selectSpy.mock.calls[0];
    // Should select only { status } or use server-side count
    expect(call[0]).not.toContain("*");
    expect(call[0]).toMatch(/status|count/);
  });
  it("scales to 100k rows without loading them into memory", async () => {
    // seed mock with 100k rows, assert memory guard (< 5MB)
    const before = process.memoryUsage().heapUsed;
    await dbGetCampaignStats(largeCampaignId);
    expect(process.memoryUsage().heapUsed - before).toBeLessThan(5_000_000);
  });
});

// db/feature-flags.test.ts
describe("getFeatureFlag Supabase fallback", () => {
  it("aborts after 500ms if Supabase does not respond", async () => {
    mockSupabaseSlow(2000);
    const start = Date.now();
    const v = await getFeatureFlag("some_flag");
    expect(Date.now() - start).toBeLessThan(700);
    expect(v).toBe(DEFAULT_FLAG_VALUE);   // fail-open to default
  });
});

// insights/route.test.ts
describe("POST /api/insights byte cap", () => {
  const MAX = 256 * 1024;
  it("rejects bodies > 256 KB with 413", async () => {
    const big = JSON.stringify({ raw_data: "x".repeat(MAX + 1) });
    const res = await POST(mockReq(big));
    expect(res.status).toBe(413);
  });
});

// db/supabase.test.ts
describe("getSupabase", () => {
  it("returns the same instance on repeated calls", () => {
    const a = getSupabase(); const b = getSupabase();
    expect(a).toBe(b);
  });
});

// badge.svg/route.test.ts
describe("badge SVG render lock", () => {
  it("two simultaneous cold-cache requests produce one render call", async () => {
    // Covered by P10 concurrent.test.ts — here we add a unit test at the cache-lock level
    const renderSpy = vi.spyOn(render, "renderBadgeSvg");
    const [r1, r2] = await Promise.all([renderBadge("juan"), renderBadge("juan")]);
    expect(renderSpy).toHaveBeenCalledTimes(1);
  });
});
```

## Green — implementation pseudocode

```ts
// db/campaigns.ts — use server-side group-by count
const { data } = await supabase
  .rpc("campaign_stats", { campaign_id: campaignId });
// OR if RPC not available, use .select("status", {count:"exact", head:true}) per status value
return data;  // already tallied
```

```ts
// db/feature-flags.ts — withTimeout guard (helper exists elsewhere in codebase)
const result = await withTimeout(supabase.from("feature_flags").select("value").eq("key", key).single(), 500);
if (!result) return DEFAULT_FLAG_VALUE;
```

```ts
// validation.ts — new guard
export const MAX_INSIGHTS_BYTES = 256 * 1024;
export function isValidInsightsUpload(body: string, value: unknown): boolean {
  if (body.length > MAX_INSIGHTS_BYTES) return false;
  // ... existing shape validation ...
}

// insights/route.ts — read body as text first, measure, then JSON.parse
const text = await request.text();
if (text.length > MAX_INSIGHTS_BYTES) return NextResponse.json({error:"payload_too_large"}, {status:413});
const body = JSON.parse(text);
```

```ts
// db/supabase.ts — explicit singleton
let client: SupabaseClient | null = null;
export function getSupabase(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  if (!client) client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { /* ... */ });
  return client;
}
```

```ts
// badge.svg/route.ts — SETNX lock on cold render
const lockKey = `badge-lock:${CACHE_VERSION}:${handle}:${theme}:${date}`;
const gotLock = await cacheSetNx(lockKey, "1", 30);   // 30-second lock
if (!gotLock) {
  // Brief wait then re-read cache; fall through to render only if still missing
  await sleep(150);
  const cached = await cacheGet(cacheKey);
  if (cached) return new Response(cached, svgHeaders);
}
try {
  const svg = await renderBadgeSvg(...);
  await cacheSet(cacheKey, svg, 24*3600);
  return new Response(svg, svgHeaders);
} finally {
  if (gotLock) await cacheDel(lockKey);
}
```

## Automated success criteria

- All new tests green.
- `grep -rn "\.select(\"\\*\")" apps/web/lib/db/campaigns.ts:425-463` → 0 matches.
- `pnpm run typecheck` clean.
- Existing perf-adjacent tests still pass.

## Manual success criteria

- Admin campaign-stats page loads in < 500 ms for a campaign with > 10k recipients.
- Feature-flag lookup never blocks longer than ~500 ms even if Supabase is laggy.
- Upload a 300 KB insights payload — 413 returned, no Supabase row inserted.
- Two concurrent `curl` calls to an un-cached badge URL — observe server logs show one render, two responses.

## Notes

- The RPC approach for campaign stats requires a Supabase function definition. If introducing an RPC is heavier than desired, fall back to `count:"exact", head:true` per-status queries (6 round-trips for 6 statuses, still O(1) in row count).
- The badge-render lock uses 30 s TTL as a safety valve: if a render crashes and doesn't release the lock, the worst case is one user waits 30 s on the next request. Tune if render p99 approaches 30 s.

## Status

- [x] Implemented on 2026-04-23
- [x] Verified with `pnpm exec vitest run apps/web/lib/db/campaigns.test.ts apps/web/lib/feature-flags.test.ts apps/web/lib/insights/validation.test.ts apps/web/app/api/insights/route.test.ts apps/web/app/u/[handle]/badge.svg/route.test.ts apps/web/app/u/[handle]/badge.svg/concurrent.test.ts apps/web/lib/db/supabase.test.ts`, `pnpm run typecheck`, `pnpm run lint`, and `pnpm run test`
- [x] Replaced `dbGetCampaignStats()` row-loading with bounded per-status count queries
- [x] Added a 500ms timeout around DB-backed feature-flag lookups while preserving env-var fallback semantics
- [x] Added a shared `MAX_INSIGHTS_BYTES` source-of-truth and rejected oversize insights uploads with `413 payload_too_large` before JSON parsing and DB writes
- [x] Added a cold-cache badge render lock keyed by the versioned badge cache key and converted the phase-10 concurrency `todo` into a real passing test
- [x] Confirmed `apps/web/lib/db/supabase.ts` was already using a memoized singleton and retained the existing singleton coverage rather than changing that module again
