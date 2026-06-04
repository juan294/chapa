# Coverage Report
> Generated: 2026-06-04 | Health status: green

## Executive Summary
Overall coverage holds at **96.78% statements / 92.65% branches / 95.77% functions / 97.89% lines** across 445 test files and 7,590 tests, all passing. Every critical path (scoring, SVG rendering, API routes, database layer) is well above the 80% threshold; the only sub-80% files are Canvas/WebGL experiments, lazy-load wrappers, and JSON config files — all known, accepted P3 carries.

## Coverage by Module
| Module | Coverage (Stmts) | Status |
|--------|------------------|--------|
| lib/impact (scoring pipeline) | 99.58% | 🟢 |
| lib/render (SVG rendering) | 100% | 🟢 |
| app/api (API routes) | 97.48%* | 🟢 |
| lib/db (database layer) | 96.47% | 🟢 |
| lib/auth | 98.00% | 🟢 |
| lib/cache | 98.12% | 🟢 |
| lib/github | 97.35% | 🟢 |
| lib/analytics | 97.29% | 🟢 |
| lib/history | 98.26% | 🟢 |
| lib/email | 97.41% | 🟢 |
| lib/profile | 100% | 🟢 |
| lib/dashboard | 100% | 🟢 |
| lib/insights | 100% | 🟢 |
| lib/verification | 100% | 🟢 |
| lib/i18n | 100% | 🟢 |
| components | 95.26% | 🟢 |
| lib/effects/interactions | 78.04% | 🟡 (Canvas/WebGL, P3) |
| packages/shared (TS src) | 100% | 🟢 |
| packages/shared (JSON config) | 0% | ⚪ false positive |

\* app/api is reported per-route; lowest route statement coverage is `/api/studio/config` at 92.3%. No route is below 80%.

## Gaps & Recommendations
**No critical-path files fall below 80% — no action required this cycle.** The following sub-80% files are all non-critical, pre-accepted P3 carries:

- `lib/effects/interactions/HolographicOverlay.tsx` — 50% stmts. Canvas/WebGL effect, not unit-testable in JSDOM.
- `app/experiments/error.tsx` & `loading.tsx` — 0% stmts. JSDOM blocks `navigation to another Document`; flag-gated experimental surface.
- `app/experiments/heatmap-wave/page.tsx` — 73.3%, `metallic-shimmer` — 77.4%, `glassmorphism` — 80%. Canvas/animation experiments.
- `components/ClientInstrumentation.tsx` (60%), `GlobalCommandBarLazy.tsx` (60%), `SharePageOwnerContentLazy.tsx` (66.7%) — thin `next/dynamic` lazy wrappers; logic lives in the wrapped (and tested) components.
- `packages/shared/package.json` & `tsconfig.json` — 0%. False positive; the `src/` TypeScript is at 100%.

**Untested source files in critical paths (no colocated `.test.ts`): 2 — both fully covered transitively.**
- `app/api/auth/bitbucket/config.ts` and `app/api/auth/codeberg/config.ts` lack a direct `*.test.ts` but are exercised at 100% stmts/funcs via their route tests. No real gap.

**Watch (low-priority carry):**
- `lib/github/client.ts` — 85.71% funcs; 2 in-flight-dedup edge paths uncovered (line 170). Low priority.

## Flaky Tests
**None detected.** The full suite ran **5 times** this cycle (2 coverage runs + 3 plain runs), each producing an identical `7590 passed (7590)` / `445 files passed`. No test failed or varied across runs.

---
SHARED_CONTEXT_START
## Coverage Agent — 2026-06-04
- **Status**: GREEN
- Overall coverage: 96.78% stmts / 92.65% branches / 95.77% funcs / 97.89% lines (8980/9278 stmts). Flat vs 2026-06-03. HEAD `2d7eb73c`.
- Critical gaps: NONE. lib/impact 99.58%, lib/render 100%, app/api 97.48% (lowest route /api/studio/config 92.3%), lib/db 96.47% — all >80%.
- Flaky tests: 0 (5 full runs this cycle, all 7590/7590 identical; 445 files).

**Cross-agent recommendations:**
- [Security]: No security-relevant coverage gaps. lib/auth 98.0%, lib/analytics 97.29%, lib/verification 100% stable. XSS escape paths and CORS guards fully covered.
- [QA]: 0 flaky tests across 5 runs. 7590 tests / 445 files all green. No host worker-pool contention. The only env noise was JSDOM `navigation to another Document` warnings on flag-gated experiments error/loading pages (0% — accepted P3).
SHARED_CONTEXT_END
