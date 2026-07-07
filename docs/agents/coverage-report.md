```markdown
# Coverage Report
> Generated: 2026-07-07 | Health status: green

## Executive Summary
Full suite passes clean — 8,174/8,174 tests across 477 files (112s, `--maxWorkers=3`) on HEAD `29d2b524` (v2.16.0) — with overall coverage of **96.42% statements / 92.17% branches / 95.40% functions / 97.58% lines**, a slight improvement over the 2026-06-30 baseline (96.31%/92.15%). All four critical paths (impact scoring, SVG rendering, API routes, database layer) are at or above 97% statements; the prior largest gap (`lib/gitlab/queries.ts`, 71.8% branches) is confirmed closed at 100%/97.2%.

## Coverage by Module
| Module | Coverage | Status |
|--------|----------|--------|
| `apps/web/lib/impact` (scoring) | 99.6% stmts / 98.7% br / 100% fn | 🟢 |
| `apps/web/lib/render` (SVG) | 100% stmts / 93.4% br / 100% fn | 🟢 |
| `apps/web/app/api` (API routes) | 97.1% stmts / 91.1% br / 96.2% fn | 🟢 |
| `apps/web/lib/db` (database) | 97.3% stmts / 94.6% br / 100% fn | 🟢 |
| `apps/web/lib/auth` | 97.3% stmts / 94.8% br | 🟢 |
| `apps/web/lib/cache` | 97.1% stmts / 92.6% br | 🟢 |
| `apps/web/lib/history` | 98.3% stmts / 96.6% br | 🟢 |
| `apps/web/lib/gitlab` | 100% stmts / 97.2% br | 🟢 (was 75.2% br — gap closed 2026-07-01) |
| `apps/web/lib/verification` | 100% all metrics | 🟢 |
| `apps/web/lib/email` | 97.7% stmts / 94.9% br | 🟢 |
| `apps/web/lib/i18n` | 97.5% stmts / 89.7% br | 🟢 |
| `apps/web/components` | 95.7% stmts / 90.2% br | 🟢 |
| `apps/web/app` (pages) | 94.8% stmts / 89.2% br | 🟢 |
| `apps/web/lib/effects` (experiments) | 93.3% stmts / 88.5% br | 🟡 (Canvas/WebGL, accepted) |
| `apps/web/lib/codeberg` | 93.1% stmts / 86.8% br | 🟡 |
| `packages/shared` | 100% stmts on all 7 `src/` files | 🟢 (89.7% aggregate is an artifact of 4 config files — `package.json`, `tsconfig*.json`, `eslint.config.mjs` — counted at 0%; recommend excluding from coverage collection) |

## Gaps & Recommendations
- **`apps/web/app/api/telemetry/route.ts` — 43.6% branches (87.1% stmts)**: the only critical-path file below 80% on any metric. It has both `route.test.ts` and `route.contract.test.ts`, but the durable-write observability branches added in the reliability-hardening commits (`ac7e465f`..`3d3bc29f`) are not exercised. Recommend adding tests for the capture/logging failure branches. **This is the one actionable P2 this cycle.**
- `apps/web/lib/i18n/provider.tsx` — 61.5% branches (carry): JSDOM locale-switch branches; unchanged for 4+ cycles.
- `apps/web/components/ClientErrorReporter.tsx` — 61.1% stmts / 33.3% branches: error-reporting wiring; low risk but cheap to cover with a window-event test.
- Lazy-wrapper components (`GlobalCommandBarLazy`, `SharePageOwnerContentLazy`, `ClientInstrumentation`) — 60–67% stmts: `next/dynamic` shells, accepted P3 carries.
- Experiments pages (`glassmorphism`, `heatmap-wave`, `metallic-shimmer`, `particle-core`, `HolographicOverlay`) — 50–83% stmts: Canvas/WebGL not exercisable in JSDOM, accepted P3 carries per `docs/accepted-risks.md` posture.
- **Untested files (no sibling test)**: `lib/db/campaigns/{crud,sends,index}.ts` have no sibling test files but are covered at 98.6–100% via the `campaigns.test.ts` barrel suite — no action needed. `lib/history/types.ts` is type-only. **Zero genuinely untested critical-path files.**
- Coverage-config hygiene: exclude `packages/shared` JSON/config files from v8 collection so the module aggregate reflects the true 100% of `src/`.

## Flaky Tests
None detected
```

SHARED_CONTEXT_START
## Coverage Agent — 2026-07-07
- **Status**: GREEN
- Overall coverage: 96.42% stmts / 92.17% branches / 95.40% funcs / 97.58% lines on HEAD `29d2b524` (v2.16.0). Suite grew 473→477 files, 8,114→8,174 tests (+60, from the reliability-hardening contract suite and v2.16.0 fixes). All passing, 112s under `--maxWorkers=3`.
- Critical gaps: only one — `app/api/telemetry/route.ts` at **43.6% branches** (durable-write observability branches from the reliability commits are untested despite two sibling test files). Everything else: lib/impact 99.6%, lib/render 100% stmts, app/api 97.1%, lib/db 97.3%. Prior largest gap `lib/gitlab/queries.ts` confirmed closed (100% stmts / 97.2% br module). `packages/shared` src/ files all 100% — the 89.7% aggregate is config-file noise (recommend coverage exclude).
- Flaky tests: 0

**Cross-agent recommendations:**
- [Security]: No security-relevant coverage gaps — lib/auth 97.3%, lib/render 100% stmts (all `escapeXml` paths covered), lib/verification 100%. The telemetry branch gap is observability-only, not an auth/input-validation surface.
- [QA]: Suite stable and clean at 8,174/8,174, 0 flakes. One P2 for triage: add branch tests for `app/api/telemetry/route.ts` failure/capture paths (43.6% br); plus P3 config hygiene to exclude `packages/shared` JSON/config files from v8 collection.
SHARED_CONTEXT_END
