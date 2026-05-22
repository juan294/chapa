All checks complete. Writing report.

```markdown
# QA Report
> Generated: 2026-05-20 | Health status: green

## Executive Summary
Full quality audit clean: 7589 tests pass across 445 files, TypeScript and ESLint clean, no accessibility regressions, and no design-system token violations in production components.

## Test Results
- Total: 7589 tests across 445 files
- Passed: 7589 | Failed: 0 | Skipped: 0
- Duration: 41.51s (3 stderr log lines are intentional negative-path assertions in agent-utils tests; JSDOM "navigation to another Document" notices are expected from auth/redirect tests)

## TypeScript
Clean — `tsc --noEmit` passed in both `packages/shared` and `apps/web` with 0 errors.

## Linting
Clean — `eslint .` produced no warnings or errors.

## Accessibility
- **`<img>` alt attributes**: no production violations. Grep for `<img` missing `alt=` returned 0 files.
- **Interactive elements / ARIA**: no `<button>` wrapping an SVG without `aria-label`/`aria-labelledby` found in production.
- **Focus indicators**: `focus-visible:` styles present in 15 occurrences across 11 files (InfoTooltip, LanguageSwitcher, BadgeToolbar, BadgeOverlay, VerifyForm, experiments pages), plus the global `:focus-visible` rule in `apps/web/styles/globals.css`. Coverage is adequate.
- **Error/loading/not-found boundaries**: 20+ route-level `error.tsx`/`loading.tsx` files present across `generating`, `studio`, `privacy`, `verify`, `experiments`, `archetypes`, `terms`, `admin`, `u/[handle]`, `about` — full coverage of public routes.
- **Heading hierarchy**: prior QA cycles (2026-05-06, 2026-04-29) verified correct h1→h2→h3 order across all pages; no structural changes since.
- **Carry-over (low severity)**: `<tr role="button" tabIndex={0}>` in `apps/web/app/admin/campaigns/campaigns-dashboard.tsx:900` still lacks `aria-label`. Admin-only surface; flagged 2026-05-06 and unresolved.

## Design System Compliance
- Inline hex `style={{ background|color: '#...' }}` patterns found in **only** `apps/web/app/global-error.tsx` and `apps/web/app/apple-icon.tsx` — both documented accepted exceptions (global-error must be standalone with no Tailwind; apple-icon is a static asset generator).
- No production components use hardcoded hex outside accepted exceptions.
- Tailwind semantic tokens (`bg-bg`, `text-text-primary`, `border-stroke`, `text-amber`, etc.) used consistently elsewhere.

## Recommendations
1. **Low — Admin a11y polish**: Add `aria-label` to the clickable `<tr>` in `apps/web/app/admin/campaigns/campaigns-dashboard.tsx:900` (e.g., `aria-label="Open campaign details"`). Carried since 2026-05-06.
2. **Low — JSDoc on auth session exports**: `lib/auth/session.ts` has 5 public exports without JSDoc (per documentation agent 2026-05-08). Polish, not a quality defect.
3. **Monitor only**: Performance agent's 4-week bundle +34.7% trend (2,266 KB) — flat for 5 cycles. Not a QA regression; tracking for cost/perf agents.

## Shared Context Entry

<!-- ENTRY:START agent=qa timestamp=2026-05-20T09:05:00Z -->
## QA Agent — 2026-05-20
- **Status**: GREEN
- Tests: 7589/7589 passed across 445 files, 0 failed, 0 skipped
- Type errors: 0
- Lint issues: 0
- A11y issues: 1 carry-over (low) — `<tr role="button">` in campaigns dashboard missing `aria-label` (admin-only surface, carried since 2026-05-06)
- Design system: 0 violations in production components. `global-error.tsx` and `apple-icon.tsx` are documented accepted exceptions.

**Cross-agent recommendations:**
- [Coverage]: No new coverage gaps observed during QA pass. Coverage agent (2026-05-19) reports 96.78% overall with 0 critical-path untested files. No action needed.
- [Security]: No security-related quality issues. All XSS escape paths covered, focus-visible enforced, no interactive divs without ARIA in production. Campaigns `<tr>` a11y carry is presentational only — no data exposure risk.
<!-- ENTRY:END -->
```
