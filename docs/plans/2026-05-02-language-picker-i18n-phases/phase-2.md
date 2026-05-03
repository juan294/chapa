# Phase 2 — Dictionary restructure + rewire current consumers

**Status:** sequential after Phase 1.
**Depends on:** Phase 1 fully merged.
**Worktree:** `.worktrees/i18n-dictionaries` or `../chapa-i18n-dictionaries`.

---

## Goal

Move all copy from `apps/web/lib/copy/public-flow.ts` into `lib/i18n/dictionaries/{en,es}.ts`, recover the original English from git history, add the common-chrome keys (Navbar, MobileNav, ThemeToggle, CopyButton, ErrorBanner, Toast, BadgeOverlay, BadgeSkeleton, UserMenu visible items), and rewire every current consumer to read from `t()` / `getServerT(locale)`. Delete `public-flow.ts`. After this phase, the **landing, verify, generating, share-visitor block, and error boundaries** render in the correct locale based on cookie + Accept-Language. The picker doesn't exist yet (Phase 3) — but flipping the cookie via DevTools should switch the language.

---

## Tasks

### 2.1 — Recover original English copy from git

```bash
git show b0758831^:apps/web/app/page.tsx          > /tmp/page-en.tsx
git show b0758831^:apps/web/app/verify/page.tsx   > /tmp/verify-en.tsx
git show b0758831^:apps/web/app/verify/VerifyForm.tsx > /tmp/verify-form-en.tsx
git show b0758831^:apps/web/app/generating/[handle]/page.tsx           > /tmp/gen-page-en.tsx
git show b0758831^:apps/web/app/generating/[handle]/GeneratingProgress.tsx > /tmp/gen-progress-en.tsx
git show b0758831^:apps/web/components/SharePageOwnerContent.tsx       > /tmp/share-en.tsx
git show b0758831^:apps/web/app/error.tsx                              > /tmp/error-en.tsx
git show b0758831^:apps/web/app/u/[handle]/error.tsx                   > /tmp/share-error-en.tsx
```

Manually extract every user-visible English string. For keys added in PR #819 with no English equivalent (e.g., `embed.windowLabel`, the Spanish-only `errors.*` shape, generation step labels in their new shape), translate from the current Spanish — these are the only "from-scratch" English strings in this phase.

### 2.2 — Build the dictionary trees

**Pseudocode** — `apps/web/lib/i18n/dictionaries/es.ts`:

```ts
import type { Translations } from '../types';
// Direct lift of SPANISH_PUBLIC_COPY (lib/copy/public-flow.ts), but reorganized
// so the top-level shape mirrors the page/feature taxonomy (no 'landing' wrapper
// vs everything else — keep the existing groupings since they're already sensible).
export const es: Translations = {
  meta: {
    defaultTitle: 'Chapa — Impacto de desarrollador, decodificado',
    defaultDescription: 'Tu impacto como desarrollador, decodificado en múltiples dimensiones — Entrega, Calidad, Constancia, Alcance y la opcional Oficio — a partir de 12 meses de actividad.',
  },
  common: {
    chapa: 'Chapa',
    login: 'login',
    tryAgain: 'Intentar de nuevo',
    goHome: 'Volver al inicio',
    loading: 'Cargando...',
    copied: 'Copiado!',
    copy: 'Copiar',
  },
  aria: {
    mainNavigation: 'Navegación principal',
    mobileNavigation: 'Navegación móvil',
    toggleNavigation: 'Alternar navegación',
    userMenu: 'Menú de usuario',
    userMenuOptions: 'Opciones del menú de usuario',
    themeToggleLight: 'Cambiar a tema claro',
    themeToggleDark: 'Cambiar a tema oscuro',
    languageSwitcher: 'Selector de idioma',
    moreInfo: 'Más información',
    dismissError: 'Descartar error',
    dismissNotification: 'Descartar notificación',
    copyEmbed: 'Copiar fragmento embebido',
    loadingBadge: 'Cargando insignia...',
    badgeTooltips: 'Tooltips de elementos de la insignia',
    avatarOf: '{login}',                       // interpolated by caller: `${t('aria.avatarOf').replace('{login}', login)}'s avatar`
  },
  landing: { /* lift from SPANISH_PUBLIC_COPY.landing */ },
  shareVisitor: { /* lift */ },
  verify: { /* lift */ },
  verifyForm: { /* lift */ },
  generation: { /* lift */ },
  errors: { /* lift */ },
  verifyDetail: { /* lift */ },
  // New keys for Phase 2 chrome:
  userMenu: {
    myBadge: 'Mi insignia',
    creatorStudio: 'Creator Studio',          // brand name — leave English
    importInsights: 'Importar Claude Code Insights',
    unlinkBitbucket: 'Desvincular Bitbucket',
    unlinkBitbucketAria: 'Desvincular cuenta de Bitbucket',
    linkBitbucket: 'Vincular Bitbucket',
    unlinkCodebergAria: 'Desvincular cuenta de Codeberg',
    unlinkCodeberg: 'Desvincular Codeberg',
    linkCodeberg: 'Vincular Codeberg',
    adminPanel: 'Panel de administración',
    aboutChapa: 'Acerca de Chapa',
    termsOfService: 'Términos del servicio',
    privacyPolicy: 'Política de privacidad',
    signOut: 'Cerrar sesión',
    confirmUnlinkBitbucketTitle: '¿Desvincular Bitbucket?',
    confirmUnlinkBitbucketBody: 'Tus estadísticas de Bitbucket dejarán de incluirse en tu insignia.',
    confirmUnlinkCodebergTitle: '¿Desvincular Codeberg?',
    confirmUnlinkCodebergBody: 'Tus estadísticas de Codeberg dejarán de incluirse en tu insignia.',
    confirm: 'Confirmar',
    cancel: 'Cancelar',
    insightsTooltipPrefix: 'Última carga: ',
  },
  badgeOverlay: {
    // 11 hotspot tooltip strings keyed by hotspot.id
    // (see apps/web/components/BadgeOverlay.tsx HOTSPOTS const)
    archetype: '...', impactScore: '...', /* ... */
  },
} as const;
```

**Pseudocode** — `apps/web/lib/i18n/dictionaries/en.ts`: same shape as `es`, populated from the git-recovered originals + new English siblings for any net-new keys.

**Note:** The `as const` is dropped at the export site since `Translations` is a recursive interface — the value is narrowed by the recursive type. Use plain typed export.

### 2.3 — Parity test grows up

Update `dictionaries/parity.test.ts` to walk the *full* tree and assert structural identity (same set of dotted paths, same leaf kind — string vs string[] vs nested object). This becomes the guardrail for every subsequent phase.

```ts
test('en and es have identical key shape', () => {
  expect(walkKeys(en)).toEqual(walkKeys(es));
  expect(leafKinds(en)).toEqual(leafKinds(es));
});
```

### 2.4 — Convert server consumers (TDD: failing render test first per file)

For each file: write a render test that mounts in both locales and asserts a sample translated string appears, then refactor the implementation.

| File | Locale source | Pattern |
|---|---|---|
| `app/page.tsx` (server component) | `getServerLocale(searchParams.lang)` then `getServerT(locale)` | replace `LANDING_COPY = SPANISH_PUBLIC_COPY.landing` with `const t = getServerT(locale)` and lookups like `t('landing.hero.title')`. Add `export const dynamic = 'force-dynamic'` per F2. |
| `app/error.tsx` (client) | `useTranslation()` | error boundary is a client component — use the hook |
| `app/u/[handle]/error.tsx` (client) | `useTranslation()` | same |
| `app/verify/page.tsx` (server) | `getServerLocale + getServerT` | Convert `metadata` to `generateMetadata({ searchParams })`. Add `export const dynamic = 'force-dynamic'`. |
| `app/verify/[hash]/page.tsx` (server) | `getServerLocale + getServerT` | same |
| `app/verify/VerifyForm.tsx` (client) | `useTranslation()` | hook |
| `app/generating/[handle]/page.tsx` (server) | `getServerLocale + getServerT` | dynamic metadata |
| `app/generating/[handle]/GeneratingProgress.tsx` (client) | `useTranslation()` | hook; convert `INITIAL_STEPS` to a function-of-locale or pull labels via `t()` per render |
| `components/SharePageOwnerContent.tsx` (client) | `useTranslation()` | both visitor + owner blocks; the 10 hardcoded Spanish strings (lines 53–177) move to keys under `shareOwner.*` |
| `components/Navbar.tsx` (server) | accept locale via prop OR call `getServerLocale()` | aria-label + login string. Pass nav links as already-translated by caller. |
| `components/NavbarClient.tsx` (client) | `useTranslation()` | aria-label + login string |
| `components/MobileNav.tsx` (client) | `useTranslation()` | two aria labels |
| `components/UserMenu.tsx` (client) | `useTranslation()` | ~25 strings under `userMenu.*` |
| `components/CopyButton.tsx` (client) | `useTranslation()` | aria + sr-only |
| `components/ThemeToggle.tsx` (client) | `useTranslation()` | aria-label |
| `components/ErrorBanner.tsx` (client) | `useTranslation()` | dismiss aria |
| `components/Toast.tsx` (client) | `useTranslation()` | dismiss aria |
| `components/BadgeOverlay.tsx` (client) | `useTranslation()` | 11 hotspot tooltip strings + tooltips aria |
| `components/BadgeSkeleton.tsx` (client) | `useTranslation()` | aria-label |

### 2.5 — Page-level dynamic flag

Every server-rendered page touched in 2.4 gets:

```ts
export const dynamic = 'force-dynamic';
```

(Removes `export const revalidate = ...` where present.) Document the trade-off in `docs/accepted-risks.md` (single new entry: "Public-page i18n requires dynamic rendering — 2026-05-02").

### 2.6 — Delete `public-flow.ts`

Once all consumers are rewired and tests pass:

```bash
git rm apps/web/lib/copy/public-flow.ts
```

If `lib/copy/` becomes empty, remove the directory.

### 2.7 — Add a `?lang=` override hook (server-side only)

For server components, the page reads `searchParams.lang`, passes it to `getServerLocale(queryOverride)`. If the override differs from the cookie, render the override locale **and** use `setLocaleAction` (called from a small `<LocaleSync queryLang={searchParams.lang} />` client island in the layout) to persist it sticky. This client island runs only when the query param is present.

**Pseudocode** — `apps/web/lib/i18n/locale-sync.tsx`:

```tsx
'use client';
import { useEffect } from 'react';
import { setLocaleAction } from './set-locale-action';
import { SUPPORTED_LOCALES, type Locale } from './types';

export function LocaleSync({ queryLang }: { queryLang?: string }) {
  useEffect(() => {
    if (queryLang && SUPPORTED_LOCALES.includes(queryLang as Locale)) {
      setLocaleAction(queryLang as Locale);
    }
  }, [queryLang]);
  return null;
}
```

Mounted in `layout.tsx` once. Layout reads `searchParams` indirectly — actually, root layouts in Next.js don't get `searchParams`. Workaround: each translated page passes `searchParams.lang` to a `<LocaleSync>` it mounts itself. Add it to the public-flow pages converted in 2.4.

---

## Definition of done

### Automated

- All tests green; new render tests cover both locales for every converted file.
- Parity test passes against the full populated dictionaries.
- Typecheck/lint green.
- `apps/web/lib/copy/public-flow.ts` does not exist.
- `grep -r "SPANISH_PUBLIC_COPY" apps/web` returns zero hits.

### Manual

- `chapa-locale=en` cookie + visit `/` → English landing (matches the pre-#819 design).
- `chapa-locale=es` cookie + visit `/` → Spanish landing (matches today's prod).
- Clear cookie, `Accept-Language: es-ES` → Spanish.
- Clear cookie, `Accept-Language: en-US` → English.
- `?lang=es` on an English browser → flips to Spanish, cookie set, sticky.
- Verify page, generating page, share-page visitor block, error boundary screens — all render in the correct locale.
- BadgeOverlay tooltip text is in the correct locale.
- UserMenu (when logged in) shows the right locale labels.

### File checklist

- [x] `apps/web/lib/i18n/dictionaries/en.ts` populated
- [x] `apps/web/lib/i18n/dictionaries/es.ts` populated
- [x] `apps/web/lib/i18n/dictionaries/parity.test.ts` updated to full-tree walk
- [x] `apps/web/lib/i18n/locale-sync.tsx` + test
- [x] All 19 consumer files in 2.4 rewired and tested
- [x] `docs/accepted-risks.md` updated
- [x] `apps/web/lib/copy/public-flow.ts` deleted

---

## STOP after this phase. Wait for user confirmation before Phase 3 (and Phase 3 can run in parallel with Phase 4 sub-phases — see main plan).
