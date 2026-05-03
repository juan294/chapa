# Phase 1 — i18n core infrastructure

**Status:** sequential (no batching) — foundation for everything else.
**Worktree:** `.worktrees/i18n-core` (background) or `../chapa-i18n-core` (interactive).
**Files affected:** all new under `apps/web/lib/i18n/`, plus `apps/web/app/layout.tsx`.

---

## Goal

Stand up the bones: types, dictionaries scaffold, dot-key resolver, server + client locale resolution, hydration-safe React provider, hook, html-lang sync, cookie-writing server action. No copy yet (dictionaries scaffolded but mostly empty — Phase 2 fills them).

After this phase: any client component can call `useTranslation()`, any server component can call `getServerT(locale)`, any page can read `getServerLocale()`, the `<html lang>` attribute is dynamic, and there's a server action to flip the locale. Nothing user-visible changes — `SPANISH_PUBLIC_COPY` is still the source of truth for copy until Phase 2 swaps it.

---

## Tasks

### 1.1 — Define shape

**Pseudocode** — `apps/web/lib/i18n/types.ts`:

```ts
export type Locale = 'en' | 'es';
export const SUPPORTED_LOCALES: readonly Locale[] = ['en', 'es'];
export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_COOKIE = 'chapa-locale';

// Recursive translation shape — leaves are strings, string[], or
// objects matching the same recursive constraint. Mirrors Paisaxe.
export interface Translations {
  [key: string]: string | string[] | Translations | Translations[];
}
```

**Test** (`types.test.ts`): a compile-time test using a tiny fixture asserting that `Locale` rejects unknown values and `SUPPORTED_LOCALES` is the same length as `Locale` union members (use a type-level helper).

### 1.2 — Dot-notation resolver

**Pseudocode** — `apps/web/lib/i18n/resolve.ts`:

```ts
import type { Translations } from './types';

// resolveTranslation('landing.hero.title', tree)
//   - splits on '.'
//   - walks the tree
//   - returns the leaf if string
//   - returns the array if array (callers can iterate for bullet lists)
//   - returns the key itself as fallback (never throws)
export function resolveTranslation(
  key: string,
  tree: Translations,
): string | string[] | Translations[] {
  // ...port from paisaxe/src/lib/i18n/resolve.ts:11–32
  //  - extend to allow array leaves (paisaxe is string-only;
  //    we need arrays for hero.bullets, footer-style lists)
}
```

**Tests** (`resolve.test.ts`): leaf-string hit, leaf-array hit (e.g. `landing.hero.bullets`), missing-key returns the key itself, intermediate-key (not a leaf) returns the key itself, deeply-nested key, key with empty string leaf.

### 1.3 — Accept-Language detection

**Pseudocode** — `apps/web/lib/i18n/detect.ts`:

```ts
// Parse a "Accept-Language" header value and return the first preferred tag
// whose primary subtag matches a supported locale. Quality values respected.
//
// Examples:
//   "es-ES,es;q=0.9,en;q=0.8"  -> 'es'
//   "fr-FR,fr;q=0.9,en;q=0.5"  -> 'en'  (no es match, en is supported)
//   "fr,de"                     -> null (no supported lang)
export function pickFromAcceptLanguage(header: string | null): Locale | null;

// Parse navigator.languages-style array (used only client-side for first-paint
// fallback when there's no SSR header — generally we don't need this because
// the server already resolved).
export function pickFromNavigatorLanguages(langs: readonly string[]): Locale | null;
```

**Tests** (`detect.test.ts`): the bullets above plus malformed headers (empty, single token, missing q, q=0).

### 1.4 — Cookie helpers

**Pseudocode** — `apps/web/lib/i18n/cookie.ts`:

```ts
import { cookies } from 'next/headers';
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
    maxAge: 60 * 60 * 24 * 365,    // 1 year
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: false,                // client picker reads it on hydration
  });
}
```

**Tests** (`cookie.test.ts`): mock `next/headers`, confirm round-trip; rejects unknown values; `httpOnly: false` so the client provider can read on first paint.

### 1.5 — Server resolver + server `t`

**Pseudocode** — `apps/web/lib/i18n/server.ts`:

```ts
import { headers } from 'next/headers';
import { readLocaleCookie } from './cookie';
import { pickFromAcceptLanguage } from './detect';
import { resolveTranslation } from './resolve';
import { en } from './dictionaries/en';
import { es } from './dictionaries/es';
import { DEFAULT_LOCALE, type Locale } from './types';

const dictionaries: Record<Locale, Translations> = { en, es };

// Precedence: query override (handled by caller) > cookie > Accept-Language > default.
// Caller can pass a queryOverride extracted from request searchParams.
export async function getServerLocale(queryOverride?: string | null): Promise<Locale> {
  if (queryOverride === 'en' || queryOverride === 'es') return queryOverride;
  const fromCookie = await readLocaleCookie();
  if (fromCookie) return fromCookie;
  const h = await headers();
  const fromHeader = pickFromAcceptLanguage(h.get('accept-language'));
  return fromHeader ?? DEFAULT_LOCALE;
}

// Returns a t() bound to a specific locale. Server use only.
export function getServerT(locale: Locale) {
  const tree = dictionaries[locale];
  return (key: string) => resolveTranslation(key, tree);
}
```

**Tests** (`server.test.ts`): query override wins; cookie wins over header; header wins over default; unknown query falls through; default is `en`.

### 1.6 — React provider

**Pseudocode** — `apps/web/lib/i18n/provider.tsx`:

```tsx
'use client';

// Same shape as Paisaxe's provider but:
//  - takes initialLocale from a server-side prop (no detection useEffect needed)
//  - both 'en' and 'es' are static-imported (no lazy loading)
//  - setLocale calls a server action that writes the cookie + revalidatePath
//  - syncs to URL by router.refresh() so server components re-render
export interface LanguageContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => Promise<void>;  // async because it triggers a server round-trip
  t: (key: string) => string | string[] | Translations[];
}

export function LanguageProvider({
  children,
  initialLocale,
}: {
  children: ReactNode;
  initialLocale: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const router = useRouter();
  const t = useCallback((key: string) => resolveTranslation(key, dictionaries[locale]), [locale]);
  const setLocale = useCallback(async (next: Locale) => {
    if (next === locale) return;
    await setLocaleAction(next);   // server action — writes cookie
    setLocaleState(next);
    router.refresh();              // re-renders server components in new locale
  }, [locale, router]);
  return <Ctx.Provider value={{ locale, setLocale, t }}>{children}</Ctx.Provider>;
}
```

**Tests** (`provider.test.tsx`): initial locale honored; `setLocale` calls action + refresh; context default value when called outside provider returns `en` fallback (warns once); locale prop change re-resolves `t` (handles router.refresh re-mounting).

### 1.7 — Hook

**Pseudocode** — `apps/web/lib/i18n/use-translation.ts`:

```ts
// Direct port of Paisaxe's useTranslation (paisaxe/src/lib/i18n/use-translation.ts:19-37)
// Outside-provider fallback resolves against `en`, warns once.
export function useTranslation(): LanguageContextValue;
```

**Tests** (`use-translation.test.tsx`): inside provider returns context; outside provider warns once and returns `en`-resolving fallback.

### 1.8 — `<html lang>` sync

**Pseudocode** — `apps/web/lib/i18n/lang-sync.tsx`:

```tsx
// Mirror paisaxe/src/components/a11y/lang-sync.tsx — useEffect sets
// document.documentElement.lang = locale on every locale change.
```

**Tests** (`lang-sync.test.tsx`): mounts, sets `document.documentElement.lang`, updates on locale change.

### 1.9 — Server action for setting the cookie

**Pseudocode** — `apps/web/lib/i18n/set-locale-action.ts`:

```ts
'use server';
import { revalidatePath } from 'next/cache';
import { writeLocaleCookie } from './cookie';
import { SUPPORTED_LOCALES, type Locale } from './types';

export async function setLocaleAction(locale: Locale): Promise<void> {
  if (!SUPPORTED_LOCALES.includes(locale)) return;
  await writeLocaleCookie(locale);
  // Revalidate everything — cookie scope is global, every translated page
  // needs to re-resolve on the next request.
  revalidatePath('/', 'layout');
}
```

**Tests** (`set-locale-action.test.ts`): writes cookie; ignores unknown locales; calls `revalidatePath`.

### 1.10 — Dictionary scaffolds

**Pseudocode** — `apps/web/lib/i18n/dictionaries/en.ts` and `.../es.ts`:

```ts
import type { Translations } from '../types';
// Scaffold only — Phase 2 imports the existing SPANISH_PUBLIC_COPY contents
// into 'es' and the git-recovered English from b0758831^ into 'en'.
export const en: Translations = {
  meta: { defaultTitle: 'Chapa — Developer Impact, Decoded' },
};
export const es: Translations = {
  meta: { defaultTitle: 'Chapa — Impacto de desarrollador, decodificado' },
};
```

**Tests** (`dictionaries/parity.test.ts`):
```
- assertSameKeyShape(en, es)   // recursive walk: same nested paths, same leaf type
- assertNoEmptyLeaves(en)
- assertNoEmptyLeaves(es)
```

These tests will start trivially passing (only `meta.defaultTitle`) and grow through Phase 2/4.

### 1.11 — Index re-exports

**Pseudocode** — `apps/web/lib/i18n/index.ts`:

```ts
export { LanguageProvider } from './provider';
export { useTranslation } from './use-translation';
export { LangSync } from './lang-sync';
export { getServerLocale, getServerT } from './server';
export { setLocaleAction } from './set-locale-action';
export { LOCALE_COOKIE, SUPPORTED_LOCALES, DEFAULT_LOCALE } from './types';
export type { Locale, Translations } from './types';
```

### 1.12 — Wire into root layout

**Pseudocode** — `apps/web/app/layout.tsx`:

```diff
+ import { LanguageProvider, LangSync, getServerLocale } from '@/lib/i18n';

  export default async function RootLayout({ children }) {
    const studioEnabled = await isStudioEnabled();
+   const locale = await getServerLocale();   // no query override here — page-level functions handle that
    return (
-     <html lang="en" ...>
+     <html lang={locale} ...>
        <head>...</head>
        <body ...>
          {/* existing JSON-LD */}
          {/* existing skip-link */}
          <ThemeProvider ...>
+           <LanguageProvider initialLocale={locale}>
+             <LangSync />
              <ClientFeatureFlagsProvider ...>
                {children}
              </ClientFeatureFlagsProvider>
+           </LanguageProvider>
          </ThemeProvider>
        </body>
      </html>
    );
  }
```

**Tests** (`layout.test.tsx`): given mocked cookie+headers, `<html lang>` matches resolved locale; provider receives `initialLocale`.

---

## Definition of done

### Automated

- 12+ new tests under `apps/web/lib/i18n/**.test.ts(x)` all green.
- `pnpm run test --filter i18n` (or full suite) passes locally.
- `pnpm run typecheck` and `pnpm run lint` green.
- Layout renders with `<html lang>` derived from cookie/header.
- Existing test suite (1,500+ tests) **still green** — no behavior change to user-visible copy yet (`SPANISH_PUBLIC_COPY` is still in use, since we haven't rewired consumers in this phase).

### Manual

- Set `chapa-locale=es` cookie in DevTools, reload `/`, inspect DOM: `<html lang="es">`.
- Clear cookie, set browser language to Spanish, reload: `<html lang="es">`.
- Clear cookie, set browser language to French, reload: `<html lang="en">`.
- The page itself still looks identical to today — copy hasn't moved yet (intentional).

### File checklist

- [x] `apps/web/lib/i18n/types.ts`
- [x] `apps/web/lib/i18n/resolve.ts` + `.test.ts`
- [x] `apps/web/lib/i18n/detect.ts` + `.test.ts`
- [x] `apps/web/lib/i18n/cookie.ts` + `.test.ts`
- [x] `apps/web/lib/i18n/server.ts` + `.test.ts`
- [x] `apps/web/lib/i18n/provider.tsx` + `.test.tsx`
- [x] `apps/web/lib/i18n/use-translation.ts` + `.test.tsx`
- [x] `apps/web/lib/i18n/lang-sync.tsx` + `.test.tsx`
- [x] `apps/web/lib/i18n/set-locale-action.ts` + `.test.ts`
- [x] `apps/web/lib/i18n/dictionaries/en.ts`
- [x] `apps/web/lib/i18n/dictionaries/es.ts`
- [x] `apps/web/lib/i18n/dictionaries/parity.test.ts`
- [x] `apps/web/lib/i18n/index.ts`
- [x] `apps/web/app/layout.tsx` updated
- [x] `apps/web/app/layout.render.test.tsx` updated (layout.test.tsx was already named this)

---

## STOP after this phase. Wait for user confirmation before Phase 2.
