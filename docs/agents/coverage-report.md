```markdown
# Coverage Report
> Generated: 2026-07-01 | Health status: green

## Executive Summary
473 test files / 8,114 tests all passing on HEAD `e54c7a6b`. Overall coverage is 96.31% statements / 92.15% branches / 95.32% functions / 97.52% lines — identical to the prior three coverage cycles (2026-06-28, 06-29, 06-30), confirming a stable baseline with zero regressions. All critical-path modules (impact scoring, SVG rendering, API routes, database layer) remain at or above 91% statements, with only branch-level gaps in a few files.

## Coverage by Module
| Module | Stmts | Branches | Funcs | Lines | Status |
|--------|-------|----------|-------|-------|--------|
| apps/web/lib/impact | 99.6% | 98.7% | 100.0% | 99.5% | 🟢 |
| apps/web/lib/render | 99.6% | 92.3% | 100.0% | 99.6% | 🟢 |
| apps/web/app/api | 97.3% | 93.5% | 96.1% | 97.6% | 🟢 |
| apps/web/lib/db | 96.5% | 93.3% | 100.0% | 98.7% | 🟢 |
| apps/web/lib/verification | 100.0% | 100.0% | 100.0% | 100.0% | 🟢 |
| apps/web/lib/dashboard | 99.2% | 96.3% | 100.0% | 99.2% | 🟢 |
| apps/web/lib/history | 98.3% | 96.6% | 100.0% | 99.0% | 🟢 |
| apps/web/lib/cache | 98.2% | 95.5% | 96.9% | 98.7% | 🟢 |
| apps/web/lib/email | 97.7% | 94.9% | 100.0% | 98.1% | 🟢 |
| apps/web/lib/auth | 97.3% | 94.8% | 99.0% | 98.6% | 🟢 |
| apps/web/lib/analytics | 97.3% | 91.2% | 100.0% | 98.5% | 🟢 |
| apps/web/lib/i18n | 97.5% | 89.7% | 96.8% | 98.1% | 🟢 |
| apps/web/lib/github | 97.1% | 98.0% | 90.6% | 98.6% | 🟢 |
| apps/web/lib/bitbucket | 96.9% | 91.1% | 92.6% | 100.0% | 🟢 |
| apps/web/lib/other | 96.8% | 93.4% | 96.9% | 97.4% | 🟢 |
| apps/web/components | 96.1% | 90.9% | 95.2% | 98.1% | 🟢 |
| apps/web/app (pages) | 94.8% | 89.3% | 92.5% | 96.1% | 🟢 |
| apps/web/lib/codeberg | 93.1% | 86.8% | 92.3% | 98.5% | 🟢 |
| apps/web/lib/gitlab | 91.3% | **75.2%** | 90.9% | 94.4% | 🟡 |
| packages/shared | 89.7% | 100.0% | 100.0% | 88.6% | 🟢 |

**Overall**: 96.31% stmts / 92.15% branches / 95.32% funcs / 97.52% lines (9,739/10,112 stmts, 5,342/5,797 branches).

Only `apps/web/lib/gitlab` falls below 80% on any metric — branches at 75.2%, driven almost entirely by `lib/gitlab/queries.ts` (71.8% branches, 24 missed branches — GitLab GraphQL/OAuth error paths). All statement/function coverage in this module still exceeds 90%.

## Gaps & Recommendations
No files in the critical-path directories (`lib/impact/`, `lib/render/`, `app/api/`, `lib/db/`) fall below 80% statement coverage. The only critical-path items below 80% are branch-level gaps in edge-case paths:

- `apps/web/lib/render/svg-to-png.ts` — 66.7% branches (1 missed branch, Sharp conversion error path). Add a test that forces the Sharp encode call to reject.
- `apps/web/lib/render/archetypeDemoData.ts`, `apps/web/lib/render/demoData.ts` — 50% branches each (trivial fallback branches in demo/sample data generators, low risk).
- `apps/web/app/api/studio/config/route.ts` — 75% functions (92.3% stmts); one uncovered handler branch, likely an auth/validation early-return.
- `apps/web/lib/gitlab/queries.ts` — 71.8% branches (24 missed), the largest single gap in the repo. Recommend mock-network tests covering GitLab OAuth token-refresh and GraphQL error responses.
- `apps/web/lib/db/campaigns/types.ts` — 88.7% stmts, no sibling `.test.ts` file (covered transitively via `crud.ts`/`sends.ts` test suites at 97–99%). Consider adding a dedicated `types.test.ts` with Zod `.safeParse()` boundary tests for direct coverage.

Non-critical-path items under 80% stmts (accepted, low risk):
- `apps/web/app/experiments/**` (glassmorphism, heatmap-wave, metallic-shimmer pages; error.tsx; loading.tsx) — Canvas/WebGL-heavy experimental pages, JSDOM limitations.
- `apps/web/lib/effects/interactions/HolographicOverlay.tsx` — 50% stmts, Canvas rendering.
- `apps/web/components/ClientInstrumentation.tsx`, `GlobalCommandBarLazy.tsx`, `SharePageOwnerContentLazy.tsx` — thin `next/dynamic` lazy-load wrappers.
- `packages/shared/{eslint.config.mjs,package.json,tsconfig*.json}` — config files, not executable logic.

Untested-file scan (no sibling `.test.ts(x)`) in critical directories found 7 files (`auth/{gitlab,codeberg,bitbucket}/config.ts`, `lib/db/campaigns/{crud,sends,types,index}.ts`) — all are covered indirectly at 88.7–100% via other suites, so no direct action needed beyond the `types.test.ts` recommendation above.

## Flaky Tests
None detected — single clean run, 8114/8114 passing in 84.15s under `--maxWorkers=3`.

SHARED_CONTEXT_START
## Coverage Agent — 2026-07-01
- **Status**: GREEN
- Overall coverage: 96.31% stmts / 92.15% branches / 95.32% funcs / 97.52% lines on HEAD `e54c7a6b` (473 files / 8,114 tests, all passing). Numbers identical to 2026-06-28/29/30 cycles — fourth consecutive stable cycle, zero regressions.
- Critical gaps: only `apps/web/lib/gitlab` module below 80% (75.2% branches, driven by `lib/gitlab/queries.ts` at 71.8% br, 24 missed branches — OAuth/GraphQL error paths). No critical-path (`lib/impact/`, `lib/render/`, `app/api/`, `lib/db/`) file below 80% statements. Branch-level P3 carries unchanged: `lib/render/svg-to-png.ts` (66.7% br, Sharp error path), `lib/db/campaigns/types.ts` (88.7% stmts, no sibling test).
- Flaky tests: 0

**Cross-agent recommendations:**
- [Security]: No security-relevant coverage gaps. lib/auth 97.3%, lib/render 99.6% (all SVG escape paths covered), lib/verification 100%.
- [QA]: 0 flaky tests. Suite stable at 8,114/8,114 across 473 files for the 4th consecutive cycle — no new gaps introduced.
SHARED_CONTEXT_END
```
