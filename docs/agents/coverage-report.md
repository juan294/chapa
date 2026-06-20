# Coverage Report
> Generated: 2026-06-20 | Health status: green

## Executive Summary
Overall coverage is **96.49% statements / 92% branches / 95.03% functions / 97.62% lines** across 7,875 passing tests (456 files). Every critical-path module (scoring, rendering, API routes, database) sits comfortably above the 80% threshold, and three consecutive full-suite runs were byte-identical — no flaky tests detected.

## Coverage by Module
| Module | Coverage (stmts) | Branches | Functions | Status |
|--------|------------------|----------|-----------|--------|
| `lib/impact/` (scoring) | 99.6% | 98.7% | 100.0% | 🟢 green |
| `lib/render/` (SVG) | 99.6% | 91.9% | 100.0% | 🟢 green |
| `app/api/` (API routes) | 97.4% | 93.9% | 96.7% | 🟢 green |
| `lib/db/` (database) | 96.5% | 93.3% | 100.0% | 🟢 green |
| `lib/cache/` | 98.1% | 95.2% | 96.8% | 🟢 green |
| `lib/auth/` | 97.4% | 94.9% | 99.0% | 🟢 green |
| `lib/github/` | 97.0% | 97.8% | 90.6% | 🟢 green |
| **Total** | **96.49%** | **92.0%** | **95.03%** | 🟢 green |

## Gaps & Recommendations
No critical-path file falls below 80% statement coverage. The files flagged below 80% are all non-critical and have documented reasons:

- `app/experiments/error.tsx`, `app/experiments/loading.tsx` — 0% stmts. Flag-gated experimental routes; JSDOM cannot exercise Next.js navigation boundaries ("navigation to another Document"). **P3, accepted.**
- `app/experiments/heatmap-wave/page.tsx` (73.3%), `app/experiments/metallic-shimmer/page.tsx` (77.4%), `lib/effects/interactions/HolographicOverlay.tsx` (50%) — Canvas/WebGL visual experiments, not exercisable under JSDOM. **P3, accepted.**
- `components/ClientInstrumentation.tsx` (60%), `components/GlobalCommandBarLazy.tsx` (60%), `components/SharePageOwnerContentLazy.tsx` (66.7%) — thin `next/dynamic` lazy-loader wrappers; uncovered lines are the dynamic-import fallbacks. **P3, low value.**
- `packages/shared/{eslint.config.mjs,package.json,tsconfig.json}` — config/JSON files reported at 0% (false positive — the actual `src/**` TS is at 100%).

**Untested source files (no sibling `.test.ts`)** — none represent a real gap; all are covered transitively:
- `app/api/auth/{gitlab,codeberg,bitbucket}/config.ts` — 100% stmts via route tests.
- `lib/db/campaigns/{crud,sends,index}.ts` — 98.6–100% stmts via `campaigns` integration tests.
- `lib/db/campaigns/types.ts` — 88.7% stmts (type/schema module, exercised through callers).

No action required. To push branch coverage higher (optional polish): `app/api/studio/config` edge branches and `lib/render` branch paths are the lowest critical-path branch numbers.

## Flaky Tests
None detected. Three consecutive full-suite runs produced identical results: **7,875/7,875 tests passing across 456/456 files** each time. The `[ERROR] test-agent ...` and `Not implemented: navigation to another Document` lines in run output are non-failing fixture/JSDOM console noise, not test failures.
