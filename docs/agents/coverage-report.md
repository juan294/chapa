# Coverage Report
> Generated: 2026-04-18 | Health status: yellow

## Executive Summary
Overall coverage holds at 93% statements and 89.5% branches — stable vs last cycle — with all critical paths (impact, render, db, auth) remaining GREEN. One date-sensitive regression was found and fixed (`buildSnapshot` ignored `today` param, causing EMA double-application on date rollover); the fix also adds a global `testTimeout: 15000` to prevent JSDOM timeouts under pre-commit hook CPU pressure. Test count dropped from ~7004 to 6894 due to `refactor(profile): harden architecture reliability flows` (commit `7563e3f`) trimming warm-cache and bulk-recalculate test suites, which left `warm-cache/route.ts` at 62.5% functions — new P2.

## Coverage by Module
| Module | Stmts | Branches | Funcs | Status |
|--------|-------|----------|-------|--------|
| `lib/impact` | 100% | 99% | 100% | GREEN |
| `lib/render` | 100% | 94% | 100% | GREEN |
| `lib/db` | 98% | 95% | 100% | GREEN |
| `lib/auth` | 98% | 97% | 100% | GREEN |
| `lib/email` | 98% | 97% | 100% | GREEN |
| `lib/cache` | 99% | 98% | 96% | GREEN |
| `lib/history` | 97% | 95% | 100% | GREEN |
| `lib/github` | 97% | 92% | 96% | GREEN |
| `lib/profile` | 100% | 88% | 92% | GREEN |
| `lib/analytics` | 100% | 91% | 100% | GREEN |
| `app/api` (aggregate) | 97% | — | — | GREEN |
| `components` | 96% | 90% | 94% | GREEN |
| `app/api/cron/warm-cache` | 83% | 75% | 63% | YELLOW |
| `lib/effects` | 95% | 91% | 95% | YELLOW (HolographicOverlay Canvas gap accepted) |
| `experiments/*` | 56% | — | — | RED (Canvas/WebGL — accepted) |

## Bugs Fixed This Cycle

### P1 Fixed: Date-sensitive EMA regression (`orchestrated-profile.test.ts`)
- **Root cause**: `buildSnapshot` (`lib/history/snapshot.ts:17`) always used `new Date()` for the snapshot `date` field, ignoring the `today` parameter passed to `materializeImpactState`. When the wall-clock date advanced past the hardcoded test date "2026-04-17", the snapshot's date diverged from `smoothScore`'s view of "today", causing the same-day EMA short-circuit to miss on second reads — the score re-smoothed on every page refresh instead of returning the cached value.
- **Fix**: `buildSnapshot` now accepts an optional `today?: string` parameter (`snapshot.ts:12`). `materializeImpactState` passes `options.today` through (`materialize-profile.ts:59`).
- **Also fixed**: Added `testTimeout: 15000` globally to `vitest.config.ts` (was default 5000ms). JSDOM render tests take 6–13s under pre-commit hook CPU pressure (after typecheck + ESLint); the 5s default caused spurious failures.

## Gaps & Recommendations

### P2 (New): `app/api/cron/warm-cache/route.ts` — 63% funcs, 75% branches
The `7563e3f` refactor trimmed the warm-cache test suite from ~1100 to ~14 lines across both warm-cache and bulk-recalculate, leaving 3 of 8 functions uncovered. This is a cron route that runs daily and drives lifetime snapshot recording — branch coverage at 75% means some error/edge paths are untested.
- **Recommendation**: Add tests for the uncovered functions (snapshot persistence fallback, priority handle processing, error recovery path).

### P2 (Carried): `components/UserMenu.tsx` — 80% funcs
`handleInsightsFile` and related upload handlers are complex async flows. Now exactly at threshold (up from 79.3%).

### P3 (Accepted — all unchanged):
- `lib/effects/interactions/HolographicOverlay.tsx` — 50% stmts (Canvas/WebGL, untestable in JSDOM)
- `app/experiments/*` — 56% aggregate (Canvas/WebGL pages, accepted)
- `app/api/refresh/route.ts` / `app/api/recalculate/route.ts` — 33–50% funcs (inline fire-and-forget arrow functions, not meaningful to test)
- `lib/history/svg-to-png.ts` — 67% branches (OG image fallback path requires real Resvg binary)
- `components/GlobalCommandBarLazy.tsx` / `ShareBadgePreviewLazy.tsx` — 50–60% (next/dynamic wrappers, not meaningfully testable)
- `components/ClientAnalytics.tsx` — 0% (thin PostHog wrapper, correct to leave untested)

## Untested Files
All files in `lib/` and `app/api/` without a `.test.ts` counterpart are type-only files (`types.ts`), OAuth config objects (`config.ts`), or test helpers. No actionable gaps in critical paths.

## Flaky Tests
None detected. 3/3 runs passed 6894/6894 tests.

> **Note on test count**: Dropped from ~7004 (2026-04-17 triage) to 6894 (-110) due to `7563e3f` refactoring the warm-cache and bulk-recalculate test suites. This is not a regression — tests were intentionally reorganized as part of the architecture reliability refactor. The warm-cache coverage gap (P2 above) is the direct consequence to address.
