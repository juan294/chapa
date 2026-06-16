# Coverage Report
> Generated: 2026-06-16 | Health status: green

## Executive Summary
Overall coverage is **96.78% statements / 92.56% branches / 95.77% functions / 97.87% lines** across 445 test files and **7594 passing tests** (0 failures, 0 skipped). All critical paths (impact, render, api, db) sit above 96% statements, no source file in those paths is untested, and three full-suite runs produced identical results — **0 flaky tests detected**.

## Coverage by Module
| Module | Coverage (stmt) | Branches | Functions | Status |
|--------|-----------------|----------|-----------|--------|
| `apps/web/lib/impact` (scoring) | 99.59% | 98.67% | 100.00% | 🟢 |
| `apps/web/lib/render` (SVG) | 100.00% | 92.86% | 100.00% | 🟢 |
| `apps/web/app/api` (routes) | 97.48% | 94.22% | 96.80% | 🟢 |
| `apps/web/lib/db` (database) | 96.48% | 93.32% | 100.00% | 🟢 |
| `apps/web/lib/cache` | 98.13% | 95.16% | 96.77% | 🟢 |
| `apps/web/lib/auth` | 98.00% | 96.18% | 98.85% | 🟢 |
| `apps/web/lib/github` | 97.35% | 96.64% | 93.10% | 🟢 |
| `apps/web/lib/history` | 98.26% | 96.55% | 100.00% | 🟢 |
| `apps/web/lib/analytics` | 97.30% | 91.23% | 100.00% | 🟢 |
| `apps/web/lib/email` | 97.57% | 94.74% | 100.00% | 🟢 |
| `apps/web/lib/verification` | 100.00% | 100.00% | 100.00% | 🟢 |
| `apps/web/lib/i18n` | 100.00% | 97.87% | 96.30% | 🟢 |
| `apps/web/components` | 96.46% | 90.11% | 95.72% | 🟢 |
| `packages/shared/src` | 100.00% | 100.00% | 100.00% | 🟢 |
| **Total** | **96.78%** | **92.56%** | **95.77%** | 🟢 |

## Gaps & Recommendations

### Critical paths (impact / render / api / db)
- **No real gaps.** Every source file in `lib/impact`, `lib/render`, and `lib/db` has a co-located `.test.ts`, and every `app/api` route has a `route.test.ts`.
- `apps/web/app/api/auth/bitbucket/config.ts` and `apps/web/app/api/auth/codeberg/config.ts` lack a direct `.test.ts` but are confirmed at **100% statements** via transitive route-test coverage — no action needed.
- Lowest-covered route is `/api/studio/config` (92.3% stmt / 85.71% branch). Optional polish only.

### Files below 80% statements (10) — all P3 carries, none in critical paths
- `app/experiments/error.tsx`, `app/experiments/loading.tsx` — 0% (JSDOM `navigation to another Document`, flag-gated experiments)
- `lib/effects/interactions/HolographicOverlay.tsx` — 50% (Canvas/WebGL, not exercisable in JSDOM)
- `app/experiments/heatmap-wave/page.tsx` — 73.3% (Canvas/WebGL)
- `app/experiments/metallic-shimmer/page.tsx` — 77.4% (Canvas/WebGL)
- `components/ClientInstrumentation.tsx`, `components/GlobalCommandBarLazy.tsx`, `components/SharePageOwnerContentLazy.tsx` — 60–66.7% (`next/dynamic` lazy wrappers; runtime behavior is in the wrapped components)
- `packages/shared/package.json`, `packages/shared/tsconfig.json` — 0% (false positives; `packages/shared/src` TypeScript is 100%)

**Recommendation:** None of the sub-80% files are actionable — they are accepted P3 carries (Canvas/WebGL, flag-gated experiments, lazy wrappers, non-source JSON). No new tests are warranted this cycle.

## Flaky Tests
**None detected.** Three consecutive full-suite runs each returned **7594/7594 passing across 445/445 files**, identical results. The only console noise is two intentional `test-agent` fixture-report ERROR assertions and JSDOM `navigation to another Document` warnings on flag-gated experiment pages — neither is a test failure.
