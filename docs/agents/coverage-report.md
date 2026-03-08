# Coverage Report
> Generated: 2026-03-08 | Health status: GREEN

## Executive Summary

Overall coverage holds steady at **78.5% statements** with all **4,280 tests passing** across 273 test files. All 8 critical-path modules maintain 88–100% coverage. The coverage gap is concentrated in UI-heavy components (Studio, Admin chrome, archetype pages) which are non-critical paths. Zero flaky tests detected across 3 consecutive runs.

## Coverage Summary

| Metric | Coverage | Threshold | Status |
|--------|----------|-----------|--------|
| Statements | 78.54% (5,141/6,545) | 75% | PASS |
| Branches | 74.48% (2,697/3,621) | 70% | PASS |
| Functions | 70.47% (969/1,375) | 65% | PASS |
| Lines | 79.74% (4,729/5,930) | 75% | PASS |

## Coverage by Module (Critical Paths)

| Module | Stmts % | Branch % | Funcs % | Lines % | Status |
|--------|---------|----------|---------|---------|--------|
| `lib/render/` | 100 | 93.9 | 100 | 100 | GREEN |
| `lib/impact/` | 99.4 | 97.5 | 100 | 100 | GREEN |
| `lib/history/` | 97.8 | 97.8 | 100 | 100 | GREEN |
| `lib/github/` | 97.1 | 87.1 | 90+ | 96.2 | GREEN |
| `app/api/` (routes) | 95.5 | 91.0 | 92+ | 96.0 | GREEN |
| `lib/auth/` | 94.1 | 88.3 | 100 | 98.7 | GREEN |
| `lib/db/` | 93.0 | 87.5 | 100 | 96.2 | GREEN |
| `lib/cache/` | 88.9 | 85.7 | 81.8 | 89.2 | GREEN |

All critical modules above 88% — no regressions from previous report.

## Coverage by Module (Non-Critical)

| Module | Stmts % | Notes | Status |
|--------|---------|-------|--------|
| `app/studio/` | ~27 | `StudioClient.tsx` (0%), `BadgePreviewCard.tsx` (0%) | RED |
| `app/admin/` | ~57 | Admin chrome components mostly at 0%, but logic/hooks tested | YELLOW |
| `app/experiments/` | ~57 | Experimental pages, not shipped | YELLOW |
| `app/archetypes/` | 0 | 6 static showcase pages — pure render, no logic | RED |
| `components/` (UI) | ~65 | Several UI components below 50% | YELLOW |

## Files Below 80% (Critical Path Only)

| File | Stmts % | Uncovered | Risk |
|------|---------|-----------|------|
| `app/api/auth/login/route.ts` | 76.9 | OAuth redirect edge cases (6 stmts) | LOW |

Only **1 critical-path file** is below 80%. All other sub-80% files are UI components.

## Files Below 80% (Non-Critical — Largest Gaps)

| File | Stmts % | Stmts Uncovered | Priority |
|------|---------|-----------------|----------|
| `app/studio/StudioClient.tsx` | 0 | ~119 stmts | MEDIUM — primary Studio UI |
| `app/experiments/hexmap/page.tsx` | 0 | ~132 stmts | LOW — experimental |
| `components/ParticleBackground.tsx` | 0.9 | ~112 stmts | LOW — canvas decoration |
| `components/BadgeToolbar.tsx` | 20.9 | ~72 stmts | MEDIUM — user-facing toolbar |
| `components/AuthorTypewriter.tsx` | 20.2 | ~67 stmts | LOW — animation only |
| `components/PostHogProvider.tsx` | 24.1 | ~22 stmts | LOW — analytics wrapper |
| `components/UserMenu.tsx` | 54.9 | ~32 stmts | MEDIUM — user-facing menu |
| `components/MobileNav.tsx` | 68.4 | ~12 stmts | LOW |
| `components/GlobalCommandBar.tsx` | 66.7 | ~18 stmts | LOW |
| `components/ShortcutCheatSheet.tsx` | 68.8 | ~10 stmts | LOW |

## Untested Source Files

29 source files in `apps/web/` have no corresponding test file. All are low-risk:

**Static/metadata (no logic):**
- `app/apple-icon.tsx`, `app/icon.tsx`, `app/not-found.tsx`
- `app/privacy/page.tsx`, `app/terms/page.tsx`
- `app/archetypes/{balanced,builder,emerging,guardian,marathoner,polymath}/page.tsx` (6 files)
- `app/verify/page.tsx`, `app/generating/[handle]/page.tsx`
- `app/cli/authorize/page.tsx`

**Lazy wrappers (trivial):**
- `components/GlobalCommandBarLazy.tsx`, `components/ShareBadgePreviewLazy.tsx`

**Type-only files (no runtime code):**
- `lib/bitbucket/types.ts`, `lib/codeberg/types.ts`, `lib/history/types.ts`, `lib/verification/types.ts`
- `packages/shared/src/types.ts`, `packages/shared/src/platforms.ts`, `packages/shared/src/index.ts`

**Other:**
- `components/ThemeProvider.tsx` — thin wrapper
- `components/SharePageShortcuts.tsx` — keyboard helper
- `app/studio/QuickControls.tsx` — interactive, could benefit from tests
- `app/admin/agents-types.ts` — type definitions
- `app/experiments/__fixtures__/mock-data.ts` — test fixture data

## Flaky Tests

**None detected.** 3 consecutive runs produced identical results:
- Run 1: 273 files, 4,280 passed, 0 failed
- Run 2: 273 files, 4,280 passed, 0 failed (2 unhandled errors — see below)
- Run 3: 273 files, 4,280 passed, 0 failed

**Known stderr noise:** Run 2 produced 2 `ReferenceError: window is not defined` errors originating from `use-animated-counter.test.ts`. These are unhandled exceptions during React DOM cleanup in jsdom — all tests in the file still pass. This is intermittent (appeared in 1 of 3 runs) but does not affect test outcomes.

**Intentional stderr:** 3 error-handling tests (generate, verify, refresh routes) emit `console.error` during normal execution — these test 500 error paths and are expected.

## Trends (vs 2026-03-07)

| Metric | Previous | Current | Delta |
|--------|----------|---------|-------|
| Statements | 78.5% (5,111/6,514) | 78.54% (5,141/6,545) | +0.04% |
| Test Files | 272 | 273 | +1 |
| Tests | 4,238 | 4,280 | +42 |
| Flaky | 0 | 0 | — |

Coverage is **stable**. 42 new tests added with 1 new test file since last report. 31 new statements covered.

## Recommendations

### Priority 1 — Should test (user-facing, stateful)
1. **`StudioClient.tsx`** (0%, ~119 stmts) — Primary Creator Studio client. Has complex state, form handling, and API calls. Smoke tests + key interaction tests would add ~100 stmts coverage.
2. **`BadgeToolbar.tsx`** (20.9%, ~72 stmts) — User-facing badge toolbar with copy/download/share actions. Missing coverage on download and share flows.
3. **`UserMenu.tsx`** (54.9%, ~32 stmts) — User menu with platform connect/disconnect. Missing coverage on Bitbucket/Codeberg disconnect flows and mobile behavior.

### Priority 2 — Worth testing (moderate risk)
4. **`app/api/auth/login/route.ts`** (76.9%) — Only critical-path file below 80%. 6 uncovered statements in OAuth redirect edge cases. Low risk but easy to close.
5. **`GlobalCommandBar.tsx`** (66.7%) — Command palette with keyboard shortcuts. Missing coverage on command execution and escape handling.
6. **`MobileNav.tsx`** (68.4%) — Mobile navigation drawer. Missing coverage on open/close transitions.

### Priority 3 — Nice to have
7. **`ParticleBackground.tsx`** (0.9%, ~112 stmts) — Canvas-heavy animation. Smoke test only.
8. **`AuthorTypewriter.tsx`** (20.2%, ~67 stmts) — Typewriter animation. Timing-dependent, low value from testing.
9. **`use-animated-counter.test.ts`** — Investigate the intermittent `window is not defined` error. Consider adding explicit jsdom environment declaration or cleanup guards.

### Recurring from cross-agent reports
- `merge_operations` cleanup needs tests once retention policy is implemented (Cost Analyst).
- OAuth timeout behavior untested — 9 fetch calls lack `AbortSignal.timeout()` (Cost Analyst).
- Share page ISR integration test needed once `revalidate=3600` is added (Performance).
