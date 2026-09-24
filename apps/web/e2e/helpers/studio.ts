import type { Page } from "@playwright/test";

/**
 * #1329 — `data-save-state`, `studio-demo-marker`, `studio-save` and
 * `studio-reset` were each independently observed resolving to two DOM
 * nodes under load (parallel workers / a loaded full-suite run), always
 * sourced from the single JSX location each is written in `StudioClient.tsx`
 * — there is no second copy in source. The most likely mechanism, consistent
 * with `e2e/smoke.spec.ts`'s already-documented and accepted `#main-content`
 * case ("loading.tsx and page.tsx both have id=\"main-content\" and may
 * briefly coexist in the DOM during hydration"), is a stale, never-hydrated
 * copy of this same subtree lingering in the live DOM for one paint
 * alongside the freshly committed client copy, during `/studio`'s hydration
 * handoff (`force-dynamic` + a `loading.tsx` Suspense boundary). That stale
 * copy is discarded without ever running a mount effect, so
 * `StudioClient`'s `hydrated` state (set via `useEffect`, see
 * `data-studio-hydrated` on `studio-root`) can only ever become `"true"` on
 * the one real, currently-committed tree.
 *
 * Scoping every Studio locator through `studioRoot()` therefore can never
 * silently resolve to a stale node the way a positional `.first()`/`.last()`
 * guess could — if a duplicate node is present, only the hydrated one
 * matches this selector to begin with.
 */
export function studioRoot(page: Page) {
  return page.locator('[data-studio-hydrated="true"]');
}

export function studioControl(
  page: Page,
  testId: "studio-save" | "studio-reset",
) {
  return studioRoot(page).getByTestId(testId);
}

/**
 * #1335 phase 5 e2e — `badge-preview` (rendered inside the same
 * `StudioClient` tree as `studio-root`) is subject to the identical #1329
 * stale-pre-hydration-copy duplication, but every existing lookup used a
 * raw `page.getByTestId('badge-preview')` instead of scoping through
 * `studioRoot()`. Observed as an intermittent Playwright strict-mode
 * violation ("resolved to 2 elements") on the `[data-element=archetype]
 * rect` assertion, reproduced on two different locale/theme combinations
 * across separate runs — not a fixture or residue issue. Scope every
 * badge-preview lookup through this helper instead of the raw testid.
 */
export function studioBadgePreview(page: Page) {
  return studioRoot(page).getByTestId("badge-preview");
}
