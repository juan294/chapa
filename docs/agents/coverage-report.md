# Coverage Report
> Generated: 2026-04-03 | Branch: `develop` | Health status: green

## Executive Summary

All 6,879 tests pass across 386 files with **92.99% statement coverage** — all critical paths (scoring pipeline, SVG rendering, API routes, database layer) remain at 96–100%. The only persistent gap is `AdminDashboardClient.tsx` at 68.4% function coverage, now in its 4th consecutive cycle without resolution.

## Coverage by Module

| Module | Stmts | Branches | Funcs | Status |
|--------|-------|----------|-------|--------|
| `lib/impact` | 100.0% | 98.5% | 100.0% | GREEN |
| `lib/render` | 100.0% | 92.7% | 100.0% | GREEN |
| `app/api` | 97.6% | 94.8% | 98.3% | GREEN |
| `lib/db` | 97.7% | 95.4% | 100.0% | GREEN |
| `lib/auth` | 98.1% | 96.4% | 100.0% | GREEN |
| `lib/history` | 98.2% | 96.5% | 100.0% | GREEN |
| `lib/email` | 97.9% | 96.7% | 100.0% | GREEN |
| `lib/cache` | 99.2% | 97.9% | 95.8% | GREEN |
| `lib/github` | 96.8% | 91.9% | 96.2% | GREEN |
| `lib/bitbucket` | 97.2% | 89.5% | 96.3% | GREEN |
| `lib/codeberg` | 97.5% | 95.7% | 96.2% | GREEN |
| `lib/dashboard` | 100.0% | 86.8% | 100.0% | GREEN |
| `lib/effects` | 94.6% | 90.8% | 94.7% | GREEN |
| `lib/keyboard` | 96.5% | 95.9% | 100.0% | GREEN |
| `lib/hooks` | 93.5% | 88.9% | 100.0% | GREEN |
| `components` | 95.7% | 89.5% | 93.8% | GREEN |
| `app (pages)` | 93.6% | 90.8% | 91.8% | GREEN |
| `packages/shared` | 100.0% | 100.0% | 100.0% | GREEN |
| `app/experiments` | 56.1% | 51.2% | 52.6% | RED (accepted) |

**Overall:** 92.99% stmts (7,524/8,091) · 89.65% branches · 89.58% funcs · 94.19% lines

## Gaps & Recommendations

### P1 — Persistent (4th cycle)
- **`app/admin/AdminDashboardClient.tsx`** — 80.6% stmt, **68.4% func** (6 of 19 functions untested). Consistent across every report since 2026-03-28. The 6 untested functions are likely admin action handlers (refresh, bulk ops, sort/filter callbacks). Worth a dedicated test pass.

### P2 — Yellow zone (actionable)
- **`app/verify/[hash]/page.tsx`** — 83.3% stmt, **75.0% branch**. Missing branch coverage likely on hash-mismatch or expired-badge code paths.
- **`components/ConfirmDialog.tsx`** — 87.5% stmt, **75.0% branch**. Cancel/dismiss branch likely untested.
- **`components/AuthorTypewriter.tsx`** — 86.9% stmt, **66.7% branch**. Reduced-motion or completion-callback branch missing.
- **`components/Toast.tsx`** — 85.7% stmt, 91.7% branch. Minor — near threshold.
- **`components/ThemeToggle.tsx`** — 85.7% stmt, 91.7% branch. Minor — near threshold.

### P3 — Lazy components (structural limitation)
- **`components/ShareBadgePreviewLazy.tsx`** — 40% stmt. `next/dynamic` wrapper with `ssr: false`; inner component fully tested. Wrapper path cannot execute in JSDOM.
- **`components/GlobalCommandBarLazy.tsx`** — 50% stmt. Same pattern.

### Accepted (not actionable)
- **`app/experiments/*`** — 56.1% aggregate. WebGL/Canvas APIs unavailable in JSDOM. Accepted limitation documented since 2026-03-12.
- **`lib/effects/interactions/HolographicOverlay.tsx`** — 47.0%. Canvas-dependent. Accepted.
- **0% files** — `apple-icon.tsx`, `icon.tsx`, `layout.tsx`, `admin/page.tsx`, `cli/authorize/error.tsx`, `experiments/error.tsx`, `experiments/loading.tsx`, `studio/page.tsx`, `ClientAnalytics.tsx` — all Next.js structural (route segments, icon generators) or browser-only analytics bootstrap. Not testable in unit env.

## Flaky Tests

None detected. Suite ran 3 consecutive times with identical results: **6,879/6,879 passed** each run.

> Note: `BadgeToolbar.render.test.tsx` fires a post-teardown `setTimeout` producing a `window is not defined` console error. All tests pass; this is a cleanup-timing artifact, not a flaky failure.

---

<!-- SHARED_CONTEXT_START -->
## Coverage Agent — 2026-04-03
- **Status**: GREEN
- Overall coverage: **92.99% stmts** (7,524/8,091), 89.65% branch, 89.58% funcs, 94.19% lines
- Test suite: 386 files, 6,879 tests, 100% pass rate, 0 flaky (3 runs)
- Delta vs 2026-04-02: stable — no regressions, no new gaps
- All critical paths GREEN: `lib/impact` 100%, `lib/render` 100%, `packages/shared` 100%, `lib/cache` 99.2%, `lib/history` 98.2%, `lib/auth` 98.1%, `lib/email` 97.9%, `lib/db` 97.7%, `lib/validation` 97.3%, `app/api` 97.6%, `lib/github` 96.8%, `lib/effects` 94.6%, `components` 95.7%
- `app/experiments` at 56.1% (RED) — WebGL/Canvas, JSDOM limitation. Accepted.
- P1 gap (4th cycle): `AdminDashboardClient.tsx` funcs **68.42%** — 6 of 19 functions untested.
- P2 gaps: `app/verify/[hash]/page.tsx` branch 75%, `ConfirmDialog.tsx` branch 75%, `AuthorTypewriter.tsx` branch 66.7%
- 0 flaky tests across 3 consecutive runs

**Cross-agent recommendations:**
- [Security]: All security-critical paths at 96%+. No new security-coverage gaps. XSS tests remain comprehensive.
- [QA]: `AdminDashboardClient.tsx` funcs at 68.42% — P1, now in 4th consecutive cycle. Recommend targeting the 6 untested admin action handlers.
- [Cost Analyst]: `app/api` at 97.6% — no cost-critical uncovered routes.
- [Performance]: `app/experiments` accepted (WebGL). `BadgeToolbar.render.test.tsx` cleanup artifact cosmetic only.
<!-- SHARED_CONTEXT_END -->
