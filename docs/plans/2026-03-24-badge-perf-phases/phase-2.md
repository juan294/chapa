# Phase 2: Pre-Warm Avatar + Craft in Cron

> **Files**: 2 modified
> **Estimated tests**: 3–4 new tests
> **Dependencies**: Phase 1 (uses `getCachedCraftScore`)

## Goal

The warm-cache cron currently warms stats + snapshot caches but skips avatar and craft
score caches. After cron runs, the first badge/share-page visit still needs to fetch
avatar from GitHub CDN (500ms–2s) and craft from Supabase (50–100ms). By pre-warming
these in the cron, most user requests hit fully-cached paths.

## Changes

### 1. Modify: `apps/web/app/api/cron/warm-cache/route.ts`

Add avatar and craft warming to `warmHandle()`. These are independent of the stats
fetch and of each other, so they run in parallel via `Promise.allSettled`.

```pseudo
// In warmHandle(), after successful getStats():

// Current code computes impact WITHOUT craft:
//   const impact = computeImpactV4(stats);

// Change to: fetch craft score first, then compute with it
//
// 1. Warm craft cache (reads from Redis/Supabase, populates Redis)
//    This uses getCachedCraftScore from Phase 1 — the act of calling it
//    warms the cache (read-through caching pattern).
//
// 2. Warm avatar cache (reads from Redis/GitHub CDN, populates Redis)
//    Call getAvatarBase64(handle, stats.avatarUrl) if avatarUrl exists.
//    The function already has its own Redis caching — just calling it
//    ensures the cache is warm.
//
// 3. Compute impact WITH craft (if available)
//    Pass craftResult?.craftScore to computeImpactV4()
```

Detailed changes inside `warmHandle()`:

```diff
+ import { getAvatarBase64 } from "@/lib/render/avatar";
+ import { getCachedCraftScore } from "@/lib/cache/craft-cache";

  async function warmHandle(...): Promise<HandleResult> {
    try {
      const stats = await getStats(handle, githubToken);
      if (!stats) { ... return; }

+     // Pre-warm avatar + craft caches in parallel (fire-and-forget safe)
+     const [craftSettled] = await Promise.allSettled([
+       getCachedCraftScore(handle),
+       stats.avatarUrl ? getAvatarBase64(handle, stats.avatarUrl) : Promise.resolve(undefined),
+     ]);
+     const craftResult = craftSettled.status === "fulfilled" ? craftSettled.value : null;

      // Record snapshot with craft score included
-     const impact = computeImpactV4(stats);
+     const impact = computeImpactV4(stats, craftResult?.craftScore ?? undefined);
      const snapshot = buildSnapshot(stats, impact);
      ...
    }
  }
```

**Response shape**: Add `avatarsWarmed` counter to the JSON response for observability.

```diff
+ let avatarsWarmed = 0;

  // In the per-handle result tracking:
+ interface HandleResult {
+   warmed: boolean;
+   snapshotRecorded: boolean;
+   notified: boolean;
+   avatarWarmed: boolean;  // NEW
+ }

  // In the response JSON:
  return NextResponse.json({
    warmed,
    failed,
    snapshots,
    notifications,
+   avatarsWarmed,
    ...
  });
```

### 2. Modify: `apps/web/app/api/cron/warm-cache/route.test.ts`

Add tests for the new warming behavior.

```pseudo
// New test group: "avatar and craft warming"

- "warms avatar cache for handles with avatarUrl"
  // Mock getStats to return stats with avatarUrl
  // Verify getAvatarBase64 was called with correct args

- "skips avatar warming when stats have no avatarUrl"
  // Mock getStats to return stats WITHOUT avatarUrl
  // Verify getAvatarBase64 was NOT called

- "warms craft cache via getCachedCraftScore"
  // Mock getCachedCraftScore to return a craft result
  // Verify computeImpactV4 was called WITH craft score

- "continues warming even if avatar fetch fails"
  // Mock getAvatarBase64 to reject
  // Verify handle still counts as warmed (avatar is non-critical)
```

## Design decisions

**Why call `getCachedCraftScore` instead of `dbGetToolInsights` directly?**
Using the cached wrapper means the cron both reads AND populates the Redis cache in one
call (read-through pattern). If the cache is already warm (from a recent badge request),
it's a cheap Redis read. If cold, it fetches from Supabase and caches the result.

**Why `Promise.allSettled` for avatar + craft?**
Both are independent and non-critical. If avatar fetch times out (5s) or craft DB is
unreachable, the handle should still be counted as warmed (stats are the critical path).

**Impact on cron execution time:**
- Avatar: Redis hit = ~2ms, CDN miss = ~500ms–2s (but has 5s timeout)
- Craft: Redis hit = ~2ms, Supabase miss = ~50ms
- Per-handle overhead: ~5ms (cached) to ~2s (worst case avatar CDN)
- Budget: 50 handles × BATCH_SIZE 5 = 10 batches. Even worst case (all avatar misses):
  10 batches × 2s = 20s. Well within 300s Vercel Pro limit.

## Success criteria

### Automated
- [ ] All new tests pass: `pnpm run test -- warm-cache`
- [ ] Existing warm-cache tests still pass
- [ ] Type check passes: `pnpm run typecheck`
- [ ] Lint passes: `pnpm run lint`
- [ ] `computeImpactV4` in warm-cache is called with craft score when available

### Manual
- None — all verification is automated.
