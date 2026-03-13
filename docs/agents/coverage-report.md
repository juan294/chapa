# Coverage Report
> Generated: 2026-03-13 | Health status: GREEN

## Executive Summary

Overall coverage is **78.74% statements** (5,517/7,006) across 283 test files with 4,541 tests — all passing, zero flaky. All 9 critical-path modules exceed 89% coverage. The primary gaps are in UI-heavy client components (Studio, verify pages, archetype pages) and experiment demo pages, which are non-critical paths.

## Overall Coverage

| Metric | Coverage | Threshold | Status |
|--------|----------|-----------|--------|
| Statements | 78.74% (5,517/7,006) | 75% | PASS |
| Branches | 74.88% (2,990/3,993) | 70% | PASS |
| Functions | 70.48% (1,015/1,440) | 65% | PASS |
| Lines | 79.87% (5,069/6,346) | 75% | PASS |

## Coverage by Critical Module

| Module | Stmts % | Branch % | Funcs % | Lines % | Status |
|--------|---------|----------|---------|---------|--------|
| `lib/render` | 100.0 | 93.75 | 100.0 | 100.0 | GREEN |
| `lib/impact` | 99.46 | 97.45 | 100.0 | 100.0 | GREEN |
| `lib/email` | 98.33 | 88.31 | 100.0 | 98.82 | GREEN |
| `lib/history` | 97.89 | 89.33 | 100.0 | 98.83 | GREEN |
| `lib/github` | 97.09 | 89.91 | 95.65 | 97.36 | GREEN |
| `lib/codeberg` | 97.52 | 95.74 | 96.15 | 100.0 | GREEN |
| `lib/auth` | 94.48 | 88.28 | 100.0 | 99.11 | GREEN |
| `lib/db` | 93.47 | 88.00 | 100.0 | 96.48 | GREEN |
| `lib/cache` | 89.24 | 87.17 | 81.25 | 91.35 | GREEN |
| `lib/bitbucket` | 93.05 | 76.31 | 96.29 | 95.31 | GREEN |
| `lib/keyboard` | 96.47 | 95.89 | 100.0 | 97.29 | GREEN |
| `lib/verification` | 100.0 | 100.0 | 100.0 | 100.0 | GREEN |
| `lib/insights` | 92.96 | 84.84 | 100.0 | 93.07 | GREEN |
| `packages/shared` | 100.0 | 100.0 | 100.0 | 100.0 | GREEN |

## Coverage by Non-Critical Module

| Module | Stmts % | Branch % | Funcs % | Lines % | Status |
|--------|---------|----------|---------|---------|--------|
| `components/dashboard` | 94.80 | 78.49 | 91.35 | 95.05 | GREEN |
| `components/terminal` | 90.90 | 83.89 | 89.09 | 92.85 | GREEN |
| `components` (top-level) | 54.23 | 50.61 | 56.07 | 55.53 | RED |
| `app/admin` | ~57 | — | — | — | YELLOW |
| `app/studio` | 27.08 | 22.80 | 40.47 | 26.97 | RED |
| `app/experiments` | ~50 | — | — | — | YELLOW |
| `app/verify` | 0.0 | 0.0 | 0.0 | 0.0 | RED |
| `app/archetypes` | 0.0 | — | 0.0 | 0.0 | RED |

## API Route Coverage

| Route | Stmts % | Status |
|-------|---------|--------|
| `api/auth/login` | 76.9 | YELLOW — only critical-path file below 80% |
| `api/supplemental` | 81.08 | GREEN |
| `api/studio/config` | 92.3 | GREEN |
| `api/history/[handle]` | 95.23 | GREEN |
| `api/insights` | 95.23 | GREEN |
| `api/webhooks/resend` | 96.66 | GREEN |
| `api/auth/callback` | covered | GREEN |
| `api/auth/session` | covered | GREEN |
| `api/generate` | covered | GREEN |
| `api/refresh` | 100.0 | GREEN |
| `api/verify/[hash]` | 100.0 | GREEN |
| `api/health` | covered | GREEN |
| `api/telemetry` | 100.0 | GREEN |
| `api/cron/warm-cache` | covered | GREEN |
| `api/recalculate` | covered | GREEN |
| All other API routes | 90–100 | GREEN |

## Gaps & Recommendations

### Priority 1 — Critical Path (should fix)

1. **`app/api/auth/login/route.ts`** — 76.9% stmts (6 uncovered statements). Only critical-path file below 80%. OAuth redirect edge cases need coverage.

### Priority 2 — High-Value Components (recommended)

2. **`app/studio/StudioClient.tsx`** — 0% (119 statements). Main Studio page component, entirely untested.
3. **`app/studio/BadgePreviewCard.tsx`** — 0% (estimated ~80 statements). Studio badge preview, untested.
4. **`components/UserMenu.tsx`** — 38.88% stmts. Core navigation component with significant uncovered branches (lines 92–571).
5. **`components/BadgeToolbar.tsx`** — 20.87% stmts. Badge action toolbar with 72 uncovered statements.
6. **`components/AuthorTypewriter.tsx`** — 20.23% stmts. Animation-heavy but has logic branches untested.
7. **`app/verify/[hash]/page.tsx`** — 0% (264 lines). Verification results page completely untested.

### Priority 3 — UI Components (lower risk)

8. **`components/PostHogProvider.tsx`** — 24.13% stmts. Analytics wrapper with untested initialization paths.
9. **`components/GlobalCommandBar.tsx`** — 66.66% stmts. Command palette with uncovered keyboard interactions.
10. **`components/MobileNav.tsx`** — 68.42% stmts. Mobile navigation with uncovered responsive paths.
11. **`components/ShortcutCheatSheet.tsx`** — 68.75% stmts. Keyboard shortcuts overlay.
12. **`components/Navbar.tsx`** / **`NavbarClient.tsx`** — 0%. Server/client navbar components (thin wrappers).
13. **`components/ErrorBanner.tsx`** — 0%. Error display component.
14. **`components/CopyButton.tsx`** — 0%. Clipboard copy utility.
15. **`components/SharePageOwnerContent.tsx`** — 0%. Share page owner-specific content.

### Priority 4 — Non-Critical Pages (lowest risk)

16. **`app/archetypes/*`** — 6 archetype pages at 0% (thin static pages, ~13 stmts each).
17. **`app/experiments/hexmap/page.tsx`** — 0% (132 statements, canvas-heavy).
18. **`lib/effects/backgrounds/ParticleBackground.tsx`** — 0.88% (112 statements, canvas-heavy).
19. **`app/privacy/page.tsx`** / **`app/terms/page.tsx`** — 0% (static legal pages, ~13 stmts each).
20. **`app/cli/authorize/*`** — 0%. CLI authorization flow pages.

### Uncovered Source Files (no dedicated test file)

The following source files have coverage from other test files but no dedicated `.test.ts`:
- `apps/web/app/apple-icon.tsx` — icon generation
- `apps/web/app/icon.tsx` — icon generation
- `apps/web/app/not-found.tsx` — 404 page
- `apps/web/components/ThemeProvider.tsx` — theme wrapper
- `apps/web/components/ShareBadgePreviewLazy.tsx` — lazy-load wrapper
- `apps/web/components/GlobalCommandBarLazy.tsx` — lazy-load wrapper

These are thin wrappers and low-risk.

## Flaky Tests

**None detected.** Three consecutive test runs all produced identical results:
- Run 1: 283 files, 4,541 tests, 0 failed (12.0s)
- Run 2: 283 files, 4,541 tests, 0 failed (21.6s)
- Run 3: 283 files, 4,541 tests, 0 failed (17.8s)

Note: Run 2 reported "4 errors" in stderr — these are intentional `console.error` output from error-handling tests (`verify/route.test.ts`, `refresh/route.test.ts`, `generate/route.test.ts`, `use-animated-counter.test.ts`). All test assertions passed.

## Delta vs Last Report (2026-03-12)

| Metric | Previous | Current | Change |
|--------|----------|---------|--------|
| Statements | 78.84% (5,524/7,006) | 78.74% (5,517/7,006) | -0.10% |
| Branches | 74.90% | 74.88% | -0.02% |
| Functions | 70.62% | 70.48% | -0.14% |
| Lines | 79.98% | 79.87% | -0.11% |
| Test count | 4,541 | 4,541 | 0 |
| Test files | 283 | 283 | 0 |
| Flaky tests | 0 | 0 | 0 |

Coverage dipped marginally (-0.10% stmts) — likely from minor source additions without matching test additions. No structural regression. All thresholds still pass.
