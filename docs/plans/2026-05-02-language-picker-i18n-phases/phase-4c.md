# Phase 4c — Legal pages (privacy + terms)

**Status:** [batch-eligible after Phase 2]
**Depends on:** Phase 2 merged.
**Worktree:** `.worktrees/i18n-legal` or `../chapa-i18n-legal`.
**Files affected:** `apps/web/app/privacy/page.tsx`, `apps/web/app/terms/page.tsx`. No overlap with Phase 4a/4b/4d/4e.

---

## Goal

Localize `/privacy` and `/terms`. Each is ~12 strings (h1, last-updated date label, 6–7 numbered H2+paragraph pairs, mailto link). Mostly straightforward prose.

---

## Tasks

### 4c.1 — Dictionary keys

Add to `en.ts` (parity-matched in `es.ts`):

```ts
legal: {
  privacy: {
    metadataTitle: 'Privacy Policy',
    metadataDescription: '...',
    h1: 'Privacy Policy',
    lastUpdatedLabel: 'Last updated:',
    lastUpdatedDate: '2026-04-12',     // raw date kept as string — both locales same
    sections: [
      { heading: '1. Information we collect', body: '...' },
      { heading: '2. How we use information', body: '...' },
      // ... 6 more
    ],
    contactPrefix: 'Reach us at ',
    contactEmail: 'privacy@thecreativetoken.com',
    contactSuffix: '.',
  },
  terms: {
    metadataTitle: 'Terms of Service',
    metadataDescription: '...',
    h1: 'Terms of Service',
    lastUpdatedLabel: 'Last updated:',
    lastUpdatedDate: '2026-04-12',
    sections: [
      { heading: '1. Acceptance', body: '...' },
      // ... 6 more
    ],
  },
},
```

**English source** = current page text. **Spanish source** = translated; tone matches Spanish legal-doc convention (formal `usted`, no contractions).

### 4c.2 — Convert pages

Both privacy and terms pages: server component → `getServerLocale + getServerT`, `export const dynamic = 'force-dynamic'`, replace static `metadata` with `generateMetadata`. Mount `<LocaleSync queryLang>`.

```tsx
// apps/web/app/privacy/page.tsx
export const dynamic = 'force-dynamic';
export async function generateMetadata({ searchParams }): Promise<Metadata> { /* ... */ }
export default async function PrivacyPage({ searchParams }) {
  const locale = await getServerLocale((await searchParams).lang);
  const t = getServerT(locale);
  const sections = t('legal.privacy.sections') as Array<{ heading: string; body: string }>;
  return (
    <>
      <Navbar />
      <LocaleSync queryLang={(await searchParams).lang} />
      <main>
        <h1>{t('legal.privacy.h1')}</h1>
        <p>{t('legal.privacy.lastUpdatedLabel')} {t('legal.privacy.lastUpdatedDate')}</p>
        {sections.map((s, i) => (
          <section key={i}>
            <h2>{s.heading}</h2>
            <p>{s.body}</p>
          </section>
        ))}
        <p>
          {t('legal.privacy.contactPrefix')}
          <a href={`mailto:${t('legal.privacy.contactEmail')}`}>{t('legal.privacy.contactEmail')}</a>
          {t('legal.privacy.contactSuffix')}
        </p>
      </main>
    </>
  );
}
```

### 4c.3 — Tests

Render in both locales; assert section count, h1, mailto present.

---

## Definition of done

### Automated

- Render tests for both pages in both locales — green.
- Parity test passes.
- Typecheck/lint green.

### Manual

- `/privacy?lang=es` and `?lang=en` render correctly.
- `/terms?lang=es` and `?lang=en` render correctly.
- Mailto links work; emails render literally (not translated).

### File checklist

- [ ] `apps/web/lib/i18n/dictionaries/en.ts` — legal namespace
- [ ] `apps/web/lib/i18n/dictionaries/es.ts` — same keys translated
- [ ] `apps/web/app/privacy/page.tsx`
- [ ] `apps/web/app/terms/page.tsx`
- [ ] Render tests for both

---

## STOP after this phase if running solo.
