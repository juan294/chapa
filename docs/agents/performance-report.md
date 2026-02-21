---

# Performance Report
> Generated: 2026-02-19 | Branch: `develop` | Health status: **GREEN**

## Executive Summary

The Chapa build is healthy with **no routes exceeding the 500KB threshold**. Total client-side static JS is ~1.6MB across 46 chunks, with the largest individual chunk at 220KB. The badge SVG route has excellent caching (6h CDN + 7d stale-while-revalidate) and in-flight request deduplication. One optimization opportunity: `dbGetLatestSnapshot()` has no application-level cache, adding ~50-150ms to every badge request.

## Build Output

**Next.js 16.1.6 (Turbopack)** — compiled in 2.0s, 50 static pages generated in 256ms.

> Note: Turbopack does not emit per-route First Load JS sizes. Analysis based on `.next/static/chunks/` inspection.

### Client-Side Chunks (Top 10)

| Chunk | Size (KB) | Status |
|-------|-----------|--------|
| `484c69dcd7684692.js` | 220 | OK |
| `17a702d48c913fd1.js` | 172 | OK |
| `a6dad97d9634a72d.js` | 112 | OK |
| `70c742eba8ce1834.js` | 112 | OK |
| `71dff01ff7365d49.js` | 56 | OK |
| `9a4a8216d25f87ef.js` | 52 | OK |
| `bfe46c5d29a814b5.js` | 48 | OK |
| `3732fecc719825d8.js` | 48 | OK |
| `bf2f904e5eb87d6a.js` | 44 | OK |
| `b4b6098f1fc48502.js` | 44 | OK |

### Server-Side Chunks (Top 5)

| Chunk | Size (KB) | Notes |
|-------|-----------|-------|
| `_99edbd10._.js` | 356 | Shared server runtime |
| `posthog-js (SSR)` | 168 | PostHog SDK |
| `supabase (SSR)` | 156 | Supabase client |
| `supabase (server)` | 156 | Supabase client |
| `server entrypoint` | 100 | Root server module |

## Bundle Analysis

- **Total client static JS**: ~1.6MB (46 chunks)
- **Total static output**: ~1.8MB (includes CSS, manifests)
- **Largest client chunk**: 220KB — well under 500KB threshold
- **Routes > 500KB**: **0**
- **Routes > 300KB**: **0**
- **Unused exports (knip)**: **0** — only 4 stale `knip.json` ignore entries to clean up

## Client/Server Boundary

**30 files** with `"use client"` — **27 correctly placed**, 3 minor candidates:

| File | Assessment | Impact |
|------|-----------|--------|
| `SharePageShortcuts.tsx` | Renderless (returns `null`). Could be a hook | Low |
| `CrossAgentInsights.tsx` | `useState` only for tab selection; markdown is pure | Low |
| `UserMenu.tsx` | Could split server shell + client dropdown | Very Low |

**Verdict**: Well-optimized. No heavy server modules in client bundles. Not worth refactoring.

## Font Loading — All PASS

- `next/font/google` with `display: "swap"` for both JetBrains Mono and Plus Jakarta Sans
- No external `@import` or `<link>` font requests — zero render-blocking
- System font fallbacks defined

## CLS Risk — Very Low

All images have explicit dimensions (`next/image` with width/height). One minor: embed snippet suggests `width="600"` without height — adding `height="315"` would help downstream sites.

## Caching & Headers

### Badge Route (`/u/[handle]/badge.svg`)

| Header | Value |
|--------|-------|
| `Cache-Control` | `public, s-maxage=21600, stale-while-revalidate=604800` |
| Error fallback | `s-maxage=300, stale-while-revalidate=600` |

### Application Caching

| Layer | TTL | Status |
|-------|-----|--------|
| Stats (primary) | 6h | Good |
| Stats (stale fallback) | 7d | Excellent |
| Avatar (base64) | 6h | Good |
| Rate limit | 60s/100req | Good |
| **DB snapshot** | **none** | **Missing** |

### Badge Response Times

| Scenario | Estimated |
|----------|-----------|
| All caches hit | ~94ms |
| Stats miss | ~540ms |
| All misses | ~1040ms |

Key optimizations already in place: in-flight request deduplication, fail-open rate limiting, async `after()` writes.

## Recommendations

| # | Issue | Impact | Effort |
|---|-------|--------|--------|
| **1** | Cache `dbGetLatestSnapshot()` in Redis (24h TTL) | Medium — saves 50-150ms/req | Low |
| **2** | Clean up 4 stale knip.json ignore entries | Low — config hygiene | Low |
| **3** | Add `height="315"` to embed snippet | Low — prevents CLS downstream | Low |
| **4** | Add `@next/bundle-analyzer` for monitoring | Info — catch future regressions | Low |

### Not Recommended

- Splitting the 3 `"use client"` files — marginal gains, not worth complexity
- Dynamic imports in badge route — all imports already lightweight
- Avatar lazy-loading — 6h Redis cache is sufficient

---

## Shared Context Entry

```
## Performance Agent — 2026-02-19
- **Status**: GREEN
- Total client static JS: ~1.6MB across 46 chunks
- Largest chunk: 220KB (well under 500KB threshold)
- Routes >500KB: 0
- Unused exports: 0
- Badge route: ~94ms cached, ~1040ms worst-case
- Missing cache: dbGetLatestSnapshot() (Supabase hit every request)

**Cross-agent recommendations:**
- [Coverage]: Badge route EMA smoothing path (dbGetLatestSnapshot) should have integration tests
- [Security]: Fail-open rate limiting is an accepted risk — document in security review
- [QA]: Embed snippet missing height attr could cause CLS on downstream sites
```
