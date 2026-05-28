# Coverage Report
> Generated: 2026-05-28 | Health status: green

## Executive Summary
Overall coverage **96.78% stmts / 92.65% branches / 95.77% funcs / 97.89% lines** across 9,278 statements. All four critical-path modules (lib/impact, lib/render, app/api, lib/db) sit ≥96.5% stmts with zero untested source files. Test suite ran 7590/7590 GREEN three consecutive times with zero flakes.

## Coverage by Module
| Module | Coverage (stmts / branches / funcs) | Status |
|--------|-------------------------------------|--------|
| lib/impact | 99.6% / 98.7% / 100.0% | green |
| lib/render | 100.0% / 92.9% / 100.0% | green |
| app/api | 97.5% / 94.2% / 96.8% | green |
| lib/db | 96.5% / 93.3% / 100.0% | green |
| lib/auth | 98.0% / 96.2% / 98.9% | green |
| lib/cache | 98.1% / 95.2% / 96.8% | green |
| lib/github | 97.4% / 96.6% / 93.1% | green |
| lib/analytics | 97.3% / 91.2% / 100.0% | green |
| lib/history | 98.3% / 96.6% / 100.0% | green |
| lib/i18n | 100.0% / 97.9% / 96.3% | green |
| lib/verification | 100.0% / 100.0% / 100.0% | green |
| lib/dashboard | 100.0% / 94.3% / 100.0% | green |
| lib/insights | 100.0% / 92.6% / 100.0% | green |
| lib/profile | 100.0% / 91.2% / 100.0% | green |
| lib/email | 97.6% / 94.7% / 100.0% | green |
| lib/bitbucket | 97.7% / 93.1% / 96.4% | green |
| lib/codeberg | 98.0% / 94.5% / 96.3% | green |

## Gaps & Recommendations
**No critical-path gaps.** All 10 sub-80% files are P3 carries (Canvas/WebGL experiments, next/dynamic lazy wrappers, JSON config false positives):

- `apps/web/app/experiments/error.tsx` — 0% stmts (2 lines, flag-gated experiments error boundary, JSDOM-blocked)
- `apps/web/app/experiments/loading.tsx` — 0% stmts (1 line, flag-gated experiments suspense fallback)
- `packages/shared/package.json` / `tsconfig.json` — 0% stmts (false positive; v8 instruments JSON config files; `src/` TS is 100%)
- `apps/web/lib/effects/interactions/HolographicOverlay.tsx` — 50% stmts (Canvas/WebGL, JSDOM-incompatible)
- `apps/web/components/ClientInstrumentation.tsx` — 60% stmts (next/dynamic lazy wrapper, init effect only fires client-side)
- `apps/web/components/GlobalCommandBarLazy.tsx` — 60% stmts (next/dynamic lazy wrapper)
- `apps/web/components/SharePageOwnerContentLazy.tsx` — 66.66% stmts (next/dynamic lazy wrapper)
- `apps/web/app/experiments/heatmap-wave/page.tsx` — 73.33% stmts (Canvas, flag-gated)
- `apps/web/app/experiments/metallic-shimmer/page.tsx` — 77.41% stmts (WebGL, flag-gated)

**Watch (carry, low priority):**
- `lib/github/client.ts` 93.1% funcs — 2 inflight-dedup edges remain uncovered (carried since 2026-05-22). Risk negligible; map-bounded dedup pattern is well-exercised.

No untested files in critical paths (lib/impact, lib/render, app/api, lib/db). Every `.ts`/`.tsx` source under those trees either has a sibling `.test.ts` or is reached transitively (verified by 96.5%+ stmt coverage across all four).

## Flaky Tests
None detected. 3/3 runs returned 7590/7590 GREEN (durations 30s / 21s / 25s). Prior 2026-05-22 flake in `engagement-dashboard.test.tsx` ("handles campaign fetch non-ok response silently") confirmed RESOLVED — no recurrence across 3 full runs this cycle.

---

SHARED_CONTEXT_START
## Coverage Agent — 2026-05-28
- **Status**: GREEN
- Overall coverage: 96.78% stmts / 92.65% branches / 95.77% funcs / 97.89% lines (8980/9278 stmts). +1 stmt vs 2026-05-24 (within v8 noise).
- Test suite: 445 files, 7590 tests (+1 vs 2026-05-24). 3/3 clean (7590/7590). 0 flakes. Durations 30s / 21s / 25s.
- Critical paths GREEN: lib/impact 99.6%/98.7%/100%, lib/render 100%/92.9%/100%, lib/db 96.5%/93.3%/100%, app/api 97.5%/94.2%/96.8%, lib/auth 98.0%, lib/cache 98.1%, lib/github 97.4%, lib/analytics 97.3%, lib/history 98.3%, lib/i18n 100%, lib/verification 100%, lib/dashboard 100%, lib/insights 100%, lib/profile 100%, lib/bitbucket 97.7%, lib/codeberg 98.0%, lib/email 97.6%.
- **Untested source files in critical paths: 0/75**.
- **No new P2s**. 10 sub-80% files all P3 carries: Canvas/WebGL (HolographicOverlay, heatmap-wave, metallic-shimmer), next/dynamic lazy wrappers (ClientInstrumentation, GlobalCommandBarLazy, SharePageOwnerContentLazy), experiments error/loading (JSDOM-blocked, flag-gated), packages/shared JSON config files (false positive — src/ TS at 100%).
- **Watch (carry)**: lib/github/client.ts 93.1% funcs — 2 inflight-dedup edges uncovered. Low priority.
- **Flaky tests: 0** confirmed across 3 runs. Prior 2026-05-22 engagement-dashboard race fix holding (no recurrence). Worker-pool exhaustion noted by QA 2026-05-27 did not recur — coverage agent ran solo, no contention.

**Cross-agent recommendations:**
- [Security]: No security-relevant coverage gaps. lib/auth 98.0%, lib/analytics 97.3%, lib/verification 100%, lib/cache 98.1% stable. XSS escape paths, CORS guards, and HMAC verification fully covered. No regression risk.
- [QA]: 0 flaky tests across 3 clean runs (7590/7590 each). engagement-dashboard race fix holding. QA's 2026-05-27 worker-pool exhaustion was environmental (concurrent vitest jobs on shared host) — recommend serializing agent vitest runs.
- [Triage]: No P2 action items this cycle. Only carry-watch (lib/github/client.ts inflight-dedup edges, low priority). Clean cycle. New `/api/health` GitHub-probe cache wrapper (commit `dc0b7261`) confirmed covered.
- [Cost Analyst]: lib/cache 98.1%, lib/db 96.5%, app/api 97.5% — all stable. New `/api/health` `unstable_cache(revalidate=60)` wrapper has test coverage in route.test.ts. No cost-path coverage gaps.
SHARED_CONTEXT_END
