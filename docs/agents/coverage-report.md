# Coverage Report
> Generated: 2026-04-13 | Health status: YELLOW

## Executive Summary

Overall coverage is **93.14% statements** (7585/8143) across 390 test files and 7001 tests. All critical scoring, rendering, and shared library paths are at 100%. The YELLOW status is driven by experiment pages (Canvas/WebGL, untestable in JSDOM) and a few component function gaps pulling branches below 90%.

## Coverage by Module

| Module | Stmts | Branch | Funcs | Lines | Status |
|--------|-------|--------|-------|-------|--------|
| **All files** | **93.14%** | **89.86%** | **90.01%** | **94.31%** | YELLOW |
| `lib/impact` (scoring) | 100% | 98.5% | 100% | 100% | GREEN |
| `lib/render` (SVG) | 100% | 92.7% | 100% | 100% | GREEN |
| `packages/shared` | 100% | 100% | 100% | 100% | GREEN |
| `lib/cache` | 99.2% | 97.9% | 95.8% | 100% | GREEN |
| `lib/history` | 98.2% | 96.5% | 100% | 99.0% | GREEN |
| `lib/auth` | 98.1% | 96.4% | 100% | 99.2% | GREEN |
| `lib` (root) | 98.0% | 97.9% | 100% | 100% | GREEN |
| `lib/email` | 97.8% | 96.3% | 100% | 97.9% | GREEN |
| `lib/db` | 97.6% | 95.2% | 100% | 99.8% | GREEN |
| `lib/github` | 96.8% | 91.9% | 96.2% | 97.5% | GREEN |
| `lib/keyboard` | 96.5% | 95.9% | 100% | 97.3% | GREEN |
| `components` | 93.9% | 90.2% | 89.1% | 97.4% | YELLOW |
| `app/admin` | 93.8% | 88.1% | 98.4% | 94.8% | GREEN |
| `lib/effects/interactions` | 76.9% | 88.9% | 87.5% | 78.4% | YELLOW |
| `lib/effects/backgrounds` | 91.1% | 76.2% | 81.8% | 94.8% | YELLOW |
| `app/experiments` (Canvas/WebGL) | 71.4% | 100% | 33.3% | 71.4% | RED (accepted) |
| `app` (root layout/icons) | 75.6% | 100% | 85.7% | 75.0% | YELLOW (accepted) |

## Files Below 80% Coverage

| File | Stmts | Branch | Funcs | Notes |
|------|-------|--------|-------|-------|
| `experiments/hexmap/page.tsx` | 0% | 0% | 0% | Canvas/WebGL — JSDOM limitation |
| `experiments/holographic/page.tsx` | 45.7% | 50% | 45.5% | Canvas — JSDOM limitation |
| `experiments/confetti/page.tsx` | 47.5% | 40% | 31.6% | Canvas — JSDOM limitation |
| `experiments/3d-tilt/page.tsx` | 55.6% | 46.2% | 42.9% | Canvas — JSDOM limitation |
| `experiments/metallic-shimmer/page.tsx` | 60% | 28.6% | 50% | Canvas — JSDOM limitation |
| `experiments/number-counters/page.tsx` | 61.7% | 48.9% | 58.5% | Canvas — JSDOM limitation |
| `experiments/tier-visuals/page.tsx` | 65.9% | 79.5% | 65.5% | Canvas — JSDOM limitation |
| `experiments/heatmap-wave/page.tsx` | 72.4% | 50% | 60% | Canvas — JSDOM limitation |
| `experiments/particles/page.tsx` | 76.6% | 59.6% | 62.5% | Canvas — JSDOM limitation |
| `HolographicOverlay.tsx` | 47.1% | 86.7% | 75% | Canvas — JSDOM limitation |
| `ParticleBackground.tsx` | 90.3% | 72.2% | 77.8% | Canvas animation callbacks |
| `GlobalCommandBarLazy.tsx` | 50% | 100% | 33.3% | Lazy wrapper (3 lines) |
| `ShareBadgePreviewLazy.tsx` | 40% | 100% | 25% | Lazy wrapper (3 lines) |
| `components/UserMenu.tsx` | 94.8% | 98.6% | **79.3%** | `handleInsightsFile` uncovered |
| `app/u/[handle]/badge.svg/route.ts` | 91.7% | 90.6% | **80%** | `after()` fire-and-forget path |

## Gaps & Recommendations

### P2 — Worth addressing

- **`components/UserMenu.tsx`** — 79.3% funcs. The `handleInsightsFile` function (file upload handler) lacks test coverage. Add a test mocking `FileReader` + the POST to `/api/insights`.
- **`lib/effects/interactions/HolographicOverlay.tsx`** — 47% stmts. Canvas-dependent but the CSS-export path and hook lifecycle are testable. Add tests for the non-canvas branches.
- **`lib/effects/backgrounds/ParticleBackground.tsx`** — 72.2% branch. Animation frame callbacks are canvas-dependent. Test the mount/unmount lifecycle and config defaults.

### P3 — Accepted limitations (no action needed)

- **All `experiments/*` pages** — Canvas/WebGL rendering untestable in JSDOM. Accepted limitation. Aggregate 56.1%.
- **`GlobalCommandBarLazy.tsx` / `ShareBadgePreviewLazy.tsx`** — `next/dynamic` wrappers (2-3 lines each). Coverage numbers are misleading; the underlying components are fully tested.
- **`app` root `layout.tsx`, `apple-icon.tsx`, `icon.tsx`** — Next.js framework entry points. Not meaningful to unit test.
- **`svg-to-png.ts`** — 66.7% branch. The `existsSync` fallback path is environment-specific.
- **`render/demoData.ts` / `archetypeDemoData.ts`** — 50% branch. Null-guard arms on static data.

### Files Without Dedicated Test Files

These files are covered transitively through other tests (route tests, component tests) but have no companion `.test.ts`:

| File | Reason |
|------|--------|
| `lib/bitbucket/types.ts` | Type-only (no runtime code) |
| `lib/codeberg/types.ts` | Type-only (no runtime code) |
| `lib/history/types.ts` | Re-export only |
| `lib/verification/types.ts` | Type-only |
| `packages/shared/src/types.ts` | Type-only |
| `packages/shared/src/platforms.ts` | Type-only |
| `app/api/auth/bitbucket/config.ts` | Covered by route tests |
| `app/api/auth/codeberg/config.ts` | Covered by route tests |
| `components/ThemeProvider.tsx` | Thin wrapper around `next-themes` |
| `lib/test-helpers/admin-auth.ts` | Test infrastructure |
| `lib/test-helpers/platform-auth-fixtures.ts` | Test infrastructure |

## Flaky Tests

**None detected.** Suite ran 3 consecutive times with identical results: 7001/7001 passed, 0 failures, 0 skipped in all 3 runs. The previously flaky `BadgeToolbar.render.test.tsx` (fixed 2026-04-10) remains stable.

## Trend

| Date | Stmts | Tests | Files | Flaky |
|------|-------|-------|-------|-------|
| 2026-04-13 | 93.14% | 7001 | 390 | 0 |
| 2026-04-12 | 93.12% | 7001 | 390 | 0 |
| 2026-04-10 | 93.14% | 7000 | 390 | 1 (BadgeToolbar) |
| 2026-04-09 | 93.14% | 7000 | 390 | 1 (BadgeToolbar) |

Coverage is plateau-stable. The +0.02pp delta vs 2026-04-12 is within rounding noise (2 more statements covered). No regression.
