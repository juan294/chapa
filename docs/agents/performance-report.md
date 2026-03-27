# Performance Report
> Generated: 2026-03-26 | Health status: GREEN

## Executive Summary

Build compiles in 3.0s (Turbopack) with 0 TypeScript errors. Total client JS is 1,800 KB (1.76 MB) across 71 chunks — no chunk exceeds 500 KB. Knip reports **0 findings** (fully clean). Font loading, CLS prevention, badge caching, and dynamic imports are all optimal. No regressions since last report (2026-03-12); total JS increased by ~366 KB (+25%) due to new features (campaigns, engagement dashboards, additional experiments), which is proportional growth with no individual chunk exceeding thresholds.

## Build Output

- **Compiler**: Next.js 16.2.1 (Turbopack)
- **Compile time**: 3.0s
- **TypeScript errors**: 0
- **Static pages generated**: 63 (11 workers, 393ms)
- **Total routes**: 82 (5 static, 77 dynamic)

| Chunk | Size (KB) | Contents | Status |
|-------|-----------|----------|--------|
| `0x~..e.8sn6o..js` | 228 | Next.js framework / runtime | GREEN |
| `08ejob94x411n.js` | 176 | PostHog analytics SDK | GREEN |
| `0qg7f~h3ny-im.js` | 136 | React DOM streaming runtime | GREEN |
| `03~yq9q893hmn.js` | 112 | Core-js / polyfills | GREEN |
| `0reyiuqw~c4-k.js` | 64 | Application code | GREEN |
| `12imygs--7n__.js` | 60 | Application code | GREEN |
| `0q5ms8d.aw1ps.js` | 60 | Application code | GREEN |
| `0s9.cqo3ngzzb.js` | 56 | Application code | GREEN |
| All remaining (63) | <52 each | Various | GREEN |

**No chunk exceeds 500 KB.** Largest is 228 KB (Next.js framework).

## Bundle Analysis

- **Total client JS**: 1,800 KB (1.76 MB) across 71 chunks
- **Largest chunk**: 228 KB (Next.js framework runtime)
- **Chunks >100 KB**: 4 (framework: 228 KB, PostHog: 176 KB, React DOM: 136 KB, polyfills: 112 KB)
- **Unused exports (knip)**: 0 — fully clean (resolved from 60 unused exports + 42 unused types in 2026-03-12)
- **Delta vs 2026-03-12**: +366 KB total (+25%). Proportional to new features added (campaigns dashboard, engagement dashboard, CLI auth, additional experiments). No individual regressions.

## Client/Server Boundary

**120 files** with `"use client"` directive (including test files).

**Previously flagged files (2026-03-12) — all resolved:**
- `overall-health-banner.tsx` — `"use client"` **removed** (now a server component). RESOLVED.
- `ShareBadgePreviewLazy.tsx` — Retains `"use client"` correctly (wraps `next/dynamic` with `ssr: false`, which requires client context). Legitimate.
- `GlobalCommandBarLazy.tsx` — Same pattern as above. Legitimate.

**Current audit**: All 120 `"use client"` files examined. No unnecessary directives found. Pattern is correct: client directives are on leaf interactive components (event handlers, hooks, browser APIs) and lazy-loading wrappers.

## Dynamic Imports (Code Splitting)

9 components properly code-split via `next/dynamic` with `ssr: false`:

| Component | Location | Loading UI |
|-----------|----------|------------|
| `AuroraBackground` | `BadgePreviewCard.tsx` | Empty div |
| `ParticleCanvas` | `BadgePreviewCard.tsx` | Empty div |
| `GradientBorder` | `BadgePreviewCard.tsx` | Empty div |
| `HolographicOverlay` | `BadgePreviewCard.tsx` | Empty div |
| `AgentsDashboard` | `AdminDashboardClient.tsx` | "Loading agents..." |
| `EngagementDashboard` | `AdminDashboardClient.tsx` | "Loading engagement..." |
| `CampaignsDashboard` | `AdminDashboardClient.tsx` | "Loading campaigns..." |
| `GlobalCommandBar` | `GlobalCommandBarLazy.tsx` | None |
| `ShareBadgePreview` | `ShareBadgePreviewLazy.tsx` | Skeleton placeholder |
| `ShortcutCheatSheet` | `KeyboardShortcutsListener.tsx` | None |
| `Analytics` | `ClientAnalytics.tsx` | None |
| `SpeedInsights` | `ClientAnalytics.tsx` | None |

All heavy visual effects and admin dashboards are properly deferred.

## Font Loading

- **Status**: OPTIMAL
- Uses `next/font/google` for both fonts (self-hosted, no external requests)
- `JetBrains Mono`: weights 400, 500, 700, 800; `display: "swap"`; Latin subset
- `Plus Jakarta Sans`: weights 400–700; `display: "swap"`; Latin subset
- No `@import url()` or external `<link>` font tags found
- Fonts injected as CSS variables: `--font-jetbrains-mono`, `--font-plus-jakarta`

## CLS Risks

- **Status**: NONE
- All `<Image>` components have explicit `width`/`height` attributes
- No bare `<img>` tags without dimensions
- All visual assets are inline SVG or base64 data URIs
- Share page uses `<BadgeSkeleton />` during loading (prevents layout shift)
- Share page uses ISR (`revalidate=3600`) — content typically pre-rendered

## Caching & Headers

### Badge SVG (`/u/[handle]/badge.svg`)
- **Success**: `Cache-Control: public, s-maxage=21600, stale-while-revalidate=604800` (6h cache, 7d SWR)
- **Error fallback**: `Cache-Control: public, s-maxage=300, stale-while-revalidate=600` (5min cache, 10min SWR)
- **Embed headers**: `Content-Security-Policy: frame-ancestors *`, `X-Frame-Options: ALLOWALL`
- Correctly differentiated caching for success vs. error states

### Share Page (`/u/[handle]`)
- ISR with `revalidate=3600` (1 hour) — prevents unnecessary server renders

## Recommendations

No action items. All metrics are within healthy thresholds:

1. ~~Remove 3 unnecessary `"use client"` directives~~ — **RESOLVED** (1 removed, 2 confirmed legitimate)
2. ~~Clean up 60+ unused exports flagged by knip~~ — **RESOLVED** (knip now fully clean, 0 findings)
3. ~~Add ISR to share page~~ — **RESOLVED** (`revalidate=3600` in place with test assertion)

**Monitoring items (carried):**
- **OG image Redis memory**: ~62% of estimated Redis usage at 10K users. Consider blob storage at 50K+ users. (Source: cost-analyst 2026-03-26)
- **PostHog chunk**: 176 KB, lazy-loaded on first interaction. Optimal but worth monitoring if SDK grows.
- **Total JS growth**: +25% vs last report. Expected given feature additions. Monitor for sustained growth beyond feature scope.
