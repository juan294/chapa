# QA Report
> Generated: 2026-05-06 | Health status: green

## Executive Summary
All 7,567 tests pass across 445 files with zero TypeScript errors, zero lint issues, and zero accessibility violations in production components. The codebase remains in excellent health with one low-severity a11y finding (campaigns table `<tr role="button">` missing `aria-label`).

## Test Results
- Total: **7,567** tests across **445** files
- Passed: **7,567** | Failed: **0** | Skipped: **0**
- Duration: 94.77s (full suite with environment setup)
- Note: Test-harness noise (`[ERROR] test-agent produced invalid report output`) observed in runner — these are internal agent-utils self-tests, not production failures. All 445 test files passed cleanly.

## TypeScript
Clean — `tsc --noEmit` passed across both workspace projects (`packages/shared` and `apps/web`) with zero errors.

## Linting
Clean — `eslint .` exited with no warnings or errors.

## Accessibility

### `<img>` alt attributes
All `<img>` tags in production components have `alt` attributes:
- `apps/web/app/u/[handle]/page.tsx:233` — `alt={interpolate(t("sharePage.badgeAlt"), { handle })}` ✓
- `apps/web/components/LiteYouTubeEmbed.tsx:45` — `alt={title}` ✓

### Focus indicators
`focus-visible` styles are present and comprehensive:
- Global rule: `apps/web/styles/globals.css:455` — `*:focus-visible` with ring styles
- Production components: `BadgeOverlay.tsx`, `BadgeToolbar.tsx`, `LanguageSwitcher.tsx`, `InfoTooltip.tsx`, `VerifyForm.tsx` all use `focus-visible:ring-*` utilities ✓

### Interactive elements — ARIA labels
All `role="button"` elements with `tabIndex={0}` checked:
- `apps/web/components/dashboard/ActivityHeatmap.tsx:560` — has `aria-label` with contribution count and date ✓
- `apps/web/app/admin/campaigns/campaigns-dashboard.tsx:900` — `<tr role="button" tabIndex={0}>` **missing `aria-label`** (P2). The row represents a campaign record and is keyboard-navigable but not labelled for screen readers. The campaigns dashboard is admin-only, reducing end-user impact.

All `<button>` elements in production (non-experiment) code have visible text content or are wrapped with accessible text — no unlabelled icon-only buttons found in core paths.

### Heading hierarchy
Heading structure is correct across all audited production pages:
- Page-level `<h1>` present in all main pages
- `<h2>` and `<h3>` follow without skipping levels in production routes
- Experiment pages (`/experiments/*`) have minor h2-before-h1 patterns in some sub-sections but these are gated by feature flag and not user-facing by default

### Error boundaries and states
- **Error boundaries**: 13 `error.tsx` files (one per route segment)
- **Loading states**: 13 `loading.tsx` files covering all major routes
- **Empty states**: Present in share page, admin dashboard, and campaign list components

## Design System Compliance
No violations found in production components. Spot-checks confirmed:
- All production `.tsx` components outside `lib/render/` and `experiments/` use semantic tokens (`bg-bg`, `text-text-primary`, `bg-amber`, `border-stroke`, etc.)
- No hardcoded hex colors found in `apps/web/components/` or core `apps/web/app/` routes
- Known accepted exceptions (per prior QA cycles): `global-error.tsx` hardcoded hex (no theme provider available), `apple-icon.tsx` / `icon.tsx` static assets, `experiments/**` Canvas/WebGL raw hex arrays — all confirmed intentional

## CI Workflow
Pending unstaged change to `.github/workflows/ci.yml`: adds `source` metadata block (`provider`, `repository`, `runId`, `workflowRef`) to the coverage reporting step. No functional impact on test execution. Low risk.

## Recommendations

| # | Priority | Finding | File | Action |
|---|----------|---------|------|--------|
| 1 | P2 | `<tr role="button">` in campaigns table missing `aria-label` | `app/admin/campaigns/campaigns-dashboard.tsx:900` | Add `aria-label={c.name}` or `aria-label={\`Campaign: ${c.name}\`}` to the `<tr>` |
| 2 | P3 | Coverage agent flags 7 archetype pages with 0–80% stmt coverage due to `generateMetadata` not being runtime-tested | `app/archetypes/artificer`, `emerging` + 5 others | Add runtime import tests per coverage agent P2 items (carried from prior cycle) |
| 3 | P3 | `app/cli/authorize/error.tsx` at 0% stmt coverage | `app/cli/authorize/error.tsx` | Add one jsdom render test |
| 4 | P3 | `lib/i18n/detect.ts` at ~75% branch coverage | `apps/web/lib/i18n/detect.ts` | One test for non-q semicolon param path (per triage May 6) |

---

SHARED_CONTEXT_START
## QA Agent — 2026-05-06
- **Status**: GREEN
- Tests: 7567 passed / 0 failed / 7567 total (445 files)
- Type errors: 0
- Lint issues: 0
- A11y issues: 1 low-severity (campaigns `<tr role="button">` missing `aria-label`, admin-only)

**Cross-agent recommendations:**
- [Coverage]: All prior P2 gaps (verify, about/scoring, about/verification, cli/authorize pages) confirmed resolved per coverage agent 2026-05-06 entry. Remaining P2s: 7 archetype pages `generateMetadata` runtime tests, `cli/authorize/error.tsx` 0% stmts, `lib/i18n/detect.ts` ~75% branches.
- [Security]: No security-related quality issues. All interactive elements have keyboard handlers. XSS vectors in SVG pipeline unchanged (all covered). Campaigns table `<tr role="button">` missing `aria-label` is a11y, not security.
SHARED_CONTEXT_END
