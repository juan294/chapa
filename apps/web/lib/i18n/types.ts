export type Locale = 'en' | 'es';
export const SUPPORTED_LOCALES: readonly Locale[] = ['en', 'es'];
/**
 * Fallback locale for a request that carries NO locale signal (#1201).
 *
 * A `chapa-locale` cookie wins first, then `Accept-Language`, in `proxy.ts`,
 * `getServerLocale` and `detect.ts` alike, so a Spanish visitor still gets
 * Spanish. This value only governs the signal-less case, which is common here:
 * a README `<img>` embed of `/u/:handle/badge.svg` sends no cookie and no
 * useful header, so every un-qualified embedded badge renders in this locale
 * for a worldwide audience. It also renders the statically-built shells (root
 * layout, the `loading.tsx` files, `/verify`) and the warm-cache cron's
 * pre-warmed badge.
 */
export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_COOKIE = 'chapa-locale';
export const LOCALE_SYNC_EVENT = 'chapa-locale-sync-change';

export function isSupportedLocale(value: unknown): value is Locale {
  return SUPPORTED_LOCALES.some((locale) => locale === value);
}

export interface Translations {
  [key: string]: string | string[] | string[][] | Translations | Translations[];
}
