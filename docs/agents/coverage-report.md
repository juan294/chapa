# Coverage Report
> Generated: 2026-06-24 | Branch: `develop` @ `be655b39` | Health status: **GREEN**

## Executive Summary
Overall coverage is **96.32% statements / 92.06% branches / 95.32% functions / 97.53% lines** across 463 test files and 7,976 tests, with every critical-path module (impact, render, app/api, db) at ≥96% statements and **zero critical-path files below 80%**. No genuinely flaky tests were found — earlier failures were environmental worker-pool exhaustion under extreme host load (load avg 120–260 on 12 CPUs); a parallelism-constrained run passed 7,976/7,976 cleanly.

## Coverage by Module
| Module | Statements | Branches | Functions | Status |
|--------|-----------|----------|-----------|--------|
| `lib/impact` (scoring) | 99.6% | 98.7% | 100.0% | 🟢 |
| `lib/render` (SVG) | 99.6% | 92.3% | 100.0% | 🟢 |
| `app/api` (routes) | 97.4% | 93.9% | 96.7% | 🟢 |
| `lib/db` (database) | 96.5% | 93.3% | 100.0% | 🟢 |
| `lib/cache` | 98.1% | 95.2% | 96.8% | 🟢 |
| `lib/auth` | 97.3% | 94.8% | 99.0% | 🟢 |
| `lib/github` | 97.1% | 98.0% | 90.6% | 🟢 |
| `components` | 96.4% | 90.8% | 95.5% | 🟢 |
| `packages/shared` (src) | 88.5%* | 100.0% | 100.0% | 🟢 |
| **Overall** | **96.32%** | **92.06%** | **95.32%** | 🟢 |

\* `packages/shared` is dragged down only by non-runtime config/JSON files (`package.json`, `tsconfig*.json`, `eslint.config.mjs`) reported at 0%; the actual `src/**` TypeScript is fully covered. Coverage thresholds in `vitest.config.ts` (75% stmts / 70% br / 65% fn / 75% lines) all pass with wide margin.

## Gaps & Recommendations

### Critical paths — no real gaps
The four source files in critical paths that lack a sibling `.test.ts` are all **transitively covered** by route/integration tests:

| File | Statements (transitive) |
|------|------------------------|
| `apps/web/app/api/auth/{gitlab,codeberg,bitbucket}/config.ts` | 100% |
| `apps/web/lib/db/campaigns/crud.ts` | 99.1% |
| `apps/web/lib/db/campaigns/sends.ts` | 98.6% |
| `apps/web/lib/db/campaigns/index.ts` | 100% |
| `apps/web/lib/db/campaigns/types.ts` | 88.7% (type/schema module — runtime-light) |

### Sub-80% files (all outside critical paths — P3)
- **NEW this cycle** — `apps/web/app/u/[handle]/SharePageH2.tsx` **33.3%**: a 12-line `'use client'` i18n wrapper added in `be655b39` (localizes the share-page `<h2>`). No branches; a single render test (assert `t('sharePage.h2')` text renders) closes it. **Recommended: add `SharePageH2.test.tsx`.**
- `apps/web/app/experiments/error.tsx` / `loading.tsx` **0%**: JSDOM cannot exercise `navigation to another Document`; flag-gated experimental routes. Accepted P3 carry.
- `apps/web/lib/effects/interactions/HolographicOverlay.tsx` **50%**, `app/experiments/{glassmorphism,heatmap-wave,metallic-shimmer}/page.tsx` **70–77%**: Canvas/WebGL surfaces that JSDOM can't render. Accepted P3 carry.
- `components/{ClientInstrumentation,GlobalCommandBarLazy,SharePageOwnerContentLazy}.tsx` **60–66.7%**: thin `next/dynamic` lazy-loader wrappers. Accepted P3 carry.
- `packages/shared` config/JSON files **0%**: not runtime code (false positive). No action.

## Flaky Tests
**None detected at the test level.** The suite was run three times:

| Run | Parallelism | Result |
|-----|-------------|--------|
| 1 | default (12 forks) | 6 failed — `scripts/lib/agent-utils.test.ts` (timeouts), `scripts/generate-badge-reference.test.ts`, `NavLink.test.tsx` worker-startup timeout |
| 2 | default (12 forks) | 9 failed — `experiments/{3d-tilt,glassmorphism,hexmap,particles}`, `SharePageOwnerContent.render`, scripts (timeouts) |
| 3 (clean) | `--maxWorkers=3` | **0 failed — 7,976/7,976 passed across 463 files** |

The failing test *set changed between the two contended runs* and **disappeared entirely** once parallelism was constrained — the signature of environmental worker-pool exhaustion, not test-level flakiness. Root cause: the host was under extreme contention (load avg **120–260 on 12 CPUs**, 71 active sessions) causing vitest fork workers to exceed their startup/response timeout (`[vitest-pool-runner]: Timeout waiting for worker to respond`). No individual test is inherently non-deterministic.

**Recommendation (infra, not code):** serialize or rate-limit concurrent agent vitest runs on shared hosts, or pin agent coverage runs to `--maxWorkers=3` to avoid colliding with other jobs. This matches the recurring environmental pattern noted by QA cycles (2026-05-22/23/24/27).
