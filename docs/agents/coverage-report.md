```markdown
# Coverage Report
> Generated: 2026-07-10 | Health status: green

## Executive Summary
Overall coverage is **96.65% statements / 92.69% branches / 95.33% functions / 97.84% lines** across 8,333 passing tests (485 files, clean isolated run). Every critical path — impact scoring, SVG rendering, API routes, and the database layer — sits well above the 80% threshold; the only sub-80% files are experiment/loading/lazy-wrapper UI shims that are long-standing accepted P3 carries.

## Coverage by Module
| Module | Coverage (stmts / branches) | Status |
|--------|------------------------------|--------|
| `lib/impact/` (scoring pipeline) | 99.6% / 98.7% | ✅ green |
| `lib/render/` (SVG rendering) | 100.0% / 93.4% | ✅ green |
| `app/api/` (API routes) | 97.5% / 94.0% | ✅ green |
| `lib/db/` (database layer) | 97.3% / 94.6% | ✅ green |
| `lib/cache/` | 97.1% / 92.9% | ✅ green |
| `lib/github/` | 96.3% / 97.1% | ✅ green |
| `lib/auth/` | 97.3% / 94.8% | ✅ green |
| `lib/history/` | 98.3% / 96.6% | ✅ green |
| `lib/verification/` | 100.0% / 100.0% | ✅ green |
| **Total** | **95.83% / 92.41%** (per-file JSON) | ✅ green |

## Gaps & Recommendations
No critical-path file is below 80%. The 10 files under 80% statements are all non-critical UI/experiment surfaces:

- `apps/web/app/experiments/metallic-shimmer/page.tsx` — 0% (Canvas/WebGL experiment, JSDOM-untestable, P3 carry)
- `apps/web/app/experiments/error.tsx` / `loading.tsx` — 0% (experiment route boundaries)
- `apps/web/app/admin/loading.tsx` — 0% (static loading shell)
- `apps/web/app/admin/agents/agents-dashboard.tsx` — 0% (admin-only client dashboard; consider a smoke render test)
- `apps/web/lib/effects/interactions/HolographicOverlay.tsx` — 50% (WebGL effect, P3 carry)
- `apps/web/components/GlobalCommandBarLazy.tsx` — 60% (`next/dynamic` lazy wrapper)
- `apps/web/components/SharePageOwnerContentLazy.tsx` — 66.7% (`next/dynamic` lazy wrapper)
- `apps/web/app/experiments/glassmorphism/page.tsx` — 70.6% (experiment page)
- `apps/web/app/experiments/heatmap-wave/page.tsx` — 73.3% (experiment page)

Untested-file check (no sibling `.test.ts`): the OAuth `config.ts` files (`bitbucket`/`codeberg`/`gitlab`) and `lib/db/campaigns/{crud,sends,index}.ts` lack co-located tests but are all covered indirectly (100% / 99.1% / 98.6% stmts via shared route and `campaigns.test.ts` suites). **No genuine untested critical-path files exist.**

Lowest-priority follow-ups: add a smoke render test for `admin/agents/agents-dashboard.tsx` (currently 0%) and a lightweight import test for the two `*Lazy.tsx` wrappers to lift them over 80%.

## Flaky Tests
None detected. A second, resource-contended run (961s vs. 105s, under concurrent background load) surfaced 3 worker-crash errors; these did not reproduce in the clean isolated run (8,333/8,333, 0 failures) and are attributable to host load, not test flakiness.

<!-- ENTRY:START agent=coverage timestamp=2026-07-10 -->
## Coverage Agent — 2026-07-10
- **Status**: GREEN
- Overall coverage: 96.65% stmts / 92.69% branches / 95.33% funcs / 97.84% lines (clean run, 8,333 tests / 485 files, 0 failures)
- Critical gaps: none — impact 99.6%, render 100%, api 97.5%, db 97.3%, cache 97.1%, auth 97.3%, verification 100%, history 98.3% (all ≫80%)
- Flaky tests: 0 (3 worker-crash errors in a load-contended re-run were non-reproducible host-load artifacts, not test flakes)

**Cross-agent recommendations:**
- [Security]: No security-relevant coverage gaps — lib/auth 97.3%, lib/render 100% stmts (all `escapeXml` paths covered), lib/verification 100%. OAuth `config.ts` files (bitbucket/codeberg/gitlab) show as "no sibling test" but are 100% covered via route suites.
- [QA]: Suite grew to 8,333 across 485 files, 0 flakes on the isolated run. Only sub-80% files are documented P3 UI/experiment carries (Canvas/WebGL + `next/dynamic` lazy wrappers) plus `admin/agents-dashboard.tsx` (0%) — the one net-new candidate for a smoke render test.
<!-- ENTRY:END -->
```
