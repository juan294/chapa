'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import {
  LOCALE_COOKIE,
  isSupportedLocale,
  type Locale,
  type Translations,
} from './types';
import { resolveTranslation } from './resolve';
import { setLocaleAction } from './set-locale-action';
import { en } from './dictionaries/en';

export interface LanguageContextValue {
  locale: Locale;
  setLocale: (
    locale: Locale,
    options?: { force?: boolean; navigate?: boolean },
  ) => Promise<void>;
  t: (key: string) => string | string[] | Record<string, unknown>[];
}

export const LanguageContext = createContext<LanguageContextValue | null>(null);

function readClientLocaleCookie(): Locale | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(
    new RegExp('(?:^|; )' + LOCALE_COOKIE + '=([^;]+)')
  );
  const value = match?.[1];
  return isSupportedLocale(value) ? value : undefined;
}

/**
 * Return the canonical public URL for a locale-segmented internal route.
 *
 * The proxy rewrites canonical paths such as `/about` to `/es/about` or
 * `/en/about`. Those locale-prefixed paths are implementation details, but
 * they remain directly addressable. A locale change must therefore navigate
 * back through the canonical path so the proxy can select fresh server-rendered
 * content using the newly persisted cookie.
 */
export function canonicalLocaleHref({
  pathname,
  search,
  hash,
}: Pick<Location, 'pathname' | 'search' | 'hash'>, locale?: Locale, ensureLocaleQuery = false): string {
  const canonicalPath = pathname.replace(/^\/(?:en|es)(?=\/|$)/, '') || '/';
  let canonicalSearch = search;
  if (locale) {
    const params = new URLSearchParams(search);
    if (params.has('lang') || ensureLocaleQuery) {
      params.set('lang', locale);
      const serialized = params.toString();
      canonicalSearch = serialized ? `?${serialized}` : '';
    }
  }
  return `${canonicalPath}${canonicalSearch}${hash}`;
}

/**
 * Provides the active locale + dictionary to the client tree.
 *
 * The root layout renders STATICALLY at `DEFAULT_LOCALE` (no cookies()/headers()),
 * so content pages stay ISR/static (#861). It imports only the DEFAULT locale's
 * dictionary server-side and passes it via the `dictionary` prop — Next serializes
 * that single dictionary into the route's RSC payload; it does NOT ship in the
 * shared client JS bundle, and the other locale's dictionary is loaded on-demand
 * client-side (a separate chunk) only when the user switches or a non-default
 * locale cookie is present (#862).
 *
 * Because the layout is static it cannot read the locale cookie server-side, so on
 * mount the provider reads the persisted `chapa-locale` cookie and applies it
 * client-side — restoring a returning non-default-locale user's language.
 *
 * When `dictionary` is omitted (e.g. unit tests that render with only
 * `initialLocale`), the provider falls back to the statically-bundled English
 * dictionary, keeping the test-facing API identical.
 *
 * #1071 — `/u/[handle]` and `/verify/[hash]` are dynamic routes that resolve
 * their own per-request locale and each nest a SECOND `LanguageProvider`
 * inside the root layout's static one (which is always pinned to
 * `DEFAULT_LOCALE`) so they can serve a locale the static root can't know
 * about. When that per-request locale happens to match the root's, the
 * nested provider used to still receive and serialize its own full ~650-key
 * dictionary into the RSC payload — a second copy of data the root ancestor
 * already provided. This component now checks for a matching ancestor
 * `LanguageContext` and, when found, renders as a transparent pass-through
 * instead of standing up a second provider/dictionary: descendants resolve
 * `useTranslation()` straight to the ancestor's context. Callers should
 * still avoid passing `dictionary` in that case (see `SharePage` /
 * `VerifyLocaleBoundary`) so the RSC payload never serializes it in the
 * first place; this reuse is a defense-in-depth guarantee, not a
 * replacement for that call-site behavior. Locale mismatches (e.g. an
 * explicit `?lang=` on a non-default page) fall through to the normal path
 * below, unchanged.
 */
export function LanguageProvider({
  children,
  initialLocale,
  dictionary,
}: {
  children: ReactNode;
  initialLocale: Locale;
  dictionary?: Translations;
}) {
  const ancestor = useContext(LanguageContext);
  // #1108-repro — capture the pass-through decision ONCE, at mount, instead
  // of recomputing `ancestor.locale === initialLocale` on every render. The
  // ancestor is a LIVE context value: the root `LanguageProviderInner`'s own
  // mount effect can apply a persisted locale cookie shortly after mount,
  // changing ITS `locale` from `DEFAULT_LOCALE` to whatever was persisted.
  // If that happens to land on this nested provider's `initialLocale` after
  // it already mounted as a real provider (SSR and the first client render
  // both correctly took the "REAL" branch — ancestor was still
  // `DEFAULT_LOCALE` at that point), re-deriving the decision on the next
  // render would flip it to "PASS-THROUGH" mid-lifecycle: React sees the
  // element type at this position change from `LanguageProviderInner` to a
  // bare `Fragment` and unmounts/remounts the ENTIRE subtree below —
  // including this page's own Suspense boundary. If that boundary's first
  // streamed resolution was still in flight when the remount happened, the
  // remount's fresh copy could land in the DOM alongside the still-settling
  // original instead of cleanly replacing it, producing duplicate content
  // (confirmed via `ancestor`/`initialLocale` render tracing: the decision
  // observably flipped from "REAL" to "PASS-THROUGH" after mount in a
  // reproducing run). Freezing the decision at mount (matching what SSR
  // already committed to) makes it immune to the ancestor's locale changing
  // later for any reason — cookie sync, a future locale switch, etc.
  const [usePassThrough] = useState(
    () => !!ancestor && ancestor.locale === initialLocale,
  );
  if (usePassThrough) {
    return <>{children}</>;
  }
  return (
    <LanguageProviderInner initialLocale={initialLocale} dictionary={dictionary}>
      {children}
    </LanguageProviderInner>
  );
}

function LanguageProviderInner({
  children,
  initialLocale,
  dictionary,
}: {
  children: ReactNode;
  initialLocale: Locale;
  dictionary?: Translations;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const [activeDictionary, setActiveDictionary] = useState<Translations>(
    dictionary ?? en
  );

  // Load a locale's dictionary client-side. The active locale's dictionary is
  // already supplied via the RSC payload, so this only fetches the OTHER locale
  // (a separate chunk) when needed — never shipping both in the shared bundle.
  const loadDictionary = useCallback(
    async (loc: Locale): Promise<Translations> => {
      if (loc === 'es') {
        return (await import('./dictionaries/es')).es;
      }
      return (await import('./dictionaries/en')).en;
    },
    []
  );

  // Apply a locale client-side: load its dictionary + update state.
  const applyLocale = useCallback(
    async (next: Locale) => {
      const dict = await loadDictionary(next);
      setActiveDictionary(dict);
      setLocaleState(next);
    },
    [loadDictionary]
  );

  // On mount, an explicit query locale owns the page before the persisted cookie.
  // Some query readers are behind Suspense, so their LocaleSync layout effect can
  // mount after this provider effect. Reading the URL here prevents the cookie's
  // async dictionary load from racing and overwriting that deep-link locale.
  // Routes without LocaleSync also remain coherent for an explicit `?lang=`.
  /* eslint-disable react-hooks/set-state-in-effect -- locale updates await an async dictionary import and synchronize URL/cookie state after mount */
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const mountedQueryLocale = document.documentElement.dataset.chapaLocaleSync;
    if (isSupportedLocale(mountedQueryLocale)) {
      // LocaleSync already started the query-owned update in its layout effect.
      return;
    }
    const queryLocale = new URLSearchParams(window.location.search).get('lang');
    if (isSupportedLocale(queryLocale)) {
      if (queryLocale !== locale) {
        void applyLocale(queryLocale);
      }
      return;
    }
    const cookieLocale = readClientLocaleCookie();
    if (cookieLocale && cookieLocale !== locale) {
      // State updates happen after an awaited dynamic import (not synchronously),
      // and this only runs once on mount to honor the persisted locale cookie.
      void applyLocale(cookieLocale);
    }
    // Run once on mount; `locale`/`applyLocale` are stable enough for this check.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const t = useCallback(
    (key: string) =>
      resolveTranslation(key, activeDictionary) as
        | string
        | string[]
        | Record<string, unknown>[],
    [activeDictionary]
  );

  const setLocale = useCallback(
    async (
      next: Locale,
      { force = false, navigate = true }: { force?: boolean; navigate?: boolean } = {},
    ) => {
      const cookieLocale = readClientLocaleCookie();
      if (next === locale && (!force || cookieLocale === next)) return;
      // Apply the requested dictionary before awaiting cookie persistence. An
      // explicit `?lang=` page must stay coherent even when its server action
      // is slow or unavailable; otherwise server-rendered copy can use the
      // query locale while the shared client navigation remains stale.
      if (next !== locale) {
        await applyLocale(next);
      }
      // The server action deliberately does not revalidate the static layout,
      // avoiding an automatic RSC refresh racing the canonical navigation.
      let persistenceFailed = false;
      if (cookieLocale !== next) {
        try {
          await setLocaleAction(next);
        } catch {
          persistenceFailed = true;
          // Keep the already-applied dictionary authoritative and continue to
          // the explicit query-locale navigation. A transient server-action
          // failure must not leave the locale control unable to switch.
        }
      }
      if (!navigate) return;
      // A full canonical navigation is intentional. `router.refresh()` can
      // retain the prior locale's server-component payload for the same public
      // URL, while directly visited `/en` or `/es` routes never pass through
      // the locale-selecting proxy. Re-entering through the canonical path
      // makes the persisted cookie authoritative for the whole page.
      window.location.assign(
        canonicalLocaleHref(window.location, next, persistenceFailed),
      );
    },
    [locale, applyLocale]
  );

  const value = useMemo<LanguageContextValue>(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}
