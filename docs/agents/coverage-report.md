# Coverage Report
> Generated: 2026-03-14 | Health status: GREEN

## Executive Summary
Overall coverage is **78.66% statements** (5,541/7,044) across 289 test files with 4,581 tests — all passing with zero flaky tests detected across 3 consecutive runs. All critical path modules remain at 89–100% coverage; the overall figure is slightly down from 78.74% (-0.08%) due to statement count growth (+38 stmts) outpacing test additions (+40 tests).

## Overall Metrics

| Metric | Value | Threshold | Status |
|--------|-------|-----------|--------|
| Statements | 78.66% (5,541/7,044) | 75% | PASS |
| Branches | 74.85% (2,995/4,001) | 70% | PASS |
| Functions | 70.35% (1,018/1,447) | 65% | PASS |
| Lines | 79.78% (5,092/6,382) | 75% | PASS |
| Test Files | 289 | — | — |
| Total Tests | 4,581 | — | — |
| Pass Rate | 100% | — | — |
| Flaky Tests | 0 (3 runs) | — | — |

## Delta vs Previous Report (2026-03-13)

| Metric | Previous | Current | Delta |
|--------|----------|---------|-------|
| Statements | 78.74% (5,517/7,006) | 78.66% (5,541/7,044) | -0.08% |
| Test Files | 283 | 289 | +6 |
| Tests | 4,541 | 4,581 | +40 |
| Flaky | 0 | 0 | — |

The marginal dip reflects 38 new source statements vs 24 newly covered statements. No structural regression — all thresholds pass comfortably.

## Coverage by Critical Module

| Module | Stmts % | Branch % | Funcs % | Files | Status |
|--------|---------|----------|---------|-------|--------|
| `lib/render` | 100.0% | 93.8% | 100.0% | 15 | GREEN |
| `lib/verification` | 100.0% | 100.0% | 100.0% | 3 | GREEN |
| `lib/utils` | 100.0% | 100.0% | 100.0% | 4 | GREEN |
| `lib/impact` | 99.5% | 97.5% | 100.0% | 5 | GREEN |
| `lib/email` | 98.3% | 88.3% | 100.0% | 3 | GREEN |
| `lib/history` | 97.9% | 89.3% | 100.0% | 6 | GREEN |
| `lib/codeberg` | 97.5% | 95.7% | 96.2% | 4 | GREEN |
| `lib/github` | 97.1% | 89.9% | 95.7% | 4 | GREEN |
| `lib/keyboard` | 96.5% | 95.9% | 100.0% | 2 | GREEN |
| `lib/auth` | 94.5% | 88.3% | 100.0% | 7 | GREEN |
| `app/api` (all routes) | 94.7% | 91.2% | 88.9% | 35 | GREEN |
| `lib/db` | 93.5% | 87.5% | 100.0% | 10 | GREEN |
| `lib/insights` | 93.0% | 84.8% | 100.0% | 3 | GREEN |
| `lib/bitbucket` | 93.1% | 76.3% | 96.3% | 4 | GREEN |
| `lib/cache` | 89.2% | 87.2% | 81.2% | 2 | GREEN |
| `packages/shared` | 100.0% | 100.0% | 100.0% | 8 | GREEN |
| `components/dashboard` | 94.8% | 78.5% | 91.4% | 14 | GREEN |
| `components/terminal` | 90.9% | 83.9% | 89.1% | 4 | GREEN |

## Coverage by Non-Critical Module

| Module | Stmts % | Branch % | Funcs % | Files | Status |
|--------|---------|----------|---------|-------|--------|
| `lib/effects` | 65.9% | 67.2% | 77.6% | 17 | YELLOW |
| `app/experiments` | 57.3% | 53.0% | 53.0% | 16 | YELLOW |
| `app/admin` | 56.5% | 53.0% | 49.1% | 20 | YELLOW |
| `app/studio` | 27.0% | 22.8% | 40.0% | 8 | RED |
| `app/verify` | 0.0% | 0.0% | 0.0% | 5 | RED |
| `app/archetypes` | 0.0% | 100.0% | 0.0% | 7 | RED |
| `app/cli` | 0.0% | 0.0% | 0.0% | 2 | RED |
| `app/about` | 0.0% | 0.0% | 0.0% | 5 | RED |

Note: RED modules above are primarily React page components (`.tsx`) that have logic tests but 0% runtime coverage since they are not rendered in test environment. Many have corresponding `.test.ts` files that test exported logic/props rather than rendering.

## Only Critical-Path File Below 80%

| File | Stmts | Uncovered | Status |
|------|-------|-----------|--------|
| `app/api/auth/login/route.ts` | 76.9% (20/26) | 6 stmts — OAuth redirect edge cases | YELLOW |

## Gaps & Recommendations

### P1 — Critical path gaps (should fix)
- **`app/api/auth/login/route.ts`** (76.9%) — Only critical-path file below 80%. 6 uncovered statements are OAuth redirect edge cases. Add tests for missing redirect URL validation and error state handling.

### P2 — Largest untested files by statement count
- **`hexmap/page.tsx`** (132 stmts, 0%) — Canvas-heavy experiment page. Smoke test recommended (render without crash), but full canvas testing is impractical.
- **`StudioClient.tsx`** (119 stmts, 0%) — Core Studio UI component. Has a logic-only test file (`StudioClient.test.tsx` with 36 tests) but runtime coverage is 0%. Needs render tests for interactive flows.
- **`ParticleBackground.tsx`** (112 stmts, 0.9%) — Canvas animation. Has `ParticleBackground.test.ts` (11 tests) but canvas API mocking limits coverage. Smoke test exists.
- **`agents-dashboard.tsx`** (55 stmts, 0%) — Admin agents dashboard UI. Has `agents-dashboard.test.ts` (52 tests) covering logic. Needs render test.
- **`BadgePreviewCard.tsx`** (37 stmts, 0%) — Studio badge preview. Has `BadgePreviewCard.test.tsx` (39 tests) covering logic. Needs render test.
- **`AdminDashboardClient.tsx`** (26 stmts, 0%) — Admin dashboard wrapper. Has `AdminDashboardClient.test.ts` (60 tests). Needs render test.

### P3 — Component coverage gaps
- **`UserMenu.tsx`** (38.9%, 66 uncovered stmts) — Complex interactive component with dropdown, platform connections. `UserMenu.test.tsx` has 47 tests + `UserMenu.render.test.tsx` has 7 render tests, but many interaction paths untested.
- **`BadgeToolbar.tsx`** (20.9%, 72 uncovered stmts) — Badge action toolbar. Has 28 logic tests + 8 render tests. Interactive flows (download, copy, share) need more coverage.
- **`AuthorTypewriter.tsx`** (20.2%, 67 uncovered stmts) — Animation-heavy typewriter effect. Has 14 logic + 7 render tests. Timer/animation logic hard to test.
- **`PostHogProvider.tsx`** (24.1%, 22 uncovered stmts) — Analytics wrapper with conditional initialization. Partially tested.
- **`GlobalCommandBar.tsx`** (66.7%, 17 uncovered stmts) — Command palette. Has 9 logic + 5 render tests. Keyboard interaction paths need more coverage.

### P4 — Page component coverage (0% runtime, logic tested separately)
These pages have 0% runtime coverage but have associated test files testing their exported logic, metadata, or ISR config:
- `app/archetypes/*/page.tsx` (6 pages, 4 stmts each) — ISR config tested in `archetypes-isr.test.ts`
- `app/about/scoring/page.tsx`, `app/about/verification/page.tsx` — Static content pages
- `app/verify/[hash]/page.tsx`, `app/verify/VerifyForm.tsx` — Verify flow, has `VerifyForm.test.tsx`
- `app/admin/page.tsx` — Admin entry, has `page.test.ts`
- `app/cli/authorize/page.tsx` — CLI auth flow, has `AuthorizeClient.test.tsx`
- `app/studio/page.tsx` — Studio entry, has `page.test.tsx`

## Flaky Tests

**None detected.** Three consecutive runs all produced identical results: 289 files, 4,581 tests, 100% pass rate. Previous `window is not defined` flaky behavior has not reproduced in 9 days of runs — considered resolved.

## Notes
- Coverage reporter excludes `apps/web/lib/insights/__fixtures__/claude-code-report.html` (Rollup parse error on HTML fixture — non-issue).
- Statement count increased from 7,006 → 7,044 (+38) since last report, reflecting new code additions.
- All configured coverage thresholds pass: stmts 78.66% > 75%, branches 74.85% > 70%, functions 70.35% > 65%, lines 79.78% > 75%.
