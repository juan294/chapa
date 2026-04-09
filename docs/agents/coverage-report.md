# Coverage Report
> Generated: 2026-04-09 | Health status: yellow

## Executive Summary

All 390 test files and 7000 tests pass across 3 runs, with overall statement coverage stable at 93.14% — plateau-stable vs yesterday (+0.01pp). The `BadgeToolbar.render.test.tsx` flaky test (strips SVG animations) re-appeared once in 3 runs, re-opening the P3 that was declared resolved in the 2026-04-07 triage.

## Coverage by Module

| Module | Stmts | Branches | Funcs | Lines | Status |
|--------|-------|----------|-------|-------|--------|
| packages/shared | 100.0% | 100.0% | 100.0% | 100.0% | GREEN |
| lib/impact | 100.0% | 98.5% | 100.0% | 100.0% | GREEN |
| lib/render | 100.0% | 92.7% | 100.0% | 100.0% | GREEN |
| lib/crypto | 100.0% | 100.0% | 100.0% | 100.0% | GREEN |
| lib/analytics | 100.0% | 90.9% | 100.0% | 100.0% | GREEN |
| lib/auth | 98.1% | 96.4% | 100.0% | 99.2% | GREEN |
| lib/cache | 99.2% | 97.9% | 95.8% | 100.0% | GREEN |
| lib/db | 97.6% | 95.2% | 100.0% | 99.8% | GREEN |
| lib/email | 97.9% | 96.7% | 100.0% | 98.1% | GREEN |
| lib/github | 96.8% | 91.9% | 96.2% | 97.5% | GREEN |
| lib/history | 98.2% | 96.5% | 100.0% | 99.0% | GREEN |
| lib/effects | 94.6% | 90.8% | 94.7% | 95.8% | GREEN |
| app/api | 97.6% | 94.8% | 97.4% | 97.8% | GREEN |
| components | 95.9% | 90.2% | 93.9% | 98.2% | GREEN |
| lib/utils | 100.0% | 100.0% | 100.0% | 100.0% | GREEN |
| app/experiments | 56.1% | 51.2% | 52.6% | 59.7% | RED (accepted — WebGL/Canvas) |

**Overall:** 93.14% stmts | 89.87% branch | 90.00% funcs | 94.31% lines

## Gaps & Recommendations

### P2 — Actionable

- **`components/UserMenu.tsx`** — 94.8% stmts, 72.2% branches, 79.3% funcs. `handleInsightsFile` complex upload handler has uncovered branches. Carried from prior cycles; low priority but worth closing.

### P3 — Accepted / Low Priority

- **`components/AuthorTypewriter.tsx`** — 86.6% stmts, 67.5% branches. JSDOM timing limitations prevent full branch coverage on animation callbacks. Accepted limitation.
- **`lib/effects/backgrounds/ParticleBackground.tsx`** — 90.3% stmts, 72.2% branches, 77.8% funcs. Canvas/WebGL rendering; JSDOM ceiling. Accepted.
- **`lib/effects/interactions/HolographicOverlay.tsx`** — 47.0% stmts, 86.7% branches, 75.0% funcs. JSDOM limitation for WebGL paths. Accepted.
- **`lib/render/svg-to-png.ts`** — 100% stmts, 66.7% branches. `turbopackIgnore` fallback branch and PNG error path. Fire-and-forget; accepted.
- **`lib/render/demoData.ts` / `archetypeDemoData.ts`** — 50% branches each. Null-coalescing arms on static data; would require `undefined` injection. Accepted.
- **`app/api/refresh/route.ts`** — 100% stmts, 75% funcs. 1 fire-and-forget `updateCraftCache` catch arrow uncovered. Accepted.
- **`components/ShareBadgePreviewLazy.tsx`** / **`GlobalCommandBarLazy.tsx`** — 40–50% stmts. `next/dynamic` wrappers; runtime-rendered portion not exercisable in JSDOM. Accepted.

### Not Actionable (Next.js server pages / static assets)

- `app/admin/page.tsx`, `app/studio/page.tsx`, `app/layout.tsx`, `app/apple-icon.tsx`, `app/icon.tsx`, `components/ClientAnalytics.tsx` — all 0% runtime coverage; structurally tested where applicable. Accepted.

## Flaky Tests

| Test | File | Occurrences (3 runs) | Nature |
|------|------|----------------------|--------|
| `download strips SVG animations` | `BadgeToolbar.render.test.tsx:948` | 1/3 FAILED | Timing race: `capturedSrc` sometimes resolves as `<svg></svg>` (empty processed result) instead of stripped SVG. `queueMicrotask` + `setTimeout(r, 0)` in `act()` is not reliably flushing the full async chain. Previously declared resolved (2026-04-07); re-emerged today. |

**Root cause:** The `MockImage.onerror` fires via `queueMicrotask` inside `act()`, but `handleDownload` in `BadgeToolbar.tsx` has multiple async hops (fetch → stripAnimations → set Image.src → onerror → fallback download). The single `await new Promise((r) => setTimeout(r, 0))` is sometimes insufficient to drain all microtask + promise chains before the assertion runs.

**Recommendation:** Replace `setTimeout(r, 0)` with a `flushPromises` helper (or multiple awaits) to fully drain the async queue. This is a P2 — the test gave a false negative in production-equivalent code.

**Additionally:** An unhandled rejection (`window is not defined` from `setDownloadStatus("idle")` in `BadgeToolbar.tsx:130`) surfaces on the first run. This is a post-unmount state update caused by the async download completing after the test cleans up. Not a test failure by itself, but contributes to environment pollution between tests.

---

## Delta vs 2026-04-08

| Metric | 2026-04-08 | 2026-04-09 | Delta |
|--------|-----------|-----------|-------|
| Statements | 93.13% | 93.14% | +0.01pp |
| Branches | 89.87% | 89.87% | 0pp |
| Functions | 89.94% | 90.00% | +0.06pp |
| Lines | 94.31% | 94.31% | 0pp |
| Test files | 390 | 390 | 0 |
| Tests | 7000 | 7000 | 0 |

Coverage is plateau-stable. No new tests added since 2026-04-08.
