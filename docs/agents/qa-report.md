# QA Report
> Generated: 2026-04-29 | Health status: green

## Executive Summary
All 7,272 tests pass across 409 files with zero type errors, zero lint issues, and zero accessibility violations. The only open item is the `og-image/route.ts` 60% function coverage gap entering its 5th carry cycle — everything else is clean.

## Test Results
- Total: 7,272 tests across 409 files
- Passed: 7,272 | Failed: 0 | Skipped: 0
- Duration: ~47s
- Flaky tests: 0 (BadgeToolbar `@keyframes` flake confirmed resolved for 5+ cycles)

## TypeScript
Clean — 0 errors across `packages/shared` and `apps/web`.

## Linting
Clean — 0 ESLint errors or warnings.

## Accessibility

**`<img>` alt attributes**: No bare `<img>` tags missing `alt` in any `.tsx`/`.jsx` source file.

**Focus indicators**: `focus-visible` styles confirmed in `styles/globals.css` (global baseline) and production components: `VerifyForm.tsx`, `BadgeToolbar.tsx`, `InfoTooltip.tsx`, `BadgeOverlay.tsx`. `prefers-reduced-motion` respected in `globals.css`, `StudioClient.tsx`, `AuthorTypewriter.tsx`, `ClaudeCodeStar.tsx`.

**ARIA labels**: `aria-label` / `aria-labelledby` present across all interactive components (`GlobalCommandBar.tsx`, `UserMenu.tsx`, `BadgeToolbar.tsx`, `ThemeToggle.tsx`, `BadgeOverlay.tsx`, `ActivityHeatmap.tsx`, `StatsGrid.tsx`, `InsightCard.tsx`, and others).

**Heading hierarchy**: All production pages use h1→h2→h3 in correct order. `SectionHeading` (h2) and `SubHeading` (h3) in `app/about/scoring/page.tsx` are component definitions that render correctly after the page's h1 at line 101 — no skip. The `app/u/[handle]/page.tsx` h1 is `sr-only` with visible h2 below — semantically correct. Admin dashboard uses `sr-only` h1 at `app/admin/page.tsx:25` with rendered h2 sections in the client component.

**Error boundaries**: 14 `error.tsx` files covering all routes (`about`, `admin`, `archetypes`, `cli/authorize`, `coming-soon`, `experiments`, `generating`, `privacy`, `studio`, `terms`, `u/[handle]`, `verify`, `global-error.tsx`).

**Loading/empty states**: `BadgeSkeleton.tsx`, multiple `loading.tsx` files, and `isLoading` guards confirmed in `UserMenu.tsx`, `AdminDashboardClient.tsx`, `campaigns-dashboard.tsx`, `engagement-dashboard.tsx`.

## Design System Compliance

**Production components**: 0 violations. All UI components use semantic tokens (`bg-bg`, `text-text-primary`, `text-amber`, `border-stroke`, etc.).

**Accepted exceptions** (unchanged from prior cycles):
- `app/global-error.tsx` — hardcoded hex intentional and documented in the file (CSS custom properties not available when the global error boundary replaces the root layout).
- `app/apple-icon.tsx`, `app/icon.tsx` — static icon assets, correctly hardcoded per prior QA/performance approval.
- `app/experiments/**` — Canvas/WebGL requires raw hex arrays; accepted P3.

**Sparkline `color` prop**: `Sparkline.tsx` receives color as a string prop from callers. Callers pass CSS variable values resolved at the call site (e.g., dimension colors). Test fixtures use literal hex for assertions — this is test infrastructure, not a component violation.

## Coverage Gaps (from Coverage Agent 2026-04-29)

| File | Stmts | Funcs | Status |
|------|-------|-------|--------|
| `app/u/[handle]/og-image/route.ts` | 94.3% | **60%** | P2 — 5th carry cycle |
| `lib/cache/dirty-stats.ts` | 83.33% | **75%** | P2 — small, one test closes it |
| `lib/effects/interactions/HolographicOverlay.tsx` | 50% | 75% | P3 candidate (Canvas) |

## Recommendations

1. **[P2 — Escalated]** Cover `app/u/[handle]/og-image/route.ts` lines 77 and 97 (`route.ts:77,97`). Add two test fixtures: (a) `fetch()` rejection simulating avatar timeout, (b) missing-avatar SVG fallback path. This is the only actionable critical-path gap and has been carried for 5 cycles.

2. **[P2 — Quick win]** Add one test for `lib/cache/dirty-stats.ts:33` — the clear-marker function is a single call, trivially testable in isolation.

3. **[Info]** `HolographicOverlay.tsx` at 50% stmts is Canvas-blocked in JSDOM — consider formally downgrading to accepted P3 to remove it from the active P2 list.

---

SHARED_CONTEXT_START
## QA Agent — 2026-04-29
- **Status**: GREEN
- Tests: 7272/7272 passed across 409 files, 0 failed, 0 skipped
- Type errors: 0
- Lint issues: 0
- A11y issues: 0 — all `<img>` have alt, focus-visible in globals.css + 4 production components, prefers-reduced-motion respected, aria-label present in 20+ components, heading hierarchy correct in all pages, 14 error boundaries, multiple loading states

**Cross-agent recommendations:**
- [Coverage]: `og-image/route.ts` 60% funcs (lines 77, 97) is the only critical-path gap — entering 5th carry cycle, triage must address this sprint. `dirty-stats.ts` 75% funcs is a one-test fix.
- [Security]: No new security-related quality issues. All XSS vectors covered via escapeXml(), interactive elements fully accessible. global-error.tsx hardcoded hex is intentional and does not touch any server secrets.
SHARED_CONTEXT_END
