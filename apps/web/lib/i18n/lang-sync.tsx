'use client';

import { useEffect } from 'react';
import { useTranslation } from './use-translation';
import { isSupportedLocale, LOCALE_SYNC_EVENT } from './types';

export function LangSync() {
  const { locale } = useTranslation();

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const syncDocumentLanguage = () => {
      const ownedLocale = document.documentElement.dataset.chapaLocaleSync;
      if (isSupportedLocale(ownedLocale) && ownedLocale !== locale) return;
      document.documentElement.lang = locale;
    };

    syncDocumentLanguage();
    window.addEventListener(LOCALE_SYNC_EVENT, syncDocumentLanguage);
    return () => {
      window.removeEventListener(LOCALE_SYNC_EVENT, syncDocumentLanguage);
    };
  }, [locale]);

  return null;
}
