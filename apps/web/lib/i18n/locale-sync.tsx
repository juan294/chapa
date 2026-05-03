'use client';

import { useEffect } from 'react';
import { setLocaleAction } from './set-locale-action';
import { SUPPORTED_LOCALES, type Locale } from './types';

export function LocaleSync({ queryLang }: { queryLang?: string | null }) {
  useEffect(() => {
    if (queryLang && SUPPORTED_LOCALES.includes(queryLang as Locale)) {
      void setLocaleAction(queryLang as Locale);
    }
  }, [queryLang]);
  return null;
}
