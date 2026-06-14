# Coverage Report
> Generated: 2026-06-14 | Health status: green

## Executive Summary
All 7,590 tests pass with 96.78% statement coverage; every critical path (impact, render, api, db) sits well above the 80% threshold, and no genuine flaky tests were found across three runs.

## Coverage by Module
| Module | Coverage (stmts) | Status |
|--------|------------------|--------|
| apps/web/lib/impact | 99.59% | ✅ |
| apps/web/lib/render | 100.00% | ✅ |
| apps/web/app/api | 97.48% | ✅ |
| apps/web/lib/db | 96.48% | ✅ |
| apps/web/lib/cache | 98.13% | ✅ |
| apps/web/lib/auth | 98.00% | ✅ |
| apps/web/lib/github | 97.35% | ✅ |
| apps/web/lib/analytics | 97.30% | ✅ |
| apps/web/lib/history | 98.26% | ✅ |
| apps/web/lib/email | 97.57% | ✅ |
| apps/web/lib/verification | 100.00% | ✅ |
| apps/web/components | 96.46% | ✅ |
| packages/shared/src | 100.00% | ✅ |
| **Overall** | **96.78%** (8980/9278) | ✅ |

Overall: 96.78% stmts / 92.65% branches / 95.77% funcs / 97.88% lines.

## Gaps & Recommendations
No real gaps in the critical paths (impact / render / api / db). No untested source files in `lib/impact`, `lib/render`, or `lib/db`; every `app/api` route has a `route.test.ts`. The two non-route helpers without a direct test file — `app/api/auth/bitbucket/config.ts` and `app/api/auth/codeberg/config.ts` — are both at **100% statements** via transitive route-test coverage.

All 10 files below 80% are previously-accepted P3 carries, none on a critical path:
- `app/experiments/error.tsx` (0%), `app/experiments/loading.tsx` (0%) — flag-gated experiment routes; JSDOM cannot exercise (`navigation to another Document`).
- `app/experiments/heatmap-wave/page.tsx` (73.33%), `app/experiments/metallic-shimmer/page.tsx` (77.41%), `lib/effects/interactions/HolographicOverlay.tsx` (50%) — Canvas/WebGL effects not exercisable in JSDOM.
- `components/ClientInstrumentation.tsx` (60%), `components/GlobalCommandBarLazy.tsx` (60%), `components/SharePageOwnerContentLazy.tsx` (66.66%) — thin `next/dynamic` lazy wrappers.
- `packages/shared/package.json` (0%), `packages/shared/tsconfig.json` (0%) — false positives; these are JSON config files, not source (the `src/` TypeScript is 100%).

Optional polish only (all already ≥80%): `app/api/studio/config` and `app/admin/bulk-recalculate` edge branches, and `campaigns-dashboard` function coverage (admin-only).

## Flaky Tests
None detected. Three full-suite runs:
- Run 1 (instrumented): 7590/7590 passed, 445/445 files
- Run 2 (instrumented): 7590/7590 passed, 445/445 files
- Run 3 (plain): 7484/7484 passed, 433/445 files — 12 files failed to **start** with `[vitest-pool]: Timeout waiting for worker to respond` (host worker-pool/file-descriptor exhaustion, an environmental condition documented in prior QA cycles), not assertion failures.

All 12 affected files were re-run in isolation and passed cleanly (12 files / 106 tests), confirming no genuine flakiness — only the known shared-host worker-spawn contention. Recommend serializing concurrent vitest jobs on shared hosts so coverage/QA runs don't collide.
