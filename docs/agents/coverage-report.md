# Coverage Report
> Generated: 2026-04-04 | Health status: green

## Executive Summary

All critical paths remain GREEN with overall statements at 93.12% (+0.13pp) and functions at 90.04% (+0.46pp). The long-standing P1 — `AdminDashboardClient.tsx` functions at 68.42% — is **confirmed resolved** at 100% across all metrics this cycle. One intermittent flaky test detected in full-suite runs only (passes in isolation).

---

## Coverage by Module

| Module | Stmts | Branch | Funcs | Lines | Status |
|--------|-------|--------|-------|-------|--------|
| **Overall** | **93.12%** | **89.78%** | **90.04%** | **94.29%** | 🟢 |
| `lib/impact` | 100% | 98.5% | 100% | 100% | 🟢 |
| `lib/render` | 100% | 92.68% | 100% | 100% | 🟢 |
| `lib/cache` | 99.18% | 97.91% | 95.83% | 100% | 🟢 |
| `lib/history` | 98.23% | 96.47% | 100% | 99% | 🟢 |
| `lib/auth` | 98.06% | 96.39% | 100% | 99.17% | 🟢 |
| `lib/email` | 97.75% | 96.29% | 100% | 97.93% | 🟢 |
| `lib/db` | 97.69% | 95.36% | 100% | 100% | 🟢 |
| `app/api` | ~97% | ~93% | ~99% | ~97% | 🟢 |
| `lib/github` | 96.79% | 91.94% | 96.15% | 97.54% | 🟢 |
| `lib/insights` | 100% | 92.64% | 100% | 100% | 🟢 |
| `app/admin` | 93.78% | 86.87% | 98.38% | 94.83% | 🟢 |
| `components` | 93.79% | 90.16% | 88.94% | 97.31% | 🟢 |
| `packages/shared` | 100% | 100% | 100% | 100% | 🟢 |
| `app/experiments` | ~65% | ~58% | ~55% | ~70% | 🔴 (accepted) |

---

## Delta vs Previous Cycle (2026-04-03)

| Metric | 2026-04-03 | 2026-04-04 | Delta |
|--------|-----------|-----------|-------|
| Statements | 92.99% | 93.12% | +0.13pp |
| Branches | 89.65% | 89.78% | +0.13pp |
| Functions | 89.58% | 90.04% | **+0.46pp** |
| Lines | 94.19% | 94.29% | +0.10pp |
| Test count | 6,883 | 6,915 | +32 |
| Test files | 386 | 388 | +2 |

**Resolved this cycle:**
- `AdminDashboardClient.tsx` funcs: 68.42% → **100%** ✅ (P1, open 4 cycles)
- `app/verify/[hash]/page.tsx` branches: 75% → **100%** ✅
- `ConfirmDialog.tsx` branches: 75% → 93.75% ✅ (dead `else if` removed)

---

## Gaps & Recommendations

### P2 — Should fix

- **`AuthorTypewriter.tsx` branch 67.5%** (lines 106, 114, 126–143): Most significant branch gap remaining. Despite null guard removal in last triage cycle, animation/timeout branch paths are still uncovered. These drive the typewriter effect and error states.

- **`BadgeOverlay.tsx` branch 78.57%** (lines 236–237, 311): 3 uncovered branches in the overlay's positioning / dismiss logic. Low risk as it's a tooltip overlay, but below 80% branch threshold.

- **`lib/render/svg-to-png.ts` branch 66.66%** (line 38): Single uncovered branch — the `turbopackIgnore` path for `path.join(process.cwd(), ...)`. The file is otherwise 100% covered; only the conditional font-path resolution branch is missed.

- **`UserMenu.tsx` funcs 78.57%** (lines 259, 295–317, 415): 3 action handlers untested — likely the disconnect flows for Bitbucket/Codeberg and the profile-copy function. Worth covering given OAuth account management is security-adjacent.

- **`lib/insights/parser.ts` branch 83.5%** (lines 158, 166, 185, 190): 4 uncovered branches in the AI insights parser. Parsing edge cases (malformed LLM responses) are the likely gap.

### P3 — Low risk / accepted

- `app/admin/AdminDashboard.ts` branch 84.84% (lines 80–82, 118, 156) — orchestrator loading states
- `components/dashboard/DimensionCard.tsx` branch 82.75% (lines 134–144, 154–158)
- `Toast.tsx` stmts 85.71% (lines 140–141) — auto-dismiss edge case
- `ThemeToggle.tsx` stmts 85.71% (line 19) — SSR hydration guard
- `MobileNav.tsx` branch 89.28% (lines 38, 44, 64) — mobile-only interaction paths
- `GlobalCommandBarLazy.tsx` stmts 50% — lazy wrapper, only the `ssr: false` module boundary matters
- `ShareBadgePreviewLazy.tsx` stmts 40% — same pattern
- `lib/impact/heatmap-evenness.ts` branch 87.5% (line 46) — edge-case boundary
- `lib/render/demoData.ts` + `archetypeDemoData.ts` branch 50% — conditional demo path, no production path impact

### Untested files (no .test.ts counterpart)

These are all expected — no tests needed:

| File | Reason |
|------|--------|
| `app/admin/agents-types.ts` | Type declarations only |
| `app/api/auth/bitbucket/config.ts` | OAuth config constants |
| `app/api/auth/codeberg/config.ts` | OAuth config constants |
| `app/apple-icon.tsx`, `app/icon.tsx` | Next.js static asset generators |
| `app/archetypes/*/page.tsx` (7 files) | Static content pages, no logic |
| `app/studio/QuickControls.tsx` | UI component, no dedicated test |
| `lib/*/types.ts` (bitbucket, codeberg, history, verification) | Type-only files |

### Accepted limitations (permanent)

- `app/experiments/**/page.tsx` (13 pages, 0–95%): WebGL/Canvas/complex animations. JSDOM cannot execute these. The `hexmap/page.tsx` (0%, 636 lines) is the largest single untested file.
- `app/layout.tsx`: Next.js root layout — server component, no unit-testable logic
- `packages/shared/index.ts`, `platforms.ts`: Re-export barrels

---

## Flaky Tests

**1 intermittent flaky test detected:**

- **File**: `apps/web/components/BadgeToolbar.render.test.tsx`
- **Test**: `BadgeToolbar render > download strips SVG animations > strips @keyframes, animation properties, and SMIL animate elements`
- **Behavior**: Failed in 1 of 3 full-suite runs (run 3). Passed 5/5 runs in isolation.
- **Root cause**: Timing race — the test coordinates `fetch` mock + `Image` mock with `queueMicrotask` for microtask-level flush. In a full 388-file suite run, shared microtask queue congestion can cause the `onerror` callback to fire after the `act()` flush window.
- **Risk**: LOW — only affects download-animation stripping in badge export, not correctness of the badge SVG itself. The logic is correct; the test coordination is fragile under suite-wide concurrency.
- **Recommendation**: Replace `queueMicrotask` with a manual `Promise.resolve()` chain or use `waitFor()` with a condition check instead of a single `act()` flush.
