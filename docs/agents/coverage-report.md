# Coverage Report
> Generated: 2026-03-15 | Health status: GREEN

## Executive Summary

Overall coverage at **80.1% statements** (5,690/7,103) across 294 test files and 4,713 tests — all passing, 0 flaky. All critical-path modules (impact, render, auth, API routes, DB, cache) are at 89%+ statements. Coverage rose +1.44% stmts vs prior report (78.66%). All configured thresholds pass (stmts 75%, branches 70%, funcs 65%, lines 75%).

## Overall Metrics

| Metric | Coverage | Count | Threshold | Status |
|--------|----------|-------|-----------|--------|
| Statements | 80.10% | 5,690/7,103 | 75% | PASS |
| Branches | 76.05% | 3,075/4,043 | 70% | PASS |
| Functions | 72.17% | 1,048/1,452 | 65% | PASS |
| Lines | 81.28% | 5,232/6,437 | 75% | PASS |

## Coverage by Module

### Critical Paths (all above 80%)

| Module | Stmts | Branch | Funcs | Lines | Status |
|--------|-------|--------|-------|-------|--------|
| `lib/render` | 100% | 93.75% | 100% | 100% | GREEN |
| `lib/verification` | 100% | 100% | 100% | 100% | GREEN |
| `lib/utils` | 100% | 100% | 100% | 100% | GREEN |
| `lib/impact` | 99.46% | 97.45% | 100% | 100% | GREEN |
| `lib/email` | 98.33% | 88.31% | 100% | 98.82% | GREEN |
| `lib/history` | 98.23% | 90.58% | 100% | 99% | GREEN |
| `lib/codeberg` | 97.52% | 95.74% | 96.15% | 100% | GREEN |
| `lib/github` | 97.09% | 89.91% | 95.65% | 97.36% | GREEN |
| `lib/keyboard` | 96.47% | 95.89% | 100% | 97.29% | GREEN |
| `lib` (root: env, flags, validation) | 95.74% | 97.82% | 88.88% | 97.14% | GREEN |
| `lib/auth` | 94.48% | 88.28% | 100% | 99.11% | GREEN |
| `lib/insights` | 92.96% | 84.84% | 100% | 93.07% | GREEN |
| `lib/db` | 93.45% | 87.5% | 100% | 96.6% | GREEN |
| `lib/bitbucket` | 93.05% | 76.31% | 96.29% | 95.31% | GREEN |
| `lib/cache` | 89.24% | 87.17% | 81.25% | 91.35% | GREEN |
| `lib/agents` | 100% | 100% | 100% | 100% | GREEN |
| `lib/analytics` | 100% | 90.9% | 100% | 100% | GREEN |
| `lib/dashboard` | 100% | 86.84% | 100% | 100% | GREEN |
| `lib/hooks` | 87.09% | 72.22% | 75% | 96.42% | GREEN |
| `packages/shared/src` | 100% | 100% | 100% | 100% | GREEN |

### API Routes (aggregate: 94.7%+ stmts)

| Route | Stmts | Branch | Status |
|-------|-------|--------|--------|
| `api/auth/login` | 100% | 93.75% | GREEN |
| `api/auth/callback` | 93.1% | 81.08% | GREEN |
| `api/auth/logout` | 100% | 100% | GREEN |
| `api/auth/session` | 100% | 100% | GREEN |
| `api/auth/bitbucket/*` | 100% | 100% | GREEN |
| `api/auth/codeberg/*` | 100% | 100% | GREEN |
| `api/cli/auth/approve` | 94.44% | 100% | GREEN |
| `api/cli/auth/poll` | 100% | 100% | GREEN |
| `api/generate` | 100% | 100% | GREEN |
| `api/health` | 100% | 100% | GREEN |
| `api/recalculate` | 100% | 100% | GREEN |
| `api/refresh` | 100% | 92.85% | GREEN |
| `api/verify/[hash]` | 100% | 100% | GREEN |
| `api/insights` | 95.23% | 100% | GREEN |
| `api/insights/[handle]` | 100% | 100% | GREEN |
| `api/history/[handle]` | 95.23% | 91.42% | GREEN |
| `api/cron/warm-cache` | 98.9% | 92.5% | GREEN |
| `api/webhooks/resend` | 96.66% | 95.23% | GREEN |
| `api/studio/config` | 92.3% | 85.71% | GREEN |
| `api/supplemental` | 81.08% | 77.77% | GREEN |
| `api/telemetry` | 100% | 100% | GREEN |
| `api/feature-flags` | 100% | 100% | GREEN |
| `api/admin/stats` | 100% | 100% | GREEN |
| `api/admin/users` | 96.42% | 90.62% | GREEN |
| `api/admin/agents-summary` | 96.96% | 92.85% | GREEN |
| `api/admin/agents/run` | 84.11% | 80% | GREEN |
| `api/admin/feature-flags` | 93.1% | 95% | GREEN |
| `api/admin/engagement-flags` | 89.47% | 70% | YELLOW |
| `api/notifications/unsubscribe` | 100% | 100% | GREEN |

### Components (aggregate: 58.54% stmts)

| Component | Stmts | Status | Notes |
|-----------|-------|--------|-------|
| `dashboard/*` | 94.8% | GREEN | All dashboard components well-tested |
| `terminal/*` | 90.9% | GREEN | |
| `badge/BadgeContent` | 94.11% | GREEN | |
| `ImpactBreakdown` | 97.72% | GREEN | |
| `InfoTooltip` | 91.3% | GREEN | |
| `BadgeOverlay` | 100% | GREEN | |
| `KeyboardShortcutsListener` | 95.16% | GREEN | |
| `ThemeToggle` | 85.71% | GREEN | |
| `Toast` | 85.71% | GREEN | |
| `ConfirmDialog` | 87.5% | GREEN | |
| `ShortcutCheatSheet` | 68.75% | YELLOW | 37-58,78 uncovered |
| `GlobalCommandBar` | 66.66% | YELLOW | 92-98,104-115 uncovered |
| `MobileNav` | 68.42% | YELLOW | 31-49 uncovered |
| `BadgeToolbar` | 54.94% | RED | 72 uncovered stmts, 37.5% funcs |
| `StudioClient` | 47.89% | RED | 119 stmts at ~48% |
| `UserMenu` | 39.81% | RED | 66 uncovered stmts, 36.66% funcs |
| `PostHogProvider` | 24.13% | RED | Analytics wrapper |
| `AuthorTypewriter` | 20.23% | RED | Canvas animation |

### Pages (non-API)

| Page | Stmts | Status | Notes |
|------|-------|--------|-------|
| `u/[handle]` (share page) | 83.72% | GREEN | |
| `u/[handle]/badge.svg` | 91.11% | GREEN | |
| `u/[handle]/og-image` | 100% | GREEN | |
| `generating/[handle]` | 81.81% | GREEN | |
| `admin` | 66.86% | YELLOW | AdminDashboardClient at 0% |
| `studio` | 50.62% | RED | StudioClient 48%, BadgePreviewCard 0% |
| `experiments/*` | 0-86% | YELLOW | Experimental pages, mixed coverage |
| `about`, `about/scoring`, `about/verification` | 0% | RED | Static pages |
| `archetypes/*` (6 pages) | 0% | RED | Static ISR pages |
| `verify`, `verify/[hash]` | 0% | RED | VerifyForm + verification display |
| `cli/authorize` | 0% | RED | CLI auth client component |
| `privacy`, `terms` | 0% | RED | Static legal pages |
| `page.tsx` (landing) | 0% | RED | 401-line landing page |

### Effects Library

| Module | Stmts | Status |
|--------|-------|--------|
| `effects/borders` | 100% | GREEN |
| `effects/cards` | 100% | GREEN |
| `effects/celebrations` | 100% | GREEN |
| `effects/text` | 100% | GREEN |
| `effects/heatmap` | 88.33% | GREEN |
| `effects/tier` | 85.71% | GREEN |
| `effects/counters` | 93.1% | GREEN |
| `effects/interactions` | 76.92% | YELLOW |
| `effects/backgrounds` | 9.67% | RED |

## Gaps & Recommendations

### Priority 1 — Critical-path files below 80%

- **`api/admin/engagement-flags/route.ts`** — 89.47% stmts but only 70% branch coverage. Add branch edge case tests.

### Priority 2 — High-value untested/low-coverage components

1. **`UserMenu.tsx`** (576 lines, 39.81% stmts) — Core navigation component with platform link/unlink flows. 66 uncovered stmts including multi-platform disconnect logic (lines 260-555).
2. **`BadgeToolbar.tsx`** (349 lines, 54.94% stmts) — Badge action bar with download/share. 72 uncovered stmts, only 37.5% function coverage.
3. **`StudioClient.tsx`** (314 lines, 47.89% stmts) — Creator Studio main client. Large interactive component with 35.48% branch coverage.
4. **`BadgePreviewCard.tsx`** (197 lines, 0% stmts) — Studio preview card, entirely untested.
5. **`GlobalCommandBar.tsx`** (148 lines, 66.66% stmts) — Command palette with 60% function coverage.
6. **`AuthorTypewriter.tsx`** (214 lines, 20.23% stmts) — Canvas-based typewriter animation.
7. **`MobileNav.tsx`** (122 lines, 68.42% stmts) — Responsive navigation.

### Priority 3 — Untested pages

8. **`verify/[hash]/page.tsx`** (297 lines, 0%) — Badge verification display page.
9. **`verify/VerifyForm.tsx`** (72 lines, 0%) — Verification form component.
10. **`cli/authorize` pages** (76 lines combined, 0%) — CLI device auth flow.
11. **`page.tsx` (landing)** (480 lines, 0%) — Main landing page. Large but mostly presentational.
12. **Archetype pages** (6 pages, ~22 lines each, all 0%) — Static ISR pages, low risk but easy to smoke-test.
13. **`about/*` pages** (3 pages, all 0%) — Static content pages.
14. **`privacy`, `terms`** (19 lines each, 0%) — Static legal pages, low risk.

### Priority 4 — Effects & utilities

15. **`effects/backgrounds/ParticleBackground.tsx`** (112 stmts, 0.9%) — Canvas-heavy, difficult to unit test. Smoke test recommended.
16. **`effects/interactions/HolographicOverlay.tsx`** (47.05% stmts) — Interactive overlay with low coverage.

### Not recommended to test

- **Font files** (`lib/render/fonts/*.ttf`) — Binary assets, 0% coverage is expected.
- **`favicon.ico`, `apple-icon.tsx`, `icon.tsx`** — Image generation, minimal logic.
- **`layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`** — Framework boilerplate, low ROI.
- **`PostHogProvider.tsx`** (24.13%) — Thin analytics wrapper, testing would be mostly mocking.

## Delta vs Prior Report (2026-03-14)

| Metric | Previous | Current | Delta |
|--------|----------|---------|-------|
| Statements | 78.66% (5,541/7,044) | 80.10% (5,690/7,103) | **+1.44%** |
| Branches | 74.85% | 76.05% | **+1.20%** |
| Functions | 70.35% | 72.17% | **+1.82%** |
| Lines | 79.78% | 81.28% | **+1.50%** |
| Test files | 289 | 294 | +5 |
| Total tests | 4,581 | 4,713 | +132 |

Source grew by +59 stmts (7,044 -> 7,103), but coverage grew faster (+149 newly covered stmts). Strong positive trajectory.

## Flaky Tests

**None detected.** 4 consecutive runs (including the coverage run) all passed 4,713/4,713 tests across 294 files. The "2 errors" in one run were v8 coverage provider warnings during report generation, not test failures. Previous `window is not defined` flaky issue has not reproduced in 10+ days — considered resolved.

## Test Suite Health

| Metric | Value |
|--------|-------|
| Test files | 294 |
| Total tests | 4,713 |
| Pass rate | 100% |
| Flaky tests | 0 |
| Duration | ~21-24s |
| Environment | jsdom (component tests), node (unit/API tests) |
