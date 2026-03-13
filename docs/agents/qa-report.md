# QA Report
> Generated: 2026-03-11 | Health status: GREEN

## Executive Summary
All 4,541 tests pass across 283 files with zero type errors and zero lint issues. Accessibility is excellent (WCAG 2.1 AA compliant). Design system compliance is now 100% — the previous hardcoded hex violations in `ActivityHeatmap.tsx` and `hexmap/page.tsx` have been resolved. Two medium-priority gaps remain: missing error boundaries on secondary routes and no structured error monitoring.

## Test Results
- Total: **4,541 tests** across **283 files**
- Passed: **4,541** | Failed: **0** | Skipped: **0**
- Duration: 10.47s
- Delta vs last QA (2026-03-04): +303 tests, +11 files

## TypeScript
**Clean** — 0 errors across both `packages/shared` and `apps/web`.

## Linting
**Clean** — 0 errors, 0 warnings.

## Accessibility

**Status: EXCELLENT — 0 blockers**

| Area | Status | Notes |
|------|--------|-------|
| Images/alt text | PASS | No `<img>` tags; all SVGs use `aria-hidden="true"` or `role="img"` with `aria-label` |
| Heading hierarchy | PASS | All pages follow h1 → h2 → h3 without skipping levels |
| ARIA labels | PASS | All interactive elements have proper labels, roles, and state attributes |
| Focus indicators | PASS | Global `*:focus-visible` style in `globals.css:399-402`; terminal input intentionally suppresses outline |
| Keyboard navigation | PASS | Focus trapping in `MobileNav.tsx:29-52`, Escape handlers on dialogs/tooltips, `onKeyDown` on SVG interactives |
| prefers-reduced-motion | PASS | Global blanket rule in `globals.css:416-425` + `useReducedMotion()` hook in `StudioClient.tsx:29-49` |
| Semantic HTML | PASS | `<main>`, `<nav>`, `<footer>`, `<section>` used throughout; `role="log"` on terminal output |

**Minor observations (non-blocking):**
- `UserMenu.tsx:315-324` — `<label>` element used as `role="menuitem"` (functional but semantically unusual; could be `<button>` in future)
- Terminal input `outline: none` is intentional — always-focused element where standard focus ring would be distracting

## Error Handling & Resilience

| Category | Coverage | Quality |
|----------|----------|---------|
| Error boundaries | 3 routes (`/`, `/admin`, `/u/[handle]`) | Strong UX with reset + go-home buttons |
| Loading states | 8/8 main routes | All use `role="status"` + `sr-only` text + skeleton screens |
| Empty states | ~70% | Badge SVG has fallback, Studio builds empty stats, Verify shows 3 distinct states |
| API error handling | 9/9 routes | Consistent try/catch, proper HTTP status codes, rate limit headers |
| 404 page | Present | User-friendly with go-home CTA |
| SVG fallback | Present | `fallbackSvg()` with XSS-safe escaping and short cache TTL |

**Gaps:**
1. `/studio`, `/about`, `/verify`, `/generating`, `/experiments` routes lack dedicated `error.tsx` — fall back to root boundary
2. No structured error monitoring (Sentry/PostHog) — all errors logged to console only
3. No correlation IDs in 500 responses
4. `ImpactBreakdown` component assumes data is always present (no null guard)

## Design System Compliance

**Status: PASS — 0 violations**

| Check | Status |
|-------|--------|
| No hardcoded hex colors in components | PASS — all colors use semantic tokens |
| Semantic token usage (no raw Tailwind colors) | PASS — `bg-bg`, `bg-card`, `text-text-primary` etc. used throughout |
| Font compliance | PASS — `font-heading` (JetBrains Mono) on headings, `font-body` (Plus Jakarta Sans) on body |
| Button styling (`rounded-lg`, not `rounded-full`) | PASS — `rounded-full` only on icon-only buttons (exception allowed) |
| Inline SVG icons (no icon libraries) | PASS — zero lucide/heroicons imports |
| Card styling (`bg-card` + `border-stroke`) | PASS — consistent across all card components |

**RESOLVED since last QA:** Hardcoded hex colors in `ActivityHeatmap.tsx:30-33` and `hexmap/page.tsx:31-35` (previously flagged) — now using CSS variable tokens.

## Cross-Agent Findings Addressed

From shared context recommendations directed at QA:
- **Cost Analyst**: Process stream leak in `/api/admin/agents/run/route.ts` — CONFIRMED still present. Needs `.destroy()`, `removeAllListeners()`, and 5-min timeout.
- **Cost Analyst**: `/api/insights` `after()` hook should use `Promise.allSettled()` — CONFIRMED, still uses `Promise.all()`.
- **Cost Analyst**: `metrics_snapshots` retention (`dbCleanOldSnapshots()`) — CONFIRMED not implemented.
- **Documentation**: `/api/studio/config` method mismatch (POST in docs vs GET+PUT in code) — CONFIRMED, docs should be updated.
- **Security**: `minimatch` ReDoS — RESOLVED per security agent (no longer in audit output).
- **Performance**: `ActivityHeatmap.tsx` hardcoded colors — RESOLVED.

## Recommendations

### High Priority
1. **Add error boundaries** to `/studio`, `/about`, `/verify`, `/generating` routes — prevents white-screen crashes on these pages
2. **Fix process stream leak** in `app/api/admin/agents/run/route.ts` — add `.destroy()` on stdout/stderr, `removeAllListeners()`, and 5-minute process timeout
3. **Use `Promise.allSettled()`** in `/api/insights` `after()` hook — prevents silent rejection on cache invalidation failure

### Medium Priority
4. **Add null guard** to `ImpactBreakdown` component — if `stats` or `impact` is null, render graceful fallback instead of crashing
5. **Implement `dbCleanOldSnapshots()`** — `metrics_snapshots` grows ~3.65M rows/year at 10K users
6. **Update CLAUDE.md** — `/api/studio/config` documents POST but code exports GET + PUT
7. **Add test coverage** for priority files per coverage agent: `login/route.ts` (76.9%), `StudioClient.tsx` (0%), `BadgeToolbar.tsx`, `UserMenu.tsx` (38.9%)

### Low Priority
8. **Add error monitoring** — integrate PostHog error tracking or similar for 5xx alerts
9. **Enhance root `loading.tsx`** — currently minimal (single pulsing dot); add contextual skeleton
10. **Refactor `UserMenu.tsx:315`** — replace `<label role="menuitem">` with `<button>` for semantic correctness
