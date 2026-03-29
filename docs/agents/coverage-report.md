# Coverage Report
> Generated: 2026-03-29 | Branch: `develop` | Health status: **GREEN**

## Executive Summary

Overall coverage is **92.69% statements** across 6,609 tests in 379 files — steady improvement (+0.26% stmts, +195 tests vs 2026-03-28). All critical paths (scoring, rendering, API, DB, auth, cache) are at 96%+ with zero flaky tests across 3 consecutive runs.

## Coverage Summary

| Metric | Coverage | Covered/Total | Delta vs 03-28 |
|--------|----------|---------------|----------------|
| Statements | 92.69% | 7,469 / 8,058 | +0.26% |
| Branches | 88.93% | 4,109 / 4,620 | +0.52% |
| Functions | 88.56% | 1,510 / 1,705 | +0.78% |
| Lines | 93.96% | 6,822 / 7,260 | +0.12% |

Test suite: **379 files, 6,609 tests, 100% pass rate** (~55-75s with coverage).
All thresholds pass with 17%+ margin (75% stmts threshold).

## Coverage by Module

| Module | Stmts | Branch | Funcs | Lines | Files | Status |
|--------|-------|--------|-------|-------|-------|--------|
| `lib/impact` | 100.0% | 98.5% | 100.0% | 100.0% | 5 | GREEN |
| `lib/render` | 100.0% | 93.8% | 100.0% | 100.0% | 11 | GREEN |
| `packages/shared` | 100.0% | 100.0% | 100.0% | 100.0% | 10 | GREEN |
| `lib/verification` | 100.0% | 100.0% | 100.0% | 100.0% | 3 | GREEN |
| `lib/insights` | 100.0% | 92.6% | 100.0% | 100.0% | 3 | GREEN |
| `lib/cache` | 99.2% | 97.9% | 95.8% | 100.0% | 3 | GREEN |
| `lib/history` | 98.2% | 90.6% | 100.0% | 99.0% | 6 | GREEN |
| `lib/auth` | 98.0% | 96.2% | 100.0% | 99.2% | 11 | GREEN |
| `lib/db` | 97.7% | 95.3% | 100.0% | 100.0% | 11 | GREEN |
| `lib/codeberg` | 97.5% | 95.7% | 96.2% | 100.0% | 4 | GREEN |
| `lib/bitbucket` | 97.2% | 89.5% | 96.3% | 100.0% | 4 | GREEN |
| `app/api` | 97.2% | 93.8% | 97.3% | 97.5% | 46 | GREEN |
| `lib/github` | 96.8% | 91.3% | 96.2% | 97.5% | 4 | GREEN |
| `lib/email` | 96.7% | 93.4% | 100.0% | 97.5% | 7 | GREEN |
| `components` | 95.4% | 89.1% | 92.2% | 97.6% | 47 | GREEN |
| `lib/effects` | 94.6% | 90.8% | 94.7% | 95.8% | 17 | GREEN |
| `app/admin` | 93.7% | 89.4% | 87.2% | 95.6% | 21 | GREEN |
| `app/studio` | 87.6% | 83.3% | 87.1% | 87.6% | 8 | YELLOW |
| `app/experiments` | 56.1% | 51.2% | 52.6% | 59.7% | 16 | RED (accepted) |

## Gaps & Recommendations

### P1 — Function coverage <80% (non-experiment, actionable)

| File | Stmts | Funcs | Notes |
|------|-------|-------|-------|
| `app/studio/BadgePreviewCard.tsx` | 81.1% | 53.3% | Interaction callbacks untested |
| `app/admin/AdminDashboardClient.tsx` | 80.6% | 68.4% | Admin panel event handlers |
| `components/SharePageShortcuts.tsx` | 95.7% | 70.0% | Keyboard shortcut handlers |
| `app/api/admin/bulk-recalculate/route.ts` | 86.7% | 71.4% | Helper functions untested |
| `lib/hooks/use-trend-data.ts` | 87.1% | 75.0% | Edge case branches |
| `lib/effects/interactions/HolographicOverlay.tsx` | 47.0% | 75.0% | JSDOM limitation (accepted) |
| `lib/effects/backgrounds/ParticleBackground.tsx` | 90.3% | 77.8% | Canvas animation callbacks |
| `components/InfoTooltip.tsx` | 91.3% | 76.5% | Tooltip positioning helpers |
| `components/UserMenu.tsx` | 94.0% | 78.6% | Menu interaction handlers |

### P2 — Lazy/wrapper components (low risk, JSDOM limitations)

| File | Stmts | Funcs | Notes |
|------|-------|-------|-------|
| `components/ClientAnalytics.tsx` | 0.0% | 0.0% | PostHog wrapper, no DOM to test |
| `components/ShareBadgePreviewLazy.tsx` | 40.0% | 25.0% | `next/dynamic` wrapper, confirmed legitimate |
| `components/GlobalCommandBarLazy.tsx` | 50.0% | 33.3% | `next/dynamic` wrapper, confirmed legitimate |

### P3 — Experiments module (accepted limitation)

The `app/experiments` module at 56.1% is intentionally below threshold — all pages are canvas/WebGL-heavy and cannot be meaningfully tested in JSDOM. This is an accepted limitation carried from previous reports.

## Untested Files

10 files (~1,224 lines) lack a dedicated `.test.ts`/`.test.tsx`:

| File | Lines | Risk | Notes |
|------|-------|------|-------|
| `components/BadgeOverlay.tsx` | 357 | Medium | Has `.render.test.tsx` variants but no unit test |
| `lib/effects/heatmap/HeatmapGrid.tsx` | 311 | Low | Visual component, canvas-heavy |
| `lib/effects/backgrounds/ParticleBackground.tsx` | 230 | Low | Animation component, canvas |
| `lib/test-helpers/platform-auth-fixtures.ts` | 159 | None | Test utility, used by other tests |
| `lib/test-helpers/fixtures.ts` | 102 | None | Test utility |
| `lib/effects/tier/TierVisuals.tsx` | 89 | Low | Visual component |
| `components/SharePageShortcuts.tsx` | 67 | Low | Keyboard shortcuts |
| `lib/test-helpers/admin-auth.ts` | 49 | None | Test utility |
| `components/ThemeProvider.tsx` | 19 | None | Thin `next-themes` wrapper |
| `packages/shared/src/platforms.ts` | 9 | None | Type definitions only |

**Actionable untested files** (excluding test helpers, type defs, thin wrappers): 5 files, ~1,054 lines. `BadgeOverlay.tsx` is the highest-priority gap at 357 lines of interactive overlay logic.

## Flaky Tests

**None detected.** 3 consecutive runs, all 6,609 tests passed in each:

| Run | Files | Tests | Duration | Result |
|-----|-------|-------|----------|--------|
| 1 (with coverage) | 379 | 6,609 | 55.77s | PASS |
| 2 | 379 | 6,609 | 74.68s | PASS |
| 3 | 379 | 6,609 | 74.56s | PASS |

## Delta vs Previous Report (2026-03-28)

| Metric | Previous | Current | Change |
|--------|----------|---------|--------|
| Statements | 92.43% | 92.69% | +0.26% |
| Branches | 88.41% | 88.93% | +0.52% |
| Functions | 87.78% | 88.56% | +0.78% |
| Lines | 93.84% | 93.96% | +0.12% |
| Test files | 378 | 379 | +1 |
| Tests | 6,414 | 6,609 | +195 |

Trend: steady improvement across all metrics. Functions coverage saw the largest gain (+0.78%).
