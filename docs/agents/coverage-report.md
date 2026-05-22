# Coverage Report
> Generated: 2026-05-22 | Health status: yellow

## Executive Summary
Overall coverage holds at **96.77% stmts / 92.55% branches / 95.72% funcs / 97.87% lines** (8978/9277 stmts) across 445 test files / 7589 tests — flat vs 2026-05-19. All critical paths (`lib/impact`, `lib/render`, `lib/db`, `app/api`) remain ≥96% on every metric with zero untested files. **One flaky test detected**: `engagement-dashboard.test.tsx > "handles campaign fetch non-ok response silently"` fails under full-suite load (runs 2 + 3) but passes in isolation — race in `getByText` assertion after rejected campaigns fetch.

## Coverage by Module
| Module | Stmts | Branches | Funcs | Lines | Status |
|---|---|---|---|---|---|
| lib/impact | 99.6% | 98.7% | 100% | 99.5% | GREEN |
| lib/render | 100% | 92.9% | 100% | 100% | GREEN |
| lib/db | 96.5% | 93.3% | 100% | 98.7% | GREEN |
| app/api | 97.5% | 94.2% | 96.8% | 97.9% | GREEN |
| lib/auth | 98.0% | 96.2% | 98.9% | 98.9% | GREEN |
| lib/cache | 98.1% | 95.2% | 96.8% | 98.6% | GREEN |
| lib/github | 97.4% | 96.6% | 93.1% | 99.2% | GREEN |
| lib/analytics | 97.3% | 91.2% | 100% | 98.5% | GREEN |
| lib/history | 98.3% | 96.6% | 100% | 99.0% | GREEN |
| lib/i18n | 100% | 97.9% | 96.3% | 100% | GREEN |
| lib/verification | 100% | 100% | 100% | 100% | GREEN |
| lib/feature-flags | 100% | 100% | 100% | 100% | GREEN |
| lib/dashboard | 100% | 94.3% | 100% | 100% | GREEN |
| lib/insights | 100% | 92.6% | 100% | 100% | GREEN |
| lib/profile | 100% | 91.2% | 100% | 100% | GREEN |

## Gaps & Recommendations
**Critical-path gaps (lib/impact, lib/render, lib/db, app/api): NONE** — 0/75 untested source files; all files ≥80% on every metric.

Sub-80% files (all P3 carries, no critical-path impact):
- `apps/web/app/experiments/error.tsx` — 0% (JSDOM-blocked, flag-gated route)
- `apps/web/app/experiments/loading.tsx` — 0% (JSDOM-blocked, flag-gated route)
- `apps/web/app/experiments/heatmap-wave/page.tsx` — 73.3% stmts / 60% funcs (Canvas/WebGL)
- `apps/web/app/experiments/metallic-shimmer/page.tsx` — 77.4% stmts (Canvas/WebGL)
- `apps/web/lib/effects/interactions/HolographicOverlay.tsx` — 50% stmts (Canvas/WebGL)
- `apps/web/components/ClientInstrumentation.tsx` — 60% stmts (next/dynamic lazy wrapper)
- `apps/web/components/GlobalCommandBarLazy.tsx` — 60% stmts (next/dynamic lazy wrapper)
- `apps/web/components/SharePageOwnerContentLazy.tsx` — 66.7% stmts (next/dynamic lazy wrapper)
- `packages/shared/package.json` + `tsconfig.json` — false positive (v8 instrumenting JSON; `packages/shared/src/` TS at 100%)

Watch (carry): `lib/github/client.ts` 93.1% funcs — 2 uncovered inflight-dedup edges. Low priority.

## Flaky Tests
**1 flaky test detected** (P2):

- `apps/web/app/admin/engagement/engagement-dashboard.test.tsx > EngagementDashboard > "handles campaign fetch non-ok response silently"` (lines 265–286)
  - **Symptom**: `TestingLibraryElementError: Unable to find an element with the text: /No engagement template created yet/`
  - **Runs**: Failed in run 2 (7115 reported, suite aborted early) AND run 3 (7588/7589). Passed in run 1 (with coverage) and in isolation (21/21 in 2.27s).
  - **Root cause**: Race condition. The `waitFor` only watches the `/engagement/` header text (always present), then asserts `getByText(/No engagement template created yet/)` synchronously. After the non-ok campaigns fetch resolves, the component may not yet have re-rendered the empty-state copy when the assertion fires.
  - **Fix**: Move the empty-state assertion inside a `waitFor` block (or use `findByText`), and prefer asserting on a state-specific anchor instead of the always-present header.
