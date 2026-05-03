'use client';

import { useEffect } from 'react';
import { useTranslation } from './use-translation';

export function LangSync() {
  const { locale } = useTranslation();

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  return null;
}
