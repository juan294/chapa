# Coverage Report
> Generated: 2026-04-07 | Branch: `develop` | Health status: green

## Executive Summary

Test suite passes at 92.99% statement coverage (6,955 tests, 389 files). Coverage is plateau-stable — zero delta vs the 2026-04-06 cycle. One critical gap remains open: `lib/db/tool-insights.ts::dbRecomputeCraft` at 72.7% stmts, carried from v2.7.x with no fix yet applied.

## Coverage by Module

| Module | Stmts | Branches | Funcs | Status |
|--------|-------|----------|-------|--------|
| `lib/impact` | 100% | 98% | 100% | GREEN |
| `lib/render` | 100% | 94% | 100% | GREEN |
| `packages/shared` | 100% | 100% | 100% | GREEN |
| `lib/cache` | 99.2% | 97.9% | 95.8% | GREEN |
| `lib/email` | 97.9% | 96.7% | 100% | GREEN |
| `lib/history` | 98.2% | 96.5% | 100% | GREEN |
| `lib/auth` | 98.0% | 97.6% | 100% | GREEN |
| `app/api` | 97.5% | 95.3% | 96.2% | GREEN |
| `lib/github` | 97.5% | 93.6% | 97.4% | GREEN |
| `lib/insights` | 100% | 92.6% | 100% | GREEN |
| `components` | 95.9% | 90.1% | 93.9% | GREEN |
| `lib/effects` | 94.6% | 90.8% | 94.7% | GREEN |
| `app/other` | 94.2% | 91.0% | 93.6% | GREEN |
| `lib/db` | 95.2% | 93.4% | 98.4% | GREEN\* |
| `lib/other` | 89.3% | 86.4% | 87.2% | YELLOW |
| `app/experiments` | 56.1% | 51.2% | 52.6% | RED (accepted) |

\* `lib/db` aggregate is GREEN but contains one outlier file below threshold (see Gaps).

**Overall:** 92.99% stmts (7,568/8,138) · 89.68% branches (4,200/4,683) · 89.94% funcs (1,538/1,710) · 94.17% lines (6,902/7,329)

## Gaps & Recommendations

### P1 — Must Fix

- **`apps/web/lib/db/tool-insights.ts`** — 72.7% stmts / 75% branches (12 uncovered statements)
  - `dbRecomputeCraft` (lines 149–180) has **zero test cases**. Added in v2.7.x, carried 2 cycles.
  - Error path at line 164 (`PGRST116` code) and the re-throw at line 165 are untested.
  - Fix: add `describe("dbRecomputeCraft")` block in `tool-insights.test.ts` — test null-DB, PGRST116, generic error, and success paths.

- **`apps/web/app/api/recalculate/route.ts`** — 100% stmts but 50% funcs
  - The fire-and-forget `updateCraftCache(...).catch(() => {})` arrow at line 62 is never exercised.
  - Fix: add a test with a non-null `craftResult` mock to exercise the `if (craftResult)` branch and confirm the `.catch` runs without throwing.

- **`apps/web/app/api/refresh/route.ts`** — 97% stmts / 75% funcs
  - `dbRecomputeCraft` / `updateCraftCache` calls at lines 67 and 83 are not mocked; the craft path is never exercised in tests.
  - Fix: add 2 tests — one where `dbRecomputeCraft` returns a valid `CraftResult` and one where it returns null.

### P2 — Watch

- **`apps/web/components/AuthorTypewriter.tsx`** — branches 67.5% — early-return paths for empty/null author not fully covered.
- **`apps/web/components/GlobalCommandBarLazy.tsx`** — 50% stmts — lazy-wrapper smoke test exists but rendering branch uncovered.
- **`apps/web/lib/validation.ts`** — 73.3% stmts — several conditional branches around optional fields untested.
- **`apps/web/lib/effects/interactions/HolographicOverlay.tsx`** — 47% stmts — WebGL/canvas; JSDOM limitation, accepted.

### Accepted Limitations (no action needed)

- `app/experiments/*` — WebGL, Canvas, particle effects; JSDOM cannot exercise these (56.1% accepted).
- `app/layout.tsx`, `app/apple-icon.tsx`, `app/icon.tsx` — Next.js server-only files; 0% by design.
- `app/admin/page.tsx`, `app/studio/page.tsx` — Server pages, covered by integration tests only.
- `components/ClientAnalytics.tsx` — PostHog browser-only init; 0% by design.

## Flaky Tests

One flaky run detected in 5 total (runs: 1 coverage + 4 no-coverage):

- **Run 3 of 5** — 1 failed / 383 files (vs 389 expected), duration 235s (vs ~16s normal). Root cause: `coverage/.tmp/` directory race condition — vitest v8 workers try to write temp coverage files to a directory that gets cleaned between runs. Workaround confirmed: `mkdir -p coverage/.tmp` before the run resolves it. This is an **infrastructure flake, not a test logic flake**.

- **`BadgeToolbar.render.test.tsx > download strips SVG animations`** — Previously reported as failing 2/4 cycles (queueMicrotask timing race). **0/4 failures this cycle.** Monitoring continues — likely resolved by a dependency update. If it reappears, fix with `waitFor()`.

---

## SHARED_CONTEXT_ENTRY

```
<!-- ENTRY:START agent=coverage timestamp=2026-04-07T03:00:00Z -->
## Coverage Agent — 2026-04-07
- **Status**: GREEN
- Overall coverage: **92.99% stmts** (7,568/8,138), 89.68% branch, 89.94% funcs, 94.17% lines
- Test suite: 389 files, 6,955 tests, 100% pass rate on 4/5 runs; 1 infrastructure flake (coverage/.tmp race)
- Delta vs 2026-04-06: **0pp all metrics** — no new code, no new tests this cycle. Coverage plateau-stable.
- All critical paths GREEN: lib/impact 100%, lib/render 100%, packages/shared 100%, lib/cache 99.2%, lib/history 98.2%, lib/auth 98%, lib/email 97.9%, app/api 97.5%, lib/db 95.2%, lib/github 97.5%, components 95.9%
- **P1 CARRIED**: `lib/db/tool-insights.ts::dbRecomputeCraft` (lines 149–180) — 0 test cases, 72.7% stmts, 3rd cycle without fix
- **P1 CARRIED**: `app/api/recalculate/route.ts` — 50% funcs (fire-and-forget .catch arrow uncovered)
- **P1 CARRIED**: `app/api/refresh/route.ts` — 75% funcs (craft dbRecomputeCraft path not mocked)
- **Flaky RESOLVED**: BadgeToolbar download strip — 0/4 failures this cycle (was 2/4). Monitoring one more cycle.
- **Infra flake NEW**: coverage/.tmp race condition causes occasional full-suite failure — workaround: `mkdir -p coverage/.tmp` before run.

**Cross-agent recommendations:**
- [Security]: dbRecomputeCraft error paths remain untested — silent failure risk in craft refresh/recalculate. P2 security-adjacent, unchanged from last cycle.
- [QA]: 3 P1s all stem from v2.7.x craft-recompute shipping without tests. Top priority: tool-insights.test.ts dbRecomputeCraft describe block.
- [Cost Analyst]: app/api at 97.5%, lib/db at 95.2%. Only tool-insights.ts below 80%. No new cost-critical coverage gaps.
- [Performance]: No performance-coverage gaps. Flaky BadgeToolbar monitor: if returns, apply waitFor() fix.
<!-- ENTRY:END -->
```
