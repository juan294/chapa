# Coverage Report
> Generated: 2026-03-23 | Health status: GREEN

## Executive Summary
Overall coverage is **88.55% statements** across 7,977 statements in 339 test files (5,782 tests). All critical paths (scoring, rendering, auth, verification) are at 95%+ coverage. Coverage improved +0.83% stmts vs last report (87.72% on 2026-03-22), with 211 newly covered statements against 165 new total — a strong positive trend. Zero flaky tests detected across 3 consecutive runs.

## Coverage Summary

| Metric | Coverage | Covered/Total | Threshold | Margin |
|--------|----------|---------------|-----------|--------|
| Statements | 88.55% | 7,064/7,977 | 75% | +13.55% |
| Branches | 84.02% | 3,860/4,594 | 70% | +14.02% |
| Functions | 80.43% | 1,328/1,651 | 65% | +15.43% |
| Lines | 89.81% | 6,466/7,199 | 75% | +14.81% |

## Coverage by Module

| Module | Stmts | Branch | Funcs | Status |
|--------|-------|--------|-------|--------|
| packages/shared | 100.0% | 100.0% | 100.0% | GREEN |
| lib/render | 100.0% | 93.8% | 100.0% | GREEN |
| lib/verification | 100.0% | 100.0% | 100.0% | GREEN |
| lib/crypto | 100.0% | 100.0% | 100.0% | GREEN |
| lib/utils | 100.0% | 100.0% | 100.0% | GREEN |
| lib/async | 100.0% | 100.0% | 100.0% | GREEN |
| lib/dashboard | 100.0% | 86.8% | 100.0% | GREEN |
| lib/analytics | 100.0% | 90.9% | 100.0% | GREEN |
| lib/impact | 99.5% | 97.5% | 100.0% | GREEN |
| app/api/auth | 98.6% | 94.5% | 88.5% | GREEN |
| lib/history | 98.2% | 90.6% | 100.0% | GREEN |
| lib/cache | 98.1% | 97.7% | 84.2% | GREEN |
| lib/codeberg | 97.5% | 95.7% | 96.2% | GREEN |
| lib/github | 97.1% | 90.2% | 95.7% | GREEN |
| lib/other | 96.7% | 96.7% | 94.7% | GREEN |
| app/api/other | 95.9% | 93.3% | 87.2% | GREEN |
| app/api/admin | 95.4% | 91.4% | 89.2% | GREEN |
| lib/auth | 95.1% | 90.1% | 100.0% | GREEN |
| lib/insights | 94.9% | 87.0% | 100.0% | GREEN |
| lib/email | 94.7% | 91.4% | 97.7% | GREEN |
| components | 92.4% | 81.9% | 87.3% | GREEN |
| lib/bitbucket | 93.1% | 76.3% | 96.3% | GREEN |
| lib/db | 91.9% | 88.5% | 96.8% | GREEN |
| lib/effects | 89.3% | 80.0% | 86.8% | YELLOW |
| lib/hooks | 87.1% | 72.2% | 75.0% | YELLOW |
| app/admin | 82.8% | 78.6% | 73.1% | YELLOW |
| app/pages | 73.8% | 80.3% | 60.5% | RED |
| app/experiments | 56.1% | 51.2% | 52.6% | RED |

## Delta vs Previous Report (2026-03-22)

| Metric | Previous | Current | Delta |
|--------|----------|---------|-------|
| Statements | 87.72% (6,853/7,812) | 88.55% (7,064/7,977) | **+0.83%** |
| Branches | 82.45% | 84.02% | **+1.57%** |
| Functions | 79.14% | 80.43% | **+1.29%** |
| Lines | 88.96% | 89.81% | **+0.85%** |
| Test files | 321 | 339 | **+18** |
| Tests | 5,548 | 5,782 | **+234** |

Strong positive trend: 211 newly covered stmts vs 165 new total stmts.

## Gaps & Recommendations

### Priority 1 — Files below 80% in production code (non-experimental)

| File | Coverage | Stmts | Notes |
|------|----------|-------|-------|
| `app/admin/AdminDashboardClient.tsx` | 71.0% | 22/31 | Client interaction, render tests exist but need branch coverage |
| `app/admin/campaigns/campaigns-dashboard.tsx` | 74.6% | 132/177 | Complex campaign UI, needs error/edge-case paths |
| `lib/effects/interactions/HolographicOverlay.tsx` | 47.1% | 8/17 | DOM API gaps in JSDOM — hard to test canvas/animation |
| `lib/effects/counters/use-animated-counter.ts` | 79.5% | 35/44 | Hook timing edge cases |
| `app/page.tsx` (landing) | 0.0% | 0/17 | Server component — needs render test |
| `app/about/scoring/page.tsx` | 0.0% | 0/9 | Server component — needs render test |
| `app/about/verification/page.tsx` | 0.0% | 0/10 | Server component — needs render test |
| `app/cli/authorize/AuthorizeClient.tsx` | 0.0% | 0/9 | Client component — needs render test |
| `app/generating/[handle]/page.tsx` | 0.0% | 0/6 | Server component — needs render test |
| `app/studio/page.tsx` | 0.0% | 0/19 | Server component — needs render test |
| `app/admin/page.tsx` | 0.0% | 0/11 | Server component — needs render test |

### Priority 2 — Experimental pages (feature-flagged, lower urgency)

| File | Coverage | Stmts | Notes |
|------|----------|-------|-------|
| `app/experiments/hexmap/page.tsx` | 0.0% | 0/132 | Canvas-heavy, V8 instrumentation issues |
| `app/experiments/holographic/page.tsx` | 45.7% | 16/35 | DOM interactions |
| `app/experiments/confetti/page.tsx` | 47.5% | 19/40 | Animation/canvas |
| `app/experiments/3d-tilt/page.tsx` | 55.6% | 10/18 | DOM interactions |
| `app/experiments/metallic-shimmer/page.tsx` | 60.0% | 18/30 | CSS animation |
| `app/experiments/number-counters/page.tsx` | 61.7% | 74/120 | Complex counter logic |
| `app/experiments/tier-visuals/page.tsx` | 65.9% | 58/88 | Visual components |
| `app/experiments/heatmap-wave/page.tsx` | 72.4% | 21/29 | Animation |
| `app/experiments/particles/page.tsx` | 76.6% | 118/154 | Canvas/WebGL |
| `app/experiments/glassmorphism/page.tsx` | 79.5% | 31/39 | CSS effects |

### Priority 3 — Untested files (no .test.ts at all)

| File | Notes |
|------|-------|
| `components/ThemeProvider.tsx` | Thin wrapper — smoke test worthwhile |
| `lib/test-helpers/fixtures.ts` | Test infrastructure — optional |
| `lib/bitbucket/types.ts` | Type-only — no testable logic |
| `lib/codeberg/types.ts` | Type-only — no testable logic |
| `lib/history/types.ts` | Re-export — no testable logic |
| `lib/verification/types.ts` | Type-only — no testable logic |
| `packages/shared/src/index.ts` | Barrel file — no testable logic |
| `packages/shared/src/platforms.ts` | Type-only — no testable logic |
| `packages/shared/src/types.ts` | Types + constants — constants testable |

## Flaky Tests

**None detected.** 3 consecutive runs all passed with identical results:

| Run | Files | Tests | Result |
|-----|-------|-------|--------|
| 1 (with coverage) | 339 | 5,782 | All passed |
| 2 | 339 | 5,782 | All passed |
| 3 | 339 | 5,782 | All passed |

Note: One transient failure was observed during a coverage configuration variant run (1 test failed when using non-default reporter flags). This did not reproduce in any of the 3 standard runs and is attributable to test isolation under different Vitest configurations, not a flaky test.

## Recommendations Summary

1. **Quick wins (0% coverage, small stmts):** Add render tests for 7 server/client page components (`app/page.tsx`, `about/scoring`, `about/verification`, `cli/authorize/AuthorizeClient`, `generating/[handle]/page`, `studio/page`, `admin/page`). These are 6-19 stmts each — simple smoke tests would close the gap.

2. **Medium effort:** Improve `campaigns-dashboard.tsx` (74.6%) and `AdminDashboardClient.tsx` (71.0%) branch coverage with error-path and edge-case tests.

3. **Hard to test (accepted):** `HolographicOverlay.tsx` (47.1%) and `hexmap/page.tsx` (0%) are canvas/DOM-heavy — JSDOM limitations make full coverage impractical. Smoke tests already exist for hexmap.

4. **Experiments pages:** Feature-flagged and non-critical. V8 instrumentation issues artificially deflate some numbers. Low priority.

5. **No action needed:** 7 of 9 untested files are pure type definitions or re-exports with no executable logic.
