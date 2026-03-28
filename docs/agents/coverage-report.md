# Coverage Report
> Generated: 2026-03-28 | Health status: GREEN

## Executive Summary

Test coverage is strong at **92.43% statements** across 316 source files with 6,414 tests in 378 test files. All critical paths (scoring, rendering, API, database) exceed 96%. Zero flaky tests detected across 3 consecutive runs. The only low-coverage area is `app/experiments` (56.1%), which is accepted due to canvas/WebGL/JSDOM limitations.

## Overall Coverage

| Metric | Coverage | Covered/Total | Threshold | Margin |
|--------|----------|---------------|-----------|--------|
| Statements | **92.43%** | 7,347/7,948 | 75% | +17.4% |
| Branches | **88.41%** | 4,022/4,549 | 70% | +18.4% |
| Functions | **87.78%** | 1,473/1,678 | 65% | +22.8% |
| Lines | **93.84%** | 6,722/7,163 | 75% | +18.8% |

## Delta vs Previous Report (2026-03-27)

| Metric | Previous | Current | Delta |
|--------|----------|---------|-------|
| Statements | 92.17% | 92.43% | **+0.26%** |
| Branches | 87.22% | 88.41% | **+1.19%** |
| Functions | 87.26% | 87.78% | **+0.52%** |
| Lines | 93.56% | 93.84% | **+0.28%** |
| Test files | 370 | 378 | **+8** |
| Tests | 6,129 | 6,414 | **+285** |

## Coverage by Module

| Module | Stmts | Branch | Funcs | Lines | Status |
|--------|-------|--------|-------|-------|--------|
| lib/impact | 99.5% | 97.5% | 100.0% | 100.0% | GREEN |
| lib/render | 100.0% | 93.8% | 100.0% | 100.0% | GREEN |
| lib/verification | 100.0% | 100.0% | 100.0% | 100.0% | GREEN |
| lib/insights | 100.0% | 92.6% | 100.0% | 100.0% | GREEN |
| packages/shared | 100.0% | 100.0% | 100.0% | 100.0% | GREEN |
| lib/cache | 98.4% | 97.9% | 87.5% | 100.0% | GREEN |
| lib/history | 98.2% | 90.6% | 100.0% | 99.0% | GREEN |
| lib/other | 97.8% | 93.3% | 98.6% | 99.2% | GREEN |
| app/api | 97.7% | 94.4% | 95.2% | 97.9% | GREEN |
| lib/codeberg | 97.5% | 95.7% | 96.2% | 100.0% | GREEN |
| lib/bitbucket | 97.2% | 89.5% | 96.3% | 100.0% | GREEN |
| lib/github | 97.2% | 92.1% | 96.0% | 97.5% | GREEN |
| lib/db | 96.9% | 92.7% | 98.4% | 99.4% | GREEN |
| lib/email | 96.7% | 93.4% | 100.0% | 97.5% | GREEN |
| lib/auth | 96.3% | 92.9% | 100.0% | 98.9% | GREEN |
| components | 95.0% | 88.6% | 90.8% | 97.3% | GREEN |
| app/pages | 94.9% | 94.1% | 94.9% | 95.4% | GREEN |
| lib/effects | 94.6% | 90.8% | 94.7% | 95.8% | GREEN |
| app/admin | 93.7% | 89.4% | 87.2% | 95.6% | GREEN |
| app/studio | 87.6% | 82.5% | 87.1% | 87.6% | YELLOW |
| app/experiments | 56.1% | 51.2% | 52.6% | 59.7% | RED (accepted) |

## Critical Path Files Below 90% (any metric)

These files are in critical paths but have at least one coverage metric below 90%:

| File | Stmts | Branch | Funcs | Lines | Priority |
|------|-------|--------|-------|-------|----------|
| `app/api/refresh/route.ts` | 100.0% | 92.8% | **66.7%** | 100.0% | P1 |
| `app/api/auth/callback/route.ts` | 98.3% | 97.6% | **80.0%** | 100.0% | P2 |
| `app/api/cron/warm-cache/route.ts` | 98.7% | 91.7% | **80.0%** | 98.7% | P2 |
| `lib/cache/snapshot-cache.ts` | 100.0% | 100.0% | **80.0%** | 100.0% | P2 |
| `lib/cache/redis.ts` | 97.7% | 97.5% | **85.7%** | 100.0% | P2 |
| `lib/db/supabase.ts` | 95.0% | 100.0% | **80.0%** | 100.0% | P2 |
| `app/api/studio/config/route.ts` | 92.3% | **85.7%** | 100.0% | 92.0% | P3 |
| `app/api/admin/agents/run/route.ts` | 95.1% | **85.2%** | 94.1% | 95.5% | P3 |
| `app/api/admin/campaigns/route.ts` | 96.0% | **86.4%** | 100.0% | 95.7% | P3 |
| `app/api/admin/users/route.ts` | 95.0% | **89.3%** | 100.0% | 94.4% | P3 |
| `lib/auth/github.ts` | 92.2% | **84.0%** | 100.0% | 98.8% | P3 |
| `lib/auth/bitbucket.ts` | 95.5% | **86.7%** | 100.0% | 98.3% | P3 |
| `lib/auth/codeberg.ts` | 94.3% | **86.4%** | 100.0% | 97.9% | P3 |
| `lib/db/snapshots.ts` | 93.2% | **83.9%** | 100.0% | 97.2% | P3 |
| `lib/db/admin-users.ts` | 96.9% | **81.2%** | 100.0% | 100.0% | P3 |
| `lib/db/verification.ts` | 94.6% | **81.8%** | 100.0% | 100.0% | P3 |
| `lib/db/tool-insights.ts` | 92.8% | **87.5%** | 100.0% | 95.8% | P3 |
| `lib/impact/heatmap-evenness.ts` | 100.0% | **83.3%** | 100.0% | 100.0% | P3 |
| `lib/impact/recency.ts` | 96.2% | **87.5%** | 100.0% | 100.0% | P3 |
| `lib/render/archetypeDemoData.ts` | 100.0% | **50.0%** | 100.0% | 100.0% | P3 |
| `lib/render/demoData.ts` | 100.0% | **50.0%** | 100.0% | 100.0% | P3 |

## Untested Files (no .test.ts counterpart)

**10 files** with no dedicated test file (789 total lines):

| File | Lines | Risk | Notes |
|------|-------|------|-------|
| `packages/shared/src/types.ts` | 357 | Low | Type definitions only |
| `apps/web/lib/bitbucket/types.ts` | 91 | Low | Type definitions only |
| `apps/web/lib/codeberg/types.ts` | 69 | Low | Type definitions only |
| `apps/web/components/SharePageShortcuts.tsx` | 59 | Low | UI shortcut handler |
| `packages/shared/src/index.ts` | 48 | Low | Re-exports |
| `apps/web/app/api/auth/bitbucket/config.ts` | 29 | Low | OAuth config constants |
| `apps/web/app/api/auth/codeberg/config.ts` | 24 | Low | OAuth config constants |
| `apps/web/lib/verification/types.ts` | 19 | Low | Type definitions only |
| `packages/shared/src/platforms.ts` | 9 | Low | Platform constants |
| `apps/web/lib/history/types.ts` | 3 | Low | Type definitions only |

Most untested files are type definitions or re-exports with no runtime behavior to test.

## 0% Coverage Files (Server/Singleton Components)

These files show 0% coverage due to Next.js server component or singleton constraints (JSDOM cannot import them):

| File | Reason |
|------|--------|
| `app/layout.tsx` | Root server layout (fonts, providers) |
| `app/icon.tsx` | Next.js metadata icon generation |
| `app/apple-icon.tsx` | Next.js metadata Apple icon generation |
| `app/admin/page.tsx` | Server page (imports tested AdminDashboardClient) |
| `app/studio/page.tsx` | Server page (imports tested studio components) |
| `app/experiments/hexmap/page.tsx` | Canvas/WebGL — JSDOM limitation |
| `app/cli/authorize/error.tsx` | Error boundary — Next.js runtime only |
| `app/experiments/error.tsx` | Error boundary — Next.js runtime only |
| `app/experiments/loading.tsx` | Loading component — server only |
| `components/ClientAnalytics.tsx` | PostHog singleton — tested indirectly |

## Accepted Low-Coverage Areas

| File/Area | Coverage | Reason |
|-----------|----------|--------|
| `app/experiments/*` | 56.1% | Feature-flagged, canvas/WebGL-heavy, V8/JSDOM limitations |
| `HolographicOverlay.tsx` | 47.0% | JSDOM lacks WebGL/canvas APIs |
| `ShareBadgePreviewLazy.tsx` | 40.0% | `next/dynamic` wrapper — tested via wrapped component |
| `GlobalCommandBarLazy.tsx` | 50.0% | `next/dynamic` wrapper — tested via wrapped component |

## Flaky Tests

**None detected.** Three consecutive runs all passed 6,414/6,414 tests with consistent results:

| Run | Tests | Passed | Failed | Duration |
|-----|-------|--------|--------|----------|
| 1 | 6,414 | 6,414 | 0 | 47.96s |
| 2 | 6,414 | 6,414 | 0 | ~48s |
| 3 | 6,414 | 6,414 | 0 | 31.34s |

## Gaps & Recommendations

### P1 — Function coverage gaps in critical API routes
- **`app/api/refresh/route.ts`** — 66.7% funcs. Add tests for uncovered exported functions (likely error/edge case handlers).

### P2 — Function coverage gaps in infrastructure
- **`app/api/auth/callback/route.ts`** — 80.0% funcs. Add tests for OAuth error callback paths.
- **`app/api/cron/warm-cache/route.ts`** — 80.0% funcs. Add tests for cron helper functions.
- **`lib/cache/snapshot-cache.ts`** — 80.0% funcs. Add tests for cache miss/error paths.
- **`lib/cache/redis.ts`** — 85.7% funcs. Add tests for rate limiter fallback functions.
- **`lib/db/supabase.ts`** — 80.0% funcs. Add tests for client initialization edge cases.

### P3 — Branch coverage gaps (80-90%)
- **`lib/render/demoData.ts`** and **`lib/render/archetypeDemoData.ts`** — 50% branch. Add tests for conditional demo data paths.
- **`lib/auth/github.ts`** — 84.0% branch. Add tests for token refresh error branches.
- **`lib/db/snapshots.ts`** — 83.9% branch. Add tests for snapshot upsert edge cases.
- **`lib/db/admin-users.ts`** — 81.2% branch. Add tests for admin lookup edge cases.
- **`lib/impact/heatmap-evenness.ts`** — 83.3% branch. Add tests for edge case evenness calculations.

### P4 — Non-critical
- **`app/studio/BadgePreviewCard.tsx`** — 53.3% funcs. Add tests for preview card interaction callbacks.
- **`components/UserMenu.tsx`** — 88.0% stmts but 57.1% funcs. Add tests for disconnect/menu action callbacks.
- **`components/AuthorTypewriter.tsx`** — 66.7% branch. Add tests for typewriter animation edge cases.
