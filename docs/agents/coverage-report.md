```markdown
# Coverage Report
> Generated: 2026-07-08 | Health status: green

## Executive Summary
The full suite passed cleanly — 8,251/8,251 tests across 479 files (114s, `--maxWorkers=3`) — with overall coverage at **96.58% statements / 92.64% branches / 95.29% functions / 97.79% lines**, a slight improvement over the 2026-06-30 baseline (96.31% stmts). All four critical paths (scoring, rendering, API routes, database layer) are ≥97% statements, and the previously flagged `lib/gitlab/queries.ts` branch gap (71.8%) is confirmed closed at 97.2%.

## Coverage by Module
| Module | Coverage | Status |
|--------|----------|--------|
| `apps/web/lib/impact` (scoring pipeline) | 99.6% stmts / 98.7% br / 100% fn | ✅ Green |
| `apps/web/lib/render` (SVG rendering) | 100% stmts / 93.4% br / 100% fn | ✅ Green |
| `apps/web/app/api` (API routes) | 97.4% stmts / 94.1% br / 96.2% fn | ✅ Green |
| `apps/web/lib/db` (database layer) | 97.3% stmts / 94.6% br / 100% fn | ✅ Green |
| `apps/web/lib/auth` | 97.3% stmts / 94.8% br | ✅ Green |
| `apps/web/lib/cache` | 97.1% stmts / 92.6% br | ✅ Green |
| `apps/web/lib/gitlab` | 100% stmts / 97.2% br | ✅ Green (was yellow) |
| `apps/web/lib/history` | 98.3% stmts / 96.6% br | ✅ Green |
| `apps/web/lib/email` | 97.7% stmts / 94.9% br | ✅ Green |
| `apps/web/lib/verification` | 100% across the board | ✅ Green |
| `packages/shared` | 100% across the board | ✅ Green |
| `apps/web/components` | 95.8% stmts / 90.6% br | ✅ Green |
| `apps/web/app` (pages) | 94.8% stmts / 89.2% br | 🟡 Yellow (experiments-only drag) |
| `apps/web/lib/effects` | 93.3% stmts / 88.5% br | 🟡 Yellow (Canvas/WebGL limits) |

## Gaps & Recommendations
All critical paths are green; every remaining gap is in non-critical UI code, and most are known P3 carries (JSDOM cannot exercise Canvas/WebGL or `next/dynamic` lazy-mount paths).

- **`apps/web/components/ClientInstrumentation.tsx`** — 60% stmts, **no sibling test file**. Only true untested file outside experiments; a small render test mocking the instrumentation hook would close it.
- **`apps/web/components/SharePageOwnerContentLazy.tsx`** — 66.7% stmts, **no sibling test file**. `next/dynamic` wrapper; loader callback branch unexercised (same accepted pattern as `GlobalCommandBarLazy`, which has a test but sits at 60% for the same reason).
- **`apps/web/components/ClientErrorReporter.tsx`** — 61.1% stmts / 33.3% br despite having a test; the error-dedup and report-transport branches are unexercised and are testable in JSDOM. Best-value fix in this list.
- **`apps/web/app/experiments/error.tsx` / `loading.tsx`** — 0% stmts; trivial boundary components behind the experiments feature flag (accepted carry).
- **Experiments pages** (`glassmorphism` 70.6%, `heatmap-wave` 73.3%, `metallic-shimmer` 78.1%, `particle-core.ts` 58% br) — Canvas/WebGL rendering paths unreachable in JSDOM; long-standing accepted P3 carries, no action.
- **Branch-only watch items** (stmts ≥80%): `AuthorTypewriter.tsx` 67.5% br, `ParticleBackground.tsx` 68% br, `lib/i18n/provider.tsx` 61.5% br (JSDOM locale-switch limitation, known carry).
- **`lib/db/campaigns/crud.ts` / `sends.ts`** have no sibling test files but are covered indirectly at 99.1%/98.6% stmts via the campaigns suite — not a gap, noted for file-placement convention only.

## Flaky Tests
None detected
```

SHARED_CONTEXT_START
## Coverage Agent — 2026-07-08
- **Status**: GREEN
- Overall coverage: 96.58% stmts / 92.64% branches / 95.29% funcs / 97.79% lines (8,251 tests / 479 files, all passing, single clean run)
- Critical gaps: none in critical paths — lib/impact 99.6%, lib/render 100% stmts, app/api 97.4%, lib/db 97.3%. Remaining sub-80% files are experiments (Canvas/WebGL), lazy wrappers, `ClientInstrumentation.tsx` (60%, no test file), and `ClientErrorReporter.tsx` (61%, dedup/transport branches untested — best-value fix)
- Flaky tests: 0

**Cross-agent recommendations:**
- [Security]: No security-relevant gaps. lib/auth 97.3%, lib/render 100% stmts (all escapeXml paths), lib/verification 100%, lib/gitlab branch gap from June cycles confirmed closed (97.2% br).
- [QA]: Suite grew 8,193 → 8,251 (+58) since 2026-07-07 triage with coverage improving slightly — new code shipped with tests. Only actionable item: `ClientErrorReporter.tsx` branch coverage (33%) is JSDOM-testable; `ClientInstrumentation.tsx` lacks any sibling test.
SHARED_CONTEXT_END
