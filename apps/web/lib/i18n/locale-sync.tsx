'use client';

import { useLayoutEffect } from 'react';
import { useTranslation } from './use-translation';
import { isSupportedLocale } from './types';

/**
 * Applies an inbound `?lang=` deep-link query param to the live page.
 *
 * Calls the `LanguageProvider`'s own `setLocale` (exposed via `useTranslation`)
 * rather than `setLocaleAction` directly. `setLocale` persists the
 * `chapa-locale` cookie (via `setLocaleAction`) for future loads AND applies
 * the locale to the current render immediately (loads the target dictionary +
 * updates provider state) without starting a document navigation. A request
 * like `/u/handle?lang=en` therefore switches the visible language on first
 * paint instead of only on a subsequent reload (#1020). The forced sync keeps
 * the query authoritative over a stale cookie, while the provider skips cookie
 * and dictionary work that is already current.
 */
export function LocaleSync({ queryLang }: { queryLang?: string | null }) {
  const { setLocale } = useTranslation();

  useLayoutEffect(() => {
    if (isSupportedLocale(queryLang)) {
      document.documentElement.dataset.chapaLocaleSync = queryLang;
      void setLocale(queryLang, { force: true, navigate: false });
      return () => {
        delete document.documentElement.dataset.chapaLocaleSync;
      };
    }
    // setLocale is intentionally omitted: its identity changes whenever the
    // active locale changes. The explicit query value is the only input that
    // should restart this synchronization.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryLang]);
  return null;
}
