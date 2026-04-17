# Coverage Report
> Generated: 2026-04-17 | Health status: yellow

## Executive Summary
All critical-path modules remain GREEN and stable at 93.14% statement coverage (unchanged from 2026-04-15). Status is YELLOW due to branch coverage sitting at 89.86% — 0.14pp below the 90% threshold — driven primarily by Canvas/WebGL experiment pages that are untestable in JSDOM.

## Coverage by Module

| Module | Stmt% | Branch% | Func% | Status |
|--------|-------|---------|-------|--------|
| `lib/impact` | 100.0% | 98.5% | 100.0% | GREEN |
| `lib/render` | 100.0% | 92.7% | 100.0% | GREEN |
| `packages/shared` | 100.0% | 100.0% | 100.0% | GREEN |
| `lib/cache` | 99.2% | 97.9% | 95.8% | GREEN |
| `lib/history` | 98.2% | 96.5% | 100.0% | GREEN |
| `lib/auth` | 98.1% | 96.4% | 100.0% | GREEN |
| `lib/email` | 97.9% | 96.7% | 100.0% | GREEN |
| `app/api` | 97.6% | 94.8% | 97.4% | GREEN |
| `lib/db` | 97.6% | 95.2% | 100.0% | GREEN |
| `lib/github` | 96.8% | 91.9% | 96.2% | GREEN |
| `components` | 96.0% | 90.1% | 93.9% | GREEN |
| `app/experiments` | 56.1% | 51.2% | 52.6% | ACCEPTED |

**Overall: 93.14% stmts (7585/8143) · 89.86% branch · 90.01% funcs · 94.31% lines**

## Gaps & Recommendations

### P2 — Carried (low priority)
- `components/UserMenu.tsx` — 94.8% stmt / 79.3% funcs: `handleInsightsFile` complex async callback remains the only untested function in this component. Low risk — not on critical path.

### P3 — Accepted (structural/JSDOM limits)
- `components/AuthorTypewriter.tsx` — 86.6% stmt / 67.5% branches: JSDOM timing limitation; timing-dependent branch paths are not reliably testable.
- `components/HolographicOverlay.tsx` — 47% stmt: Canvas/WebGL — untestable in JSDOM. Accepted.
- `app/experiments/*` — 56.1% aggregate: All 16 experiment pages use Canvas/WebGL/3D — not testable in JSDOM. Accepted.
- `lib/render/svg-to-png.ts` — 66.7% branches: Fallback branch requires native resvg binary not present in CI. Accepted.
- `app/api/refresh/route.ts` — 75% funcs: `after()` fire-and-forget callback by design. Accepted.

### P3 — Untested structural files (0%)
These files are untested but contain no testable business logic — they are Next.js structural wrappers:
- `app/layout.tsx` — root layout (fonts + providers)
- `app/admin/page.tsx` — thin server component shell
- `app/studio/page.tsx` — thin server component shell
- `app/cli/authorize/error.tsx` / `app/experiments/error.tsx` — error boundaries
- `app/experiments/loading.tsx` — loading state skeleton
- `components/ClientAnalytics.tsx` — browser-only PostHog `useEffect` (SSR-safe, but not JSDOM-testable)

### P3 — Lazy wrapper stubs (40–50%)
- `components/ShareBadgePreviewLazy.tsx` (40%) and `components/GlobalCommandBarLazy.tsx` (50%) are single-expression `next/dynamic` wrappers. The actual component logic is tested via the full component tests. No coverage value in testing the wrapper stub.

## Flaky Tests
None detected — 3/3 runs passed 7001/7001 tests across 390 files. BadgeToolbar flaky test (resolved 2026-04-10) confirmed stable for 6th consecutive cycle.

---

## Cycle Delta vs 2026-04-15

| Metric | 2026-04-15 | 2026-04-17 | Delta |
|--------|-----------|-----------|-------|
| Statements | 93.14% | 93.14% | ±0 |
| Branches | 89.88% | 89.86% | −0.02pp |
| Functions | 90.01% | 90.01% | ±0 |
| Lines | 94.31% | 94.31% | ±0 |
| Test files | 390 | 390 | ±0 |
| Total tests | 7001 | 7001 | ±0 |

Coverage at stable plateau — no regressions, no new gaps.
