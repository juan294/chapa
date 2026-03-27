# Coverage Report
> Generated: 2026-03-27 | Health status: GREEN

## Executive Summary

Overall test coverage is **92.17% statements** (7,341/7,964) across 370 test files with 6,129 tests — all passing. Coverage improved +0.70% stmts vs 2026-03-26 (was 91.47%). All critical paths (scoring, rendering, API, database) exceed 96%. Zero flaky tests detected across 3 consecutive runs.

## Coverage Summary

| Metric | Coverage | Covered/Total |
|--------|----------|---------------|
| Statements | 92.17% | 7,341 / 7,964 |
| Branches | 87.22% | 3,968 / 4,549 |
| Functions | 87.26% | 1,459 / 1,672 |
| Lines | 93.56% | 6,722 / 7,184 |

## Coverage by Module

| Module | Files | Stmts | Branch | Funcs | Status |
|--------|-------|-------|--------|-------|--------|
| packages/shared | 10 | 100.0% | 100.0% | 100.0% | GREEN |
| lib/impact | 5 | 99.5% | 97.5% | 100.0% | GREEN |
| lib/render | 15 | 100.0% | 93.8% | 100.0% | GREEN |
| lib/verification | 3 | 100.0% | 100.0% | 100.0% | GREEN |
| lib/cache | 3 | 98.4% | 97.9% | 87.5% | GREEN |
| lib/history | 6 | 98.2% | 90.6% | 100.0% | GREEN |
| lib/other | 23 | 97.8% | 93.3% | 98.6% | GREEN |
| lib/codeberg | 4 | 97.5% | 95.7% | 96.2% | GREEN |
| lib/bitbucket | 4 | 97.2% | 89.5% | 96.3% | GREEN |
| lib/github | 4 | 97.1% | 90.2% | 95.7% | GREEN |
| app/api | 44 | 97.1% | 92.9% | 92.1% | GREEN |
| lib/email | 7 | 96.7% | 93.4% | 100.0% | GREEN |
| lib/db | 11 | 96.7% | 92.7% | 98.4% | GREEN |
| lib/auth | 11 | 96.3% | 92.9% | 100.0% | GREEN |
| lib/insights | 3 | 100.0% | 92.6% | 100.0% | GREEN |
| components | 47 | 94.5% | 85.0% | 90.1% | GREEN |
| lib/effects | 17 | 94.4% | 90.8% | 93.4% | GREEN |
| app/admin | 21 | 93.7% | 89.3% | 87.1% | GREEN |
| app/pages | 65 | 91.2% | 86.3% | 91.1% | GREEN |
| app/experiments | 16 | 56.1% | 51.2% | 52.6% | RED |

## Critical Path Detail (files below 95% stmts or 80% branch/funcs)

### API Routes
| File | Stmts | Branch | Funcs | Notes |
|------|-------|--------|-------|-------|
| api/auth/callback/route.ts | 93.3% | 80.5% | 70.0% | OAuth callback edge cases |
| api/admin/feature-flags/route.ts | 93.5% | 95.5% | 100.0% | Near threshold |
| api/studio/config/route.ts | 92.3% | 85.7% | 100.0% | PUT path gaps |
| api/notifications/unsubscribe/route.ts | 92.9% | 100.0% | 50.0% | Missing func coverage |
| api/supplemental/route.ts | 92.9% | 94.7% | 100.0% | Near threshold |
| api/cli/auth/approve/route.ts | 94.4% | 100.0% | 100.0% | Near threshold |

### Database Layer
| File | Stmts | Branch | Funcs | Notes |
|------|-------|--------|-------|-------|
| lib/db/snapshots.ts | 93.3% | 83.9% | 100.0% | Branch gaps in error paths |
| lib/db/supabase.ts | 90.0% | 100.0% | 80.0% | Client init functions |
| lib/db/tool-insights.ts | 92.9% | 87.5% | 100.0% | Near threshold |
| lib/db/verification.ts | 94.6% | 81.8% | 100.0% | Branch edge cases |

### Components
| File | Stmts | Branch | Funcs | Notes |
|------|-------|--------|-------|-------|
| UserMenu.tsx | 87.7% | 92.2% | 56.7% | Many untested callbacks |
| AuthorTypewriter.tsx | 86.9% | 66.7% | 100.0% | Animation branches |
| ThemeToggle.tsx | 85.7% | 87.5% | 85.7% | Theme switching edge cases |
| Toast.tsx | 85.7% | 91.7% | 85.7% | Timer/auto-dismiss paths |
| ConfirmDialog.tsx | 87.5% | 70.0% | 100.0% | Branch coverage low |
| InfoTooltip.tsx | 91.3% | 82.8% | 76.5% | Portal rendering branches |
| BadgeContent.tsx | 94.1% | 70.8% | 80.0% | Conditional rendering |
| SubMetricPanel.tsx | 97.2% | 64.5% | 100.0% | Low branch coverage |
| ScoreBoldNumber.tsx | 100.0% | 60.0% | 100.0% | Conditional formatting |
| AutocompleteDropdown.tsx | 90.7% | 73.8% | 92.3% | Keyboard nav branches |
| TerminalOutput.tsx | 100.0% | 50.0% | 100.0% | Line-type switch branches |
| ImpactBreakdown.tsx | 95.7% | 72.4% | 100.0% | Low branch coverage |
| InsightCard.tsx | 92.9% | 89.6% | 100.0% | Near threshold |

### Effects
| File | Stmts | Branch | Funcs | Notes |
|------|-------|--------|-------|-------|
| HolographicOverlay.tsx | 47.1% | 86.7% | 75.0% | JSDOM limitation (accepted) |
| ParticleBackground.tsx | 90.3% | 72.2% | 77.8% | Canvas API in JSDOM |
| TierVisuals.tsx | 85.7% | 100.0% | 50.0% | Missing func coverage |

### Lazy Components (0% or near-0%)
| File | Stmts | Notes |
|------|-------|-------|
| ClientAnalytics.tsx | 0.0% | PostHog wrapper, no logic to test |
| ShareBadgePreviewLazy.tsx | 40.0% | `next/dynamic` wrapper |
| GlobalCommandBarLazy.tsx | 50.0% | `next/dynamic` wrapper |

## Experiments Module (56.1% — accepted low priority)

All files under `app/experiments/` are feature-flagged and canvas/animation-heavy. JSDOM/V8 cannot meaningfully test WebGL/Canvas2D interactions. Coverage here is best-effort.

| File | Stmts | Notes |
|------|-------|-------|
| hexmap/page.tsx | 0.0% | 636 lines, canvas-heavy |
| holographic/page.tsx | 45.7% | WebGL interactions |
| confetti/page.tsx | 47.5% | Canvas animations |
| 3d-tilt/page.tsx | 55.6% | CSS transform interactions |
| metallic-shimmer/page.tsx | 60.0% | CSS gradient animations |
| number-counters/page.tsx | 61.7% | requestAnimationFrame |
| tier-visuals/page.tsx | 65.9% | SVG animations |
| heatmap-wave/page.tsx | 72.4% | Canvas animations |
| particles/page.tsx | 76.6% | Canvas particles |
| glassmorphism/page.tsx | 79.5% | CSS backdrop-filter |

## Server Page Components (0% — Next.js limitation)

These are server components rendered by Next.js — they don't execute in Vitest's JSDOM environment. Their logic is tested indirectly through the API routes and components they compose.

| File | Notes |
|------|-------|
| app/layout.tsx | Root layout (providers, fonts) |
| app/icon.tsx | Generated favicon |
| app/apple-icon.tsx | Generated Apple icon |
| app/admin/page.tsx | Server wrapper for AdminDashboard |
| app/studio/page.tsx | Server wrapper for Studio |
| app/cli/authorize/error.tsx | Error boundary |
| app/experiments/error.tsx | Error boundary |
| app/experiments/loading.tsx | Loading skeleton |

## Untested Files

Only **3 source files** with meaningful logic lack dedicated test files:

1. **`components/ClientAnalytics.tsx`** — PostHog provider wrapper. No testable logic (just renders `<PostHogProvider>`). Accepted.
2. **`components/SharePageShortcuts.tsx`** — Keyboard shortcut listener. Renderless, side-effect only. Low priority.
3. **`api/auth/bitbucket/config.ts`** / **`api/auth/codeberg/config.ts`** — Static OAuth config objects. Tested indirectly by platform auth tests.

All type-only files (`types.ts`) and re-export barrels (`index.ts`) are appropriately excluded.

## Gaps & Recommendations

### Priority 1 — Should fix (critical path, <80% branch or funcs)
- **`api/auth/callback/route.ts`** (70.0% funcs) — Add tests for OAuth token exchange error paths and edge cases
- **`components/UserMenu.tsx`** (56.7% funcs) — Test disconnect callbacks, Bitbucket/Codeberg menu actions
- **`components/badge/BadgeContent.tsx`** (70.8% branch) — Test conditional rendering for missing dimensions, Craft toggle
- **`dashboard/SubMetricPanel.tsx`** (64.5% branch) — Test all metric type renderings
- **`dashboard/ScoreBoldNumber.tsx`** (60.0% branch) — Test formatting edge cases (0, 100, decimals)
- **`terminal/TerminalOutput.tsx`** (50.0% branch) — Test all line-type color mappings

### Priority 2 — Should improve (important files, 80-95%)
- **`lib/db/supabase.ts`** (80.0% funcs) — Test lazy client initialization
- **`lib/effects/TierVisuals.tsx`** (50.0% funcs) — Test tier-specific visual selection
- **`components/AuthorTypewriter.tsx`** (66.7% branch) — Test animation cycle completion
- **`components/ConfirmDialog.tsx`** (70.0% branch) — Test cancel/confirm callbacks, keyboard dismiss
- **`components/AutocompleteDropdown.tsx`** (73.8% branch) — Test keyboard navigation edge cases
- **`components/ImpactBreakdown.tsx`** (72.4% branch) — Test dimension visibility toggles

### Priority 3 — Nice to have
- **`api/notifications/unsubscribe/route.ts`** (50.0% funcs) — Test POST handler
- **`lib/effects/ParticleBackground.tsx`** (72.2% branch, 77.8% funcs) — Canvas limitations
- **`HolographicOverlay.tsx`** (47.1% stmts) — JSDOM limitation, accepted

### Accepted Limitations (no action needed)
- `app/experiments/*` — Feature-flagged, canvas/WebGL-heavy, JSDOM cannot test
- `HolographicOverlay.tsx` — DOM API gaps in JSDOM test environment
- Server page components (layout, icons, error boundaries) — Tested indirectly
- Lazy wrappers (`*Lazy.tsx`) — Thin `next/dynamic` wrappers

## Flaky Tests

**None detected.** Three consecutive full-suite runs produced identical results:

| Run | Tests | Passed | Failed | Duration |
|-----|-------|--------|--------|----------|
| 1 | 6,129 | 6,129 | 0 | 46.1s |
| 2 | 6,129 | 6,129 | 0 | 36.3s |
| 3 | 6,129 | 6,129 | 0 | 36.2s |

## Delta vs Previous Report (2026-03-26)

| Metric | Previous | Current | Delta |
|--------|----------|---------|-------|
| Statements | 91.47% | 92.17% | **+0.70%** |
| Branches | 85.77% | 87.22% | **+1.45%** |
| Functions | 86.29% | 87.26% | **+0.97%** |
| Lines | 92.89% | 93.56% | **+0.67%** |
| Test count | 6,032 | 6,129 | **+97** |
| Test files | 369 | 370 | **+1** |
| Flaky tests | 0 | 0 | — |
