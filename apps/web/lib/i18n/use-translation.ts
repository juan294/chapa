'use client';

import { useContext, useMemo, useEffect } from 'react';
import { LanguageContext, type LanguageContextValue } from './provider';
import { resolveTranslation } from './resolve';
import { __getFallbackDictionary, __setFallbackDictionary } from './fallback-dictionary';
import type { Locale } from './types';

// #1164 (FE-H1/PE-H1) — this fallback previously resolved against a
// statically-imported English dictionary, which pulled the ~90KB English
// dictionary chunk into every client bundle regardless of locale (measured:
// it was referenced 17 times from the prerendered SPANISH page's <script
// src> list, vs. 0 references for the Spanish dictionary chunk anywhere).
//
// Per docs/accepted-risks.md, no production path ever renders outside
// LanguageProvider — this fallback exists solely so a misconfigured or
// no-provider test component doesn't crash. Rather than importing a
// dictionary here (which would reintroduce the exact bundle leak this fix
// removes), the dictionary is supplied by `vitest.setup.ts` at test-runtime
// via the injection seam in `./fallback-dictionary.ts` (kept in its own
// module — see that file's header comment for why). Production never calls
// `__setFallbackDictionary`, so the fallback dictionary stays `undefined`
// there and `t()` degrades to returning the raw key — never a crash, never
// `undefined` rendered, exactly as it does in any other misuse of this
// fallback.
export { __setFallbackDictionary };

export function useTranslation(): LanguageContextValue {
  const context = useContext(LanguageContext);

  const fallback = useMemo<LanguageContextValue>(
    () => ({
      locale: 'en' as Locale,
      setLocale: async () => {},
      t: (key: string) => {
        const dictionary = __getFallbackDictionary();
        return dictionary
          ? (resolveTranslation(key, dictionary) as
              | string
              | string[]
              | Record<string, unknown>[])
          : key;
      },
    }),
    []
  );

  // Warn once per mount cycle when called outside LanguageProvider
  useEffect(() => {
    if (!context) {
      console.warn(
        'useTranslation: LanguageProvider not found, using fallback. Wrap your component in LanguageProvider.'
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return context ?? fallback;
}
