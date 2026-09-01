// Client-safe exports only — do NOT add server-only imports (next/headers, cookie.ts, server.ts)
export { LanguageProvider, LanguageContext } from './provider';
export type { LanguageContextValue } from './provider';
export { useTranslation } from './use-translation';
export { LangSync } from './lang-sync';
export { LocaleSync } from './locale-sync';
export { DEFAULT_LOCALE } from './types';
export type { Locale, Translations } from './types';
export { interpolate } from './interpolate';
