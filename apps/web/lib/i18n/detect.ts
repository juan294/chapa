import type { Locale } from './types';

const SUPPORTED_PRIMARY = new Set(['en', 'es']);

function primarySubtag(lang: string): string {
  /* v8 ignore next -- split() always returns ≥1 element; ?? '' is for noUncheckedIndexedAccess */
  return (lang.split('-')[0] ?? '').toLowerCase();
}

/**
 * Parse Accept-Language header and return the best-matching supported locale.
 * Returns null if no supported locale is found.
 *
 * Spec: https://www.rfc-editor.org/rfc/rfc9110#section-12.5.4
 */
export function pickFromAcceptLanguage(header: string | null): Locale | null {
  if (!header) return null;

  // Parse tokens: "es-ES,es;q=0.9,en;q=0.8" → [{lang, q}]
  const tokens = header
    .split(',')
    .map((token) => {
      const parts = token.trim().split(';');
      /* v8 ignore next -- split() always returns ≥1 element; ?? '' is for noUncheckedIndexedAccess */
      const lang = (parts[0] ?? '').trim();
      let q = 1.0;
      for (let i = 1; i < parts.length; i++) {
        /* v8 ignore next -- valid loop index is always defined; ?? '' is for noUncheckedIndexedAccess */
        const param = (parts[i] ?? '').trim();
        if (param.startsWith('q=')) {
          const parsed = parseFloat(param.slice(2));
          if (!isNaN(parsed)) q = parsed;
        }
      }
      return { lang, q };
    })
    .filter(({ lang }) => lang.length > 0);

  // Sort by quality descending (stable — order preserved for ties)
  tokens.sort((a, b) => b.q - a.q);

  for (const { lang } of tokens) {
    const primary = primarySubtag(lang);
    if (SUPPORTED_PRIMARY.has(primary)) {
      return primary as Locale;
    }
  }

  return null;
}

/**
 * Pick a supported locale from the browser's navigator.languages array.
 * Returns null if no supported locale is found.
 */
export function pickFromNavigatorLanguages(langs: readonly string[]): Locale | null {
  for (const lang of langs) {
    const primary = primarySubtag(lang);
    if (SUPPORTED_PRIMARY.has(primary)) {
      return primary as Locale;
    }
  }
  return null;
}
