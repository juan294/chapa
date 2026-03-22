# Coverage Report
> Generated: 2026-03-22 | Health status: GREEN

## Executive Summary

Test coverage is **87.72% statements** (6,853/7,812) across 302 source files, with **5,548 tests in 321 test files — all passing**. All critical paths (scoring, rendering, API routes, database, auth, cache) are above 90%. No flaky tests detected across 3 consecutive runs. Coverage is up +0.32% statements vs last report (2026-03-21: 87.40%).

## Overall Metrics

| Metric | Value | Threshold | Margin |
|--------|-------|-----------|--------|
| Statements | 87.72% (6,853/7,812) | 75% | +12.72% |
| Branches | 82.45% (3,690/4,475) | 70% | +12.45% |
| Functions | 79.14% (1,275/1,611) | 65% | +14.14% |
| Lines | 88.96% (6,265/7,042) | 75% | +13.96% |

## Coverage by Module

### Critical Paths (all GREEN)

| Module | Stmts | Covered/Total | Status |
|--------|-------|---------------|--------|
| lib/render | 100.0% | 246/246 | GREEN |
| lib/verification | 100.0% | 14/14 | GREEN |
| packages/shared | 100.0% | 68/68 | GREEN |
| lib/impact | 99.5% | 187/188 | GREEN |
| lib/cache | 98.1% | 103/105 | GREEN |
| lib/history | 98.2% | 111/113 | GREEN |
| app/api/auth | 98.6% | 282/286 | GREEN |
| lib/github | 97.1% | 167/172 | GREEN |
| lib/codeberg | 97.5% | 118/121 | GREEN |
| app/api/admin | 97.0% | 319/329 | GREEN |
| app/api/cron | 94.0% | 142/151 | GREEN |
| lib/db | 94.7% | 555/586 | GREEN |
| lib/auth | 94.7% | 267/282 | GREEN |
| lib/email | 94.7% | 303/320 | GREEN |
| lib/insights | 94.9% | 243/256 | GREEN |
| lib/bitbucket | 93.1% | 134/144 | GREEN |
| components | 90.7% | 1,286/1,418 | GREEN |
| lib/effects | 88.8% | 364/410 | GREEN |

### Supporting Modules

| Module | Stmts | Covered/Total | Status |
|--------|-------|---------------|--------|
| lib/crypto | 100.0% | 7/7 | GREEN |
| lib/async | 100.0% | 21/21 | GREEN |
| lib/analytics | 100.0% | 32/32 | GREEN |
| lib/dashboard | 100.0% | 55/55 | GREEN |
| lib/utils | 100.0% | 15/15 | GREEN |
| lib/keyboard | 96.5% | 82/85 | GREEN |
| lib/validation | 97.3% | 73/75 | GREEN |
| app/studio | 87.1% | 210/241 | GREEN |
| lib/hooks | 87.1% | 27/31 | GREEN |
| app/u (share page) | 89.7% | 113/126 | GREEN |

### Below Threshold

| Module | Stmts | Covered/Total | Status | Notes |
|--------|-------|---------------|--------|-------|
| app/admin (pages) | 79.1% | 406/513 | YELLOW | AdminDashboardClient (0%), agent pages (0%) |
| app/generating | 80.4% | 45/56 | GREEN | Borderline |
| app/experiments | 56.2% | 421/749 | RED | Feature-flagged experiment pages, V8 instrumentation issues |
| app/about | 0.0% | 0/24 | RED | Static content pages, low risk |
| app/archetypes | 0.0% | 0/30 | RED | Static archetype showcase pages |
| app/verify | 0.0% | 0/29 | RED | Verify form + page components |
| app/cli | 0.0% | 0/24 | RED | CLI authorize client + page |
| app/privacy | 0.0% | 0/5 | RED | Static page |
| app/terms | 0.0% | 0/5 | RED | Static page |

## Gaps & Recommendations

### Priority 1 — Components with Significant Untested Logic

- **`app/verify/VerifyForm.tsx`** (13 stmts, 0%) — Client-side verification form with user interaction. Should have render tests.
- **`app/verify/[hash]/page.tsx`** (12 stmts, 0%) — Verification result page with conditional rendering.
- **`app/admin/AdminDashboardClient.tsx`** (31 stmts, 0%) — Admin dashboard client component.
- **`app/admin/agents/overall-health-banner.tsx`** (17 stmts, 0%) — Agent health banner with conditional logic.
- **`app/admin/agents/agent-toggles-table.tsx`** (12 stmts, 0%) — Agent toggles with branching.
- **`components/Navbar.tsx`** (9 stmts, 0%) — Navigation bar with auth-aware rendering.
- **`components/NavbarClient.tsx`** (7 stmts, 0%) — Client-side navbar with interactive elements.
- **`components/CopyButton.tsx`** (8 stmts, 0%) — Copy to clipboard with feedback state.
- **`app/cli/authorize/page.tsx`** (14 stmts, 0%) — CLI auth flow page.

### Priority 2 — Experiment Pages (low risk, feature-flagged)

- **`app/experiments/hexmap/page.tsx`** (132 stmts, 0%) — Canvas-heavy, hardest to test.
- **`app/experiments/confetti/page.tsx`** (21 uncovered stmts, 47.5%)
- **`app/experiments/number-counters/page.tsx`** (46 uncovered stmts, 61.7%)
- **`app/experiments/tier-visuals/page.tsx`** (30 uncovered stmts, 65.9%)
- **`app/experiments/metallic-shimmer/page.tsx`** (12 uncovered stmts, 60.0%)
- **`app/experiments/particles/page.tsx`** (36 uncovered stmts, 76.6%)

### Priority 3 — Low-Risk Static Pages

- 7 archetype pages (4 stmts each, 0%) — All follow same template pattern. One smoke test covering the shared `ArchetypeLayout` would cover all.
- `app/about/page.tsx`, `app/about/scoring/page.tsx`, `app/about/verification/page.tsx` — Static content.
- `app/privacy/page.tsx`, `app/terms/page.tsx` — Static legal pages.

### Priority 4 — Framework/Infrastructure Files

- `app/layout.tsx` (5 stmts, 0%) — Root layout, rarely changes.
- `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx` — Error boundaries, 1 stmt each.
- `app/loading.tsx` — Loading state, 1 stmt.
- `ThemeProvider.tsx` (2 stmts, 0%) — Thin wrapper around `next-themes`.

### Other Notable Observations

- **`lib/effects/interactions/HolographicOverlay.tsx`** (47.1%) — Complex interaction handler, testing limited by JSDOM DOM API gaps.
- **`lib/effects/counters/use-animated-counter.ts`** (75.0%) — Animation hook, edge cases around RAF timing.
- **Previous report item `PostHogProvider.tsx` (24.1%)** — Still lowest-coverage production component. Difficult to test due to PostHog SDK initialization.

## Untested Files (No Corresponding .test.ts)

### Critical Path
- `components/ThemeProvider.tsx` (19 lines) — thin wrapper, low risk

### Non-Critical
- 7 archetype pages (161–190 lines each) — static content, same template
- `app/terms/page.tsx` (110 lines) — static legal content
- `packages/shared/src/types.ts` (357 lines) — type-only file, no runtime logic
- `lib/bitbucket/types.ts` (91 lines) — type-only file
- `lib/codeberg/types.ts` (69 lines) — type-only file
- `app/admin/agents-types.ts` (26 lines) — type-only file
- Various error/loading boundary files (11–61 lines each) — boilerplate

## Flaky Tests

**None detected.** Three consecutive full test suite runs all produced identical results:
- Run 1: 321 files, 5,548 tests — all passed
- Run 2: 321 files, 5,548 tests — all passed
- Run 3: 321 files, 5,548 tests — all passed

Previous flaky test (`BadgeToolbar.render.test.tsx`) did not reproduce. Considered resolved.

## Delta vs Previous Report (2026-03-21)

| Metric | Previous | Current | Delta |
|--------|----------|---------|-------|
| Statements | 87.40% (6,758/7,732) | 87.72% (6,853/7,812) | +0.32% |
| Test files | 320 | 321 | +1 |
| Tests | 5,518 | 5,548 | +30 |
| Flaky tests | 0 | 0 | stable |

Coverage increased slightly. 80 new statements added to codebase (+7,732→7,812), with 95 newly covered (+6,758→6,853), netting a positive delta. The 9 macOS duplicate files previously inflating the denominator have been cleaned up by triage.

## Vitest Warnings

- `UserMenu.render.test.tsx` — nested `vi.mock()` will become an error in a future Vitest version (carried from previous report, still present).
