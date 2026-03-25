# Badge SVG Performance Optimization

> **Created**: 2026-03-24
> **Status**: Draft
> **Branch**: `feature/badge-perf`
> **Issue**: TBD

## Problem

Badge loads take 3–6 seconds on cold cache, causing users to stare at a blank white
card on the share page. This is critical before enabling the v2.0 announcement campaign
— every email links to a share page that must load fast.

### Root causes (measured)

| Bottleneck | Latency (cold) | Frequency | Impact |
|------------|----------------|-----------|--------|
| **Craft score DB query** — `dbGetToolInsights()` hits Supabase on every request, no Redis cache | 50–100ms | Every request | Medium |
| **Avatar CDN fetch** — `getAvatarBase64()` fetches from GitHub CDN on cache miss, 5s timeout | 500ms–2s | Every 6h (cache miss) | High |
| **Cron doesn't warm avatar** — `warm-cache` calls `getStats()` but never `getAvatarBase64()` | N/A (structural) | All users | High |
| **Cron doesn't include craft** — `computeImpactV4(stats)` called without craft score | N/A (structural) | Users with craft | Medium |
| **No loading skeleton** — share page shows blank white card while badge SVG loads via `<img>` fallback | N/A (UX) | ISR miss or stats failure | Medium |

### Performance baseline

| Scenario | Current latency |
|----------|----------------|
| Fully cached (stats + avatar + craft + snapshot all in Redis) | ~75ms |
| Stats cached, avatar/craft miss | ~1.15s |
| All cache miss (first visit, no cron warm) | ~4.8s |
| Timeout (GitHub API 15s + avatar 5s) | 15s+ |

### Target

- Fully cached badge: **<100ms** (no change)
- Typical badge (post-cron-warm): **<200ms** (from ~1.15s — craft cached, avatar pre-warmed)
- Cold cache badge: **<3s** (from ~4.8s — craft from Redis instead of Supabase)
- Perceived load time: **instant** (skeleton shows immediately while SVG loads)

## Architecture

### Current request flow (badge.svg endpoint)

```
Request → rateLimit (Redis) → getStats (cache-first → GitHub GraphQL)
        → Promise.allSettled([
            dbGetToolInsights(handle),        ← SUPABASE EVERY TIME
            getCachedLatestSnapshot(handle),   ← Redis → Supabase fallback
            getAvatarBase64(handle, url),       ← Redis → GitHub CDN fallback
          ])
        → computeImpactV4 → smoothScore → renderBadgeSvg → Response
```

### After optimization

```
Request → rateLimit (Redis) → getStats (cache-first → GitHub GraphQL)
        → Promise.allSettled([
            getCachedCraftScore(handle),        ← REDIS FIRST → Supabase fallback
            getCachedLatestSnapshot(handle),     ← Redis → Supabase fallback (no change)
            getAvatarBase64(handle, url),         ← Redis → GitHub CDN fallback (no change)
          ])
        → computeImpactV4 → smoothScore → renderBadgeSvg → Response
```

Plus: warm-cache cron pre-warms avatar + craft, so most requests are fully cached.

## Phases

| # | Phase | Batch | Depends on |
|---|-------|-------|------------|
| 1 | [Redis cache for craft scores](2026-03-24-badge-perf-phases/phase-1.md) | `[batch-eligible]` | — |
| 2 | [Pre-warm avatar + craft in cron](2026-03-24-badge-perf-phases/phase-2.md) | — | Phase 1 |
| 3 | [Badge loading skeleton](2026-03-24-badge-perf-phases/phase-3.md) | `[batch-eligible]` | — |

**Phases 1 and 3 are `[batch-eligible]`** — no file overlap, no dependency on each other.
Phase 2 depends on Phase 1 (uses the new `getCachedCraftScore()` function in the cron).

## Files changed

| File | Phase | Change |
|------|-------|--------|
| `apps/web/lib/cache/craft-cache.ts` | 1 | **New** — Redis cache layer for craft scores |
| `apps/web/lib/cache/craft-cache.test.ts` | 1 | **New** — Tests |
| `apps/web/app/u/[handle]/badge.svg/route.ts` | 1 | Replace `dbGetToolInsights()` → `getCachedCraftScore()` |
| `apps/web/app/u/[handle]/page.tsx` | 1 | Replace `dbGetToolInsights()` → `getCachedCraftScore()` |
| `apps/web/app/api/recalculate/route.ts` | 1 | Replace `dbGetToolInsights()` → `getCachedCraftScore()` + invalidate |
| `apps/web/app/api/insights/route.ts` | 1 | Add craft cache invalidation in `after()` |
| `apps/web/app/api/cron/warm-cache/route.ts` | 2 | Add avatar + craft warming to `warmHandle()` |
| `apps/web/app/api/cron/warm-cache/route.test.ts` | 2 | Add tests for avatar + craft warming |
| `apps/web/components/BadgeSkeleton.tsx` | 3 | **New** — Skeleton component |
| `apps/web/app/u/[handle]/page.tsx` | 3 | Replace blank `<img>` fallback with skeleton wrapper |

## Risk assessment

- **Low risk**: All changes are additive caching layers with fail-open fallbacks. If Redis is unavailable, behavior falls back to current (Supabase direct).
- **Cache invalidation**: Craft cache is invalidated on insights upload (`POST /api/insights`) and recalculate (`POST /api/recalculate`). TTL provides eventual consistency for edge cases.
- **Cron budget**: Adding avatar + craft warming to each handle increases per-handle cron time by ~100ms (Redis reads, mostly cache hits). Well within the 300s Vercel Pro limit.

## Verification

```bash
pnpm run test && pnpm run typecheck && pnpm run lint
```
