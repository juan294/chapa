# Coverage Report
> Generated: 2026-03-07 | Health status: GREEN

## Executive Summary
Overall coverage holds steady at **78.5% statements** (5,111/6,514) with all 8 critical modules between 88–100%. The test suite is fully stable: 272 files, 4,238 tests, 100% pass rate, 0 flaky tests across 3 consecutive runs.

## Overall
| Metric | Covered | Total | Percentage |
|--------|---------|-------|------------|
| Statements | 5,111 | 6,514 | 78.46% |
| Branches | 2,686 | 3,609 | 74.42% |
| Functions | 964 | 1,370 | 70.36% |
| Lines | 4,701 | 5,902 | 79.65% |

## Coverage by Module

| Module | Stmts | Branch | Funcs | Lines | Status |
|--------|-------|--------|-------|-------|--------|
| packages/shared | 100.0% | 100.0% | 100.0% | 100.0% | GREEN |
| lib/render | 100.0% | 94.7% | 100.0% | 100.0% | GREEN |
| lib/utils | 100.0% | 100.0% | 100.0% | 100.0% | GREEN |
| lib/agents | 100.0% | 100.0% | 100.0% | 100.0% | GREEN |
| lib/dashboard | 100.0% | 88.2% | 100.0% | 100.0% | GREEN |
| lib/impact | 99.4% | 97.2% | 100.0% | 100.0% | GREEN |
| lib/email | 98.3% | 88.3% | 100.0% | 98.8% | GREEN |
| lib/history | 97.8% | 90.3% | 100.0% | 98.8% | GREEN |
| lib/codeberg | 97.5% | 95.7% | 96.2% | 100.0% | GREEN |
| lib/github | 97.1% | 89.6% | 95.7% | 97.4% | GREEN |
| lib/keyboard | 96.5% | 95.9% | 100.0% | 97.3% | GREEN |
| lib/other | 96.2% | 93.7% | 96.9% | 99.2% | GREEN |
| app/api | 95.5% | 91.0% | 89.5% | 95.8% | GREEN |
| lib/auth | 94.1% | 88.3% | 100.0% | 98.7% | GREEN |
| lib/db | 93.0% | 87.6% | 100.0% | 96.1% | GREEN |
| lib/bitbucket | 93.1% | 76.3% | 96.3% | 95.3% | GREEN |
| app/u (share) | 89.9% | 76.0% | 71.4% | 90.4% | GREEN |
| lib/cache | 88.9% | 87.2% | 80.0% | 91.0% | GREEN |
| components | 74.4% | 68.3% | 72.2% | 76.1% | YELLOW |
| lib/effects | 65.9% | 67.2% | 77.6% | 66.3% | YELLOW |
| app/experiments | 57.4% | 53.0% | 53.2% | 60.8% | RED |
| app/admin | 56.5% | 53.0% | 49.1% | 58.3% | RED |
| app/pages | 45.7% | 53.3% | 30.2% | 43.4% | RED |
| app/studio | 27.1% | 22.8% | 40.5% | 27.0% | RED |

## Critical Path Coverage (all GREEN)

| Critical Module | Stmts | Notes |
|-----------------|-------|-------|
| lib/render (SVG rendering) | 100.0% | Full coverage |
| lib/impact (scoring pipeline) | 99.4% | Near-perfect |
| lib/history (lifetime metrics) | 97.8% | Strong |
| lib/github (data fetching) | 97.1% | Strong |
| app/api (API routes) | 95.5% | Strong |
| lib/auth (authentication) | 94.1% | Strong |
| lib/db (database layer) | 93.0% | Strong |
| lib/cache (Redis caching) | 88.9% | Solid |

Only critical-path file below 80%: `app/api/auth/login/route.ts` at 76.9% (6 uncovered statements — OAuth redirect edge cases).

## Gaps & Recommendations

### Large Untested Files (0% coverage, >10 stmts)
- `app/experiments/hexmap/page.tsx` — 132 stmts, experimental UI
- `app/studio/StudioClient.tsx` — 119 stmts, Creator Studio main client component
- `app/admin/agents/agents-dashboard.tsx` — 55 stmts, admin agent dashboard UI
- `app/studio/BadgePreviewCard.tsx` — 37 stmts, studio preview card
- `app/admin/AdminDashboardClient.tsx` — 26 stmts, admin dashboard client
- `app/studio/page.tsx` — 18 stmts, studio page wrapper
- `app/page.tsx` — 17 stmts, landing page
- `app/admin/agents/overall-health-banner.tsx` — 17 stmts, health banner
- `app/cli/authorize/page.tsx` — 14 stmts, CLI auth page
- `app/verify/VerifyForm.tsx` — 13 stmts, verification form
- `app/verify/[hash]/page.tsx` — 12 stmts, verification page
- `app/admin/agents/agent-toggles-table.tsx` — 12 stmts, agent toggles
- `app/admin/page.tsx` — 11 stmts, admin page wrapper
- `app/about/verification/page.tsx` — 10 stmts, about verification

### Partially Covered Files (<80%, >20 stmts)
| File | Stmts | Coverage | Uncovered |
|------|-------|----------|-----------|
| `lib/effects/backgrounds/ParticleBackground.tsx` | 113 | 0.9% | 112 |
| `components/AuthorTypewriter.tsx` | 84 | 20.2% | 67 |
| `components/BadgeToolbar.tsx` | 91 | 20.9% | 72 |
| `components/PostHogProvider.tsx` | 29 | 24.1% | 22 |
| `app/experiments/holographic/page.tsx` | 35 | 45.7% | 19 |
| `app/experiments/confetti/page.tsx` | 40 | 47.5% | 21 |
| `app/admin/agents/cross-agent-insights.tsx` | 25 | 48.0% | 13 |
| `components/UserMenu.tsx` | 71 | 54.9% | 32 |
| `app/experiments/metallic-shimmer/page.tsx` | 30 | 60.0% | 12 |
| `app/experiments/number-counters/page.tsx` | 120 | 61.7% | 46 |
| `app/experiments/tier-visuals/page.tsx` | 88 | 65.9% | 30 |
| `components/GlobalCommandBar.tsx` | 51 | 66.7% | 17 |
| `components/MobileNav.tsx` | 38 | 68.4% | 12 |
| `components/ShortcutCheatSheet.tsx` | 48 | 68.8% | 15 |
| `app/experiments/heatmap-wave/page.tsx` | 29 | 72.4% | 8 |
| `app/experiments/particles/page.tsx` | 154 | 76.6% | 36 |
| `app/api/auth/login/route.ts` | 26 | 76.9% | 6 |
| `components/terminal/TerminalInput.tsx` | 57 | 77.2% | 13 |

### Priority Test Additions (by impact)
1. **`app/api/auth/login/route.ts`** (76.9%) — only critical-path file below 80%; 6 uncovered stmts in OAuth redirect edge cases
2. **`components/UserMenu.tsx`** (54.9%) — user-facing component with 32 uncovered stmts
3. **`components/GlobalCommandBar.tsx`** (66.7%) — interactive navigation with 17 uncovered stmts
4. **`components/MobileNav.tsx`** (68.4%) — mobile navigation with 12 uncovered stmts
5. **`components/ShortcutCheatSheet.tsx`** (68.8%) — keyboard shortcuts UI with 15 uncovered stmts
6. **`components/terminal/TerminalInput.tsx`** (77.2%) — main input component with 13 uncovered stmts

### Low-Priority (UI-heavy, non-critical)
- `StudioClient.tsx` (119 stmts, 0%) — complex client component, would benefit from smoke tests
- `ParticleBackground.tsx` (112 stmts, 0.9%) — canvas-heavy, smoke test recommended
- `AuthorTypewriter.tsx` (84 stmts, 20.2%) — animation-heavy component
- `BadgeToolbar.tsx` (91 stmts, 20.9%) — toolbar with interactive states
- All `app/experiments/*` pages — experimental UI, lowest priority

## Stability vs Previous Report (2026-03-06)
| Metric | Previous | Current | Delta |
|--------|----------|---------|-------|
| Statements | 78.5% | 78.5% | 0.0% |
| Test files | 272 | 272 | 0 |
| Test count | 4,238 | 4,238 | 0 |
| Pass rate | 100% | 100% | 0% |
| Critical modules <80% | 1 | 1 | 0 |

Coverage is stable — no regressions, no new tests added since last report.

## Flaky Tests
None detected. All 4,238 tests passed consistently across 3 consecutive runs with identical results. The stderr noise from `generate/route.test.ts`, `verify/[hash]/route.test.ts`, and `refresh/route.test.ts` is from intentional error-handling tests (testing 500 responses by throwing "unexpected boom") — not actual failures.
