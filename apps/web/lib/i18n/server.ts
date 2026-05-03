import { headers } from 'next/headers';
import { readLocaleCookie } from './cookie';
import { pickFromAcceptLanguage } from './detect';
import { resolveTranslation } from './resolve';
import { en } from './dictionaries/en';
import { es } from './dictionaries/es';
import { DEFAULT_LOCALE, type Locale, type Translations } from './types';

const dictionaries: Record<Locale, Translations> = { en, es };

export async function getServerLocale(queryOverride?: string | null): Promise<Locale> {
  if (queryOverride === 'en' || queryOverride === 'es') return queryOverride;
  const fromCookie = await readLocaleCookie();
  if (fromCookie) return fromCookie;
  const h = await headers();
  const fromHeader = pickFromAcceptLanguage(h.get('accept-language'));
  return fromHeader ?? DEFAULT_LOCALE;
}

export function getServerT(locale: Locale) {
  const tree = dictionaries[locale];
  return (key: string) => resolveTranslation(key, tree);
}
