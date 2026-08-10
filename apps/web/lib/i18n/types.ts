export type Locale = 'en' | 'es';
export const SUPPORTED_LOCALES: readonly Locale[] = ['en', 'es'];
export const DEFAULT_LOCALE: Locale = 'es';
export const LOCALE_COOKIE = 'chapa-locale';

export function isSupportedLocale(value: unknown): value is Locale {
  return SUPPORTED_LOCALES.some((locale) => locale === value);
}

export interface Translations {
  [key: string]: string | string[] | string[][] | Translations | Translations[];
}
