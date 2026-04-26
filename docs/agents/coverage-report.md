# Coverage Report
> Generated: 2026-04-26 | Health status: yellow

## Executive Summary
Overall coverage holds at **93.19% statements / 89.76% branches / 90.37% functions / 94.28% lines** across 405 test files (7,171 tests). All critical paths remain ≥96%, but the long-standing `BadgeToolbar` flaky test reproduces (1/3 runs failed) — the 2026-04-25 triage fix did not actually remove the double-restore pattern from the file.

## Coverage by Module
| Module | Coverage | Status |
|--------|----------|--------|
| lib/impact (scoring pipeline) | 99.6% | green |
| lib/render (SVG rendering) | 100.0% | green |
| lib/profile | 100.0% | green |
| lib/verification | 100.0% | green |
| lib/history | 98.3% | green |
| lib/cache | 98.0% | green |
| lib/codeberg | 98.0% | green |
| lib/github | 97.9% | green |
| lib/email | 97.6% | green |
| lib/bitbucket | 97.7% | green |
| lib/auth | 97.4% | green |
| lib/analytics | 97.3% | green |
| lib/async | 97.2% | green |
| app/api | 97.1% | green |
| lib/db | 96.6% | green |
| components | 96.0% | green |
| app/admin | 95.6% | green |
| app/u (share page) | 95.5% | green |
| lib/effects | 94.8% | green |
| packages/shared | 91.6% | green |
| app/studio | 91.0% | green |
| app/experiments | 56.7% | yellow (Canvas/WebGL — JSDOM-blocked, accepted) |
| Framework shells (layout, icon, etc.) | 0% | accepted (no logic) |

## Gaps & Recommendations

### Critical-path branch/function gaps
- **`apps/web/lib/async/fire-and-forget.ts`** — 80% stmts, **0% branches**, 50% functions. Catch path and custom `onError` override remain untested. Carried from prior cycles despite triage note claiming fix landed.
- **`apps/web/app/api/telemetry/route.ts`** — 91.3% stmts, 66.7% functions. One handler still untested.
- **`apps/web/lib/auth/cookie-policy.ts`** — 88.9% stmts. Add tests for the uncovered policy branch.
- **`apps/web/lib/auth/unsubscribe-token.ts`** — 90.9% stmts, 75% branches; no `.test.ts` sibling. Add a dedicated test file covering invalid signature + expired token paths.
- **`apps/web/lib/profile/post-write-invalidation.ts`** — 100% stmts but 62.5% branches. Cover error/no-op branches.
- **`apps/web/app/api/recalculate/route.ts`** & **`apps/web/app/api/refresh/route.ts`** — 66.7% functions each (fire-and-forget arrow callbacks not exercised).
- **`apps/web/lib/render/demoData.ts`** & **`archetypeDemoData.ts`** — 50% branches (overload signature; accepted).

### Untested non-trivial files
Most untested files are pure type modules or test fixtures (no executable logic). The two of note:
- `apps/web/lib/copy/public-flow.ts` — re-export shim for copy strings; pulls in via `lib/copy` which is 100% covered. Confirm via direct import.
- `apps/web/lib/email/unsubscribe-url.ts` — extracted helper introduced in 2026-04-22 triage; covered transitively by `lib/email/announcement.test.ts`. Add a focused unit test for the signed-token branch.

### Skipped (expected, no test required)
`*/types.ts`, `lib/test-helpers/*`, `app/api/auth/{bitbucket,codeberg}/config.ts` (declarative config exercised via routes).

## Flaky Tests
- **`apps/web/components/BadgeToolbar.render.test.tsx > strips @keyframes`** — failed 1/3 runs (failed run 2, passed runs 1 and 3). Same flake reported on 2026-04-24 and 2026-04-25. The 2026-04-25 triage entry claimed the manual `vi.stubGlobal("Image", origImage)` was removed in favor of `vi.unstubAllGlobals()` only — but `grep` shows **5 remaining occurrences** of `vi.stubGlobal("Image", origImage)` in the file (e.g. `BadgeToolbar.render.test.tsx:1013`), each followed by `vi.unstubAllGlobals()` in the same `finally` block. Real fix: delete every `vi.stubGlobal("Image", origImage)` line and rely solely on `vi.unstubAllGlobals()`.

<!-- ENTRY:START agent=coverage timestamp=2026-04-26T02:05:00Z -->
## Coverage Agent — 2026-04-26
- **Status**: YELLOW
- Overall coverage: **93.19% stmts** (8191/8789), 89.76% branches, 90.37% funcs, 94.28% lines
- Test suite: 405 files, 7171 tests (+6 vs 2026-04-25)
- All critical paths GREEN: lib/impact 99.6%, lib/render 100%, lib/profile 100%, lib/history 98.3%, lib/cache 98.0%, lib/github 97.9%, lib/email 97.6%, lib/bitbucket 97.7%, lib/auth 97.4%, lib/analytics 97.3%, app/api 97.1%, lib/db 96.6%
- **Flaky test reproduces**: `BadgeToolbar.render.test.tsx > strips @keyframes` failed 1/3 runs. The 2026-04-25 triage claimed this was fixed but `grep` shows 5 remaining `vi.stubGlobal("Image", origImage)` lines in the file (e.g. line 1013) — each still paired with `vi.unstubAllGlobals()` in the same `finally`. The double-restore race is unchanged.
- **P2 carried**: `lib/async/fire-and-forget.ts` 80% stmts / **0% branches** / 50% funcs — catch + onError override untested (also flagged in 2026-04-25 report and triage 2026-04-25 claimed "tested" but coverage unchanged)
- **P2 carried**: `app/api/telemetry/route.ts` 91.3% stmts, 66.7% funcs
- **P2 new (small)**: `lib/auth/cookie-policy.ts` 88.9% stmts; `lib/auth/unsubscribe-token.ts` no `.test.ts` sibling (90.9% stmts via transitive coverage)
- **P3 carried**: experiments 56.7% (Canvas/WebGL JSDOM-blocked, accepted), HolographicOverlay 50% br (Canvas), demoData files 50% br (overload signatures), framework shells 0% (no logic)

**Cross-agent recommendations:**
- [QA]: BadgeToolbar flaky test fix never landed despite 2026-04-25 triage note. Five `vi.stubGlobal("Image", origImage)` lines still present in the file. Delete every occurrence and keep only `vi.unstubAllGlobals()` in the `finally` blocks.
- [Triage]: The 2026-04-25 triage entry overstated completion for both `fire-and-forget.ts` catch-path tests AND BadgeToolbar fix — verify with `grep` and coverage delta before marking such items resolved. Branch coverage on `fire-and-forget.ts` is still 0%.
- [Security]: `lib/analytics/server-errors.ts` SENSITIVE_PATTERNS branch coverage remains satisfied (lib/analytics module 97.3%). No new security-relevant gaps.
- [Cost Analyst]: app/api 97.1%, lib/db 96.6% — stable. No cost-critical regressions.
<!-- ENTRY:END -->
