# Coverage Report
> Generated: 2026-06-10 | Health status: green

## Executive Summary
All 7590 tests pass across 445 files at 96.78% statement coverage, with every critical path (impact 99.59%, render 100%, app/api 97.48%, db 96.48%) well above the 80% bar. Three full suite runs were identical — zero flaky tests detected. HEAD pinned at `48206b13` (no code-surface change vs the 2026-06-08 cycle); coverage is flat within v8 noise.

## Coverage by Module
| Module | Coverage (stmts) | Status |
|--------|------------------|--------|
| lib/impact | 99.59% | ✅ green |
| lib/render | 100.00% | ✅ green |
| app/api | 97.48% | ✅ green |
| lib/db | 96.48% | ✅ green |
| lib/cache | 98.13% | ✅ green |
| lib/auth | 98.00% | ✅ green |
| lib/github | 97.35% | ✅ green |
| lib/analytics | 97.30% | ✅ green |
| lib/history | 98.26% | ✅ green |
| lib/email | 97.57% | ✅ green |
| lib/verification | 100.00% | ✅ green |
| components | 96.40% | ✅ green |
| packages/shared | 91.60% | ✅ green |
| **Overall** | **96.78%** (8980/9278) | ✅ green |

Branches 92.65% (4833/5216) · Functions 95.77% (1860/1942) · Lines 97.89% (8201/8377).

## Gaps & Recommendations
No critical-path gaps. The two critical-path source files lacking a direct `.test.ts` — `app/api/auth/bitbucket/config.ts` and `app/api/auth/codeberg/config.ts` — are both confirmed at **100% stmts** via transitive route-test coverage. No action needed.

Files <80% statements (all P3 carries, none on a critical path):
- `app/experiments/error.tsx` / `loading.tsx` — 0% (JSDOM "navigation to another Document"; flag-gated experiments pages).
- `lib/effects/interactions/HolographicOverlay.tsx` — 50% (Canvas/WebGL, not exercisable in JSDOM).
- `app/experiments/heatmap-wave/page.tsx` — 73.33%, `app/experiments/metallic-shimmer/page.tsx` — 77.41% (Canvas/WebGL).
- `components/ClientInstrumentation.tsx` — 60%, `GlobalCommandBarLazy.tsx` — 60%, `SharePageOwnerContentLazy.tsx` — 66.66% (`next/dynamic` lazy wrappers; thin shells).
- `packages/shared/package.json` / `tsconfig.json` — 0% (config-file false positives; `src/` TypeScript is 100%).

Optional polish (non-blocking): `/api/studio/config` (lowest critical-path route at 92.3% stmts / 85.71% br) and `admin/bulk-recalculate` edge branches.

## Flaky Tests
None detected. Three full suite runs (1 instrumented + 2 plain) each returned 7590/7590 across 445/445 files, identical. No worker-pool contention this cycle (~46s instrumented / ~29s plain).
