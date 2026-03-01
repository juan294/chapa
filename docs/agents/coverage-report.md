# Coverage Report
> Generated: 2026-03-01 | Health status: **green**

## Executive Summary

All 272 test files (4,232 tests) pass consistently across 3 runs with zero flaky tests. Corrected overall coverage is **78.4% statements** (excluding a config bug that scans `packages/shared/node_modules.nosync/`). All 8 critical path modules (impact, render, API routes, db, github, auth, cache, history) have 88–100% statement coverage and 100% test file coverage — every source file has a corresponding `.test.ts`.

## Coverage by Module

| Module | Files | Stmts | Branch | Funcs | Status |
|--------|-------|-------|--------|-------|--------|
| lib/impact | 5 | 99.4% | 97.0% | 100.0% | GREEN |
| lib/render | 15 | 100.0% | 94.7% | 100.0% | GREEN |
| lib/auth | 7 | 94.1% | 88.3% | 100.0% | GREEN |
| lib/github | 4 | 97.1% | 89.6% | 95.7% | GREEN |
| lib/email | 3 | 98.3% | 88.3% | 100.0% | GREEN |
| lib/history | 6 | 97.8% | 90.3% | 100.0% | GREEN |
| lib/db | 9 | 93.0% | 87.6% | 100.0% | GREEN |
| lib/cache | 2 | 88.9% | 87.2% | 80.0% | GREEN |
| app/api | 32 | 95.5% | 91.0% | 89.5% | GREEN |
| lib/agents | 2 | 100.0% | 100.0% | 100.0% | GREEN |
| lib/other | 24 | 96.7% | 93.0% | 98.1% | GREEN |
| lib/hooks | 1 | 87.1% | 72.2% | 75.0% | GREEN |
| lib/effects | 17 | 65.9% | 67.2% | 77.6% | YELLOW |
| components | 41 | 74.4% | 68.3% | 72.2% | YELLOW |
| app/pages | 86 | 53.6% | 52.1% | 47.1% | YELLOW |
| packages/shared | 8* | 85.0%* | 79.2%* | 92.3%* | GREEN* |
| **TOTAL (corrected)** | **264** | **78.4%** | **74.4%** | **70.3%** | |

> *packages/shared: corrected values exclude `node_modules.nosync/typescript/` (165K stmts of TS compiler), which is a coverage config bug — `packages/shared/**` glob picks up the symlinked node_modules directory.

## Critical Path Test File Coverage

All critical modules have **100% test file coverage** (every source file has a `.test.ts`):

| Critical Path | Source Files | Test Files | Coverage |
|---------------|-------------|------------|----------|
| lib/impact | 6 | 6 | 100% |
| lib/render | 11 | 11 | 100% |
| app/api routes | 32 | 32 | 100% |
| lib/db | 9 | 9 | 100% |
| lib/github | 4 | 4 | 100% |
| lib/auth | 7 | 7 | 100% |
| lib/cache | 2 | 2 | 100% |
| lib/history | 5 | 5 | 100% |
| **Total** | **76** | **76** | **100%** |

## Gaps & Recommendations

### Config Bug (fix first)

- **`packages/shared/node_modules.nosync/`** is being scanned by v8 coverage. Add `**/node_modules.nosync/**` to `vitest.config.ts` coverage excludes. This is why overall coverage reports ~3% instead of ~78%.

### Components with <80% coverage (8 files)

These are UI-heavy components where test coverage is harder but still beneficial:

- `components/AuthorTypewriter.tsx` — 20% (84 stmts) — animation/interaction heavy
- `components/BadgeToolbar.tsx` — 21% (91 stmts) — toolbar interactions
- `components/PostHogProvider.tsx` — 24% (29 stmts) — analytics wrapper
- `components/UserMenu.tsx` — 55% (71 stmts) — dropdown menu states
- `components/GlobalCommandBar.tsx` — 67% (51 stmts) — command palette
- `components/MobileNav.tsx` — 68% (38 stmts) — mobile navigation
- `components/ShortcutCheatSheet.tsx` — 69% (48 stmts) — keyboard shortcuts dialog
- `components/terminal/TerminalInput.tsx` — 77% (57 stmts) — close to threshold

### App pages with 0% coverage (high-value targets)

- `app/page.tsx` — 0% (17 stmts) — **landing page**, highest user impact
- `app/studio/StudioClient.tsx` — 0% (119 stmts) — **Creator Studio**, core feature
- `app/studio/BadgePreviewCard.tsx` — 0% (37 stmts)
- `app/studio/page.tsx` — 0% (18 stmts)
- `app/admin/AdminDashboardClient.tsx` — 0% (26 stmts)
- `app/admin/agents/agents-dashboard.tsx` — 0% (55 stmts)
- `app/admin/agents/overall-health-banner.tsx` — 0% (17 stmts)
- `app/admin/agents/agent-toggles-table.tsx` — 0% (12 stmts)
- `app/cli/authorize/page.tsx` — 0% (14 stmts)
- `app/verify/VerifyForm.tsx` — 0% (13 stmts)
- `app/verify/[hash]/page.tsx` — 0% (12 stmts)
- `app/experiments/hexmap/page.tsx` — 0% (132 stmts) — largest untested experiment

### lib/effects — 65.9% overall

- `lib/effects/backgrounds/ParticleBackground.tsx` — 1% (113 stmts) — canvas-heavy, hard to unit test
- `lib/effects/interactions/HolographicOverlay.tsx` — 47% (17 stmts)

### Priority recommendations

1. **Fix coverage config** — add `**/node_modules.nosync/**` to excludes in `vitest.config.ts`
2. **Studio pages** — `StudioClient.tsx` (119 stmts at 0%) is the biggest untested feature
3. **Landing page** — `app/page.tsx` should have basic render tests
4. **Admin dashboard** — several 0% admin components need at least smoke tests
5. **Components** — `BadgeToolbar.tsx` and `AuthorTypewriter.tsx` are the largest uncovered components

## Flaky Tests

**None detected.** All 3 runs produced identical results:
- Run 1: 272 passed, 4,232 tests, 0 failures
- Run 2: 272 passed, 4,232 tests, 0 failures
- Run 3: 272 passed, 4,232 tests, 0 failures

## Test Suite Metrics

| Metric | Value |
|--------|-------|
| Test files | 272 |
| Total tests | 4,232 |
| Pass rate | 100% |
| Suite duration | ~110–120s |
| Flaky tests | 0 |
| Coverage thresholds | 75% stmts, 70% branch, 65% funcs, 75% lines |
| Threshold met (corrected) | stmts 78.4% YES, branch 74.4% YES, funcs 70.3% YES |
