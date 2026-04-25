# Coverage Report
> Generated: 2026-04-25 | Branch: `develop` | Health status: yellow

## Executive Summary

All critical paths remain green (97%+ coverage). The BadgeToolbar `@keyframes` flaky test resurfaced in 1 of 3 runs — the same teardown race that has been observed in prior cycles. The fork-pool starvation issue from 2026-04-24 did **not** reproduce this cycle (suite ran cleanly in ~45s). Test suite grew +62 tests (+3 files) since last cycle.

## Coverage by Module

| Module | Stmts | Branches | Funcs | Status |
|--------|-------|----------|-------|--------|
| lib/impact | 99.6% | 98.6% | 100% | ✅ GREEN |
| lib/render | 100% | 92.9% | 100% | ✅ GREEN |
| lib/db | 96.5% | 93.5% | 100% | ✅ GREEN |
| lib/cache | 98.0% | 95.2% | 96.3% | ✅ GREEN |
| lib/auth | 97.4% | 95.4% | 98.9% | ✅ GREEN |
| lib/history | 98.3% | 96.6% | 100% | ✅ GREEN |
| lib/email | 97.6% | 94.7% | 100% | ✅ GREEN |
| lib/github | 96.5% | 92.5% | 96.6% | ✅ GREEN |
| app/api | 97.1% | 94.2% | 95.0% | ✅ GREEN |
| lib/analytics | 97.3% | 89.1% | 100% | ✅ GREEN |
| lib/profile | 100% | 86.4% | 100% | ✅ GREEN |
| components | 96.2% | 90.0% | 95.5% | ✅ GREEN |
| lib/async | 97.2% | 88.9% | 88.9% | ✅ GREEN |
| experiments/** | 56.7% | 51.2% | 52.6% | ⚪ ACCEPTED (Canvas/WebGL, JSDOM-blocked) |
| **TOTAL** | **93.22%** | **89.66%** | **90.51%** | **YELLOW** |

_(8300/8903 stmts · 4512/5032 branches · 1661/1835 funcs · 7575/8033 lines)_

Delta vs 2026-04-24: stmts +0.07pp, branches +0.11pp, funcs +0.42pp, lines +0.04pp.

## Gaps & Recommendations

### P2 — Actionable

- **`lib/async/fire-and-forget.ts`** — 80% stmts, **0% branches**, 50% funcs. The synchronous-throw catch path and the custom `onError` override are untested. This is a 12-line utility with only 2 code paths; trivial to cover.

- **`components/BadgeToolbar.render.test.tsx` (flaky)** — `strips @keyframes` test failed 1/3 runs. Root cause: `vi.stubGlobal("Image", …)` is restored in a `finally` block, but `vi.unstubAllGlobals()` is also called in the same `finally` — when the inner `waitFor` rejects, the order of execution may leave a stale stub. The try/finally structure is present but the stub is being double-restored (once manually, once via `unstubAllGlobals`). Fix: remove the manual `vi.stubGlobal("Image", origImage)` restore and rely solely on `vi.unstubAllGlobals()` in the `finally` block, or vice versa — don't do both.

- **`app/api/telemetry/route.ts`** — 91.3% stmts, 66.6% funcs. One handler (likely GET) is completely untested. Low risk but straightforward to add.

- **`components/SharePageOwnerContent.tsx`** — 90.5% stmts, 75% funcs. One owner-only function still missing test coverage after the 2026-04-22 triage cycle.

### P3 — Accepted / Low Priority

- **`components/AuthorTypewriter.tsx`**: 86.7% stmts, 67.5% branches — animation-timing branches unreachable in JSDOM. Accepted.
- **`lib/profile/post-write-invalidation.ts`**: 100% stmts, 62.5% branches — error paths in conditional Redis invalidation. Low risk.
- **`lib/profile/orchestrated-profile.ts`**: 100% stmts, 75% branches — defensive fallback branches.
- **`lib/auth/unsubscribe-token.ts`**: 90.9% stmts, 75% branches — 2 error-path branches.
- **`lib/render/archetypeDemoData.ts` + `demoData.ts`**: 100% stmts, 50% branches — TypeScript function overload signature branches; no runtime impact.
- **`app/api/refresh/route.ts` + `app/api/recalculate/route.ts`**: ~97% stmts, 66.6% funcs — fire-and-forget arrow functions not counted as function calls. Structural, not a real gap.
- **experiments/\*\*** and Canvas/WebGL components: JSDOM-blocked. Accepted permanently.
- **Framework shells** (apple-icon, icon, layout, admin/page, studio/page, ClientAnalytics, ClientInstrumentation): 0% — no logic to test. Accepted.

### No Direct Tests Required

- `app/api/auth/bitbucket/config.ts` + `app/api/auth/codeberg/config.ts` — pure config wiring, exercised via route integration tests.

## Flaky Tests

| Test | File | Fail Rate | Cause | Fix |
|------|------|-----------|-------|-----|
| `strips @keyframes, animation properties, and SMIL animate elements` | `BadgeToolbar.render.test.tsx` | 1/3 runs | Double-restore of `Image` global stub (`vi.stubGlobal(origImage)` + `vi.unstubAllGlobals()` both in finally) | Remove the manual `vi.stubGlobal("Image", origImage)` restore; let `vi.unstubAllGlobals()` be the sole teardown |

_Fork-pool starvation from 2026-04-24 did NOT reproduce this cycle (suite completed in 45.36s without fork cap)._
