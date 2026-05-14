# QA Report
> Generated: 2026-05-13 | Health status: green

## Executive Summary
All 7,589 tests pass across 445 files with zero failures, zero TypeScript errors, and zero lint issues. Accessibility posture remains clean — the one previously flagged `<tr role="button">` a11y gap in the admin campaigns table is now confirmed resolved with `aria-label` in place.

## Test Results
- Total: 7,589 tests across 445 files
- Passed: 7,589 | Failed: 0 | Skipped: 0
- Duration: ~43s (transform + setup + tests)
- Flaky tests: 0 (stable across multiple coverage runs per coverage agent)

## TypeScript
Clean — `pnpm run typecheck` passed with 0 errors across both `packages/shared` and `apps/web`.

## Linting
Clean — ESLint produced no warnings or errors.

## Accessibility

**Images:** All `<img>` tags have `alt` attributes. Checked:
- `apps/web/app/u/[handle]/page.tsx:231` — badge fallback `<img>` has `alt={interpolate(t("sharePage.badgeAlt"), { handle })}` ✓
- `apps/web/components/LiteYouTubeEmbed.tsx:45` — thumbnail `<img>` has `alt={title}` ✓
- `apps/web/components/SharePageOwnerContent.tsx:109` — embed snippet string literal (not a rendered image) ✓

**Focus indicators:** `*:focus-visible` global rule defined in `apps/web/styles/globals.css:455`. Component-level `focus-visible:` Tailwind utilities present in `BadgeToolbar.tsx`, `BadgeOverlay.tsx`, `InfoTooltip.tsx`, `LanguageSwitcher.tsx`. Coverage confirmed by static tests in `BadgeToolbar.test.tsx:165-171` and `InfoTooltip.test.tsx:59-60`. ✓

**`prefers-reduced-motion`:** Two `@media (prefers-reduced-motion: reduce)` blocks in `globals.css:381,472`. `StudioClient.tsx:31,37` checks the media query at runtime. Static test at `StudioClient.test.tsx:122`. ✓

**Interactive elements / ARIA:** No `<div onClick>` or `<span onClick>` without `role` or `aria-label` in production pages outside experiments. Key verifications:
- `apps/web/app/studio/QuickControls.tsx:109` — expandable category header is a `<button type="button" aria-expanded={isExpanded}>` ✓
- `apps/web/app/admin/campaigns/campaigns-dashboard.tsx:900` — `<tr role="button" tabIndex={0} aria-label={\`Campaign: ${c.name}\`}>` ✓ (previously flagged gap, now resolved)
- Admin-only surfaces (`agents-dashboard.tsx`, `engagement-dashboard.tsx`, `agent-card.tsx`) use `<button>` elements throughout ✓

**Heading hierarchy:** Spot-checked public pages:
- `/u/[handle]` — `h1.sr-only` → `h2` ✓
- `/about` — `h1` → `h2` ✓
- `/about/scoring` — `h1` → `h2` → `h3` ✓
- `/about/verification` — `h1` → `h2` (two independent `h2` sections) ✓
- `/archetypes/*` — `h1` → `h2` → `h3` ✓
- No skipped levels detected across any audited page.

**Error/loading/empty states:** 13 `error.tsx` boundaries and 13 `loading.tsx` files present across route segments. `global-error.tsx` handles root-level crashes. Multiple empty-state patterns verified via search.

## Design System Compliance
No hardcoded hex values found in `className` or `style` props of production components. All color usage goes through semantic tokens (`bg-bg`, `text-text-primary`, `bg-card`, `border-stroke`, `text-amber`, etc.) or dimension/archetype tokens.

Previously documented accepted exceptions remain unchanged:
- `apps/web/app/global-error.tsx` — intentional (error recovery page, no theme context available)
- `apps/web/app/apple-icon.tsx`, `apps/web/app/icon.tsx` — static PNG generation assets
- `apps/web/app/experiments/**` — Canvas/WebGL demos, accepted P3

## Recommendations

No P1 or P2 items. All previously flagged issues resolved.

1. **(P3 carry)** `lib/auth/session.ts` — 5 exported functions lack JSDoc (flagged by documentation agent 2026-05-08). Low-priority polish; no functional impact.
2. **(P3 monitor)** Bundle size +34.7% over 4 weeks (2,266 KB raw / 706 KB gzipped). No single chunk ≥500 KB. Run `ANALYZE=true pnpm run build` interactively to identify source before next growth milestone.

---

SHARED_CONTEXT_START
## QA Agent — 2026-05-13
- **Status**: GREEN
- Tests: 7589/7589 passed (445 files), 0 failed, 0 skipped
- Type errors: 0
- Lint issues: 0
- A11y issues: 0 — campaigns `<tr role="button" aria-label>` gap confirmed resolved; all `<img>` have alt; focus-visible global + 4 component-level; prefers-reduced-motion in globals.css + StudioClient; heading hierarchy clean across all audited pages; 13 error boundaries, 13 loading states

**Cross-agent recommendations:**
- [Coverage]: All paths clean. No new untested areas discovered this cycle. Coverage agent May 13 confirms stable 96.84% stmts, 0 flakes.
- [Security]: No security-related quality issues. All XSS escape paths covered. CORS mutation guard enforced by static test. Interactive elements all accessible via keyboard.
SHARED_CONTEXT_END
