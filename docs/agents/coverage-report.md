# Coverage Report
> Generated: 2026-03-31 | Health status: GREEN

## Executive Summary
Overall test coverage remains strong at **92.72% statements** (7,491/8,079) across 382 test files and 6,655 tests with a 100% pass rate. All critical paths (scoring, rendering, API, database, auth) are above 96%. Zero flaky tests detected across 3 consecutive runs.

## Coverage by Module

### Critical Paths (all GREEN)
| Module | Stmts | Branch | Funcs | Lines | Status |
|--------|-------|--------|-------|-------|--------|
| `lib/impact` (scoring) | 100.0% | 98.5% | 100.0% | 100.0% | GREEN |
| `lib/render` (SVG) | 100.0% | 92.7% | 100.0% | 100.0% | GREEN |
| `lib/verification` | 100.0% | 100.0% | 100.0% | 100.0% | GREEN |
| `lib/insights` | 100.0% | 92.6% | 100.0% | 100.0% | GREEN |
| `packages/shared` | 100.0% | 100.0% | 100.0% | 100.0% | GREEN |
| `lib/cache` | 99.2% | 97.9% | 95.8% | 100.0% | GREEN |
| `lib/history` | 98.2% | 94.1% | 100.0% | 99.0% | GREEN |
| `lib/auth` | 98.1% | 96.4% | 100.0% | 99.2% | GREEN |
| `lib/db` | 97.7% | 95.4% | 100.0% | 100.0% | GREEN |
| `lib/codeberg` | 97.5% | 95.7% | 96.2% | 100.0% | GREEN |
| `lib/bitbucket` | 97.2% | 89.5% | 96.3% | 100.0% | GREEN |
| `lib/github` | 96.8% | 91.3% | 96.2% | 97.5% | GREEN |
| `lib/email` | 96.7% | 93.4% | 100.0% | 97.5% | GREEN |
| `components` | 95.4% | 89.1% | 92.2% | 97.7% | GREEN |
| `lib/effects` | 94.6% | 90.8% | 94.7% | 95.8% | GREEN |

### API Routes (all GREEN)
| Module | Stmts | Branch | Funcs | Lines | Status |
|--------|-------|--------|-------|-------|--------|
| `app/api/auth` | 99.2% | 97.0% | 100.0% | 100.0% | GREEN |
| `app/api/cron` | 98.7% | 93.1% | 100.0% | 99.3% | GREEN |
| `app/api/cli` | 97.3% | 100.0% | 100.0% | 97.2% | GREEN |
| `app/api/insights` | 97.3% | 100.0% | 100.0% | 97.3% | GREEN |
| `app/api/webhooks` | 96.7% | 95.2% | 100.0% | 96.7% | GREEN |
| `app/api/admin` | 95.8% | 91.2% | 93.2% | 96.0% | GREEN |
| `app/api/history` | 95.6% | 91.4% | 100.0% | 95.6% | GREEN |
| `app/api/supplemental` | 93.5% | 94.7% | 100.0% | 93.5% | GREEN |
| `app/api/studio` | 92.3% | 85.7% | 100.0% | 92.0% | GREEN |
| `app/api/generate` | 100.0% | 100.0% | 100.0% | 100.0% | GREEN |
| `app/api/health` | 100.0% | 100.0% | 100.0% | 100.0% | GREEN |
| `app/api/profile` | 100.0% | 100.0% | 100.0% | 100.0% | GREEN |
| `app/api/recalculate` | 100.0% | 100.0% | 100.0% | 100.0% | GREEN |
| `app/api/refresh` | 100.0% | 100.0% | 100.0% | 100.0% | GREEN |
| `app/api/verify` | 100.0% | 100.0% | 100.0% | 100.0% | GREEN |
| `app/api/telemetry` | 100.0% | 100.0% | 100.0% | 100.0% | GREEN |
| `app/api/feature-flags` | 100.0% | 100.0% | 100.0% | 100.0% | GREEN |
| `app/api/notifications` | 100.0% | 100.0% | 100.0% | 100.0% | GREEN |

### Pages & UI
| Module | Stmts | Branch | Funcs | Lines | Status |
|--------|-------|--------|-------|-------|--------|
| `app/admin` | 93.7% | 89.4% | 87.2% | 95.6% | GREEN |
| `app/studio` | 87.6% | 83.3% | 87.1% | 87.6% | GREEN |
| `app/experiments` | 56.1% | 51.2% | 52.6% | 59.7% | RED (accepted) |
| `lib/hooks` | 87.1% | 72.2% | 75.0% | 96.4% | YELLOW |

### Other (GREEN)
| Module | Stmts | Status |
|--------|-------|--------|
| `lib/agents`, `lib/async`, `lib/crypto`, `lib/env`, `lib/feature-flags`, `lib/keyboard`, `lib/test-helpers`, `lib/utils`, `lib/validation`, `lib/dashboard`, `lib/analytics`, `lib/http` | 96-100% | GREEN |

## Gaps & Recommendations

### P1 — Functions coverage <80% (actionable)
| File | Stmts | Funcs | Issue |
|------|-------|-------|-------|
| `app/studio/BadgePreviewCard.tsx` | 81.1% | **53.3%** | Interaction callbacks untested |
| `app/admin/AdminDashboardClient.tsx` | 80.6% | **68.4%** | Event handler branches untested |
| `components/SharePageShortcuts.tsx` | 100% | **66.7%** | No test file exists (60 lines) |
| `app/api/admin/bulk-recalculate/route.ts` | 85.4% | **71.4%** | Edge case branches |
| `lib/hooks/use-trend-data.ts` | 87.1% | **75.0%** | Hook branch paths |
| `components/InfoTooltip.tsx` | 91.3% | **76.5%** | Some interaction paths |
| `lib/effects/backgrounds/ParticleBackground.tsx` | 90.3% | **77.8%** | Canvas/animation paths |
| `components/UserMenu.tsx` | 94.0% | **78.6%** | Menu interaction handlers |

### P2 — Branch coverage <80% (lower priority)
| File | Branch | Issue |
|------|--------|-------|
| `components/AuthorTypewriter.tsx` | 66.7% | Animation timing branches |
| `lib/email/templates/announcement.ts` | 68.8% | Template conditional branches |
| `lib/effects/backgrounds/ParticleBackground.tsx` | 72.2% | Canvas feature detection |
| `lib/hooks/use-trend-data.ts` | 72.2% | Data state branches |
| `lib/history/trend.ts` | 75.0% | Edge case paths |
| `components/ConfirmDialog.tsx` | 75.0% | Dialog state branches |
| `app/admin/engagement/engagement-dashboard.tsx` | 75.0% | Dashboard filter branches |

### Accepted Limitations (no action needed)
| File | Stmts | Reason |
|------|-------|--------|
| `app/experiments/*` (all pages) | 0-81% | Feature-flagged, canvas/WebGL-heavy, JSDOM limitations |
| `lib/effects/interactions/HolographicOverlay.tsx` | 47.0% | Canvas/WebGL — JSDOM cannot execute |
| `app/layout.tsx`, `app/icon.tsx`, `app/apple-icon.tsx` | 0% | Next.js server components — tested via integration |
| `app/admin/page.tsx`, `app/studio/page.tsx` | 0% | Server page wrappers — logic in client components |
| `components/ClientAnalytics.tsx` | 0% | PostHog wrapper — no testable logic |
| `components/ShareBadgePreviewLazy.tsx` | 40% | `next/dynamic` wrapper with `ssr: false` |
| `components/GlobalCommandBarLazy.tsx` | 50% | `next/dynamic` wrapper with `ssr: false` |

## Untested Files
| File | Lines | Risk |
|------|-------|------|
| `packages/shared/src/types.ts` | 361 | None — type definitions only |
| `lib/bitbucket/types.ts` | 91 | None — type definitions only |
| `lib/codeberg/types.ts` | 69 | None — type definitions only |
| `components/SharePageShortcuts.tsx` | 60 | **LOW** — has testable keyboard shortcut logic |
| `packages/shared/src/index.ts` | 56 | None — re-exports only |
| `packages/shared/src/stats-schema.ts` | 52 | None — Zod schema (tested via validators) |
| `app/api/auth/bitbucket/config.ts` | 29 | None — config constants |
| `app/api/auth/codeberg/config.ts` | 24 | None — config constants |
| `lib/verification/types.ts` | 19 | None — type definitions only |
| `packages/shared/src/platforms.ts` | 9 | None — constants |
| `lib/history/types.ts` | 3 | None — type definitions only |

Only `SharePageShortcuts.tsx` (60 lines) has testable logic among untested files.

## Flaky Tests
None detected. 3 consecutive runs: 6,655/6,655 passed each time (25-38s per run).

## Delta vs Previous Report (2026-03-30)
| Metric | Previous | Current | Delta |
|--------|----------|---------|-------|
| Statements | 92.72% | 92.72% | +0.00% |
| Branches | 89.05% | 89.05% | +0.00% |
| Functions | 88.57% | 88.57% | +0.00% |
| Lines | 93.99% | 93.99% | +0.00% |
| Test files | 382 | 382 | +0 |
| Tests | 6,655 | 6,655 | +0 |
| Flaky tests | 0 | 0 | -- |

No changes since last report. Coverage is stable.

## Thresholds
All thresholds pass with comfortable margin:
- Statements: 92.72% (threshold: 75%, margin: +17.72%)
- Branches: 89.05% (threshold: 70%, margin: +19.05%)
- Functions: 88.57% (threshold: 65%, margin: +23.57%)
- Lines: 93.99% (threshold: 75%, margin: +18.99%)
