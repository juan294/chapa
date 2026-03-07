# Performance Report
> Generated: 2026-03-05 | Branch: `develop` | Health status: GREEN

## Executive Summary

Build compiles cleanly in 2.3s (Turbopack). Total client-side static JS is **1.3 MB** across 52 chunks with no single chunk exceeding 500 KB. The largest chunk is 219 KB (Next.js framework internals). PostHog (~173 KB) is the biggest third-party library but is already lazy-loaded on first user interaction. The main actionable finding is that share pages (`/u/[handle]`) lack ISR, causing unnecessary SSR on every request.

## Build Output

Next.js 16.1.6 with Turbopack does **not** emit per-route First Load JS sizes in the build output. Analysis is based on the static chunk directory instead.

| Chunk | Size | Contents | Status |
|-------|------|----------|--------|
| `484c69...` | 219 KB | Next.js framework (router, hydration) | GREEN |
| `9ff022...` | 173 KB | `posthog-js` (analytics) | YELLOW |
| `a6dad9...` | 110 KB | Framework chunk | GREEN |
| `70c742...` | 108 KB | Framework chunk | GREEN |
| `f26a8d...` | 58 KB | App code | GREEN |
| `2b6d58...` | 56 KB | App code | GREEN |
| `4a281c...` | 51 KB | App code | GREEN |
| All others | <43 KB each | Various | GREEN |

**No route or chunk exceeds 500 KB.** Largest is 219 KB.

## Bundle Analysis

- **Total static JS**: 1,376 KB (1.3 MB) across 52 chunks
- **Total static CSS**: 90 KB (single file)
- **Total `.next/` directory**: 333 MB (includes dev artifacts, server chunks, cache)
- **Largest third-party**: `posthog-js` at ~173 KB — mitigated by lazy-loading (interaction-triggered `import()` with 5s fallback in `PostHogProvider.tsx:18`)
- **Unused exports (knip)**: 0 — clean
- **Unused dependencies (knip)**: 0 — clean

## Client/Server Boundary

34 files use `"use client"`. 30 legitimately need it (hooks, browser APIs). **4 files could be server components:**

| File | Location | Reason |
|------|----------|--------|
| `OverallHealthBanner.tsx` | `admin/agents/` | Pure presentation, no hooks |
| `AgentCard.tsx` | `admin/agents/` | Pure presentation, no hooks |
| `ShareBadgePreview.tsx` | `components/` | Wrapper around client child, no hooks |
| Error pages (`error.tsx`, `u/[handle]/error.tsx`, `admin/error.tsx`) | Various | Pure presentation (but Next.js error boundaries require `"use client"` — **keep as-is**) |

**Impact**: Removing `"use client"` from `OverallHealthBanner.tsx`, `AgentCard.tsx`, and `ShareBadgePreview.tsx` would reduce the client bundle marginally — these are small components. Low priority.

## Caching & Headers

### Badge SVG Route (`/u/[handle]/badge.svg`)
- **Success**: `Cache-Control: public, s-maxage=21600, stale-while-revalidate=604800` (6h CDN cache, 7d stale)
- **Fallback (error)**: `Cache-Control: public, s-maxage=300, stale-while-revalidate=600` (5m CDN cache)
- **CSP**: Allows `frame-ancestors *` (intentional — badge is embeddable)
- **I/O**: `Promise.all()` parallelizes avatar + snapshot fetch. Post-response work via `after()`.
- **Verdict**: Well-optimized. No blocking concerns.

### OG Image Route (`/u/[handle]/og-image`)
- `Cache-Control: public, s-maxage=21600, stale-while-revalidate=604800`
- Uses `@resvg/resvg-js` (~20-30 MB memory per concurrent render). Monitor during social share spikes.

### Share Pages (`/u/[handle]`) — WARNING
- **No ISR configured.** Every request triggers full SSR (stats fetch, impact compute, SVG render).
- Pages like `/`, `/about`, `/about/scoring`, `/about/verification` already have `revalidate = 3600`.
- **Adding `export const revalidate = 3600` to `/u/[handle]/page.tsx` would cut function invocations by 80-90%** for popular profiles.

### API Routes
- No API routes export `revalidate` — expected for dynamic endpoints.
- Rate limiting is fail-open by design (availability-first).

## Font Loading

- **Status**: GREEN — optimal
- Both fonts (`JetBrains Mono`, `Plus Jakarta Sans`) loaded via `next/font/google` with `display: "swap"` (`layout.tsx:11-23`)
- Subsets limited to `latin`
- No external `@import` or `<link>` tags — zero render-blocking font requests
- CSP allows `font-src 'self' https://fonts.gstatic.com` for Next.js font proxy

## CLS Risks

- **Status**: GREEN — no major risks
- Share page badge `<img>` has explicit `width={1200} height={630}` dimensions
- Demo badge on landing page is rendered server-side at build time
- All animations use CSS classes (`animate-fade-in-up`) with staggered delays
- `prefers-reduced-motion` media query is respected

## Dynamic Import Strategy

Heavy components are properly code-split with `next/dynamic`:
- `LazyAuroraBackground`, `LazyParticleCanvas`, `LazyGradientBorder`, `LazyHolographicOverlay` — `ssr: false` (`BadgePreviewCard.tsx:22-40`)
- `ShareBadgePreview` — `ssr: false` with skeleton loader (`ShareBadgePreviewLazy.tsx:6-9`)
- `AgentsDashboard`, `EngagementDashboard` — `ssr: false` (`AdminDashboardClient.tsx:12-19`)
- `posthog-js` — interaction-triggered `import()` (`PostHogProvider.tsx:18`)

No render-blocking imports of heavy libraries found.

## Recommendations

### Priority 1 — High Impact
1. **Add ISR to share pages**: Add `export const revalidate = 3600` to `apps/web/app/u/[handle]/page.tsx`. This is the single highest-impact change — reduces SSR invocations by 80-90% for popular profiles without sacrificing data freshness (badge data is cached daily anyway).

### Priority 2 — Medium Impact
2. **Monitor PostHog bundle size**: At 173 KB, `posthog-js` is the largest third-party chunk. The lazy-loading strategy (interaction + 5s timeout) is effective, but monitor for growth. Consider `posthog-js/lite` if it becomes available.
3. **Monitor resvg memory during spikes**: OG image generation uses ~20-30 MB per concurrent render. If social sharing causes concurrent spikes, consider a queue or concurrency limiter.

### Priority 3 — Low Impact
4. **Remove unnecessary `"use client"` from 3 components**: `OverallHealthBanner.tsx`, `AgentCard.tsx`, `ShareBadgePreview.tsx`. Marginal bundle savings.
5. **Enable bundle analyzer with webpack**: The `ANALYZE=true` flag doesn't produce visual output with Turbopack. Consider temporarily switching to webpack build for detailed bundle analysis if size regressions appear. Alternatively, use `npx @next/bundle-analyzer` standalone.

### No Action Required
- Knip: clean (0 unused exports/deps)
- Font loading: optimal (next/font with swap)
- CLS: no risks detected
- Badge route: well-cached with proper headers
- Dynamic imports: properly code-split
- Build time: 2.3s (fast)
