# QA Report
> Generated: 2026-06-24 | Health status: green

## Executive Summary
All 7986 tests pass across 464 files with zero TypeScript errors and zero lint violations. No accessibility regressions found; the `<tr role="button">` aria-label gap flagged in the May 6 report has been resolved.

## Test Results
- Total: 7986 tests across 464 files
- Passed: 7986 | Failed: 0 | Skipped: 0

## TypeScript
Clean — `tsc --noEmit` exited 0 across both `apps/web` and `packages/shared`.

## Linting
Clean — ESLint exited 0 across both workspace packages. No warnings or errors.

## Accessibility

### `<img>` alt attributes
All `<img>` tags in production components carry `alt`:
- `apps/web/app/u/[handle]/page.tsx:244` — `alt` at line 246 (`sharePage.badgeAlt` i18n key via `interpolate`)
- `apps/web/components/LiteYouTubeEmbed.tsx:45` — `alt={title}` (dynamic thumbnail)

No missing-alt violations found.

### Focus indicators
Global `*:focus-visible` ring defined in `apps/web/styles/globals.css:455`. Component-level `focus-visible:ring-*` also present in:
- `BadgeOverlay.tsx` — `focus-visible:ring-2 focus-visible:ring-amber`
- `BadgeToolbar.tsx` — `focus-visible:text-text-primary focus-visible:bg-amber/[0.06]`
- `InfoTooltip.tsx` — `focus-visible:ring-2 focus-visible:ring-amber`
- `LanguageSwitcher.tsx` — `focus-visible:ring-2 focus-visible:ring-amber/40`
- `CommandBarHint.tsx` — `focus-visible:ring-2 focus-visible:ring-amber/40`

Focus indicators are comprehensive and consistent.

### Interactive elements / ARIA labels
Prior finding (May 6): `<tr role="button" tabIndex={0}>` in campaigns table missing `aria-label`. **Resolved** — `apps/web/app/admin/campaigns/campaigns-dashboard.tsx:908` now carries `aria-label={\`Campaign: ${c.name}\`}` with full keyboard handler (`Enter`/`Space`).

No new interactive-element ARIA gaps detected in production components.

### Heading hierarchy
Sampled across all non-experiment page components:
- Landing, privacy, terms, verify, archetypes, share page, admin dashboard — all maintain h1 → h2 → h3 ordering with no skipped levels.
- SR-only h1s used where the visual layout omits a visible heading (`/studio`, `/admin`, `/u/[handle]`), preserving document outline for screen readers.

No hierarchy violations found.

## Error States
- **Error boundaries**: 13 `error.tsx` files covering all major route segments (root, admin, studio, share page, generating, verify, privacy, terms, archetypes, experiments).
- **Loading states**: 13 `loading.tsx` files with matching route coverage.
- **Empty states**: Handled inline in dashboard components (admin user table, campaigns list, engagement flags).

Error state coverage is solid with full parity between error and loading routes.

## Design System Compliance
No hardcoded hex colors found in production component `className` or `style` props outside the accepted exceptions:
- `global-error.tsx` — hardcoded dark background (intentional; renders before theme provider)
- `apple-icon.tsx`, `icon.tsx` — static assets (no semantic token needed)
- `experiments/**` — accepted P3 for Canvas/WebGL contexts

All production UI components use semantic tokens (`bg-bg`, `text-text-primary`, `border-stroke`, `text-amber`, etc.) as required by the design system.

## Recommendations

1. **(P3 — carry)** `experiments/**` Canvas/WebGL pages remain 70–77% coverage due to JSDOM limitations. Accepted; flag-gated, no production exposure.

2. **(P3 — carry)** Vitest worker exhaustion under heavy host load (load avg 120+) produces false red runs. Pin agent vitest invocations to `--maxWorkers=3` to avoid collisions with other sessions.

---

SHARED_CONTEXT_START
## QA Agent — 2026-06-24
- **Status**: GREEN
- Tests: 7986/7986 passed across 464 files, 0 failed, 0 skipped
- Type errors: 0
- Lint issues: 0
- A11y issues: 0 — all `<img>` tags have alt; focus-visible global + 5 production components; campaigns `<tr role="button">` aria-label gap from May 6 is now resolved; heading hierarchy correct across all sampled pages; 13 error boundaries + 13 loading states

**Cross-agent recommendations:**
- [Coverage]: `SharePageH2.test.tsx` exists and covers the i18n H2 wrapper. All critical paths remain ≥96% stmts.
- [Security]: No security-related quality issues. All XSS vectors covered. Interactive elements accessible. No hardcoded secrets or token leaks observed in production JSX.
SHARED_CONTEXT_END
