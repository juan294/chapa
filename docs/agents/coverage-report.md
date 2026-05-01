# Coverage Report
> Generated: 2026-05-01 | Health status: green

## Executive Summary
Suite is fully green at 7294/7294 across 412 files with overall **93.39% statements / 89.92% branches / 90.89% funcs / 94.43% lines**. All critical paths (impact, render, app/api, db) sit at 96%+ — the prior 6-cycle `og-image/route.ts` carry has been retired, leaving only accepted P3 gaps in JSDOM-blocked Canvas/WebGL experiments and overload-signature demo data.

## Coverage by Module
| Module | Stmts | Branches | Funcs | Lines |
|--------|-------|----------|-------|-------|
| apps/web/lib/impact | 99.59% | 98.67% | 100.00% | 99.53% |
| apps/web/lib/render | 100.00% | 92.86% | 100.00% | 100.00% |
| apps/web/lib/db | 96.48% | 93.32% | 100.00% | 98.68% |
| apps/web/app/api | 97.48% | 94.22% | 96.80% | 97.85% |
| apps/web/lib/auth | 98.00% | 96.12% | 98.85% | 98.87% |
| apps/web/lib/cache | 98.13% | 95.16% | 96.77% | 98.58% |
| apps/web/lib/github | 97.35% | 96.64% | 93.10% | 99.22% |
| apps/web/lib/bitbucket | 97.70% | 93.10% | 96.43% | 100.00% |
| apps/web/lib/codeberg | 98.03% | 94.52% | 96.30% | 100.00% |
| apps/web/lib/email | 97.57% | 94.74% | 100.00% | 97.98% |
| apps/web/lib/analytics | 97.30% | 89.47% | 100.00% | 98.51% |
| apps/web/lib/history | 98.26% | 96.55% | 100.00% | 99.01% |
| apps/web/lib/profile | 100.00% | 92.73% | 100.00% | 100.00% |
| apps/web/lib/insights | 100.00% | 92.64% | 100.00% | 100.00% |
| apps/web/lib/async | 100.00% | 100.00% | 100.00% | 100.00% |
| apps/web/lib/log | 100.00% | 100.00% | 100.00% | 100.00% |
| apps/web/lib/env | 100.00% | 87.50% | 100.00% | 100.00% |
| apps/web/lib (other) | 96.37% | 93.13% | 96.32% | 97.14% |
| apps/web/app (pages) | 93.04% | 88.46% | 95.77% | 92.89% |
| apps/web/app/admin | 95.60% | 92.33% | 91.49% | 96.82% |
| apps/web/app/u (share) | 96.77% | 93.33% | 93.94% | 97.97% |
| apps/web/app/experiments | 56.68% | 51.22% | 52.56% | 60.25% |
| apps/web/components | 96.14% | 89.90% | 95.66% | 97.90% |
| packages/shared | 91.60% | 100.00% | 100.00% | 90.83% |
| **Total** | **93.39%** | **89.92%** | **90.89%** | **94.43%** |

Critical paths (impact / render / app/api / db) are all GREEN. No critical-path file falls below 80% on stmts or funcs this cycle.

## Gaps & Recommendations

### Critical-path P2 — RESOLVED THIS CYCLE
- `app/u/[handle]/og-image/route.ts` — 6-cycle 60% funcs carry retired; now 100% (per Apr 30 triage).
- `lib/cache/dirty-stats.ts` — 75% funcs gap closed; now 100%.
- `components/SharePageOwnerContent.tsx` — 75% funcs gap closed; now 100%.

### Critical-path P3 (accepted)
- `apps/web/lib/render/archetypeDemoData.ts` and `apps/web/lib/render/demoData.ts` — both 100% stmts/funcs but **50% branches** (TypeScript overload signatures appear as untaken branches; not real code paths). Stable, no action.

### Untested critical-path files (no sibling test)
- `apps/web/app/api/auth/bitbucket/config.ts` — pure config object, exercised transitively by the bitbucket OAuth route tests. Not actionable.
- `apps/web/app/api/auth/codeberg/config.ts` — same shape. Not actionable.

### Non-critical gaps (P3 accepted, all pre-existing)
- `apps/web/app/experiments/**` — Canvas/WebGL pages can't be exercised in JSDOM. Module sits at 56.68% stmts. Accepted.
- `apps/web/lib/effects/interactions/HolographicOverlay.tsx` — 50% stmts (Canvas).
- `apps/web/lib/effects/backgrounds/ParticleBackground.tsx` — 90.35% stmts / 77.77% funcs (Canvas).
- Framework shells with no logic — `app/layout.tsx`, `app/icon.tsx`, `app/apple-icon.tsx`, `app/cli/authorize/error.tsx`, `app/studio/page.tsx`, `app/admin/page.tsx`, `components/ClientAnalytics.tsx`, `components/ClientInstrumentation.tsx`, `app/experiments/error.tsx`, `app/experiments/loading.tsx` — 0% but no executable logic. Accepted.
- `lib/env.ts` — 100% stmts/funcs / 87.5% branches (one uncovered ternary in env coercion). Minor.

### Action items
- None mandatory. Suite is healthy and the long-running `og-image` carry is finally retired. If a future cycle wants to clear the last branch gap, add a single test for the `lib/env.ts` ternary fallback.

## Flaky Tests
None detected. Three consecutive full runs passed 7294/7294 with zero failures (durations: 70s with coverage, 30s, 20s). The `BadgeToolbar > strips @keyframes` intermittent flake noted in the 2026-04-30 coverage entry did **not** recur across these three runs.
