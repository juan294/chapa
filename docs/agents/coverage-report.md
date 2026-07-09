```markdown
# Coverage Report
> Generated: 2026-07-09 | Health status: green

## Executive Summary
Overall coverage on HEAD `3a619e26` is **96.58% statements / 92.62% branches / 95.24% functions / 97.77% lines** (10,298 statements measured), with all 8,326 tests across 485 files passing in 86.6s — a slight improvement over the 2026-06-30 baseline (96.31% stmts, 8,114 tests). All four critical paths (scoring, rendering, API routes, database layer) are at or above 97% statements, and no critical-path file falls below 80%.

## Coverage by Module
| Module | Coverage (stmts / branches / funcs / lines) | Status |
|--------|--------|--------|
| `lib/impact` (scoring pipeline) | 99.6% / 98.7% / 100% / 99.5% | 🟢 |
| `lib/render` (SVG rendering) | 100% / 93.4% / 100% / 100% | 🟢 |
| `app/api` (all API routes) | 97.5% / 94.0% / 96.3% / 97.7% | 🟢 |
| `lib/db` (database layer) | 97.3% / 94.6% / 100% / 100% | 🟢 |
| `lib/auth` | 97.3% / 94.8% / 99.0% / 98.6% | 🟢 |
| `lib/cache` | 97.1% / 92.9% / 94.1% / 97.4% | 🟢 |
| `lib/history` | 98.3% / 96.6% / 100% / 99.0% | 🟢 |
| `lib/dashboard` | 99.2% / 96.3% / 100% / 99.2% | 🟢 |
| `lib/github` | 96.3% / 97.1% / 85.7% / 97.8% | 🟢 |
| `lib/gitlab` | 100% / 97.2% / 100% / 100% | 🟢 |
| `lib/verification`, `lib/crypto`, `lib/monitoring`, `lib/platform`, `packages/shared` | 100% across the board | 🟢 |
| `components` | 95.7% / 90.2% / 95.1% / 97.6% | 🟢 |
| `lib/i18n` | 97.7% / 91.0% / 97.0% / 98.2% | 🟢 |
| `lib/campaigns` (email templating) | 92.2% / 89.4% / 100% / 91.7% | 🟢 |
| `lib/codeberg` | 92.8% / 86.8% / 92.6% / 98.4% | 🟢 |
| `lib/effects` (visual effects) | 93.3% / 88.5% / 92.6% / 94.5% | 🟢 |
| `app` (pages, incl. experiments) | 94.7% / 89.2% / 92.4% / 96.1% | 🟢 |

The 2026-06-30 gap of `lib/gitlab/queries.ts` (71.8% branches, formerly the largest single gap) is confirmed closed — the module now sits at 100% statements / 97.2% branches.

## Gaps & Recommendations
No critical-path file (`lib/impact`, `lib/render`, `app/api`, `lib/db`) is below 80% on any metric. 25 files repo-wide fall below 80% statements or branches; all are non-critical UI surfaces, and most are known P3 carries:

- `apps/web/components/ClientErrorReporter.tsx` — 61.1% stmts / **33.3% branches** (4 missed). The weakest spot in the client error/telemetry surface; JSDOM-testable. Recommend a sibling test exercising the error-event and rejection branches. (Echoed by QA agent 2026-07-08.)
- `apps/web/components/ClientInstrumentation.tsx` — 60% stmts, no sibling test; JSDOM-testable, pairs naturally with the ClientErrorReporter work above.
- `apps/web/lib/i18n/provider.tsx` — 61.5% branches (5 missed, JSDOM locale-switch paths). Long-standing carry; read `feedback_language_picker_architecture` memory before touching.
- `apps/web/components/AuthorTypewriter.tsx` (67.5% br) and `apps/web/components/ShortcutCheatSheet.tsx` (71.9% br, 9 missed) — animation/keyboard timing branches; low risk, testable with fake timers.
- `apps/web/lib/effects/backgrounds/ParticleBackground.tsx` (68% br) and `apps/web/lib/effects/interactions/HolographicOverlay.tsx` (50% stmts) — Canvas/WebGL, accepted JSDOM limitation (P3 carry).
- `apps/web/app/experiments/**` (7 files, 0–85% stmts) + lazy wrappers (`GlobalCommandBarLazy`, `SharePageOwnerContentLazy`) — accepted P3 carries (Canvas/WebGL and `next/dynamic` wrappers, feature-flag-gated surfaces).

**Untested files (no sibling `.test.ts`):** none with actual coverage gaps. `lib/db/campaigns/{crud,sends,index}.ts` are covered via the parent `campaigns.test.ts` barrel (98.6–100% stmts) and `app/api/auth/{gitlab,codeberg,bitbucket}/config.ts` are at 100% via route tests. No action needed.

## Flaky Tests
1 load-induced flake detected. The initial 02:00 run executed under severe host load (23-minute duration vs the normal ~87s): `apps/web/hooks/useTrendData.test.ts > clearTrendDataCache() resets the cache` timed out (15s limit), and 3 test files (`experiments/hexmap/page.test.tsx`, `coming-soon/error.test.tsx`, `UserMenu.responsive.test.ts`) failed to start forks workers at all. The test passes in 1.6s in isolation and the full clean re-run was 8,326/8,326 with zero failures — this is host contention (2:00 AM agent window), not a test defect. If it recurs, consider staggering the coverage agent's launchd schedule away from other heavy jobs.
```

SHARED_CONTEXT_START
## Coverage Agent — 2026-07-09
- **Status**: GREEN
- Overall coverage: 96.58% stmts / 92.62% branches / 95.24% funcs / 97.77% lines on HEAD `3a619e26` — up from 96.31% stmts (2026-06-30). Suite 485 files / 8,326 tests, all passing in 86.6s.
- Critical gaps: none in critical paths — lib/impact 99.6%, lib/render 100% stmts, app/api 97.5%, lib/db 97.3%. `lib/gitlab/queries.ts` branch gap confirmed closed (100% stmts / 97.2% br). Weakest actionable files: `components/ClientErrorReporter.tsx` (33.3% br) and `components/ClientInstrumentation.tsx` (60% stmts, no sibling test) — both JSDOM-testable.
- Flaky tests: 1 (load-induced) — `useTrendData.test.ts` clearTrendDataCache timeout during a 23-minute load-degraded 02:00 run in which 3 test files also failed to start forks workers; clean full re-run passed 8,326/8,326, test passes in 1.6s isolated. Host contention, not a test defect.

**Cross-agent recommendations:**
- [Security]: No security-relevant coverage gaps — lib/auth 97.3%, lib/render 100% stmts (all escapeXml paths), lib/verification and lib/crypto 100%.
- [QA]: Confirms your 2026-07-08 flags — ClientErrorReporter/ClientInstrumentation remain the only weak client telemetry spots. Also note the 02:00 host-load degradation reproduced despite `--maxWorkers=3` (worker-start timeouts, not test failures); if it recurs, consider staggering the 2:00 AM coverage agent schedule.
SHARED_CONTEXT_END
