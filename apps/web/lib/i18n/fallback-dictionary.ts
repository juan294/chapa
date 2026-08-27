import type { Translations } from './types';

/**
 * #1164 (FE-H1/PE-H1) — test-only injection seam for `useTranslation()`'s
 * no-provider fallback dictionary.
 *
 * This lives in its OWN module, deliberately separate from `use-translation.ts`
 * (which re-exports `__setFallbackDictionary` for convenience) and `provider.tsx`,
 * so that `vitest.setup.ts` — a global setup file that runs before any test
 * file's `vi.mock()` calls are hoisted — can import it without pulling in
 * `provider.tsx` and, transitively, `set-locale-action.ts`.
 *
 * Discovered while implementing this fix: `vitest.setup.ts` originally
 * imported `__setFallbackDictionary` directly from `use-translation.ts`,
 * which imports `provider.tsx`, which imports `./set-locale-action`. Because
 * the setup file's imports execute before a test file's own
 * `vi.mock('./set-locale-action', ...)` call is hoisted, this registered the
 * REAL `set-locale-action` module first and silently broke that mock for
 * every test in `provider.test.tsx` (its `setLocaleAction` assertions saw
 * zero calls). Isolating this state in a module with no path to
 * `provider.tsx` avoids the collision entirely.
 *
 * Never touched in production — the app always renders inside
 * LanguageProvider (see docs/accepted-risks.md) — so `dictionary` stays
 * `undefined` there and `useTranslation()`'s fallback degrades to returning
 * the raw key rather than importing (and shipping) a dictionary.
 */
let dictionary: Translations | undefined;

/**
 * Test-only. Never called in production code. Lets the test suite inject a
 * real dictionary for `useTranslation()`'s no-provider fallback.
 */
export function __setFallbackDictionary(next: Translations | undefined): void {
  dictionary = next;
}

/** Test-only. Reads the currently injected fallback dictionary, if any. */
export function __getFallbackDictionary(): Translations | undefined {
  return dictionary;
}
