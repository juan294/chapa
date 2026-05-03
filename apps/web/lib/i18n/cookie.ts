import { cookies } from 'next/headers';
import { getNodeEnv } from '@/lib/env';
import { LOCALE_COOKIE, SUPPORTED_LOCALES, type Locale } from './types';

export async function readLocaleCookie(): Promise<Locale | null> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return SUPPORTED_LOCALES.includes(value as Locale) ? (value as Locale) : null;
}

export async function writeLocaleCookie(locale: Locale): Promise<void> {
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    secure: getNodeEnv() === 'production',
    httpOnly: false, // client picker reads it on hydration
  });
}
