# Phase 4d — Share page interior

**Status:** [batch-eligible after Phase 2]
**Depends on:** Phase 2 merged.
**Worktree:** `.worktrees/i18n-share-page` or `../chapa-i18n-share-page`.
**Files affected:** `apps/web/app/u/[handle]/page.tsx`, `apps/web/app/u/[handle]/loading.tsx`, `apps/web/components/SharePageOwnerContent.tsx`.

> **Coordination note:** Phase 2 already rewires the *visitor* block of `SharePageOwnerContent.tsx` to use `t()` (the existing `SHARE_VISITOR_COPY` block). Phase 4d only touches the *owner* block (lines 53–177 per the inventory) and the page metadata. No file conflict if Phase 4d branches from a develop with Phase 2 merged.

No overlap with Phase 4a/4b/4c/4e.

---

## Goal

Localize the parts of the share page that aren't already covered by Phase 2:

1. The dynamic page metadata (`generateMetadata`) with `${handle}` interpolation.
2. The h1 (sr-only) and h2 ("Your Impact, Decoded") on `app/u/[handle]/page.tsx`.
3. The `aria-label`s and `alt`s on the same page (`Chapa badge for ${handle}`, etc.).
4. The owner-side copy in `SharePageOwnerContent.tsx`: empty-impact state, regenerate button states (`Regenerar` / `Regenerando...` / `Listo`), regen-failed banner, contact-support link, "Desglose de impacto", "Incrustar esta insignia", and the two `Insignia Chapa de ${handle}` strings.
5. The `app/u/[handle]/loading.tsx` `aria-label="Loading"` and sr-only "Loading...".

---

## Tasks

### 4d.1 — Dictionary keys

```ts
sharePage: {
  metadataTitle: '@{handle} — Developer Impact, Decoded',          // {handle} interpolation
  metadataDescription: 'See @{handle}’s developer impact: ...',     // {handle}
  metadataOgTitle: '@{handle} — Chapa',
  metadataOgImageAlt: 'Chapa badge for @{handle}',
  badgeAriaLabel: 'Chapa badge for @{handle}',
  badgeAlt: 'Chapa badge for @{handle}',
  srH1: '@{handle}’s developer impact',
  h2: 'Your Impact, Decoded',
  loadingAriaLabel: 'Loading',
  loadingSrText: 'Loading...',
},
shareOwner: {
  emptyImpact: {
    heading: 'Building your profile...',
    body: 'We’re calculating your impact dimensions. This usually takes ~30 seconds.',
  },
  regenerate: {
    idle: 'Regenerate',
    pending: 'Regenerating...',
    done: 'Done',
    failed: 'Regeneration failed.',
    contactSupport: 'Contact support',
  },
  breakdown: 'Impact breakdown',
  embed: 'Embed this badge',
  badgeImageAlt: 'Chapa badge for @{handle}',                      // duplicate of sharePage.badgeAlt — keep in sync or reuse
  ariaBusy: 'Regenerating badge',
},
```

(Spanish-side mirrors with `@{handle}`-style placeholders preserved verbatim.)

A small `interpolate(template, vars)` helper goes in `lib/i18n/interpolate.ts` (3 LOC: `template.replace(/\{(\w+)\}/g, (_, k) => vars[k])`). Test it.

### 4d.2 — Update page

```diff
+ import { getServerLocale, getServerT, interpolate } from '@/lib/i18n';
+ export const dynamic = 'force-dynamic';

  export async function generateMetadata({ params, searchParams }): Promise<Metadata> {
    const handle = (await params).handle;
+   const locale = await getServerLocale((await searchParams).lang);
+   const t = getServerT(locale);
+   const title = interpolate(t('sharePage.metadataTitle') as string, { handle });
+   const description = interpolate(t('sharePage.metadataDescription') as string, { handle });
    return {
      title,
      description,
      openGraph: {
        title: interpolate(t('sharePage.metadataOgTitle') as string, { handle }),
        images: [{ url: `/u/${handle}/og-image`, alt: interpolate(t('sharePage.metadataOgImageAlt') as string, { handle }) }],
      },
      // ...
    };
  }

  export default async function SharePage({ params, searchParams }) {
+   const locale = await getServerLocale((await searchParams).lang);
+   const t = getServerT(locale);
    const handle = (await params).handle;
    return (
      <>
        <Navbar />
+       <LocaleSync queryLang={(await searchParams).lang} />
        <main>
-         <h1 className="sr-only">@{handle}'s developer impact</h1>
+         <h1 className="sr-only">{interpolate(t('sharePage.srH1') as string, { handle })}</h1>
-         <h2>Your Impact, Decoded</h2>
+         <h2>{t('sharePage.h2')}</h2>
          <img
-           alt={`Chapa badge for ${handle}`}
+           alt={interpolate(t('sharePage.badgeAlt') as string, { handle })}
-           aria-label={`Chapa badge for ${handle}`}
+           aria-label={interpolate(t('sharePage.badgeAriaLabel') as string, { handle })}
            ...
          />
          {/* The owner content block */}
        </main>
      </>
    );
  }
```

### 4d.3 — Update SharePageOwnerContent

(Client component — uses `useTranslation`.) Replace the 10 hardcoded Spanish strings with `t('shareOwner.*')` lookups. The `${handle}` interpolations use the `interpolate` helper.

### 4d.4 — Update loading.tsx

```diff
+ 'use client';
+ import { useTranslation } from '@/lib/i18n';
  export default function Loading() {
+   const { t } = useTranslation();
    return (
-     <div role="status" aria-label="Loading">
-       <span className="sr-only">Loading...</span>
+     <div role="status" aria-label={t('sharePage.loadingAriaLabel') as string}>
+       <span className="sr-only">{t('sharePage.loadingSrText') as string}</span>
        {/* spinner */}
      </div>
    );
  }
```

### 4d.5 — Tests

- `generateMetadata` returns the right title/description for `en` vs `es` with handle interpolated.
- Page renders in both locales — sr-only h1 contains the handle.
- SharePageOwnerContent: regenerate button cycles through the right locale-specific labels (idle/pending/done/failed states).
- Loading component renders the correct locale aria.

---

## Definition of done

### Automated

- Render tests for `app/u/[handle]/page.tsx` and `SharePageOwnerContent.tsx` in both locales — green.
- `generateMetadata` test in both locales — green.
- `interpolate.test.ts` covers basic substitution and missing-var no-op.
- Parity test green.
- Typecheck/lint green.

### Manual

- Visit `/u/<handle>?lang=es` (logged out) → all visitor copy + h2 + metadata in Spanish.
- Visit `/u/<handle>?lang=en` (logged out) → English equivalent.
- Visit `/u/<your-handle>?lang=es` (logged in as owner) → owner-only chrome (regenerate button, "Desglose de impacto", "Incrustar esta insignia") in Spanish.
- Click regenerate → button text cycles through correct locale variants.
- View page source: `<title>` and OG meta in correct locale with handle interpolated.

### File checklist

- [ ] `apps/web/lib/i18n/interpolate.ts` + `.test.ts`
- [ ] `apps/web/lib/i18n/dictionaries/en.ts` — sharePage + shareOwner
- [ ] `apps/web/lib/i18n/dictionaries/es.ts` — same keys translated
- [ ] `apps/web/app/u/[handle]/page.tsx`
- [ ] `apps/web/app/u/[handle]/loading.tsx`
- [ ] `apps/web/components/SharePageOwnerContent.tsx`
- [ ] Render tests for all four files

---

## STOP after this phase if running solo.
