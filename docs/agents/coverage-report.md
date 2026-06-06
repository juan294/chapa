# Coverage Report
> Generated: 2026-06-06 | Health status: green

## Executive Summary
The suite is healthy: **7590/7590 tests pass across 445 files** at **96.77% statement coverage** (92.6% branches, 95.7% functions, 97.9% lines), with all critical paths — scoring, rendering, API routes, and the database layer — well above the 80% bar. Three consecutive full runs produced identical results; **zero flaky tests** detected.

## Coverage by Module
| Module | Coverage (stmts) | Status |
|--------|------------------|--------|
| lib/impact (scoring) | 99.59% | 🟢 |
| lib/render (SVG) | 100.00% | 🟢 |
| app/api (routes) | 97.48% | 🟢 |
| lib/db (database) | 96.48% | 🟢 |
| lib/cache | 98.13% | 🟢 |
| lib/auth | 98.00% | 🟢 |
| lib/github | 97.35% | 🟢 |
| lib/analytics | 97.30% | 🟢 |
| lib/history | 98.26% | 🟢 |
| lib/email | 97.57% | 🟢 |
| lib/i18n | 100.00% | 🟢 |
| components | 96.44% | 🟢 |
| packages/shared | 91.60% | 🟢 |
| **Overall** | **96.77%** | 🟢 |

## Gaps & Recommendations
No critical-path gaps. All files below 80% statement coverage are accepted P3 carries (flag-gated, Canvas/WebGL, or lazy-wrapper/JSON-config false positives):

- `apps/web/app/experiments/error.tsx` — 0% (flag-gated; JSDOM cannot execute "navigation to another Document")
- `apps/web/app/experiments/loading.tsx` — 0% (flag-gated; same JSDOM limitation)
- `apps/web/app/experiments/heatmap-wave/page.tsx` — 73.33% (Canvas/WebGL render path)
- `apps/web/app/experiments/metallic-shimmer/page.tsx` — 77.41% (Canvas/WebGL render path)
- `apps/web/lib/effects/interactions/HolographicOverlay.tsx` — 50% (WebGL effect, untestable in JSDOM)
- `apps/web/components/ClientInstrumentation.tsx` — 60% (`next/dynamic` lazy wrapper)
- `apps/web/components/GlobalCommandBarLazy.tsx` — 60% (`next/dynamic` lazy wrapper)
- `apps/web/components/SharePageOwnerContentLazy.tsx` — 66.66% (`next/dynamic` lazy wrapper)
- `packages/shared/package.json`, `packages/shared/tsconfig.json` — 0% (false positives; the `src/` TypeScript is at 100%)

**Untested source files (no sibling `.test.ts`):** only `app/api/auth/{bitbucket,codeberg}/config.ts` — both confirmed at **100% statement coverage via transitive route-test coverage**. No real gaps.

**Watch (carry, low priority):** `lib/github/client.ts` functions ~93% — a couple of in-flight-dedup edges remain uncovered.

## Flaky Tests
None detected. Three full-suite runs (2 instrumented + 1 plain) each returned **7590/7590 passing, 445/445 files** with identical results. The only console noise is JSDOM `navigation to another Document` warnings on the flag-gated experiments error/loading pages (accepted P3) and two `test-agent` fixture-report ERROR lines that are intentional test assertions, not failures.
