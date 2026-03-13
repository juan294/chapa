# Performance Report
> Generated: 2026-03-12 | Health status: GREEN

## Executive Summary

Build is healthy with 0 TypeScript errors, 1,434 KB total client JS across 53 chunks, and no chunk exceeding 500 KB. All previously flagged issues (share page ISR, hardcoded hex colors) are resolved. Knip reports 60 unused exports and 42 unused exported types — a regression from the clean state reported on 2026-03-05, likely from accumulated test-only exports and internal functions that grew visible after refactoring. Studio page remains forced dynamic due to `headers()` import but impact is marginal.

## Build Output

| Metric | Value |
|--------|-------|
| Next.js version | 16.1.6 (Turbopack) |
| Compile time | 2.7s |
| TypeScript errors | 0 |
| Static pages generated | 60 (in 663.5ms) |
| Total routes | 81 (5 static, 5 ISR, 71 dynamic) |

### Route Configuration

| Route | Config | Status |
|-------|--------|--------|
| `/` (landing) | `revalidate=3600` (ISR) | GREEN |
| `/u/[handle]` (share page) | `revalidate=3600` (ISR) | GREEN — previously SSR, now ISR |
| `/u/[handle]/badge.svg` | Dynamic, `s-maxage=21600` | GREEN |
| `/about`, `/about/scoring`, `/about/verification` | `revalidate=3600` (ISR) | GREEN |
| `/studio` | Forced dynamic (`headers()`) | YELLOW — can't ISR due to auth/feature-flag check |
| `/experiments/*` | `force-dynamic` (layout) | GREEN — intentional |
| `/admin` | Dynamic | GREEN — requires auth |

## Bundle Analysis

### Client-Side JS Chunks (Top 10)

| Chunk | Size | Likely Content |
|-------|------|----------------|
| `484c69d...` | 219 KB | Next.js framework/React runtime |
| `2bff844...` | 175 KB | posthog-js (lazy-loaded on interaction) |
| `a6dad97...` | 110 KB | App component tree |
| `70c742e...` | 108 KB | App component tree |
| `f24d475...` | 58 KB | Shared utilities |
| `059fc5d...` | 58 KB | Shared utilities |
| `1fc5e92...` | 54 KB | Component chunk |
| `b369b7e...` | 52 KB | Component chunk |
| `0ad5d3a...` | 44 KB | Component chunk |
| `bc053d5...` | 44 KB | Component chunk |

### Summary

| Metric | Value | Status |
|--------|-------|--------|
| Total client JS | 1,434 KB (1.4 MB) | GREEN |
| Total chunks | 53 | — |
| Chunks >500 KB | 0 | GREEN |
| Chunks >300 KB | 0 | GREEN |
| Chunks >100 KB | 4 | GREEN |
| Largest chunk | 219 KB (framework) | GREEN |
| Server JS total | 6,292 KB | — |

### Knip (Unused Code Detection)

| Category | Count | Status |
|----------|-------|--------|
| Unused files | 280 | YELLOW — all are `.test.ts` files (knip miscounts test files as unused without config) |
| Unused dependencies | 1 (`@chapa/shared`) | YELLOW |
| Unused devDependencies | 3 (`eslint-plugin-import`, `eslint-plugin-jsx-a11y`, `eslint-plugin-react-hooks`) | YELLOW |
| Unlisted dependencies | 2 (`postcss`, `postcss-load-config`) | YELLOW — used by PostCSS config |
| Unused exports | 60 | YELLOW |
| Unused exported types | 42 | YELLOW |

**Knip detail — unused exports breakdown:**
- **Test-only exports** (19): Internal functions prefixed with `_` exposed for testing (`_resetClient`, `_resetInflight`, `_resetFlagCache`, `_parseNumeric`, `_normalize`, etc.) — these are intentional test hooks
- **Impact scoring internals** (7): `computeDelivery`, `computeQuality`, `computeConsistency`, `computeBreadth`, `computeDimensions`, `detectProfileType`, `deriveArchetype` — exported for test access, composed internally
- **Effects/animation exports** (10): `fadeInDelay`, `diagonalDelay`, `rippleDelay`, `scatterDelay`, `columnCascadeDelay`, `rowWaterfallDelay`, `HOLOGRAPHIC_CSS`, `GRADIENT_BORDER_CSS`, `GLASS_PRESETS`, `easings` — library-style exports, some used only in experiment pages
- **Legitimate unused** (24): `ImpactBreakdown`, `createAdminCommands`, `parseCommand`, `cacheMGet`, `dbHasLinkedPlatform`, `TIER_ORDER`, `AdminUserTableRow`, `renderMarkdown`, `clearPlatformStatusCache`, `OAUTH_ERROR_CODES`, `MERGE_OPS_RETENTION_DAYS`, `MERGE_OPS_CLEANUP_BATCH_SIZE`, `CLEANUP_BATCH_SIZE`, `ARTIFICER_STATS`, `ARTIFICER_IMPACT`, `fetchAvatarBase64`, `getFontPaths`, `stripSvgAnimations`, `buildPayload`, `computeHash`, `isAgentEnabled`, `explainDiff`, `getLatestSnapshot`, `applyEMA`, `sanitizeHtml`, `CONFIDENCE_REASONS`

**Recommendation:** Add a `knip.json` config to exclude test files and `_`-prefixed test hooks. Then audit the 24 legitimately unused exports for removal — estimated ~2–5 KB bundle savings.

## Client/Server Boundary

### "use client" Audit

| Metric | Value |
|--------|-------|
| Total files with `"use client"` | 82 (excluding tests) |
| Legitimate usage | 79 (96%) |
| Removable | 3 (4%) |

**Removable "use client" directives (marginal impact):**

1. **`components/ShareBadgePreviewLazy.tsx`** — Dynamic import wrapper only, no client APIs. The wrapped component (`ShareBadgePreview`) is already client-side.
2. **`components/GlobalCommandBarLazy.tsx`** — Dynamic import wrapper only, no client APIs.
3. **`app/admin/agents/overall-health-banner.tsx`** — Pure presentational component, no state/hooks/event handlers.

**Impact:** Removing these would not meaningfully reduce bundle size but improves architectural clarity.

### Dynamic Imports (Code Splitting)

7 files use `next/dynamic` with `ssr: false`:

| Component | Loaded From | Heavy Content |
|-----------|-------------|---------------|
| `AuroraBackground` | `BadgePreviewCard.tsx` | Canvas animation |
| `ParticleCanvas` | `BadgePreviewCard.tsx` | Canvas particles |
| `GradientBorder` | `BadgePreviewCard.tsx` | CSS effects |
| `HolographicOverlay` | `BadgePreviewCard.tsx` | Hover effects |
| `GlobalCommandBar` | `GlobalCommandBarLazy.tsx` | Command palette |
| `ShareBadgePreview` | `ShareBadgePreviewLazy.tsx` | Interactive badge |
| `AgentsDashboard` | `AdminDashboardClient.tsx` | Admin agents tab |
| `EngagementDashboard` | `AdminDashboardClient.tsx` | Admin engagement tab |
| `ShortcutCheatSheet` | `KeyboardShortcutsListener.tsx` | Overlay |

All heavy components are properly code-split. No render-blocking synchronous imports of large libraries found.

### PostHog Loading Strategy

PostHog (`posthog-js`, 175 KB) is **interaction-deferred**:
- Not loaded on page load or component mount
- Triggers on first user interaction (`click`, `scroll`, `keydown`)
- Fallback: loads after 5 seconds if no interaction
- Tracking functions (`trackEvent`) are null-safe — no-op before initialization

This is optimal for LCP and TTI.

## Caching & Headers

### Badge SVG Route (`/u/[handle]/badge.svg`)

| Header | Value | Status |
|--------|-------|--------|
| `Cache-Control` | `public, s-maxage=21600, stale-while-revalidate=604800` | GREEN |
| `Content-Type` | `image/svg+xml` | GREEN |
| `Content-Security-Policy` | `frame-ancestors *` | GREEN |
| `X-Frame-Options` | `ALLOWALL` | GREEN |

Error fallback SVG uses shorter TTL: `s-maxage=300, stale-while-revalidate=600` — appropriate for transient errors.

### ISR Configuration

| Route | Revalidate | Status |
|-------|-----------|--------|
| `/` | 3600s (1h) | GREEN |
| `/u/[handle]` | 3600s (1h) | GREEN — **RESOLVED** from last report |
| `/about/*` | 3600s (1h) | GREEN |

Share page ISR (`revalidate=3600`) is now in place with a test assertion at `page.test.ts:120` confirming the export. This was the #1 actionable item from the 2026-03-05 report.

## Font Loading

| Font | Method | Display | Weights | Status |
|------|--------|---------|---------|--------|
| JetBrains Mono | `next/font/google` | `swap` | 400, 500, 700, 800 | GREEN |
| Plus Jakarta Sans | `next/font/google` | `swap` | 400, 500, 600, 700 | GREEN |

No external font @import statements. No render-blocking font requests. Optimal.

## CLS Risks

| Risk Area | Finding | Status |
|-----------|---------|--------|
| Images without dimensions | No bare `<img>` tags found — all visual assets use inline SVG or base64 data URIs | GREEN |
| Dynamic content above fold | Animations use CSS classes (no layout shift) | GREEN |
| Font swap | `display: "swap"` on both fonts | GREEN |
| Skeleton loaders | 8 loading states with `role="status"` | GREEN |

## Delta vs Previous Report (2026-03-05)

| Metric | 2026-03-05 | 2026-03-12 | Change |
|--------|-----------|-----------|--------|
| Total client JS | 1,376 KB | 1,434 KB | +58 KB (+4.2%) |
| Total chunks | 52 | 53 | +1 |
| Largest chunk | 219 KB | 219 KB | No change |
| Knip unused exports | 0 | 60 + 42 types | Regression (see below) |
| Share page ISR | Missing | `revalidate=3600` | **RESOLVED** |
| `"use client"` removable | 3 | 3 | No change |

**Client JS increase (+58 KB):** Moderate increase likely from new features/components added since last report. All chunks remain well under 500 KB threshold. No action needed.

**Knip regression:** The previous report stated "0 unused exports" but this run finds 60 exports + 42 types. This is likely because (a) knip was run without a config file in both cases and the tool version or detection changed, or (b) new exports were added without consumers. The 280 "unused files" are all test files — knip needs a config file to exclude them. Recommendation: create `knip.json` and audit the 24 genuinely unused exports.

## Recommendations

### Priority 1 — Housekeeping (Low effort, improves tooling)
1. **Create `knip.json`** configuration to exclude test files (`**/*.test.{ts,tsx}`) and declare test-hook exports (`_`-prefixed functions) as intentional. This will eliminate 280 false-positive "unused files" and ~19 false-positive exports.
2. **Audit 24 genuinely unused exports** — remove dead code or mark as intentionally exported. Estimated ~2–5 KB bundle savings.
3. **Remove 3 unnecessary `"use client"` directives** — `ShareBadgePreviewLazy.tsx`, `GlobalCommandBarLazy.tsx`, `overall-health-banner.tsx`. Marginal impact but improves architecture.

### Priority 2 — Dependency cleanup
4. **Remove 3 unused devDependencies** — `eslint-plugin-import`, `eslint-plugin-jsx-a11y`, `eslint-plugin-react-hooks`. These are likely superseded by the current ESLint config.
5. **Add `postcss` and `postcss-load-config`** to `devDependencies` if not already declared (knip flags them as unlisted).
6. **Verify `@chapa/shared`** usage — knip flags it as unused from `package.json` but it may be consumed via TypeScript path aliases.

### Priority 3 — Monitoring
7. **OG image cache (cost-analyst recommendation):** Redis memory dominated by OG image cache (~5 GB @ 10K users). Consider migrating to Vercel Blob or reducing TTL from 7d to 24–48h before scale hits 15K DAU.
8. **Studio page ISR:** Currently forced dynamic due to `headers()` import (for session reading) and `isStudioEnabled()` DB call. Low traffic page — no action needed now, but if Studio traffic grows, consider moving the feature-flag check to middleware or client-side.

### No Action Needed
- Bundle sizes are healthy (all under 300 KB, no chunk over 500 KB)
- PostHog lazy-loading is optimal
- Font loading via `next/font` is optimal
- Badge SVG caching headers are correct
- All heavy components are properly code-split
- No CLS risks detected
- Share page ISR is now in place and tested
