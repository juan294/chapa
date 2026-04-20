# Coverage Report
> Generated: 2026-04-20 | Branch: `develop` | Health status: **yellow**

## Executive Summary
All critical paths (scoring, rendering, API, database) are GREEN at 97–100%. The overall suite grew to 7,048 tests across 396 files with zero failures in 3/3 runs; the primary actionable gaps are `SharePageOwnerContent.tsx` (new P2 at 59% stmts) and `server-errors.ts` (63.6% branches in the token-scrubbing path).

## Coverage by Module

| Module | Stmts% | Branches% | Funcs% | Status |
|--------|--------|-----------|--------|--------|
| `lib/impact` | 100.0 | 98.6 | 100.0 | 🟢 GREEN |
| `lib/render` | 100.0 | 93.8 | 100.0 | 🟢 GREEN |
| `lib/db` | 97.6 | 95.3 | 100.0 | 🟢 GREEN |
| `lib/cache` | 99.2 | 98.0 | 95.7 | 🟢 GREEN |
| `lib/auth` | 97.7 | 95.7 | 100.0 | 🟢 GREEN |
| `lib/github` | 97.0 | 92.5 | 96.4 | 🟢 GREEN |
| `lib/history` | 98.2 | 96.6 | 100.0 | 🟢 GREEN |
| `lib/email` | 97.9 | 96.7 | 100.0 | 🟢 GREEN |
| `lib/crypto` | 100.0 | 100.0 | 100.0 | 🟢 GREEN |
| `lib/profile` | 100.0 | 91.7 | 100.0 | 🟢 GREEN |
| `lib/insights` | 100.0 | 92.6 | 100.0 | 🟢 GREEN |
| `app/api` (aggregate) | 97.5 | 94.6 | 94.8 | 🟢 GREEN |
| `app/admin` | 95.7 | 92.5 | 91.4 | 🟢 GREEN |
| `components` (aggregate) | ~94 | ~90 | ~89 | 🟡 YELLOW |
| `lib/analytics` | 84.1 | 71.4 | 87.5 | 🟡 YELLOW |
| `app/experiments` | 56.7 | 51.2 | 52.6 | ⬜ ACCEPTED (Canvas/WebGL) |
| **Overall** | **93.07** | **89.56** | **89.83** | 🟡 **YELLOW** |

## Gaps & Recommendations

### P2 — Actionable (below 80% in at least one metric)

- **`components/SharePageOwnerContent.tsx`** — 59.1% stmts, 77.3% branches, 50% funcs.
  New gap this cycle. The owner-only interactive section (copy embed, refresh badge, share CTAs) is completely untested. Should have render + interaction tests covering the conditional owner-only branch, the copy-to-clipboard handler, and the refresh CTA flow.

- **`lib/analytics/server-errors.ts`** — 80% stmts, **63.6% branches**, 80% funcs.
  The SENSITIVE_PATTERNS token-scrubbing regex branches are the uncovered paths. These are security-relevant (token leak prevention in error logs) — should be tested with all 9 pattern types and verified that scrubbing fires before the log write.

- **`app/api/refresh/route.ts`** — 100% stmts/branches, **33.3% funcs**.
  Fire-and-forget arrow callbacks (`after()` side-effect lambdas). Low blast radius but persistent gap — accepted unless after() side-effects need reliability guarantees.

- **`app/api/recalculate/route.ts`** — 100% stmts/branches, **50% funcs**.
  Same pattern as refresh — after() lambdas uncovered. Accepted.

- **`lib/auth/unsubscribe-token.ts`** — 90.9% stmts, **75% branches**.
  One uncovered branch in the token validation path (invalid/expired token handling). Low risk — unsubscribe is non-critical, but worth a test.

### P3 — Accepted (structural limitations)

- **`components/AuthorTypewriter.tsx`** — 67.5% branches. JSDOM timing limit prevents testing rapid-fire character intervals. Accepted.
- **`components/GlobalCommandBarLazy.tsx`** / **`ShareBadgePreviewLazy.tsx`** — 25–50% funcs. Pure `next/dynamic` re-export wrappers with no logic. Accepted.
- **`app/experiments/*`** — 52–80% range. All use Canvas/WebGL APIs unavailable in JSDOM. Accepted.
- **`lib/effects/interactions/HolographicOverlay.tsx`** — 50% stmts (Canvas). Accepted.
- **`lib/render/demoData.ts`** / **`archetypeDemoData.ts`** — 50% branches (static data tables, no real branch logic). Accepted.
- **`app/apple-icon.tsx`**, **`app/icon.tsx`**, **`app/layout.tsx`** — 0% (Next.js static assets / root layout, not unit-testable). Accepted.

### Untested files (no `.test.ts` counterpart)

Only 2 files in critical paths have no test file:
- `apps/web/app/api/auth/codeberg/config.ts` (24 lines) — pure config object, covered transitively via platform-oauth tests
- `apps/web/app/api/auth/bitbucket/config.ts` (29 lines) — same

No action needed.

## Flaky Tests

**None detected** — 3/3 runs passed 7,048/7,048 tests.

---

## Delta vs 2026-04-19

| Item | Before | After | Change |
|------|--------|-------|--------|
| Test files | 394 | 396 | +2 |
| Total tests | 6,901 | 7,048 | +147 |
| Overall stmts | 93.07% | 93.07% | → stable |
| `warm-cache/route.ts` funcs | 62.5% | **100%** | ✅ P2 resolved |
| `public-profile.ts` branches | 68.75% | **88.88%** | ✅ P2 resolved |
| `UserMenu.tsx` funcs | 80% | **81.25%** | ✅ above threshold |
| `SharePageOwnerContent.tsx` stmts | — | **59.09%** | 🆕 NEW P2 |
| `server-errors.ts` branches | 63.63% | 63.63% | → unchanged P2 |

---

```
SHARED_CONTEXT_START
## Coverage Agent — 2026-04-20
- **Status**: YELLOW
- Overall coverage: **93.07% stmts** (7800/8380), 89.56% branches, 89.83% funcs, 94.14% lines
- Test suite: 396 files, 7048 tests (+147 vs 2026-04-19 — remediation work added tests)
- All critical paths GREEN: lib/impact 100%, lib/render 100%, lib/db 97.6%, lib/cache 99.2%, lib/auth 97.7%, lib/github 97%, lib/history 98.2%, lib/email 97.9%, app/api 97.5%, lib/profile 100%
- **Flaky tests: NONE** — 3/3 runs passed 7048/7048.
- **P2 resolved from 2026-04-19**: warm-cache/route.ts funcs 100% (was 62.5%), public-profile.ts branches 88.88% (was 68.75%), UserMenu.tsx funcs 81.25% (above threshold)
- **P2 NEW**: `components/SharePageOwnerContent.tsx` — 59.09% stmts, 77.27% branches, 50% funcs. Owner-only interactive section (embed copy, refresh CTA) completely untested.
- **P2 carried**: `lib/analytics/server-errors.ts` — 63.63% branches. SENSITIVE_PATTERNS token-scrubbing branches uncovered — security-relevant.
- **P3 carried (all accepted)**: experiments 56.7% (Canvas/WebGL), HolographicOverlay 50% (Canvas), AuthorTypewriter 67.5% branches (JSDOM), demoData 50% branches (data tables), refresh/recalculate fire-and-forget arrows 33–50% funcs, lazy wrappers 25–50% funcs

**Cross-agent recommendations:**
- [Security]: `lib/analytics/server-errors.ts` branches at 63.63% — the uncovered paths include SENSITIVE_PATTERNS regex scrubbing branches. These are the token-redaction guards before error logs. Consider security agent adding specific tests for all 9 pattern types to confirm scrubbing fires correctly.
- [QA]: Suite grew +147 tests (remediation cycle added tests). All 3 runs clean, no flaky tests. SharePageOwnerContent P2 is the only new actionable item — owner UI interactive handlers have zero test coverage.
- [Cost Analyst]: app/api 97.5%, lib/db 97.6% — stable. No changes to caching path coverage.
SHARED_CONTEXT_END
```
