# Coverage Report
> Generated: 2026-05-10 | Health status: green

## Executive Summary

All 7,587 tests pass across 445 files with 96.82% statement coverage — up +0.01pp from the May 9 cycle. Every critical path (scoring, rendering, API, database) is GREEN with no new P2 gaps; all sub-80% files remain accepted P3 carries (Canvas/WebGL, lazy wrappers, experiments-gated).

## Coverage by Module

| Module | Stmts | Branches | Funcs | Status |
|--------|-------|----------|-------|--------|
| `apps/web/lib/impact` | 99.6% | 98.7% | 100.0% | GREEN |
| `apps/web/lib/render` | 100.0% | 92.9% | 100.0% | GREEN |
| `apps/web/lib/verification` | 100.0% | 100.0% | 100.0% | GREEN |
| `apps/web/lib/crypto` | 100.0% | 100.0% | 100.0% | GREEN |
| `apps/web/lib/async` | 100.0% | 100.0% | 100.0% | GREEN |
| `apps/web/lib/log` | 100.0% | 100.0% | 100.0% | GREEN |
| `apps/web/lib/hooks` | 100.0% | 100.0% | 100.0% | GREEN |
| `apps/web/lib/profile` | 100.0% | 91.2% | 100.0% | GREEN |
| `apps/web/lib/insights` | 100.0% | 92.6% | 100.0% | GREEN |
| `apps/web/lib/i18n` | 100.0% | 97.9% | 96.3% | GREEN |
| `apps/web/lib/dashboard` | 100.0% | 94.3% | 100.0% | GREEN |
| `apps/web/lib/history` | 98.3% | 96.6% | 100.0% | GREEN |
| `apps/web/lib/cache` | 98.1% | 95.2% | 96.8% | GREEN |
| `apps/web/lib/auth` | 98.0% | 96.2% | 98.9% | GREEN |
| `apps/web/lib/codeberg` | 98.0% | 94.5% | 96.3% | GREEN |
| `apps/web/lib/email` | 97.6% | 94.7% | 100.0% | GREEN |
| `apps/web/lib/github` | 97.4% | 96.6% | 93.1% | GREEN |
| `apps/web/app/api` | 97.5% | 94.2% | 96.8% | GREEN |
| `apps/web/lib/analytics` | 97.3% | 91.2% | 100.0% | GREEN |
| `apps/web/lib/bitbucket` | 97.7% | 93.1% | 96.4% | GREEN |
| `apps/web/lib/db` | 96.5% | 93.3% | 100.0% | GREEN |
| `apps/web/app/studio` | 98.4% | 92.4% | 98.8% | GREEN |
| `apps/web/app/u` | 97.6% | 90.1% | 93.3% | GREEN |
| `apps/web/app/archetypes` | 100.0% | 85.7% | 100.0% | GREEN |
| `apps/web/app/admin` | 96.8% | 93.4% | 92.0% | GREEN |
| `apps/web/app/about` | 100.0% | 100.0% | 100.0% | GREEN |
| `apps/web/app/verify` | 100.0% | 100.0% | 100.0% | GREEN |
| `apps/web/app/cli` | 100.0% | 100.0% | 100.0% | GREEN |
| `apps/web/lib/campaigns` | 94.1% | 91.5% | 100.0% | GREEN |
| `apps/web/lib/feature-flags.ts` | 94.3% | 100.0% | 88.2% | YELLOW |
| `apps/web/app/experiments` | 89.7% | 82.1% | 88.0% | YELLOW† |
| `apps/web/components` | 96.6% | 90.7% | 95.7% | GREEN |
| `packages/shared/src` | 100.0% | 100.0% | 100.0% | GREEN |

† experiments module: all sub-80% files are Canvas/JSDOM-blocked — accepted P3.

**Overall: 96.82% stmts / 92.66% branches / 95.86% funcs / 97.88% lines** (8974/9268 stmts)

## Gaps & Recommendations

### P2 — None active

All prior P2 gaps are resolved. No new files crossed below 80% coverage outside accepted P3 territory.

### P3 — Accepted carries (no action required)

These files are permanently below 80% for structural reasons, each previously reviewed and accepted:

- `apps/web/app/experiments/error.tsx` — 0% stmts. Experiments-gated; JSDOM cannot instantiate this component.
- `apps/web/app/experiments/loading.tsx` — 0% stmts. Same constraint.
- `apps/web/lib/effects/interactions/HolographicOverlay.tsx` — 50% stmts, 75% funcs. Canvas/WebGL; JSDOM-blocked.
- `apps/web/components/ClientInstrumentation.tsx` — 60% stmts, 33% funcs. `next/dynamic` lazy wrapper; no testable logic.
- `apps/web/components/GlobalCommandBarLazy.tsx` — 60% stmts, 33% funcs. Same pattern.
- `apps/web/components/SharePageOwnerContentLazy.tsx` — 67% stmts, 50% funcs. Same pattern.
- `apps/web/app/experiments/heatmap-wave/page.tsx` — 73% stmts, 50% branches. Experiments-gated Canvas.
- `apps/web/app/experiments/metallic-shimmer/page.tsx` — 77% stmts, 43% branches. Experiments-gated Canvas.
- `apps/web/lib/effects/backgrounds/ParticleBackground.tsx` — 90% stmts, 72% branches. Canvas particle system.
- `apps/web/lib/render/archetypeDemoData.ts` / `demoData.ts` — 50% branches. TypeScript overload signatures; unreachable at runtime.
- `apps/web/lib/i18n/lang-sync.tsx` — 50% branches. SSR guard branch (`typeof window === 'undefined'`) unreachable in JSDOM.

### Watch Items

- `apps/web/lib/feature-flags.ts` — 88.2% funcs. The `isStudioEnabledSync` describe block was added in the May 9 triage (+4 tests), but one function path remains uncovered. Low priority; no regression risk.

## Flaky Tests

None detected — all 3 consecutive runs returned identical results: **7587/7587 tests passed** (445 files).

- Run 1: 7587 passed, 96.82% stmts
- Run 2: 7587 passed, 96.82% stmts
- Run 3: 7587 passed, 96.82% stmts

`BadgeToolbar @keyframes` flake remains permanently retired (pure-function extraction in May 8 triage).

---

## Delta vs Prior Cycle (2026-05-09)

| Metric | May 9 | May 10 | Δ |
|--------|-------|--------|---|
| Statements | 96.81% | 96.82% | +0.01pp |
| Branches | 92.62% | 92.66% | +0.04pp |
| Functions | 95.81% | 95.86% | +0.05pp |
| Lines | 97.87% | 97.88% | +0.01pp |
| Tests | 7581 | 7587 | +6 |
| Files | 445 | 445 | — |
