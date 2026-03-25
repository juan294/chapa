# Coverage Report
> Generated: 2026-03-24 | Branch: `develop` | Health status: GREEN

## Executive Summary

Overall statement coverage is **88.69%** (7,072/7,974) across 309 tracked files, with 345 test files containing 5,723 tests — all passing with zero flaky tests across 3 consecutive runs. All critical paths (scoring, rendering, API, auth, cache, verification) are at 91%+ coverage. Thresholds pass with 13%+ margin.

## Coverage Summary

| Metric | Coverage | Covered/Total |
|--------|----------|---------------|
| Statements | 88.69% | 7,072 / 7,974 |
| Branches | 84.19% | 3,856 / 4,580 |
| Functions | 80.64% | 1,333 / 1,653 |
| Lines | 89.96% | 6,471 / 7,193 |

**Delta vs 2026-03-23:** +0.14% stmts (7,064 → 7,072 covered, 7,977 → 7,974 total). Stable positive trend.

## Coverage by Module

| Module | Stmts | Branch | Funcs | Status |
|--------|-------|--------|-------|--------|
| `lib/impact` | 99.5% | 97.5% | 100.0% | GREEN |
| `lib/render` | 100.0% | 93.8% | 100.0% | GREEN |
| `lib/verification` | 100.0% | 100.0% | 100.0% | GREEN |
| `packages/shared` | 100.0% | 100.0% | 100.0% | GREEN |
| `lib/history` | 98.2% | 90.6% | 100.0% | GREEN |
| `lib/cache` | 98.1% | 97.7% | 84.2% | GREEN |
| `lib/codeberg` | 97.5% | 95.7% | 96.2% | GREEN |
| `lib/github` | 97.1% | 90.2% | 95.7% | GREEN |
| `app/api` | 96.4% | 92.9% | 88.2% | GREEN |
| `lib/auth` | 95.2% | 90.7% | 100.0% | GREEN |
| `lib/insights` | 94.9% | 87.0% | 100.0% | GREEN |
| `lib/email` | 94.7% | 91.4% | 97.7% | GREEN |
| `lib/bitbucket` | 93.1% | 76.3% | 96.3% | GREEN |
| `components` | 92.5% | 81.9% | 87.6% | GREEN |
| `lib/db` | 91.9% | 88.5% | 96.8% | GREEN |
| `lib/effects` | 90.7% | 80.5% | 88.2% | GREEN |
| `app/studio` | 86.8% | 82.5% | 84.7% | YELLOW |
| `app/admin` | 83.0% | 78.6% | 73.7% | YELLOW |
| `app/pages` | 68.1% | 83.3% | 44.0% | RED |
| `app/experiments` | 56.1% | 51.2% | 52.6% | RED |
| `other` | 97.1% | 93.3% | 95.5% | GREEN |

## Critical Path Files Below 90%

These are files in security/scoring/API/DB critical paths that need attention:

| File | Coverage | Stmts |
|------|----------|-------|
| `lib/db/user-platforms.ts` | 81.8% | 63/77 |
| `app/api/admin/campaigns/[id]/test/route.ts` | 83.3% | 30/36 |
| `app/api/cron/sync-audience/route.ts` | 84.6% | 44/52 |
| `lib/db/campaigns.ts` | 89.0% | 146/164 |

## Gaps & Recommendations

### Priority 1 — Server page components at 0% (quick wins, 1-3 stmts each)
These are mostly thin server components with minimal logic, but should have basic render tests:
- `app/page.tsx` (17 stmts) — landing page server component
- `app/studio/page.tsx` (19 stmts) — studio page server component
- `app/admin/page.tsx` (11 stmts) — admin page server component
- `app/about/verification/page.tsx` (10 stmts) — verification about page
- `app/about/scoring/page.tsx` (9 stmts) — scoring about page
- `app/generating/[handle]/page.tsx` (6 stmts) — generating page

### Priority 2 — Admin components below 80%
- `app/admin/AdminDashboardClient.tsx` — 71.0% (22/31 stmts). Needs error-path and edge-case branch tests.
- `app/admin/campaigns/campaigns-dashboard.tsx` — 75.1% (133/177 stmts). Needs error-path tests for campaign operations.

### Priority 3 — Experiment pages (low priority, feature-flagged)
- `app/experiments/hexmap/page.tsx` — 0% (132 stmts). Canvas-heavy, V8 instrumentation issues. Accepted limitation.
- `app/experiments/holographic/page.tsx` — 45.7% (16/35 stmts). DOM API gaps in JSDOM.
- `app/experiments/confetti/page.tsx` — 47.5% (19/40 stmts). Animation-heavy.
- `app/experiments/3d-tilt/page.tsx` — 55.6% (10/18 stmts).
- `app/experiments/metallic-shimmer/page.tsx` — 60.0% (18/30 stmts).
- `app/experiments/number-counters/page.tsx` — 61.7% (74/120 stmts).
- `app/experiments/tier-visuals/page.tsx` — 65.9% (58/88 stmts).
- `app/experiments/heatmap-wave/page.tsx` — 72.4% (21/29 stmts).
- `app/experiments/particles/page.tsx` — 76.6% (118/154 stmts).
- `app/experiments/glassmorphism/page.tsx` — 79.5% (31/39 stmts).

### Priority 4 — Effects interaction layer
- `lib/effects/interactions/HolographicOverlay.tsx` — 47.1% (8/17 stmts). JSDOM lacks full DOM API for overlay calculations. Accepted limitation.

### Not actionable (0% but trivial — 1-4 stmts, re-export wrappers)
54 files at 0% are thin wrappers (error.tsx, loading.tsx, icon.tsx, archetype pages). These are 1-4 statement server components tested indirectly via their parent route tests. Adding direct coverage would be low value.

## Flaky Tests

**None detected.** All 3 consecutive runs produced identical results:
- Run 1: 345 files, 5,723 tests, 0 failures (37.31s)
- Run 2: 345 files, 5,723 tests, 0 failures (30.64s)
- Run 3: 345 files, 5,723 tests, 0 failures (30.64s)

## Test Suite Health

| Metric | Value |
|--------|-------|
| Test files | 345 |
| Total tests | 5,723 |
| Pass rate | 100% |
| Flaky tests | 0 |
| Avg run time | ~33s |
| Coverage provider | V8 |
| Threshold: statements | 75% (actual: 88.69%, margin: +13.69%) |
| Threshold: branches | 70% (actual: 84.19%, margin: +14.19%) |
| Threshold: functions | 65% (actual: 80.64%, margin: +15.64%) |
| Threshold: lines | 75% (actual: 89.96%, margin: +14.96%) |
