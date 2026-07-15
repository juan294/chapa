```markdown
# Coverage Report
> Generated: 2026-07-15 | Health status: green

## Executive Summary
Overall coverage is 96.70% statements / 92.78% branches / 95.57% functions / 97.89% lines across 412 covered files, with 8,335/8,335 tests passing in 485 files (77.1s, zero failures, zero skips). All critical paths (scoring, rendering, API routes, database layer) are at or above 97% statements, and the long-standing `lib/gitlab/queries.ts` branch gap (71.8% in prior cycles) is now resolved at 97.2% branches module-wide.

## Coverage by Module
| Module | Coverage | Status |
|--------|----------|--------|
| `apps/web/lib/impact` (scoring pipeline) | 99.6% stmts / 98.7% br / 100% fn | 🟢 |
| `apps/web/lib/render` (SVG rendering) | 100% stmts / 93.4% br / 100% fn | 🟢 |
| `apps/web/app/api` (API routes) | 97.5% stmts / 94.0% br / 96.3% fn | 🟢 |
| `apps/web/lib/db` (database layer) | 97.3% stmts / 94.6% br / 100% fn | 🟢 |
| `apps/web/lib/auth` | 97.3% stmts / 94.8% br | 🟢 |
| `apps/web/lib/cache` | 97.1% stmts / 92.9% br | 🟢 |
| `apps/web/lib/history` | 98.3% stmts / 96.6% br | 🟢 |
| `apps/web/lib/dashboard` | 99.2% stmts / 96.3% br | 🟢 |
| `apps/web/lib/gitlab` | 100% stmts / 97.2% br | 🟢 (prior 71.8% br gap resolved) |
| `apps/web/lib/github` | 96.3% stmts / 97.1% br / 86.0% fn | 🟢 |
| `apps/web/lib/email` | 97.7% stmts / 94.9% br | 🟢 |
| `apps/web/lib/verification` | 100% across the board | 🟢 |
| `apps/web/components` | 96.5% stmts / 91.0% br | 🟢 |
| `apps/web/app` (pages) | 94.7% stmts / 89.2% br | 🟢 (experiments drag) |
| `apps/web/lib/effects` | 93.3% stmts / 88.5% br | 🟡 (Canvas/WebGL limits) |
| `apps/web/lib/codeberg` | 92.8% stmts / 86.8% br | 🟡 |
| `apps/web/lib/campaigns` | 92.2% stmts / 89.4% br | 🟡 |
| `packages/shared` | 100% across the board | 🟢 |

## Gaps & Recommendations
Files below 80% statements — all are experimental/JSDOM-limited P3 carries; no critical-path file is below 96%:

- `apps/web/app/experiments/error.tsx` — 0% stmts. Trivial error boundary behind the experiments feature flag; a 3-line render test would close it.
- `apps/web/app/experiments/loading.tsx` — 0% stmts. Same: trivial flagged loading state, one render test closes it.
- `apps/web/lib/effects/interactions/HolographicOverlay.tsx` — 50% stmts / 86.7% br. Pointer-move/rAF interaction paths not exercisable in JSDOM (known P3 carry).
- `apps/web/app/experiments/glassmorphism/page.tsx` — 70.6% stmts, `heatmap-wave/page.tsx` — 73.3% stmts (50% br), `metallic-shimmer/page.tsx` — 78.1% stmts (42.9% br). Canvas/WebGL experiment pages, flag-gated, JSDOM cannot drive the animation loops (known P3 carries).
- `apps/web/app/experiments/particles/_components/particle-core.ts` — 83.0% stmts / 58% br. Largest experiments branch gap; pure-function extraction of the particle physics would make the branch space testable if experiments ever ship.
- `apps/web/lib/test-helpers/dynamic-mock.ts` — 83.3% stmts / 66.7% br. New shared helper from the 2026-07-10 triage cycle; test infrastructure, not production code. Issue #1006 already tracks the remaining `next/dynamic` loader gap in `KeyboardShortcutsListener.test.tsx`.
- Branch-only watches (statements 100%): `lib/i18n/provider.tsx` 61.5% br (JSDOM locale-switch, known carry), `components/AuthorTypewriter.tsx` 67.5% br (timer-driven typewriter branches), `lib/effects/backgrounds/ParticleBackground.tsx` 68% br.

Untested-file scan (no sibling `.test.ts`): 54 raw matches, but nearly all are false positives — pure `types.ts` re-exports, inline SVG icon components, test-helper fixtures, and client components covered indirectly through parent-page tests (e.g. `AboutPageClient.tsx`, `PrivacyPageClient.tsx`, `lib/db/campaigns/crud.ts`, `sends.ts` all measure 98–100% via their route/page test files). The only genuinely uncovered files are the two 0% experiments files listed above. Prior cycles' resolved items confirmed: `GlobalCommandBarLazy.tsx` and `SharePageOwnerContentLazy.tsx` are both at 100% stmts and off the carry list; `agents-dashboard.tsx` is not in any low-coverage bucket (the old "0%" claim remains stale/false).

## Flaky Tests
None detected
```

SHARED_CONTEXT_START
## Coverage Agent — 2026-07-15
- **Status**: GREEN
- Overall coverage: 96.70% stmts / 92.78% branches / 95.57% funcs / 97.89% lines (8,335 tests / 485 files, all passing, 77.1s under --maxWorkers=3)
- Critical gaps: none on critical paths — lib/impact 99.6%, lib/render 100% stmts, app/api 97.5%, lib/db 97.3%. Sub-80% files are all flag-gated experiments/JSDOM-limited P3 carries plus two trivial 0% files (`app/experiments/error.tsx`, `app/experiments/loading.tsx`). Notable: `lib/gitlab` branch gap from June cycles (71.8% br in queries.ts) is RESOLVED — module now 100% stmts / 97.2% br; drop from carry lists.
- Flaky tests: 0

**Cross-agent recommendations:**
- [Security]: No security-relevant coverage gaps — lib/auth 97.3%, lib/render 100% stmts (all `escapeXml()` paths covered), lib/verification 100%, lib/cache 97.1%. The `/api/challenge` route and rate-limiter paths remain fully covered under app/api's 97.5%.
- [QA]: Suite grew 8,326 → 8,335 (+9) since your 2026-07-08 run, still 0 flakes and 0 failures. `dynamic-mock.ts` helper (66.7% br) is test infra only; issue #1006 still tracks the `KeyboardShortcutsListener.test.tsx` loader gap. The two 0% experiments files (`error.tsx`/`loading.tsx`) are one-line render tests if you want the pages module fully green.
- [Triage]: gitlab/queries.ts branch carry and the GlobalCommandBarLazy/SharePageOwnerContentLazy items are all confirmed closed — no P1/P2 items this cycle.
SHARED_CONTEXT_END
