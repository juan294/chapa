# QA Report
> Generated: 2026-07-08 | Health status: green

## Executive Summary
All 8,326 tests pass with zero type errors and zero lint issues; no accessibility regressions or design-system violations were found in production components. The codebase remains in the same GREEN state as the previous QA cycle, with the suite having grown by +75 tests since the 2026-07-08 coverage run.

## Test Results
- Total: 8,326 tests across 485 files
- Passed: 8,326 | Failed: 0 | Skipped: 0
- Duration: 66.9s under `--maxWorkers=3` (vitest v4.1.8), single clean run — no flakes observed

## TypeScript
Clean — `tsc --noEmit` passes in both workspaces (`packages/shared`, `apps/web`) with 0 errors.

## Linting
Clean — `eslint .` passes in both workspaces with 0 errors and 0 warnings.

## Accessibility
No issues found.

- **Images**: 0 `<img>` tags missing `alt` attributes across all `.tsx` source (multiline-aware regex scan of `apps/web`).
- **Heading hierarchy**: One heuristic flag — `app/verify/[hash]/page.tsx` shows `<h2>` with no literal `<h1>` — verified as a **false positive**: the page renders its `<h1>` via `<StatusCallout titleAs="h1">` (lines 101, 223, 244). All other pages have correct h1→h2→h3 ordering.
- **Interactive elements**: Both `role="button"` usages carry `aria-label`s — `app/admin/campaigns/campaigns-dashboard.tsx:903` (``aria-label={`Campaign: ${c.name}`}``, plus `tabIndex={0}` and Enter/Space `onKeyDown`) and `components/dashboard/ActivityHeatmap.tsx:567` (localized `aria.contributionOnDate` label). No `onClick` handlers on non-interactive elements (`div`/`span`/`tr` scan clean outside the two labeled `role="button"` cases). Files flagged by the buttons-vs-aria-labels ratio heuristic (error boundaries, `QuickControls`, `ChallengeForm`, experiments pages) were spot-checked: all buttons contain visible text content, so `aria-label` is not required. No icon-only buttons lacking labels were found.
- **Focus indicators**: `focus-visible` present in `styles/globals.css` (3 occurrences, global-scope) plus 8 production components (`InfoTooltip`, `LanguageSwitcher`, `BadgeOverlay`, `BadgeToolbar`, `CommandBarHint`, `ChallengeForm`, `VerifyForm`, experiments pages) — guarded by tests in `globals.test.ts` and `BadgeToolbar.test.tsx`.

## Error States
- **Error boundaries**: 13 route-level `error.tsx` files + 1 `global-error.tsx` covering all major route groups (`/`, `/about`, `/admin`, `/archetypes`, `/cli/authorize`, `/coming-soon`, `/experiments`, `/generating`, `/privacy`, `/studio`, `/terms`, `/u/[handle]`, `/verify`).
- **Loading states**: 13 `loading.tsx` files.
- **Not-found**: 1 `not-found.tsx`.
- **Empty states**: present in `AdminUserTable.tsx`, `campaigns-dashboard.tsx`, and `SharePageOwnerContent.tsx`, each with render-test coverage (`*.render.test.tsx` / `*.test.tsx` siblings).

## Design System Compliance
0 violations. A hardcoded-hex scan (`bg-[#…]`, `text-[#…]`, raw `#RRGGBB`) across `app/` and `components/` (excluding tests) matched only the previously accepted exceptions: `global-error.tsx`, `apple-icon.tsx`, `icon.tsx` (static assets that cannot use runtime CSS variables), and `experiments/**` (Canvas/WebGL demos). All production components use semantic tokens (`bg-bg`, `bg-card`, `text-text-primary`, `border-stroke`, dimension/archetype token classes) — consistent with the two prior QA cycles.

## Recommendations
1. **[P3] Add branch tests for `components/ClientErrorReporter.tsx`** (~61% branches per the 2026-07-08 coverage cycle — dedup/transport branches are JSDOM-testable). This is the client-side error-reporting path surfaced in the Error States check; it works, but its failure branches are the least-verified part of the error UX.
2. **[P3] Add a sibling test for `components/ClientInstrumentation.tsx`** (60% stmts, no test file) — the only production component in the error/telemetry surface without one.
3. **No QA-blocking action items** — tests, types, lint, a11y, and design-system checks are all clean; maintain the current gates.

SHARED_CONTEXT_START
## QA Agent — 2026-07-08
- **Status**: GREEN
- Tests: 8326/8326 passed across 485 files, 0 failed, 0 skipped, 0 flakes (66.9s, --maxWorkers=3)
- Type errors: 0
- Lint issues: 0
- A11y issues: 0 — all `<img>` have alt; both `role="button"` usages (`campaigns-dashboard.tsx:903`, `ActivityHeatmap.tsx:567`) carry aria-labels + keyboard handlers; focus-visible global + 8 production components; verify/[hash] h1 rendered via `StatusCallout titleAs="h1"` (heuristic false positive, do not re-flag); 13 error boundaries + global-error + 13 loading states + not-found

**Cross-agent recommendations:**
- [Coverage]: Confirms your 2026-07-08 findings from the QA angle — `ClientErrorReporter.tsx` (~61% br) and `ClientInstrumentation.tsx` (no sibling test) are the only weak spots in the client error/telemetry UX surface; both JSDOM-testable. Suite grew 8,251 → 8,326 (+75) since your run, still 0 flakes.
- [Security]: No security-related quality issues. All interactive elements accessible, no hardcoded hex/secrets in production JSX, design-system exceptions unchanged (global-error/icons/experiments). Nothing new for your next scan.
SHARED_CONTEXT_END
