'use client';

import { useContext, useMemo, useEffect } from 'react';
import { LanguageContext, type LanguageContextValue } from './provider';
import { en } from './dictionaries/en';
import { resolveTranslation } from './resolve';
import type { Locale } from './types';

export function useTranslation(): LanguageContextValue {
  const context = useContext(LanguageContext);

  const fallback = useMemo<LanguageContextValue>(
    () => ({
      locale: 'en' as Locale,
      setLocale: async () => {},
      t: (key: string) => resolveTranslation(key, en) as string | string[] | Record<string, unknown>[],
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
