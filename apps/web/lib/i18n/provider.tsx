'use client';

import {
  createContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  LOCALE_COOKIE,
  SUPPORTED_LOCALES,
  type Locale,
  type Translations,
} from './types';
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
 * The root layout renders STATICALLY at `DEFAULT_LOCALE` (no cookies()/headers()),
 * so content pages stay ISR/static (#861). It imports only the DEFAULT locale's
 * dictionary server-side and passes it via the `dictionary` prop — Next serializes
 * that single dictionary into the route's RSC payload; it does NOT ship in the
 * shared client JS bundle, and the other locale's dictionary is loaded on-demand
 * client-side (a separate chunk) only when the user switches or a non-default
 * locale cookie is present (#862).
 *
 * Because the layout is static it cannot read the locale cookie server-side, so on
 * mount the provider reads the persisted `chapa-locale` cookie and applies it
 * client-side — restoring a returning non-default-locale user's language.
 *
 * When `dictionary` is omitted (e.g. unit tests that render with only
 * `initialLocale`), the provider falls back to the statically-bundled English
 * dictionary, keeping the test-facing API identical.
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
  const [activeDictionary, setActiveDictionary] = useState<Translations>(
    dictionary ?? en
  );
  const router = useRouter();

  // Load a locale's dictionary client-side. The active locale's dictionary is
  // already supplied via the RSC payload, so this only fetches the OTHER locale
  // (a separate chunk) when needed — never shipping both in the shared bundle.
  const loadDictionary = useCallback(
    async (loc: Locale): Promise<Translations> => {
      if (loc === 'es') {
        return (await import('./dictionaries/es')).es;
      }
      return (await import('./dictionaries/en')).en;
    },
    []
  );

  // Apply a locale client-side: load its dictionary + update state.
  const applyLocale = useCallback(
    async (next: Locale) => {
      const dict = await loadDictionary(next);
      setActiveDictionary(dict);
      setLocaleState(next);
    },
    [loadDictionary]
  );

  // On mount, honor the persisted locale cookie. The layout renders statically at
  // DEFAULT_LOCALE, so a returning non-default-locale user's choice is applied here.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const match = document.cookie.match(
      new RegExp('(?:^|; )' + LOCALE_COOKIE + '=([^;]+)')
    );
    const cookieLocale = match?.[1] as Locale | undefined;
    if (
      cookieLocale &&
      SUPPORTED_LOCALES.includes(cookieLocale) &&
      cookieLocale !== locale
    ) {
      // State updates happen after an awaited dynamic import (not synchronously),
      // and this only runs once on mount to honor the persisted locale cookie.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void applyLocale(cookieLocale);
    }
    // Run once on mount; `locale`/`applyLocale` are stable enough for this check.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      // Persist the cookie, then apply the locale client-side (load its dictionary
      // chunk + update state) so client components reflect the change immediately.
      await setLocaleAction(next);
      await applyLocale(next);
      router.refresh();
    },
    [locale, applyLocale, router]
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
