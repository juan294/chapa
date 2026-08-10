'use client';

import { useEffect } from 'react';
import { useTranslation } from './use-translation';
import { SUPPORTED_LOCALES, type Locale } from './types';

/**
 * Applies an inbound `?lang=` deep-link query param to the live page.
 *
 * Calls the `LanguageProvider`'s own `setLocale` (exposed via `useTranslation`)
 * rather than `setLocaleAction` directly. `setLocale` persists the
 * `chapa-locale` cookie (via `setLocaleAction`) for future loads AND applies
 * the locale to the current render immediately (loads the target dictionary +
 * updates provider state) before navigating through the canonical URL. A request
 * like `/u/handle?lang=en` therefore switches the visible language on first
 * paint instead of only on a subsequent reload (#1020). `setLocale` already
 * no-ops when `next === locale`, so this is safe to call on every mount/param
 * change.
 */
export function LocaleSync({ queryLang }: { queryLang?: string | null }) {
  const { setLocale } = useTranslation();

  useEffect(() => {
    if (queryLang && SUPPORTED_LOCALES.includes(queryLang as Locale)) {
      void setLocale(queryLang as Locale);
    }
    // setLocale is intentionally omitted: its identity changes whenever `locale`
    // changes (see provider.tsx), and it already guards `next === locale`
    // internally, so re-running this effect on every such change is safe but
    // unnecessary — only queryLang changes should retrigger the sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryLang]);
  return null;
}
