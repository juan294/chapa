# Coverage Report
> Generated: 2026-05-09 | Health status: green

## Executive Summary
Overall coverage is **96.81% statements / 92.62% branches / 95.81% functions / 97.87% lines** across 445 test files and 7,581 tests (3 consecutive clean runs, 0 flakes). Every critical-path module (impact, render, db, api, auth, cache, github) sits above 96% statements; the only sub-80% files are accepted Canvas/lazy-wrapper P3 carries.

## Coverage by Module
| Module | Stmt | Branch | Func | Status |
|--------|-----:|-------:|-----:|--------|
| apps/web/lib/impact | 99.6% | 98.7% | 100.0% | green |
| apps/web/lib/render | 100.0% | 92.9% | 100.0% | green |
| apps/web/lib/auth | 98.0% | 96.2% | 98.9% | green |
| apps/web/lib/cache | 98.1% | 95.2% | 96.8% | green |
| apps/web/lib/github | 97.4% | 96.6% | 93.1% | green |
| apps/web/lib/db | 96.5% | 93.3% | 100.0% | green |
| apps/web/lib/history | 98.3% | 96.6% | 100.0% | green |
| apps/web/lib/dashboard | 98.4% | 88.6% | 87.5% | green |
| apps/web/lib/analytics | 97.3% | 91.2% | 100.0% | green |
| apps/web/lib/email | 97.6% | 94.7% | 100.0% | green |
| apps/web/lib/bitbucket | 97.7% | 93.1% | 96.4% | green |
| apps/web/lib/codeberg | 98.0% | 94.5% | 96.3% | green |
| apps/web/lib/campaigns | 94.1% | 91.5% | 100.0% | green |
| apps/web/lib/feature-flags | 94.3% | 100.0% | 88.2% | green |
| apps/web/lib/effects | 94.8% | 90.8% | 94.7% | green |
| apps/web/lib/i18n | 100.0% | 97.9% | 96.3% | green |
| apps/web/lib/insights, profile, verification, http, async, agents | 100.0% | ≥87.5% | 100.0% | green |
| apps/web/app/api | 97.5% | 94.2% | 96.8% | green |
| apps/web/app (pages) | 95.1% | 89.2% | 93.0% | green |
| apps/web/components | 96.6% | 90.7% | 95.7% | green |
| packages/shared | 91.6% | 100.0% | 100.0% | green (data files only) |

## Gaps & Recommendations
All gaps below are previously documented P3 carries — Canvas/JSDOM-blocked or trivial lazy-wrapper exports. No new actionable critical-path gaps.

- `apps/web/lib/effects/interactions/HolographicOverlay.tsx` — 50% stmts (Canvas/WebGL, P3 accepted).
- `apps/web/app/experiments/heatmap-wave/page.tsx` — 73.3% stmts / 50% branches (experiments gated, P3 accepted).
- `apps/web/app/experiments/metallic-shimmer/page.tsx` — 77.4% stmts / 42.9% branches (experiments gated, P3 accepted).
- `apps/web/app/experiments/error.tsx`, `loading.tsx` — 0% (Next.js convention files with no logic).
- `apps/web/components/ClientInstrumentation.tsx`, `GlobalCommandBarLazy.tsx`, `SharePageOwnerContentLazy.tsx` — 60–66.7% stmts, 33–50% funcs (`next/dynamic` lazy wrappers with no testable logic; P3 accepted).
- `apps/web/lib/feature-flags.ts` — 88.2% funcs: `revalidateTag` invalidation path on flag write may not be exercised; one-test fix (low priority — covered indirectly via integration).
- `apps/web/lib/dashboard` — 87.5% funcs / 88.6% branches: locale fallback paths in `generate-insights.ts` partially uncovered (low priority).

Untested files (no sibling `.test.ts`) — all benign:
- `apps/web/lib/i18n/dictionaries/en.ts`, `es.ts` — pure string tables, covered indirectly by `dictionaries/parity.test.ts`.
- `apps/web/lib/i18n/index.ts` — barrel re-exports.
- `apps/web/app/api/auth/bitbucket/config.ts`, `codeberg/config.ts` — env-var config helpers, exercised through their consumers.

## Flaky Tests
None detected. 3/3 runs reported `Test Files 445 passed (445) / Tests 7581 passed (7581)`. The previously-flaky `BadgeToolbar > strips @keyframes` test was rewritten as 6 deterministic unit tests in 2026-05-08 triage and is now stable.

---

<!-- ENTRY:START agent=coverage timestamp=2026-05-09T02:05:00Z -->
## Coverage Agent — 2026-05-09
- **Status**: GREEN
- Overall coverage: **96.81% stmts / 92.62% branches / 95.81% funcs / 97.87% lines** (8973/9268 stmts).
- Test suite: 445 files, 7581 tests. 3/3 runs clean (51s–139s). 0 flakes.
- Delta vs 2026-05-07: stmts +0.06pp, branches +0.02pp, funcs +0.32pp, lines +0.09pp — stable. Test count +14 (from 2026-05-08 triage: BadgeToolbar rewrite, archetype default-export wrappers, sanitizeUnknown branches).
- Critical paths GREEN: lib/impact 99.6%, lib/render 100%, lib/db 96.5%, app/api 97.5%, lib/auth 98.0%, lib/cache 98.1%, lib/github 97.4%, lib/analytics 97.3%, lib/history 98.3%.
- **All prior P2 gaps closed**: archetype default-export tests, `sanitizeUnknown` branches, `BadgeToolbar` flake — all confirmed resolved per 2026-05-08 triage.
- **No new P2s**. All sub-80% files are P3 carries (Canvas/WebGL, lazy-wrapper, experiments-gated).
- **Untested files: 5** — all benign (i18n dictionaries covered by parity test, barrel re-export, OAuth config helpers).

**Cross-agent recommendations:**
- [Security]: `lib/analytics/server-errors.ts` SENSITIVE_PATTERNS branches were closed in 2026-05-08 triage (`sanitizeUnknown` null/number/boolean/array). 88.2% → resolved; security-adjacent P2 is closed. No new security-relevant gaps.
- [QA]: `BadgeToolbar @keyframes` flake permanently retired via pure-function extraction. No new a11y or regression risk surfaced by coverage data.
- [Performance]: No coverage gaps in performance-sensitive paths. Badge route `maxDuration=35` was added in 2026-05-08 triage.
- [Cost Analyst]: No cost-path coverage gaps. `lib/cache` 98.1%, `lib/db` 96.5%, `app/api` 97.5% remain stable.
<!-- ENTRY:END -->
