import { isSupportedLocale, type Locale } from './types';

/**
 * Persist the `chapa-locale` cookie for future page loads, via a plain
 * `fetch` to `POST /api/locale` — deliberately NOT a Server Action.
 *
 * This used to be `'use server'` and call `writeLocaleCookie` directly.
 * `LanguageProvider.setLocale` already applies the locale change to the
 * current render synchronously (client-side dictionary swap) before
 * awaiting this call, so this call's only remaining job is best-effort
 * cookie persistence — it must never trigger a second render of the current
 * page. A Server Action that writes a cookie does exactly that: Next.js
 * returns a freshly re-rendered RSC payload for the CURRENT route alongside
 * the action's own response. On `/u/[handle]` (async, streamed
 * `generateMetadata`) that produced two byte-identical
 * `<meta property="og:image">` tags on the first navigation to a locale
 * that didn't yet match the persisted cookie. See `app/api/locale/route.ts`
 * for the full mechanism and doc citation.
 */
export async function setLocaleAction(locale: Locale): Promise<void> {
  if (!isSupportedLocale(locale)) return;
  const response = await fetch('/api/locale', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ locale }),
  });
  if (!response.ok) {
    throw new Error(`Failed to persist locale (${response.status})`);
  }
}
