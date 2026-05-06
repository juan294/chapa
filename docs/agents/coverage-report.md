# Coverage Report
> Generated: 2026-05-06 | Health status: green

## Executive Summary

All 7,559 tests passed across 444 files with overall statement coverage at **96.63%** — a slight gain of +0.14pp vs the prior cycle. All critical-path modules remain GREEN, and the `BadgeToolbar > strips @keyframes` flaky test appears resolved (0 failures across 3 consecutive runs).

## Coverage by Module

| Module | Stmts | Branch | Funcs | Lines | Status |
|--------|-------|--------|-------|-------|--------|
| lib/impact | 99.6% | 98.7% | 100.0% | 99.5% | GREEN |
| lib/render | 100.0% | 92.9% | 100.0% | 100.0% | GREEN |
| app/api | 97.5% | 94.2% | 96.8% | 97.9% | GREEN |
| lib/db | 96.5% | 93.3% | 100.0% | 98.7% | GREEN |
| lib/auth | 98.0% | 96.2% | 98.9% | 98.9% | GREEN |
| lib/cache | 98.1% | 95.2% | 96.8% | 98.6% | GREEN |
| lib/github | 97.4% | 96.6% | 93.1% | 99.2% | GREEN |
| lib/analytics | 97.3% | 89.5% | 100.0% | 98.5% | GREEN |
| lib/i18n | 100.0% | 90.6% | 96.3% | 100.0% | GREEN |
| lib/history | 98.3% | 96.6% | 100.0% | 99.0% | GREEN |
| lib/email | 97.6% | 94.7% | 100.0% | 98.0% | GREEN |
| app/u | 97.6% | 90.1% | 93.3% | 98.8% | GREEN |
| app/archetypes | 74.6% | 85.7% | 55.0% | 74.6% | YELLOW |
| app/verify | 100.0% | 100.0% | 100.0% | 100.0% | GREEN ✅ was P2 |
| app/about | 100.0% | 100.0% | 100.0% | 100.0% | GREEN ✅ was P2 |
| components | 96.6% | 90.7% | 95.9% | 98.5% | GREEN |

**Overall:** 96.63% stmts (8956/9268) · 92.53% branches · 95.34% funcs · 97.65% lines

## Gaps & Recommendations

### P2 — Actionable (non-trivial runtime gaps)

- **`app/archetypes/artificer/page.tsx` — 0% stmts** (source-string tests only, v8 sees no execution). Same for `emerging/page.tsx`. The `balanced`, `builder`, `guardian`, `marathoner`, `polymath` pages are at **80% stmts / 50% funcs** — `generateMetadata` is untested as a runtime call. Pattern: all 7 archetype pages use source-string test suites that grep the `.tsx` file; v8 coverage requires actual module imports. Recommend adding a single runtime import test per page that calls `generateMetadata({ params: { locale: 'en' } })`.
- **`app/cli/authorize/error.tsx` — 0% stmts/funcs** — no test file exists. Shell error boundary, low logic, but easy one-test fix.
- **`lib/i18n/detect.ts` — 75% branches** — one branch still uncovered after May 5 triage. Check if the final branch is the `DEFAULT_LOCALE` fallback when Accept-Language header is absent.

### P3 — Accepted (JSDOM/Canvas limitations or trivial wrappers)

- `experiments/**` — Canvas/WebGL components (JSDOM-blocked, accepted limitation)
- `HolographicOverlay.tsx` 50% stmts — Canvas-dependent, untestable in JSDOM
- `ParticleBackground.tsx` 90.4% stmts / 77.8% funcs — Canvas-dependent
- `GlobalCommandBarLazy.tsx` 60% stmts / 33% funcs — `next/dynamic` lazy wrapper, no testable logic
- `ClientInstrumentation.tsx` 60% stmts / 33% funcs — `next/dynamic` lazy wrapper
- `SharePageOwnerContentLazy.tsx` 66.7% stmts / 50% funcs — `next/dynamic` lazy wrapper
- `lib/render/archetypeDemoData.ts` + `demoData.ts` 50% branches — TS overload signatures (accepted)
- `lib/i18n/lang-sync.tsx` 50% branches — SSR guard branch

### Previously Resolved P2 Items (retired this cycle)

- `app/verify/page.tsx` → **100%** (was 55.6% stmts in May 5 report)
- `app/about/scoring/page.tsx` → **100%** (was 76.9%)
- `app/about/verification/page.tsx` → **100%** (was 78.6%)
- `app/cli/authorize/page.tsx` → **100%** (was 78.9%)

## Flaky Tests

**None detected** — all 3 consecutive runs (one with coverage, two without) passed 7,559/7,559 tests. The `BadgeToolbar > strips @keyframes` flake that persisted across 4 cycles appears resolved by the May 5 triage fix (`await act(async () => {})` scheduler drain before `vi.unstubAllGlobals()`). Monitor one more cycle before closing.
