'use client';

import {
  createContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import type { Locale, Translations } from './types';
import { resolveTranslation } from './resolve';
import { setLocaleAction } from './set-locale-action';
import { en } from './dictionaries/en';

export interface LanguageContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => Promise<void>;
  t: (key: string) => string | string[] | Record<string, unknown>[];
}

export const LanguageContext = createContext<LanguageContextValue | null>(null);

/**
 * Provides the active locale + dictionary to the client tree.
 *
 * In production, the server (a server component, e.g. `RootLayout`) resolves the
 * active locale and imports ONLY that locale's dictionary, passing it via the
 * `dictionary` prop. Next serializes that single dictionary into the current
 * route's RSC payload — it does NOT ship in the shared client JS bundle, and the
 * inactive locale's dictionary is never loaded on the client at all (#862).
 *
 * When `dictionary` is omitted (e.g. unit tests that render with only
 * `initialLocale`), the provider falls back to the statically-bundled English
 * dictionary. This keeps the test-facing API identical; English is the only
 * dictionary statically imported on the client, matching the `useTranslation`
 * fallback path.
 */
export function LanguageProvider({
  children,
  initialLocale,
  dictionary,
}: {
  children: ReactNode;
  initialLocale: Locale;
  dictionary?: Translations;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const router = useRouter();

  // The active dictionary. When provided by the server it is used verbatim.
  // Without it (tests), fall back to the bundled English dictionary so `t()`
  // resolves synchronously and behavior stays identical.
  const activeDictionary = useMemo<Translations>(
    () => dictionary ?? en,
    [dictionary]
  );

  const t = useCallback(
    (key: string) =>
      resolveTranslation(key, activeDictionary) as
        | string
        | string[]
        | Record<string, unknown>[],
    [activeDictionary]
  );

  const setLocale = useCallback(
    async (next: Locale) => {
      if (next === locale) return;
      // Persist the cookie + revalidate. The server re-renders with the new
      // locale's dictionary and re-passes it as a fresh `dictionary` prop on the
      // next render pass, so the inactive locale is never bundled client-side.
      await setLocaleAction(next);
      setLocaleState(next);
      router.refresh();
    },
    [locale, router]
  );

  const value = useMemo<LanguageContextValue>(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}
