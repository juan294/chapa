# Coverage Report
> Generated: 2026-06-18 | Health status: green

## Executive Summary
Overall coverage is **96.78% statements / 92.65% branches / 95.77% functions / 97.89% lines** across 445 test files and **7594 passing tests** (0 failures, 0 skipped). All critical paths (impact, render, api, db) sit above 96% statements with no source file in those paths below 80%, and three full-suite runs produced identical results — **0 flaky tests detected**. HEAD is `63b18ac1` (CI workflow upgrade + triage docs only — no app-code change since last cycle).

## Coverage by Module
| Module | Stmts | Branches | Functions | Status |
|--------|-------|----------|-----------|--------|
| `apps/web/lib/impact` (scoring) | 99.6% | 98.7% | 100.0% | GREEN |
| `apps/web/lib/render` (SVG rendering) | 100.0% | 92.9% | 100.0% | GREEN |
| `apps/web/app/api` (API routes) | 97.5% | 94.2% | 96.8% | GREEN |
| `apps/web/lib/db` (database layer) | 96.5% | 93.3% | 100.0% | GREEN |
| `apps/web/lib/cache` | 98.1% | 95.2% | 96.8% | GREEN |
| `apps/web/lib/auth` | 98.0% | 96.2% | 98.9% | GREEN |
| `apps/web/lib/github` | 97.4% | 96.6% | 93.1% | GREEN |
| `apps/web/lib/history` | 98.3% | 96.6% | 100.0% | GREEN |
| `apps/web/lib/email` | 97.6% | 94.7% | 100.0% | GREEN |
| `apps/web/lib/analytics` | 97.3% | 91.2% | 100.0% | GREEN |
| `apps/web/lib/verification` | 100.0% | 100.0% | 100.0% | GREEN |
| `apps/web/lib/i18n` | 100.0% | 97.9% | 96.3% | GREEN |
| `apps/web/lib/profile` | 100.0% | 91.2% | 100.0% | GREEN |
| `apps/web/lib/insights` | 100.0% | 92.6% | 100.0% | GREEN |
| `apps/web/lib/dashboard` | 100.0% | 94.3% | 100.0% | GREEN |
| `apps/web/lib/campaigns` | 94.1% | 91.5% | 100.0% | GREEN |
| `apps/web/lib/bitbucket` | 97.7% | 93.1% | 96.4% | GREEN |
| `apps/web/lib/codeberg` | 98.0% | 94.5% | 96.3% | GREEN |
| `apps/web/lib/effects` | 94.8% | 90.8% | 94.7% | GREEN |
| `apps/web/components` | 96.5% | 90.6% | 95.8% | GREEN |
| `apps/web/app/pages` | 94.9% | 89.2% | 92.5% | GREEN |
| `packages/shared` | 91.6% | 100.0% | 100.0% | GREEN |

## Gaps & Recommendations

### P3 Carries (accepted, no action needed)
All items below are multi-cycle carries with documented acceptance reasons:

- **`app/experiments/error.tsx` + `app/experiments/loading.tsx`** — 0% stmts/funcs. JSDOM `navigation to another Document` failure; pages are flag-gated. Accepted.
- **`app/experiments/heatmap-wave/page.tsx`** — 73.3% stmts, 50% branches, 60% funcs. Canvas/WebGL; untestable in JSDOM.
- **`app/experiments/metallic-shimmer/page.tsx`** — 77.4% stmts, 42.9% branches. Canvas/WebGL; accepted.
- **`lib/effects/interactions/HolographicOverlay.tsx`** — 50% stmts, 75% funcs. Canvas/WebGL; accepted.
- **`components/ClientInstrumentation.tsx`** — 60% stmts, 33% funcs. `next/dynamic` lazy wrapper; structural limitation.
- **`components/GlobalCommandBarLazy.tsx`** — 60% stmts, 33% funcs. `next/dynamic` lazy wrapper; structural limitation.
- **`components/SharePageOwnerContentLazy.tsx`** — 67% stmts, 50% funcs. `next/dynamic` lazy wrapper; structural limitation.
- **`packages/shared/package.json` + `tsconfig.json`** — 0% stmts. v8 false positive on non-TS config files; src/ TypeScript is 100%.

### Low-priority optional polish (no P2 action items)
- **`components/AuthorTypewriter.tsx`** — 67.5% branches. Branch gap in animation/timing logic.
- **`components/BadgeOverlay.tsx`** — 75% branches. Edge-case position math.
- **`lib/auth/github-session-token.ts`** — 75% branches. Token-extraction fallback paths.
- **`lib/i18n/lang-sync.tsx`** — 50% branches. Two-branch conditional; small file.
- **`lib/render/archetypeDemoData.ts`** + **`lib/render/demoData.ts`** — 50% branches each. Ternary expressions in static demo data; 100% stmts.
- **`app/admin/campaigns/campaigns-dashboard.tsx`** — 78.8% funcs. Admin-only component, 7th carry cycle.

### Critical path untested source files
- **`apps/web/app/api/auth/bitbucket/config.ts`** — no direct `.test.ts`, but confirmed **100% statements** via transitive route-test coverage.
- **`apps/web/app/api/auth/codeberg/config.ts`** — no direct `.test.ts`, but confirmed **100% statements** via transitive route-test coverage.

No real gaps in `lib/impact`, `lib/render`, `lib/db`, or any `app/api` route.

## Flaky Tests
None detected — three full-suite runs (1 instrumented + 2 plain) all produced **7594/7594 passing, 445/445 files**, identical results. No worker-pool contention this cycle (~25s / ~23s / ~21s per run).
