# Phase 1: Redis Cache for Craft Scores `[batch-eligible]`

> **Files**: 6 (1 new, 1 new test, 4 modified)
> **Estimated tests**: 8–10 new tests
> **Dependencies**: None

## Goal

Add a Redis cache layer around `dbGetToolInsights()` to eliminate the Supabase query
on every badge/share-page request. Pattern follows `snapshot-cache.ts` exactly.

## Changes

### 1. New file: `apps/web/lib/cache/craft-cache.ts`

Redis cache wrapper for craft scores. Mirrors `snapshot-cache.ts` structure.

```pseudo
import { cacheGet, cacheSet, cacheDel } from "./redis"
import { dbGetToolInsights } from "@/lib/db/tool-insights"
import type { CraftResult } from "@chapa/shared"

const CRAFT_CACHE_TTL = 3600   // 1 hour — craft scores change rarely (only on insights upload)

function craftCacheKey(handle: string): string {
  return `craft:${handle.toLowerCase()}`
}

// getCachedCraftScore(handle)
//   1. Try Redis → return on hit
//   2. Redis miss or error → query Supabase via dbGetToolInsights()
//   3. Cache result in Redis (fire-and-forget, don't cache nulls)
//   4. Return result
//
// Fail-open: Redis error → fall through to Supabase (same pattern as snapshot-cache)

// updateCraftCache(handle, result)
//   Set Redis key with TTL (called after insights upload to keep cache fresh)
//   Fire-and-forget safe — silently no-ops on Redis failure

// invalidateCraftCache(handle)
//   Delete Redis key (called when craft data changes mid-TTL)
//   Fire-and-forget safe — silently no-ops on Redis failure
```

### 2. New file: `apps/web/lib/cache/craft-cache.test.ts`

Tests follow `snapshot-cache.test.ts` pattern exactly:

```pseudo
// getCachedCraftScore
- "returns cached craft result on cache hit (no DB call)"
- "fetches from DB on cache miss and caches the result"
- "returns null when both cache and DB have no data"
- "lowercases the handle for the cache key"
- "falls back to DB when Redis fails (fail-open)"
- "does not cache null results"

// updateCraftCache
- "updates the cache with the new craft result"
- "does not throw when Redis fails (fire-and-forget safe)"

// invalidateCraftCache
- "deletes the craft cache key"
- "lowercases handle"
- "does not throw on Redis failure"
```

### 3. Modify: `apps/web/app/u/[handle]/badge.svg/route.ts`

Replace `dbGetToolInsights` import with `getCachedCraftScore`.

```diff
- import { dbGetToolInsights } from "@/lib/db/tool-insights";
+ import { getCachedCraftScore } from "@/lib/cache/craft-cache";

  // Line 104-106: inside Promise.allSettled
- dbGetToolInsights(handle),
+ getCachedCraftScore(handle),
```

No other changes to this file.

### 4. Modify: `apps/web/app/u/[handle]/page.tsx`

Replace `dbGetToolInsights` import with `getCachedCraftScore`.

```diff
- import { dbGetToolInsights } from "@/lib/db/tool-insights";
+ import { getCachedCraftScore } from "@/lib/cache/craft-cache";

  // Line 102-108: inside Promise.all
- dbGetToolInsights(handle),
+ getCachedCraftScore(handle),
```

No other changes to this file.

### 5. Modify: `apps/web/app/api/recalculate/route.ts`

Replace `dbGetToolInsights` with cached version + invalidate after recalculate.

```diff
- import { dbGetToolInsights } from "@/lib/db/tool-insights";
+ import { getCachedCraftScore, invalidateCraftCache } from "@/lib/cache/craft-cache";

  // Line 45-48: inside Promise.all
- dbGetToolInsights(handle),
+ getCachedCraftScore(handle),

  // After line 72 (after snapshot cache update): invalidate craft cache
  // so next badge request fetches fresh from DB
+ await invalidateCraftCache(handle);
```

### 6. Modify: `apps/web/app/api/insights/route.ts`

Add craft cache invalidation in the `after()` block.

```diff
+ import { invalidateCraftCache } from "@/lib/cache/craft-cache";

  // Line 63-68: inside after() → Promise.allSettled
  after(async () => {
    const handle = auth.handle.toLowerCase();
    await Promise.allSettled([
      cacheDel(`stats:v2:merged:${handle}`),
      invalidateSnapshotCache(handle),
+     invalidateCraftCache(handle),
    ]);
  });
```

## Success criteria

### Automated
- [ ] All new tests pass: `pnpm run test -- craft-cache`
- [ ] Existing tests pass: `pnpm run test`
- [ ] Type check passes: `pnpm run typecheck`
- [ ] Lint passes: `pnpm run lint`
- [ ] No new imports of `dbGetToolInsights` in badge.svg route, share page, or recalculate route
- [ ] `getCachedCraftScore` calls `cacheGet` before `dbGetToolInsights`

### Manual
- None — all verification is automated.
