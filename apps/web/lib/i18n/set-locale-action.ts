'use server';
import { writeLocaleCookie } from './cookie';
import { SUPPORTED_LOCALES, type Locale } from './types';

export async function setLocaleAction(locale: Locale): Promise<void> {
  if (!SUPPORTED_LOCALES.includes(locale)) return;
  // The locale variants are already pre-rendered. Invalidating the static
  // layout here races the caller's hard navigation with an automatic RSC
  // refresh under the new cookie, which can make `next start` answer the
  // canonical document request with NoFallbackError.
  await writeLocaleCookie(locale);
}
