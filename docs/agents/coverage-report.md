# Coverage Report
> Generated: 2026-03-26 | Branch: `develop` | Health status: GREEN

## Executive Summary

Overall coverage is **91.47% statements** (7,283/7,962) across 369 test files and 6,032 tests. All critical paths exceed 90%. No flaky tests detected across 3 consecutive runs. Coverage improved +0.82% stmts since 2026-03-25.

## Coverage Summary

| Metric | Coverage | Covered / Total | Delta vs 2026-03-25 |
|--------|----------|-----------------|---------------------|
| Statements | 91.47% | 7,283 / 7,962 | +0.82% |
| Branches | 85.77% | 3,902 / 4,549 | +0.92% |
| Functions | 86.29% | 1,442 / 1,671 | +0.72% |
| Lines | 92.89% | 6,672 / 7,182 | +0.79% |

Test suite: 369 files (+2), 6,032 tests (+106), 100% pass rate.

## Coverage by Module

### Critical Paths (all GREEN)

| Module | Stmts | Branch | Funcs | Lines | Status |
|--------|-------|--------|-------|-------|--------|
| `lib/impact` | 99.46% | 97.45% | 100% | 100% | GREEN |
| `lib/render` (via components/badge + lib/render) | ~100% | ~100% | ~100% | ~100% | GREEN |
| `packages/shared` | 100% | 100% | 100% | 100% | GREEN |
| `lib/cache` | 98.36% | 97.91% | 87.5% | 100% | GREEN |
| `lib/history` | 98.23% | 90.58% | 100% | 99% | GREEN |
| `lib/codeberg` | 97.52% | 95.74% | 96.15% | 100% | GREEN |
| `lib/github` | 97.12% | 90.24% | 95.65% | 97.4% | GREEN |
| `lib/bitbucket` | 97.22% | 89.47% | 96.29% | 100% | GREEN |
| `app/api` (aggregate) | ~97% | ~93% | ~95% | ~97% | GREEN |
| `lib/db` | 96.70% | 92.70% | 98.41% | 99.18% | GREEN |
| `lib/auth` | 96.27% | 92.92% | 100% | 98.87% | GREEN |
| `lib/email` | 96.15% | 94.07% | 97.22% | 96.21% | GREEN |
| `components` | 91.93% | 85.08% | 83.33% | 95.37% | GREEN |
| `lib/effects` | ~91% | ~82% | ~85% | ~94% | GREEN |

### Non-Critical Paths

| Module | Stmts | Branch | Funcs | Lines | Status |
|--------|-------|--------|-------|-------|--------|
| `app/admin` | 81.92% | 79.37% | 82.25% | 85.8% | YELLOW |
| `app/studio` | 87.60% | 82.45% | 87.05% | 87.55% | GREEN |
| `app/experiments` | 71.42% | ~55% | 33.33% | 71.42% | RED |

## Files Below 80% Statement Coverage

### Admin area (YELLOW)

| File | Stmts | Branch | Funcs | Notes |
|------|-------|--------|-------|-------|
| `app/admin/page.tsx` | 0% | 0% | 0% | Server page — not importable in test env |
| `app/admin/agents-types.ts` | 0% | 0% | 0% | Type definitions only |
| `app/admin/useAdminDashboard.ts` | 81.92% | **48.48%** | 76.47% | Branch coverage gap — error/loading paths |
| `admin/agents/terminal-display.tsx` | 89.65% | **72.41%** | 84.61% | Some branches uncovered |

### Experiments area (RED — accepted limitation)

| File | Stmts | Branch | Funcs | Notes |
|------|-------|--------|-------|-------|
| `experiments/hexmap/page.tsx` | 0% | 0% | 0% | Canvas-heavy, 636 lines, JSDOM limitation |
| `experiments/holographic/page.tsx` | 45.71% | 50% | 45.45% | Canvas/animation-heavy |
| `experiments/confetti/page.tsx` | 47.50% | 40% | 31.57% | Canvas/animation-heavy |
| `experiments/3d-tilt/page.tsx` | 55.55% | 46.15% | 42.85% | DOM API gaps in JSDOM |
| `experiments/metallic-shimmer/page.tsx` | 60% | 28.57% | 50% | Animation/CSS-heavy |
| `experiments/number-counters/page.tsx` | 61.66% | 48.93% | 58.53% | Animation-heavy |
| `experiments/tier-visuals/page.tsx` | 65.90% | 79.48% | 65.51% | Canvas/animation-heavy |
| `experiments/heatmap-wave/page.tsx` | 72.41% | 50% | 60% | Canvas-heavy |
| `experiments/particles/page.tsx` | 76.62% | 59.57% | 62.5% | Canvas-heavy |
| `experiments/glassmorphism/page.tsx` | 79.48% | 68.18% | 78.57% | CSS-heavy |

### Effects & Components (isolated items)

| File | Stmts | Branch | Funcs | Notes |
|------|-------|--------|-------|-------|
| `lib/effects/interactions/HolographicOverlay.tsx` | 47.05% | 86.66% | 75% | JSDOM limitation — accepted |
| `components/ClientAnalytics.tsx` | 0% | 100% | 0% | PostHog wrapper, 0 stmts covered |
| `components/ShareBadgePreviewLazy.tsx` | 40% | 100% | 25% | Lazy wrapper, minimal logic |
| `components/GlobalCommandBarLazy.tsx` | 50% | 100% | 33.33% | Lazy wrapper, minimal logic |

### Root app files (0% — server-only / asset files)

| File | Notes |
|------|-------|
| `app/BoardingTerminal.tsx` | Server component — not importable in test |
| `app/apple-icon.tsx` | Image generation route |
| `app/icon.tsx` | Image generation route |
| `app/layout.tsx` | Root layout — server component |
| `app/favicon.ico` | Static asset |
| `app/studio/page.tsx` | Server page |

## Untested Files (no corresponding .test.ts)

### No test file exists

| File | Risk | Notes |
|------|------|-------|
| `components/ClientAnalytics.tsx` | Low | PostHog wrapper, no logic |
| `app/api/auth/bitbucket/config.ts` | Low | Config constants |
| `app/api/auth/codeberg/config.ts` | Low | Config constants |
| `lib/bitbucket/types.ts` | None | Type-only file (0 runtime code) |
| `lib/codeberg/types.ts` | None | Type-only file (0 runtime code) |
| `lib/history/types.ts` | None | Type-only file (0 runtime code) |
| `packages/shared/src/types.ts` | None | Type-only file (0 runtime code) |
| `packages/shared/src/index.ts` | None | Re-export barrel file |

All untested files are either type definitions, config constants, or thin wrappers with no business logic. No action required.

## Remaining Coverage Gaps (prioritized)

### Priority 1 — Actionable

1. **`app/admin/useAdminDashboard.ts`** — 48.48% branch coverage. Error handling and loading state branches are uncovered. Add tests for error scenarios and edge cases in data fetching.
2. **`app/admin/agents/terminal-display.tsx`** — 72.41% branch coverage. Some rendering branches for terminal output formatting are untested.
3. **`lib/effects/heatmap/HeatmapGrid.tsx`** — 69.44% branch coverage. Tooltip positioning and edge-case grid rendering branches need tests.
4. **`app/admin/campaigns/campaigns-dashboard.tsx`** — 79.68% function coverage. Some campaign action handlers untested.
5. **`lib/email/campaigns.ts`** — 89.0% stmts, 89.28% branch. Email campaign sending edge cases.
6. **`app/studio/BadgePreviewCard.tsx`** — 53.33% function coverage. Preview rendering callbacks need tests.

### Priority 2 — Marginal improvement

7. **`components/UserMenu.tsx`** — 56.66% function coverage. Platform connect/disconnect handlers partially tested.
8. **`components/dashboard/RadarChartInteractive.tsx`** — 64.91% branch coverage. Chart interaction branches.
9. **`components/dashboard/ActivityHeatmap.tsx`** — 65.38% branch coverage. Heatmap cell rendering edge cases.
10. **`lib/effects/backgrounds/ParticleBackground.tsx`** — 72.22% branch coverage. Canvas animation branches (JSDOM limitation).

### Priority 3 — Accepted limitations (no action)

- All `experiments/*` pages — feature-flagged, canvas/animation-heavy, V8/JSDOM testing limitations
- `HolographicOverlay.tsx` — DOM API gaps in JSDOM (47.05% stmts)
- Server pages (`admin/page.tsx`, `studio/page.tsx`, `layout.tsx`) — not importable in test environment
- Lazy wrappers (`ShareBadgePreviewLazy.tsx`, `GlobalCommandBarLazy.tsx`) — minimal logic

## Flaky Tests

**None detected.** All 6,032 tests passed consistently across 3 consecutive runs:
- Run 1: 369 files, 6,032/6,032 passed (45.4s with coverage)
- Run 2: 369 files, 6,032/6,032 passed (45.2s with coverage)
- Run 3: 369 files, 6,032/6,032 passed (19.1s without coverage)

## Threshold Compliance

| Metric | Threshold | Actual | Margin |
|--------|-----------|--------|--------|
| Statements | 75% | 91.47% | +16.47% |
| Branches | 70% | 85.77% | +15.77% |
| Functions | 65% | 86.29% | +21.29% |
| Lines | 75% | 92.89% | +17.89% |

All thresholds pass with >15% margin.
