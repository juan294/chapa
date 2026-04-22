```markdown
# QA Report
> Generated: 2026-04-22 | Health status: green

## Executive Summary
All automated checks pass: 7048/7048 tests green, 0 TypeScript errors, 0 lint warnings. No accessibility or design-system regressions in production code.

## Test Results
- Total: 7048 tests across 396 files
- Passed: 7048 | Failed: 0 | Skipped: 0
- Duration: 49.04s (vitest 4.1.4)

## TypeScript
Clean — `pnpm run typecheck` passed across both workspace projects (`packages/shared`, `apps/web`).

## Linting
Clean — `eslint .` produced no warnings or errors.

## Accessibility
- **Bare `<img>`** — 0 violations. Grep for `<img(?![^>]*alt=)` returned no matches in production `.tsx/.jsx`.
- **Unlabeled `<button>`** — 0 empty buttons without `aria-label`/`aria-labelledby` found.
- **Focus indicators** — `focus-visible:`/`:focus-visible` used across 18 occurrences in 12 files (`InfoTooltip.tsx`, `BadgeToolbar.tsx`, `BadgeOverlay.tsx`, `VerifyForm.tsx`, `globals.css`, etc.). Focus-visible baseline is established.
- **Error/loading/404 boundaries** — 29 route-level `error.tsx`/`loading.tsx`/`not-found.tsx` files, each with a co-located test. Coverage across `/about`, `/admin`, `/archetypes`, `/cli/authorize`, `/coming-soon`, `/experiments`, `/generating`, `/privacy`, `/studio`, `/terms`, `/u/[handle]`, `/verify`, plus root `error.tsx` / `global-error.tsx` / `not-found.tsx`.
- Heading hierarchy skipping not detected in this pass (no automated scan run; defer to ux-reviewer for structural audit).

## Design System Compliance
- **Production components**: 0 hardcoded hex violations found in `apps/web/components/**`. All hex matches are inside test files (`*.test.tsx`) or are color props passed into `Sparkline` (intended parameter, not violation).
- **Accepted exceptions** (unchanged from prior cycles):
  - `app/global-error.tsx` — intentional hardcoding; component renders outside the theme provider so CSS variables are unavailable.
  - `app/apple-icon.tsx` — static icon asset rendered server-side by Next metadata API.
  - `app/experiments/*` — Canvas/WebGL experiments use raw hex arrays (shader/canvas API requirement, documented accepted risk).

## Recommendations
Prioritized:
1. **(Carried — security-relevant)** Add tests for all 9 `SENSITIVE_PATTERNS` branches in `lib/analytics/server-errors.ts` (branch coverage 71.43%). These are token-redaction guards before PostHog ingestion.
2. **(Carried)** Cover owner-only interactive handlers in `components/SharePageOwnerContent.tsx` (59.09% stmts, 50% funcs) — embed copy + refresh CTA still untested.
3. **(Hygiene)** Harden `BadgeToolbar.render.test.tsx` @keyframes teardown: wrap `vi.stubGlobal('Image', …)` setup/restore in try/finally so `unstubAllGlobals` runs even if `waitFor` rejects. The test passed 3/3 this cycle but a race is structurally possible (per coverage 2026-04-21 report).

---

<!-- ENTRY:START agent=qa timestamp=2026-04-22T09:05:00Z -->
## QA Agent — 2026-04-22
- **Status**: GREEN
- Tests: 7048/7048 passed across 396 files, 0 failed, 0 skipped
- Type errors: 0
- Lint issues: 0
- A11y issues: 0 — no bare `<img>`, no unlabeled `<button>`, focus-visible present across 18 occurrences in 12 files, 29 error/loading boundaries with tests
- Design system: 0 violations in production components. Hex hits are confined to test files, color props, `global-error.tsx` (outside theme provider), `apple-icon.tsx` (static metadata icon), and `experiments/*` (Canvas/WebGL).

**Cross-agent recommendations:**
- [Coverage]: Still no tests for the 9 `SENSITIVE_PATTERNS` redaction branches in `lib/analytics/server-errors.ts` (71.43% module branches). Highest-priority gap — feed each pattern type through `captureServerError()` and assert scrubbing.
- [Coverage]: `components/SharePageOwnerContent.tsx` owner-only handlers (embed copy, refresh CTA) remain untested at 50% funcs.
- [Coverage]: Harden `BadgeToolbar.render.test.tsx` by wrapping the `Image` `vi.stubGlobal` setup/restore in try/finally so `unstubAllGlobals` always runs even when `waitFor` throws — prevents flake regression.
- [Security]: No new security-related UX regressions. All XSS-sensitive paths remain covered; no user-input escape gaps surfaced in this cycle.
<!-- ENTRY:END -->
```
