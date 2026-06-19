# Coverage Report
> Generated: 2026-06-19 | Health status: green

## Executive Summary

All 7,594 tests passed across 3 consecutive full-suite runs with zero flakes; overall statement coverage holds at 96.78% (flat vs 2026-06-18). Every critical path (impact, render, api, db, cache, auth) remains above 80% on all three metrics, and source files without companion test files are fully covered via transitive route tests.

## Coverage by Module

| Module | Stmts | Branches | Funcs | Status |
|--------|-------|----------|-------|--------|
| lib/impact | 99.6% | 98.0% | 100.0% | GREEN |
| lib/render | 100.0% | 90.3% | 100.0% | GREEN |
| app/api | 98.6% | 96.9% | 99.3% | GREEN |
| lib/db | 97.1% | 93.4% | 100.0% | GREEN |
| lib/cache | 99.5% | 98.9% | 98.7% | GREEN |
| lib/auth | 98.7% | 95.8% | 99.2% | GREEN |
| lib/github | 97.8% | 97.3% | 96.4% | GREEN |
| lib/analytics | 98.5% | 95.1% | 100.0% | GREEN |
| lib/history | 99.1% | 97.5% | 100.0% | GREEN |
| lib/email | 98.1% | 96.6% | 100.0% | GREEN |
| lib/verification | 100.0% | 100.0% | 100.0% | GREEN |
| lib/i18n | 100.0% | 96.4% | 98.6% | GREEN |
| components | 96.0% | 93.5% | 95.0% | GREEN |
| packages/shared/src | 100.0% | 100.0% | 100.0% | GREEN |

**Overall (3-run average):** 96.77% stmts / 92.63% branches / 95.72% funcs / 97.88% lines

## Gaps & Recommendations

### Untested files in critical paths (no companion .test.ts)
All 4 files achieve 100% statement coverage via transitive test imports — no direct test file gap:
- `apps/web/lib/render/BadgeBranding.tsx` — 100% stmts via BadgeSvg render tests
- `apps/web/lib/render/BadgeSvg.tsx` — 100% stmts via badge route tests
- `apps/web/app/api/auth/bitbucket/config.ts` — 100% stmts via Bitbucket auth route tests
- `apps/web/app/api/auth/codeberg/config.ts` — 100% stmts via Codeberg auth route tests

### P3 Carries (accepted, no action required)
These 10 files are below 80% and remain accepted — same set as all prior cycles:
- `experiments/error.tsx`, `experiments/loading.tsx` — 0% stmts/fn; JSDOM `navigation to another Document`, flag-gated
- `lib/effects/interactions/HolographicOverlay.tsx` — 50% stmts; Canvas/WebGL, untestable in JSDOM
- `components/ClientInstrumentation.tsx` — 60% stmts; `next/dynamic` lazy wrapper
- `components/GlobalCommandBarLazy.tsx` — 60% stmts; `next/dynamic` lazy wrapper
- `components/SharePageOwnerContentLazy.tsx` — 66.7% stmts; `next/dynamic` lazy wrapper
- `experiments/heatmap-wave/page.tsx` — 73.3% stmts; Canvas/WebGL, flag-gated
- `experiments/metallic-shimmer/page.tsx` — 77.4% stmts; Canvas/WebGL, flag-gated
- `packages/shared/package.json`, `packages/shared/tsconfig.json` — 0% stmts; v8 false positive, not source code

### Branch-gap monitors (stmts ≥80%, branches <80%)
These files pass the 80% statement threshold but have branch coverage gaps worth monitoring:
- `components/AuthorTypewriter.tsx` — 67.5% branches (86.7% stmts). Typewriter animation state machine has several path permutations not exercised. Low P3 — visual-only component.
- `lib/i18n/lang-sync.tsx` — 50% branches (100% stmts). Sync guards for locale hydration edge cases. Worth adding 2–3 branch tests if the i18n pipeline changes.
- `lib/render/archetypeDemoData.ts`, `lib/render/demoData.ts` — 50% branches (100% stmts). V8 counting ternary expressions in static data objects. No actionable gap — data-only files.
- `components/BadgeOverlay.tsx` — 75% branches (100% stmts). Tooltip positioning edge branches.
- `lib/auth/github-session-token.ts` — 75% branches (100% stmts). Token expiry/refresh branches.
- `lib/effects/backgrounds/ParticleBackground.tsx` — 72.2% branches, 77.8% funcs. Canvas/WebGL particle effects; JSDOM cannot exercise them.
- `components/ShortcutCheatSheet.tsx` — 71.9% branches (98% stmts). Keyboard shortcut visibility branches.
- `app/admin/campaigns/campaigns-dashboard.tsx` — 78.8% funcs (91.2% stmts). Admin-only; 5th cycle carry.

### Notable lowest-coverage API route
- `app/api/studio/config/route.ts` — 92.3% stmts / 85.7% branches. Edge branches around malformed config payloads. Acceptable; monitored.

## Flaky Tests

None detected. Across 3 full consecutive runs:
- Run 1: 7594/7594 passed (96.77% stmts)
- Run 2: 7594/7594 passed (96.78% stmts)
- Run 3: 7594/7594 passed (96.76% stmts)

Coverage variance (≤0.02pp) is v8 instrumentation noise, not instability. No worker-pool contention observed this cycle.
