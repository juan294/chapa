# Coverage Report
> Generated: 2026-04-15 | Health status: YELLOW

## Executive Summary

Overall coverage is **93.14% statements** across 390 test files and 7,001 tests — all passing with zero flaky tests detected across 3 consecutive runs. All critical scoring and rendering paths are at 100%. The YELLOW status is due to experiment pages (Canvas/WebGL) sitting at 56.1% — an accepted limitation of JSDOM testing.

## Coverage by Module

| Module | Stmts % | Branch % | Funcs % | Lines % | Status |
|--------|---------|----------|---------|---------|--------|
| packages/shared | 100.0 | 100.0 | 100.0 | 100.0 | GREEN |
| lib/impact | 100.0 | 98.5 | 100.0 | 100.0 | GREEN |
| lib/render | 100.0 | 92.7 | 100.0 | 100.0 | GREEN |
| lib/analytics | 100.0 | 90.9 | 100.0 | 100.0 | GREEN |
| lib/cache | 99.2 | 97.9 | 95.8 | 100.0 | GREEN |
| lib/history | 98.2 | 96.5 | 100.0 | 99.0 | GREEN |
| lib/auth | 98.1 | 96.4 | 100.0 | 99.2 | GREEN |
| lib/email | 97.9 | 96.7 | 100.0 | 98.1 | GREEN |
| app/api | 97.6 | 94.8 | 97.4 | 97.8 | GREEN |
| lib/db | 97.6 | 95.2 | 100.0 | 99.8 | GREEN |
| lib/other | 97.3 | 92.9 | 97.4 | 98.5 | GREEN |
| lib/github | 96.8 | 91.9 | 96.2 | 97.5 | GREEN |
| app/u (share/badge) | 96.1 | 94.8 | 94.7 | 96.7 | GREEN |
| components | 96.0 | 90.1 | 93.9 | 98.2 | GREEN |
| app/pages | 95.1 | 95.6 | 96.0 | 95.6 | GREEN |
| app/admin | 94.9 | 92.0 | 91.4 | 96.2 | YELLOW |
| app/studio | 90.4 | 82.8 | 95.3 | 89.3 | YELLOW |
| app/experiments | 56.1 | 51.2 | 52.6 | 59.7 | RED |

### Overall

| Metric | Value |
|--------|-------|
| Statements | 93.14% (7585/8143) |
| Branches | 89.88% (4211/4685) |
| Functions | 90.01% (1541/1712) |
| Lines | 94.31% (6916/7333) |

## Gaps & Recommendations

### P2 — Actionable (below 80% in non-experiment code)

- **`components/UserMenu.tsx`** — 79.3% funcs (handleInsightsFile untested). Low complexity.
- **`components/ShareBadgePreviewLazy.tsx`** — 40% stmts. Lazy-loaded wrapper, dynamic import hard to exercise.
- **`components/GlobalCommandBarLazy.tsx`** — 50% stmts. Same lazy-wrapper pattern.
- **`app/api/refresh/route.ts`** — 75% funcs. Fire-and-forget `after()` callback not captured in test.
- **`app/admin/page.tsx`** — 0% (server component with auth redirect, tested via integration).
- **`app/studio/page.tsx`** — 0% (server component, tested via StudioClient).

### P3 — Accepted limitations (JSDOM / Canvas / WebGL)

These experiment pages rely on Canvas 2D, WebGL, or requestAnimationFrame which JSDOM cannot execute:

| File | Stmts % | Reason |
|------|---------|--------|
| experiments/hexmap | 0.0 | Canvas 2D |
| experiments/holographic | 45.7 | WebGL overlay |
| experiments/confetti | 47.5 | Canvas particles |
| experiments/3d-tilt | 55.6 | CSS 3D transforms + rAF |
| experiments/metallic-shimmer | 60.0 | Canvas shaders |
| experiments/number-counters | 61.7 | rAF counters |
| experiments/tier-visuals | 65.9 | Canvas + SVG |
| experiments/heatmap-wave | 72.4 | Canvas animation |
| experiments/particles | 76.6 | Canvas particles |
| experiments/glassmorphism | 79.5 | CSS backdrop-filter |

### P3 — Branch-only gaps (stmts 100%, branches < 80%)

- **`lib/render/archetypeDemoData.ts`** — 50% branches (switch fallthrough)
- **`lib/render/demoData.ts`** — 50% branches (switch fallthrough)
- **`lib/render/svg-to-png.ts`** — 66.7% branches (font file existence fallback)

### Untested files (no corresponding .test.ts)

Only 3 files in critical paths lack a dedicated test file:

| File | Notes |
|------|-------|
| `apps/web/app/api/auth/bitbucket/config.ts` | Config constants — covered via route tests |
| `apps/web/app/api/auth/codeberg/config.ts` | Config constants — covered via route tests |
| `apps/web/lib/history/types.ts` | Type-only file — no runtime code |

### Other 0% files (structural, not gaps)

| File | Reason |
|------|--------|
| `app/layout.tsx` | Root layout (Next.js bootstraps, not unit-testable) |
| `app/apple-icon.tsx` / `app/icon.tsx` | Static icon generation (ImageResponse) |
| `app/cli/authorize/error.tsx` | Error boundary (triggered by framework) |
| `components/ClientAnalytics.tsx` | PostHog wrapper (side-effect only) |

## Flaky Tests

**None detected.** 3 consecutive runs: 7001/7001 passed each time.

| Run | Tests | Passed | Failed | Duration |
|-----|-------|--------|--------|----------|
| 1 | 7001 | 7001 | 0 | 75.3s |
| 2 | 7001 | 7001 | 0 | 45.3s |
| 3 | 7001 | 7001 | 0 | 56.4s |

## Delta vs Previous Report (2026-04-13)

| Metric | Previous | Current | Delta |
|--------|----------|---------|-------|
| Statements | 93.14% | 93.14% | +0.00pp |
| Branches | 89.86% | 89.88% | +0.02pp |
| Functions | 90.01% | 90.01% | +0.00pp |
| Lines | 94.31% | 94.31% | +0.00pp |
| Tests | 7001 | 7001 | +0 |
| Files | 390 | 390 | +0 |
| Flaky | 0 | 0 | +0 |

Plateau-stable. No code changes since 2026-04-12 (only agent report updates and dev dep bumps).
