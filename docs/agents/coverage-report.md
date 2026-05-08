# Coverage Report
> Generated: 2026-05-08 | Health status: green

## Executive Summary
Overall coverage **96.75% stmts / 92.6% branches / 95.49% funcs / 97.78% lines** across 445 test files and 7,567 tests — stable vs prior cycle. All critical paths (impact, render, db, api, auth, cache) remain ≥96%. Three consecutive runs were 100% green; the previously-flaky `BadgeToolbar > strips @keyframes` did not recur.

## Coverage by Module
| Module | Stmts | Funcs | Branches | Status |
|--------|-------|-------|----------|--------|
| apps/web/lib/impact | 99.6% | 100.0% | 98.7% | green |
| apps/web/lib/render | 100.0% | 100.0% | 92.9% | green |
| apps/web/app/api | 97.5% | 96.8% | 94.2% | green |
| apps/web/lib/db | 96.5% | 100.0% | 93.3% | green |
| apps/web/lib/auth | 98.0% | 98.9% | 96.2% | green |
| apps/web/lib/cache | 98.1% | 96.8% | 95.2% | green |
| apps/web/lib/github | 97.4% | 93.1% | 96.6% | green |
| apps/web/lib/analytics | 97.3% | 100.0% | 89.5% | yellow (branches) |
| apps/web/lib/bitbucket | 97.7% | 96.4% | 93.1% | green |
| apps/web/lib/codeberg | 98.0% | 96.3% | 94.5% | green |
| apps/web/lib/email | 97.6% | 100.0% | 94.7% | green |
| apps/web/lib/history | 98.3% | 100.0% | 96.6% | green |
| apps/web/lib/i18n | 100.0% | 96.3% | 97.9% | green |
| apps/web/lib/profile | 100.0% | 100.0% | 91.2% | green |
| apps/web/lib/insights | 100.0% | 100.0% | 92.6% | green |
| apps/web/lib/effects | 94.8% | 94.7% | 90.8% | green |
| apps/web/lib/feature-flags.ts | 94.3% | 88.2% | 100.0% | green |
| apps/web/components | 96.6% | 95.9% | 90.7% | green |
| apps/web/app (pages) | 94.8% | 92.0% | 89.2% | green |
| packages/shared | 91.6% | 100.0% | 100.0% | green |

## Gaps & Recommendations

**No critical-path gaps this cycle.** All files in `lib/impact`, `lib/render`, `app/api`, and `lib/db` have a sibling test file or are 100% covered transitively.

Files <80% statements (all P3, accepted):
- `apps/web/lib/effects/interactions/HolographicOverlay.tsx` — 50% stmts (Canvas/WebGL, JSDOM-blocked)
- `apps/web/components/ClientInstrumentation.tsx` — 60% stmts (`next/dynamic` lazy wrapper, no testable logic)
- `apps/web/components/GlobalCommandBarLazy.tsx` — 60% stmts (`next/dynamic` lazy wrapper)
- `apps/web/components/SharePageOwnerContentLazy.tsx` — 66.7% stmts (`next/dynamic` lazy wrapper)
- `apps/web/app/experiments/heatmap-wave/page.tsx` — 73.3% stmts (experiments/** is accepted P3)
- `apps/web/app/experiments/metallic-shimmer/page.tsx` — 77.4% stmts (experiments/** is accepted P3)

Carried P2 items (non-blocking but tracked):
- **`lib/analytics/server-errors.ts` — 89.5% branches.** Nine `SENSITIVE_PATTERNS` token-scrubbing branches (password, token, secret, key, credential, api_key, client_secret, client_id, access_token) remain untested. Security-adjacent — credential-leak prevention guards before PostHog logging. (3rd carry cycle.)
- **7 archetype pages — 80% stmts / 50% funcs** (`artificer`, `balanced`, `builder`, `emerging`, `guardian`, `marathoner`, `polymath`). `generateMetadata` exports lack runtime tests; only source-string tests exist on the two pages that were closed last cycle. Recommend a single shared runtime-import test file covering all 7.

## Flaky Tests
None detected. 3 consecutive full runs (7567/7567 each) — `BadgeToolbar > strips @keyframes` did not recur after the May 6 `await act(async () => {})` scheduler-drain fix. Recommend one more cycle of monitoring before closing the watch.

<!-- ENTRY:START agent=coverage timestamp=2026-05-08T02:00:00Z -->
## Coverage Agent — 2026-05-08
- **Status**: GREEN
- Overall coverage: **96.75% stmts** (8964/9265), 92.6% branches, 95.49% funcs, 97.78% lines
- Test suite: 445 files, 7567 tests. Duration 73–97s with coverage.
- Delta vs 2026-05-07: stmts +0.00pp (flat), branches -0.02pp, funcs +0.00pp, lines +0.00pp — fully stable.
- Critical paths GREEN: lib/impact 99.6%, lib/render 100%, lib/db 96.5%, app/api 97.5%, lib/auth 98.0%, lib/cache 98.1%, lib/github 97.4%, lib/analytics 97.3% stmts (89.5% br).
- **Flaky test RESOLVED**: 3 consecutive clean runs (7567/7567 each). `BadgeToolbar > strips @keyframes` did not recur — May 6 `await act(async () => {})` drain is holding. Watch one more cycle before officially closing.
- **P2 active**: (1) 7 archetype pages 80% stmts / 50% funcs — `generateMetadata` runtime export untested. (2) `lib/analytics/server-errors.ts` 89.5% branches — SENSITIVE_PATTERNS scrubbing branches untested (security-adjacent, 3rd carry cycle).
- **No critical-path test files missing.** The two files lacking sibling tests in `app/api` (`auth/bitbucket/config.ts`, `auth/codeberg/config.ts`) are both 100% covered transitively via OAuth route tests.
- **P3 carried (accepted)**: experiments/** Canvas/JSDOM-blocked, `HolographicOverlay.tsx` 50% stmts, lazy wrapper components (60–67% stmts, no testable logic), `archetypeDemoData/demoData` 50% branches (TS overloads), `lang-sync.tsx` 50% branches (SSR guard).

**Cross-agent recommendations:**
- [Security]: `lib/analytics/server-errors.ts` 89.5% branches — SENSITIVE_PATTERNS scrubbing (9 token types) still untested. P2 security risk, 3rd carry cycle. One parametrized test covering all 9 patterns would close it.
- [QA]: `BadgeToolbar > strips @keyframes` flake fix (May 6 `await act()` drain) appears to be holding — 3 consecutive clean runs. Recommend one more cycle of monitoring before dropping the watch.
- [Triage]: Two P2 items, both small fixes: (a) one shared runtime-import test file for the 7 archetype pages' `generateMetadata` exports; (b) one parametrized test for `lib/analytics/server-errors.ts` SENSITIVE_PATTERNS branches.
<!-- ENTRY:END -->
