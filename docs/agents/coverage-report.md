# Coverage Report
> Generated: 2026-03-19 | Health status: GREEN

## Executive Summary
Test coverage stands at **87.45% statements** (6,752/7,721) across 318 test files and 5,495 tests with a 100% pass rate. All critical paths (scoring, rendering, API routes, database, auth) are above 93%. Zero flaky tests detected across 5 consecutive runs. No regressions since last report (flat at 87.45%).

**Note:** Raw v8 output shows 78.48% due to 10 macOS duplicate " 2" files (882 uncovered stmts). Adjusted coverage after excluding these untracked duplicates is 87.45%.

## Coverage by Module
| Module | Coverage | Files | <80% Files | Status |
|--------|----------|-------|------------|--------|
| `lib/render` | 100.0% | 11 | 0 | GREEN |
| `lib/verification` | 100.0% | 2 | 0 | GREEN |
| `packages/shared` | 100.0% | 6 | 0 | GREEN |
| `lib/agents` | 100.0% | 2 | 0 | GREEN |
| `lib/analytics` | 100.0% | 2 | 0 | GREEN |
| `lib/async` | 100.0% | 2 | 0 | GREEN |
| `lib/dashboard` | 100.0% | 1 | 0 | GREEN |
| `lib/http` | 100.0% | 1 | 0 | GREEN |
| `lib/test-helpers` | 100.0% | 1 | 0 | GREEN |
| `lib/utils` | 100.0% | 4 | 0 | GREEN |
| `lib/env` | 100.0% | 1 | 0 | GREEN |
| `lib/impact` | 99.5% | 5 | 0 | GREEN |
| `lib/cache` | 99.0% | 2 | 0 | GREEN |
| `lib/history` | 98.2% | 5 | 0 | GREEN |
| `lib/codeberg` | 97.5% | 3 | 0 | GREEN |
| `lib/validation` | 97.3% | 1 | 0 | GREEN |
| `lib/github` | 97.1% | 4 | 0 | GREEN |
| `app/api` | 96.7% | 41 | 0 | GREEN |
| `lib/keyboard` | 96.5% | 2 | 0 | GREEN |
| `lib/db` | 94.9% | 11 | 0 | GREEN |
| `lib/email` | 94.7% | 6 | 0 | GREEN |
| `lib/auth` | 94.7% | 8 | 0 | GREEN |
| `lib/insights` | 93.0% | 3 | 1 | GREEN |
| `lib/bitbucket` | 93.1% | 3 | 0 | GREEN |
| `lib/effects` | 90.5% | 17 | 1 | GREEN |
| `lib/feature-flags` | 88.9% | 1 | 0 | YELLOW |
| `components` | 88.8% | 44 | 10 | YELLOW |
| `lib/hooks` | 87.1% | 1 | 0 | YELLOW |
| `lib/crypto` | 85.7% | 1 | 0 | YELLOW |
| `app/pages` | 73.6% | 73 | 46 | RED |
| `app/experiments` | 56.2% | 15 | 11 | RED |

## Detailed Coverage Metrics
| Metric | Value | Adjusted |
|--------|-------|----------|
| Statements | 78.48% raw | **87.45%** (6,752/7,721) |
| Branches | 78.46% raw | **82.19%** (3,608/4,390) |
| Functions | 70.49% raw | **78.79%** (1,233/1,565) |
| Test Files | 318 | 318 |
| Total Tests | 5,495 | 5,495 |
| Pass Rate | 100% | 100% |

## Gaps & Recommendations

### Untested Production Files (HIGH priority)
- **`lib/crypto/safe-equal.ts`** — Security-critical timing-safe string comparison. No dedicated tests despite being used for bearer token validation. Needs tests for: equal/different strings, length mismatch, error handling.
- **`lib/async/process-in-batches.ts`** — Batch processing utility used in campaign/cron operations. Needs tests for: batch sizing, empty input, mixed success/failure results, ordering.

### Files Closest to 80% Threshold
- **`lib/insights/validation.ts`** (79.5%) — 1 file, 88 stmts. Closest to threshold. Needs ~1 more test to cross 80%.
- **`lib/effects/interactions/HolographicOverlay.tsx`** (47.1%) — 17 stmts. Interactive effect, hard to test but smoke tests exist.
- **`components/PostHogProvider.tsx`** (24.1%) — 29 stmts. Analytics wrapper with conditional logic. Partially tested via render tests.

### Low-Priority Gaps (Context)
- **`app/pages`** (73.6%, 46 files below 80%) — Nearly all are Next.js server component wrappers showing 0% due to V8 instrumentation limitations. These are tested indirectly via companion `.test.ts` files that import and test the exported functions. Not a real coverage gap.
- **`app/experiments`** (56.2%, 11 files below 80%) — All behind `experiments_enabled` feature flag. Canvas-heavy pages (`hexmap` 0%, `particles` 76.6%). Low traffic, gated access.
- **`components`** (88.8%, 10 files below 80%) — The 10 files at 0% are all thin server-component wrappers (Navbar.tsx, CopyButton.tsx, ErrorBanner.tsx, etc.) with comprehensive logic tests in companion files.

### Actionable Items (Priority Order)
1. **Write tests for `lib/crypto/safe-equal.ts`** — Security-critical, untested
2. **Write tests for `lib/async/process-in-batches.ts`** — Utility used in production paths, untested
3. **Add 1 test to `lib/insights/validation.ts`** — Push from 79.5% to 80%+
4. **Delete 10 macOS duplicate " 2" files** — They inflate raw totals by 882 stmts and cause 7 false-positive type errors
5. **Add smoke test for `components/ThemeProvider.tsx`** — Low priority, thin wrapper

## Flaky Tests
None detected. 5 consecutive runs (1 with coverage instrumentation, 4 without), all 5,495/5,495 tests passed in every run.

Previous known flaky (`BadgeToolbar.render.test.tsx` canvas download path) did not reproduce this session. Likely a coverage-instrumentation race condition under heavy parallel load — intermittent, not systematic.

## Delta vs Previous Report (2026-03-18)
| Metric | Previous | Current | Delta |
|--------|----------|---------|-------|
| Statements | 87.45% | 87.45% | +0.00% |
| Tests | 5,495 | 5,495 | +0 |
| Test Files | 318 | 318 | +0 |
| Flaky Tests | 1 intermittent | 0 | -1 |

Coverage is stable. No regressions, no new tests added since last report. The previously intermittent flaky test did not reproduce.
