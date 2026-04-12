# Coverage Report
> Generated: 2026-04-12 | Health status: yellow

## Executive Summary
Test suite is plateau-stable at **93.12% statements / 89.86% branches** across 7,001 tests in 390 files — unchanged from the 2026-04-10 cycle. All critical paths (impact, render, API, db) remain solidly green. The previously-flaky BadgeToolbar test is confirmed fixed: 0 failures in 3 consecutive runs. Branch coverage stays below 90% solely because of `experiments/` Canvas/WebGL pages, which are untestable in JSDOM.

## Coverage by Module
| Module | Stmts | Branches | Functions | Status |
|--------|-------|----------|-----------|--------|
| `lib/impact` | 100.0% | 98.5% | 100.0% | GREEN |
| `lib/render` | 100.0% | 92.7% | 100.0% | GREEN |
| `lib/verification` | 100.0% | 100.0% | 100.0% | GREEN |
| `lib/crypto` | 100.0% | 100.0% | 100.0% | GREEN |
| `lib/async` | 100.0% | 100.0% | 100.0% | GREEN |
| `lib/analytics` | 100.0% | 90.9% | 100.0% | GREEN |
| `packages/shared` | 100.0% | 100.0% | 100.0% | GREEN |
| `lib/cache` | 99.2% | 97.9% | 95.8% | GREEN |
| `lib/history` | 98.2% | 96.5% | 100.0% | GREEN |
| `lib/auth` | 98.1% | 96.4% | 100.0% | GREEN |
| `lib/email` | 97.9% | 96.7% | 100.0% | GREEN |
| `app/api` | 97.6% | 94.8% | 97.4% | GREEN |
| `lib/db` | 97.6% | 95.2% | 100.0% | GREEN |
| `lib/github` | 96.8% | 91.9% | 96.2% | GREEN |
| `lib/bitbucket` | 97.2% | 89.5% | 100.0% | GREEN |
| `lib/codeberg` | 97.5% | 89.3% | 100.0% | GREEN |
| `components` (aggregate) | 95.9% | ~88% | ~91% | GREEN |
| `app/studio` | 90.4% | 82.8% | 95.3% | YELLOW |
| `app/experiments` | 56.1% | 51.2% | 52.6% | RED (accepted) |
| **Overall** | **93.12%** | **89.86%** | **89.95%** | **YELLOW** |

## Gaps & Recommendations

### Zero-coverage files (acceptable — no testable logic)
- `app/apple-icon.tsx`, `app/icon.tsx` — Next.js image route handlers, pure metadata
- `app/layout.tsx` — root RSC layout, no branching logic
- `app/cli/authorize/error.tsx`, `app/experiments/error.tsx`, `app/experiments/loading.tsx` — 1-stmt shell files
- `components/ClientAnalytics.tsx` — wraps `next/dynamic` imports, no logic; tested structurally via `ClientAnalytics.test.tsx`

### Zero-coverage files (worth monitoring)
- **`app/admin/page.tsx`** (11 stmts, 0%) — server component behind auth-gate; auth-guard logic is the only meaningful path; low risk since the page is thin
- **`app/studio/page.tsx`** (19 stmts, 0%) — same pattern; Studio routes tested via integration; no unit test gap with real impact
- **`app/experiments/hexmap/page.tsx`** (132 stmts, 0%) — Canvas/WebGL experiment, JSDOM cannot exercise it; accepted

### Untested source files (all type-only or test infrastructure)
- `lib/verification/types.ts`, `lib/history/types.ts`, `lib/codeberg/types.ts`, `lib/bitbucket/types.ts` — pure type declarations, no runtime code
- `lib/test-helpers/fixtures.ts`, `lib/test-helpers/platform-auth-fixtures.ts`, `lib/test-helpers/admin-auth.ts` — test infrastructure, correctly excluded
- `app/api/auth/codeberg/config.ts`, `app/api/auth/bitbucket/config.ts` — configuration objects consumed by auth routes; coverage captured via route tests

### Carried P2/P3 items (all accepted, unchanged from 2026-04-09)
- **`components/UserMenu.tsx`** — 79.3% funcs (handleInsightsFile complex handler). Low priority.
- **`components/AuthorTypewriter.tsx`** — 67.5% branches (JSDOM timing limitation). Accepted.
- **`lib/effects/interactions/HolographicOverlay.tsx`** — 47.0% stmts (experiment-adjacent, Canvas/WebGL). Accepted.
- **`app/experiments/*`** — 56.1% aggregate. All Canvas/WebGL; JSDOM cannot exercise render loops. Accepted.
- **`lib/render/svg-to-png.ts`** — 66.7% branches (PNG fallback path; requires real browser rsvg). Accepted.
- **`app/api/refresh/route.ts`** — 75% funcs (fire-and-forget `after()` callback). Accepted.

## Flaky Tests
None detected. The previously-flaky `BadgeToolbar.render.test.tsx` "strips SVG animations" test (which was failing 2/3 runs as of 2026-04-10) passed all 3 runs cleanly in this cycle. Fix from 2026-04-10 triage (replacing `act()/setTimeout` with `waitFor` + mountedRef guard) is holding.
