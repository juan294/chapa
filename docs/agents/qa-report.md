# QA Report
> Generated: 2026-03-18 | Health status: GREEN

## Executive Summary

The project is in strong shape. All 5,495 tests pass across 318 files with zero failures. TypeScript and linting are clean in tracked code. Accessibility is excellent (WCAG 2.1 AA compliant). Error boundary coverage has expanded significantly since last QA. 11 stale macOS duplicate files (` 2.ts/sql`) in the working directory cause false positives in typecheck/lint and should be deleted.

## Test Results
- **Total**: 5,495 tests across 318 files
- **Passed**: 5,495 | **Failed**: 0 | **Skipped**: 0
- **Duration**: 51.6s
- **Delta vs last QA (2026-03-11)**: +954 tests, +35 test files — strong trajectory

## TypeScript
- **Tracked codebase**: Clean — 0 errors
- **Untracked duplicates**: 7 errors in macOS duplicate files (`* 2.ts`) — not in git, not real issues
- Affected files: `route 2.ts`, `campaigns.test 2.ts` (see Housekeeping below)

## Linting
- **Tracked codebase**: 1 warning — `announcement.test.ts:92` (`_unused` assigned but never used)
- **Untracked duplicates**: 3 warnings in `* 2.ts` files — not real issues
- **Errors**: 0

## Accessibility
**Status: WCAG 2.1 AA COMPLIANT**

| Category | Status | Notes |
|----------|--------|-------|
| Image alt text | PASS | All `<img>` and `Image` components have descriptive alt text with escaped handles |
| Heading hierarchy | PASS (minor) | Correct across all production pages. `/experiments/number-counters/page.tsx` has h1 after h2s — low priority (gated behind feature flag) |
| ARIA labels | EXCELLENT | Comprehensive: `aria-label`, `aria-describedby`, `aria-expanded`, `role="listbox"`, `role="alertdialog"`, `aria-live="polite"` on status regions |
| Focus indicators | EXCELLENT | Global `*:focus-visible` with amber outline. Component-level `focus-visible:ring-2` on hotspots and buttons. 44px min touch targets on close buttons |
| prefers-reduced-motion | PASS | CSS `@media (prefers-reduced-motion: reduce)` blanket + per-component JS checks (`AuthorTypewriter`, `number-counters`) |
| Keyboard navigation | EXCELLENT | Focus traps in modals/cheat-sheet, arrow key nav in autocomplete/terminal, Escape handling throughout |

## Error Handling

### Error Boundaries (error.tsx)
**8 routes covered** (up from 3 in last QA): `/` (root + global-error), `/about`, `/admin`, `/experiments`, `/generating`, `/studio`, `/u/[handle]`, `/verify`

**Routes without error boundaries**: `/archetypes/*` (7 sub-routes), `/cli/*`, `/coming-soon`, `/privacy`, `/terms`

### Loading States (loading.tsx)
**8 routes covered**: `/`, `/about`, `/admin`, `/archetypes`, `/studio`, `/u/[handle]`, `/verify`, `/generating/[handle]`

**Routes without loading states**: `/cli/*`, `/coming-soon`, `/experiments`, `/privacy`, `/terms`

### API Route Error Handling
- **19 of 41 routes** have explicit try/catch blocks (46%)
- **22 routes** rely on Next.js default error handling — most are thin wrappers (session, logout, status checks) or use `dbTimeoutOr504()` for database operations
- SVG fallback rendering works correctly with XSS-safe escaping

### Empty States
- `ImpactBreakdown.tsx` has explicit "No impact data available" empty state
- Most components gracefully handle missing data via conditional rendering

## Design System Compliance
**Status: COMPLIANT for all React components**

| Area | Status | Notes |
|------|--------|-------|
| Components (TSX) | PASS | All use semantic tokens: `bg-bg`, `bg-card`, `text-text-primary`, `border-stroke`, `text-amber` |
| Badge SVG rendering | N/A | Intentionally hardcoded — badge SVG always renders dark as standalone embeddable asset (per CLAUDE.md) |
| OG image generation | N/A | Hardcoded colors in `og-image/route.ts` — server-rendered image, not themed |
| Email templates | N/A | Inline CSS with hardcoded values — email clients don't support CSS variables |
| Favicon/icons | N/A | `icon.tsx`, `apple-icon.tsx` use hardcoded fills — correct for static assets |
| Experiment pages | PASS | Behind feature flag, use semantic tokens where applicable |

**0 design system violations in production components** (unchanged from last QA).

## Cross-Agent Issues Tracked

| Issue | Source Agent | Status |
|-------|-------------|--------|
| Badge SVG `Promise.all()` at `route.ts:103` needs `Promise.allSettled()` | Cost Analyst | OPEN |
| `/api/studio/config` docs mismatch (POST vs GET+PUT) | Documentation | CARRIED |
| 18 functions lacking JSDoc | Documentation | CARRIED |

## Housekeeping: Stale Duplicate Files

11 untracked macOS duplicate files exist in the working directory (created by Finder copy operations). They cause false typecheck errors and lint warnings. **Delete all of them:**

```
apps/web/app/api/cron/process-campaigns/route 2.ts
apps/web/app/api/cron/process-campaigns/route.test 2.ts
apps/web/app/api/cron/sync-audience/route 2.ts
apps/web/app/api/cron/sync-audience/route.test 2.ts
apps/web/lib/db/campaigns 2.ts
apps/web/lib/db/campaigns.test 2.ts
apps/web/lib/email/campaigns 2.ts
apps/web/lib/email/campaigns.test 2.ts
apps/web/lib/email/templates/announcement 2.ts
apps/web/lib/email/templates/announcement.test 2.ts
supabase/migrations/016_create_email_campaigns 2.sql
```

## Recommendations

### Priority 1 — Housekeeping (Quick Wins)
1. **Delete 11 duplicate ` 2.ts/sql` files** — eliminates false typecheck/lint noise
2. **Fix `_unused` lint warning** in `apps/web/lib/email/templates/announcement.test.ts:92`

### Priority 2 — Resilience
3. **Add error boundaries** to `/archetypes/*` routes (7 sub-routes share similar content — one `error.tsx` covers all)
4. **Convert `Promise.all()` to `Promise.allSettled()`** in badge SVG route (`route.ts:103`) — prevents craft DB errors from crashing entire badge render
5. **Add loading states** to `/cli`, `/privacy`, `/terms` (simple skeleton components)

### Priority 3 — Documentation
6. **Fix `/api/studio/config` docs** — update CLAUDE.md from POST to GET+PUT
7. **Add JSDoc** to 18 undocumented exported functions (6 scoring, 3 merge, 3 auth cookies, 6 misc)

### Priority 4 — Low Priority
8. **Fix heading hierarchy** in `/experiments/number-counters/page.tsx` (gated behind feature flag)
9. **Add error boundaries** to `/coming-soon`, `/privacy`, `/terms` (static content, low risk)
