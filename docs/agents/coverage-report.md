# Coverage Report
> Generated: 2026-04-08 | Branch: `develop` | Health status: green

## Executive Summary

All critical paths (scoring, rendering, API, DB) remain at ≥90% across all metrics. Overall coverage edged up +0.14pp stmts and +0.19pp branch vs the prior cycle. The three v2.7.x craft-recompute P1s resolved last triage are confirmed closed — only minor P3-level branch gaps remain.

## Coverage by Module

| Module | Stmts | Branches | Funcs | Lines | Status |
|--------|-------|----------|-------|-------|--------|
| `lib/impact` (5 files) | 100.0% | 98.5% | 100.0% | 100.0% | GREEN |
| `lib/render` (11 files) | 100.0% | 92.7% | 100.0% | 100.0% | GREEN |
| `app/api` (46 files) | 97.6% | 94.8% | 97.4% | 97.8% | GREEN |
| `lib/db` (11 files) | 97.6% | 95.2% | 100.0% | 99.8% | GREEN |
| `lib/cache` (3 files) | 99.2% | 97.9% | 95.8% | 100.0% | GREEN |
| `lib/github` (4 files) | 96.8% | 91.9% | 96.2% | 97.5% | GREEN |
| `lib/auth` (11 files) | 98.1% | 96.4% | 100.0% | 99.2% | GREEN |
| `lib/history` (6 files) | 98.2% | 96.5% | 100.0% | 99.0% | GREEN |
| `lib/email` (7 files) | 97.9% | 96.7% | 100.0% | 98.1% | GREEN |
| `components` (48 files) | 95.9% | 90.2% | 93.6% | 98.2% | GREEN |
| `packages/shared` (11 files) | 100.0% | 100.0% | 100.0% | 100.0% | GREEN |

**Overall:** 93.13% stmts (7579/8138) · 89.87% branch (4209/4683) · 89.94% funcs (1538/1710) · 94.31% lines (6912/7329)

**Delta vs 2026-04-07:** +0.14pp stmts · +0.19pp branch · +0.00pp funcs · +0.14pp lines

## Gaps & Recommendations

### P3 — Minor (no regression risk, low priority)

- **`app/api/refresh/route.ts`** — funcs=75% (3/4). The `.catch(() => {})` callback on the fire-and-forget `updateCraftCache()` call is not exercised. All other paths including the `dbReplaceSnapshot` catch and the successful craft path are covered. Add a test that makes `updateCraftCache` reject to close this.

- **`lib/render/svg-to-png.ts`** — branches=66.7% (2/3). The fallback branch in `const fontsDir = existsSync(appRelative) ? appRelative : monoRelative` (line 38) is never taken in test environments — `appRelative` always resolves. Accepted: integration-environment only path.

- **`lib/render/demoData.ts`** / **`lib/render/archetypeDemoData.ts`** — branches=50% each. The `?? 0` nullish coalescing arm (when `LEVEL_TO_COUNT[LEVEL_GRID[week]![day]!]` is `undefined`) is never exercised. Accepted: static demo data; `undefined` slot is not reachable in practice.

- **`components/AuthorTypewriter.tsx`** — branches=67.5%. JSDOM timing limitation prevents testing the typewriter animation branches. Accepted since 2026-03-28 triage.

- **`components/UserMenu.tsx`** — funcs=79.31% (23/29). `handleInsightsFile` complex handler logic. Low-priority — UI-only, no business logic risk.

### Accepted Limitations (unchanged)

- All `app/experiments/*` pages: canvas/WebGL rendering not testable in JSDOM.
- `app/layout.tsx`, `app/admin/page.tsx`, `app/studio/page.tsx`: Next.js server pages, 0% instrumented — not meaningful.
- `ClientAnalytics.tsx`, `apple-icon.tsx`, `icon.tsx`: static assets / client-only bootstrap — 0% expected.
- `components/GlobalCommandBarLazy.tsx` / `ShareBadgePreviewLazy.tsx`: `next/dynamic` wrappers — only module-shape tests cover them; runtime behavior tested via the wrapped components.

## Flaky Tests

None detected across 3 consecutive full runs (390 files / 7000 tests each).

The BadgeToolbar download-strip flake (2/4 runs in 2026-04-06 cycle) did not recur — monitoring closed. The coverage/.tmp race condition workaround from last cycle (`mkdir -p coverage/.tmp`) remains unnecessary in practice — no infrastructure failures observed this cycle.

---

## Shared Context Entry

<!-- ENTRY:START agent=coverage timestamp=2026-04-08T02:00:00Z -->
## Coverage Agent — 2026-04-08
- **Status**: GREEN
- Overall coverage: **93.13% stmts** (7579/8138), 89.87% branch, 89.94% funcs, 94.31% lines
- Test suite: 390 files, 7000 tests, 100% pass rate across 3 runs — no flakiness
- Delta vs 2026-04-07: +0.14pp stmts, +0.19pp branch, 0pp funcs, +0.14pp lines — plateau-stable
- All critical paths GREEN: lib/impact 100%, lib/render 100%, packages/shared 100%, lib/cache 99.2%, lib/history 98.2%, lib/auth 98.1%, lib/email 97.9%, app/api 97.6%, lib/db 97.6%, lib/github 96.8%, components 95.9%
- **All v2.7.x P1s confirmed closed**: tool-insights.ts 97.6%, recalculate funcs 100%, refresh funcs now at 75% (1 fire-and-forget catch uncovered — P3 only)
- **P3 ONLY**: refresh/route.ts catch arrow (1 func), svg-to-png fallback branch, demoData/archetypeDemoData null-coalescing arm, AuthorTypewriter JSDOM timing
- **Flaky RESOLVED**: BadgeToolbar flake 0/3 recurrences — closed

**Cross-agent recommendations:**
- [Security]: No new security-relevant coverage gaps. All previously flagged dbRecomputeCraft error paths are confirmed covered.
- [QA]: No open P1s or P2s. Only P3 branch gaps remain — all in low-risk fire-and-forget or static-data paths.
- [Cost Analyst]: app/api 97.6%, lib/db 97.6% — both improved. tool-insights.ts P2-2 confirmed resolved.
<!-- ENTRY:END -->
