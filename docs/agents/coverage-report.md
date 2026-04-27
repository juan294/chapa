# Coverage Report
> Generated: 2026-04-27 | Health status: **GREEN**

## Executive Summary
Overall coverage is **93.27% statements / 89.89% branches / 90.53% functions / 94.33% lines** across 408 test files (7,224 tests, all passing). All four critical paths — `lib/impact`, `lib/render`, `lib/db`, `app/api` — exceed 96% statement coverage. No flaky tests reproduced across three consecutive runs.

## Coverage by Module

| Module | Stmts | Branches | Funcs | Status |
|--------|-------|----------|-------|--------|
| **lib/impact** (scoring) | 99.59% | 98.67% | 100.00% | GREEN |
| **lib/render** (SVG) | 100.00% | 92.86% | 100.00% | GREEN |
| **lib/db** | 96.48% | 93.32% | 100.00% | GREEN |
| **app/api** | 97.34% | 94.19% | 97.52% | GREEN |
| lib/profile | 100.00% | 92.73% | 100.00% | GREEN |
| lib/history | 98.26% | 96.55% | 100.00% | GREEN |
| lib/auth | 98.01% | 96.17% | 98.85% | GREEN |
| lib/codeberg | 98.03% | 94.52% | 96.30% | GREEN |
| lib/email | 97.57% | 94.74% | 100.00% | GREEN |
| lib/cache | 97.48% | 95.16% | 93.55% | GREEN |
| lib/github | 97.35% | 96.64% | 93.10% | GREEN |
| lib/analytics | 97.26% | 89.09% | 100.00% | GREEN |
| lib/bitbucket | 97.70% | 93.10% | 96.43% | GREEN |
| components | 96.00% | 89.90% | 95.39% | GREEN |
| app/admin | 95.60% | 92.33% | 91.49% | GREEN |
| app/u | 95.48% | 91.67% | 87.88% | GREEN |
| lib/effects | 94.77% | 90.77% | 94.74% | GREEN |
| lib/campaigns | 94.12% | 91.49% | 100.00% | GREEN |
| app/studio | 90.98% | 83.05% | 95.29% | GREEN |
| packages/shared | 91.60% | 100.00% | 100.00% | GREEN |
| **app/experiments** | 56.68% | 51.22% | 52.56% | YELLOW (accepted) |

**Total: 8254/8849 statements covered (93.27%).** Delta vs 2026-04-26: stmts +0.08pp, branches +0.13pp, funcs +0.16pp — continued steady improvement. Test count 7224 (+53 vs 2026-04-26).

## Gaps & Recommendations

**Critical paths: zero files <80%.** Untested files in `app/api` are limited to two pure-config wiring modules — exercised transitively through their route consumers.

### Untested critical-path files (acceptable)
- `apps/web/app/api/auth/bitbucket/config.ts` — pure config (env wiring), exercised via `connect/callback/disconnect` route tests
- `apps/web/app/api/auth/codeberg/config.ts` — pure config (env wiring), exercised via `connect/callback/disconnect` route tests

### P2 — Worth adding tests
- `apps/web/app/u/[handle]/og-image/route.ts` — 94.3% stmts but **60% funcs** (3/5 helper functions exercised). The avatar-fetch branch + error-fallback path lack direct coverage.
- `apps/web/components/AuthorTypewriter.tsx` — 86.7% stmts / **67.5% branches**. JSDOM timer/animation paths are partially blocked; carried as accepted limitation across multiple cycles.
- `apps/web/lib/effects/backgrounds/ParticleBackground.tsx` — 90.3% stmts / **72.2% branches** / 77.8% funcs. Canvas-driven; some branches reachable via `prefers-reduced-motion` mocks.

### P3 — Accepted (Canvas/WebGL JSDOM-blocked)
- `app/experiments/hexmap` (0%), `holographic` (47%), `confetti` (49%), `3d-tilt` (58%), `metallic-shimmer` (61%), `number-counters` (62%), `tier-visuals` (66%), `heatmap-wave` (73%), `particles` (77%), `glassmorphism` (80%), `gradient-border` (82%), `text-effects` (87%) — all gated behind `experiments_enabled` feature flag, all WebGL/Canvas. Cannot be exercised in JSDOM. Accepted P3 across multiple cycles.
- `lib/effects/interactions/HolographicOverlay.tsx` (50% stmts) — Canvas mouse-tracking pipeline.
- `lib/render/archetypeDemoData.ts` + `demoData.ts` (100% stmts / 50% branches) — TypeScript overload-signature artifacts in branch counter; functions fully exercised. Accepted.
- `lib/log.ts` (100% stmts / 50% branches) — single ternary fallback.
- Framework shells with 0% (no executable logic): `app/layout.tsx` (6 stmts), `app/admin/page.tsx`, `app/studio/page.tsx`, `app/experiments/hexmap/page.tsx`, `components/ClientAnalytics.tsx`, `app/apple-icon.tsx`, `app/icon.tsx`, `packages/shared/package.json`.

### Resolved since 2026-04-26
- `lib/async/fire-and-forget.ts` — branch coverage moved from **0% → 100%** (now in `lib/async` 100%/100%/100% module). Triage 2026-04-26 fix landed.
- `app/api/telemetry/route.ts` — funcs moved from **66.7% → 100%** (covered by `lib/async` group at 100% funcs and broader `app/api` 97.52% funcs).
- `lib/auth/cookie-policy.ts` URL-parse catch branch and `lib/auth/unsubscribe-token.ts` dedicated test sibling — both now covered (`lib/auth` 98.01%/96.17%/98.85%).
- `BadgeToolbar.render.test.tsx` "strips @keyframes" — **stable across 3 reruns** (0 failures vs prior reports' 1/3-run failure). The 5 redundant `vi.stubGlobal("Image", origImage)` removals from triage 2026-04-26 stuck.

## Flaky Tests
**None detected.** Three consecutive vitest runs (one with coverage, two without) all passed cleanly:

| Run | Files | Tests | Result |
|-----|-------|-------|--------|
| 1 (with `--coverage`) | 408/408 | 7224/7224 | PASS |
| 2 | 408/408 | 7224/7224 | PASS |
| 3 | 408/408 | 7224/7224 | PASS |

The previously-flaky `BadgeToolbar.render.test.tsx > strips @keyframes` no longer reproduces. Aurora page test stability maintained from 2026-04-25 fixes (`testTimeout: 30000` + canvas mock). Fork-pool starvation last seen 2026-04-24 also did not reproduce — `poolOptions.forks.maxForks` pin is holding.

<!-- ENTRY:START agent=coverage timestamp=2026-04-27T02:01:00Z -->
## Coverage Agent — 2026-04-27
- **Status**: GREEN
- Overall coverage: **93.27% stmts** (8254/8849), 89.89% branches, 90.53% funcs, 94.33% lines
- Test suite: 408 files, 7224 tests (+53 vs 2026-04-26; +3 files). Duration 66s with coverage.
- Delta vs 2026-04-26: stmts +0.08pp, branches +0.13pp, funcs +0.16pp — steady improvement
- All critical paths GREEN: lib/impact 99.59%, lib/render 100%, lib/db 96.48%, app/api 97.34%, lib/profile 100%, lib/history 98.26%, lib/cache 97.48%, lib/auth 98.01%, lib/github 97.35%, lib/email 97.57%, lib/analytics 97.26%, lib/bitbucket 97.70%, lib/codeberg 98.03%
- **Flaky tests: 0** — three consecutive runs all 7224/7224 passed. Prior `BadgeToolbar > strips @keyframes` flake (carried 4+ cycles) is **resolved** — Apr 26 triage's removal of redundant `vi.stubGlobal("Image", origImage)` lines is holding.
- **P2 resolved**: `lib/async/fire-and-forget.ts` moved from 0% branches to **100%** (lib/async module now 100/100/100). Telemetry route funcs moved to 100%.
- **P2 active (small)**: `app/u/[handle]/og-image/route.ts` 94.3% stmts / **60% funcs** — 2 helpers untested. `AuthorTypewriter.tsx` 67.5% branches (JSDOM, carried). `ParticleBackground.tsx` 72.2% branches (Canvas).
- **P3 carried (accepted)**: experiments/** 56.7% (Canvas/WebGL JSDOM-blocked), HolographicOverlay 50% stmts (Canvas), `archetypeDemoData/demoData` 50% br (overload signatures), framework shells 0% (no logic), `log.ts` 50% br (ternary fallback).

**Cross-agent recommendations:**
- [Triage]: All P2 items from Apr 26 triage successfully landed. `fire-and-forget` branches at 100%, `telemetry` funcs at 100%, `cookie-policy` catch covered, dedicated `unsubscribe-token.test.ts` present, BadgeToolbar flake gone. Verification cycle worked.
- [QA]: Flake-free across 3 runs. Suite stable at 7224 tests. Recommend leaving `poolOptions.forks.maxForks` pin in place — fork-pool starvation has not reproduced since.
- [Security]: `lib/analytics/server-errors.ts` SENSITIVE_PATTERNS coverage holds (lib/analytics 97.26% stmts / 89.09% branches). No new security-relevant gaps.
- [Cost Analyst]: app/api 97.34%, lib/db 96.48% — stable. No cost-critical path coverage regressions. New `og-image/route.ts` funcs gap is rendering-side, not cost-path.
- [Performance]: Suggest a small follow-up to cover the avatar-fetch branch + error-fallback in `og-image/route.ts` to retire the only critical-path P2.
<!-- ENTRY:END -->
