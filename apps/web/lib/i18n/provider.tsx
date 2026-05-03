'use client';

import {
  createContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import type { Locale, Translations } from './types';
import { en } from './dictionaries/en';
import { es } from './dictionaries/es';
import { resolveTranslation } from './resolve';
import { setLocaleAction } from './set-locale-action';

const dictionaries: Record<Locale, Translations> = { en, es };

export interface LanguageContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => Promise<void>;
  t: (key: string) => string | string[] | Record<string, unknown>[];
}

export const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({
  children,
  initialLocale,
}: {
  children: ReactNode;
  initialLocale: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const router = useRouter();

  const t = useCallback(
    (key: string) => resolveTranslation(key, dictionaries[locale]) as string | string[] | Record<string, unknown>[],
    [locale]
  );

  const setLocale = useCallback(
    async (next: Locale) => {
      if (next === locale) return;
      await setLocaleAction(next);
      setLocaleState(next);
      router.refresh();
    },
    [locale, router]
  );

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
}
