# Phase 4a — About page family

**Status:** [batch-eligible after Phase 2]
**Depends on:** Phase 2 merged.
**Worktree:** `.worktrees/i18n-about` or `../chapa-i18n-about`.
**Files affected:** `apps/web/app/about/**`. No overlap with Phase 4b–4e.

---

## Goal

Localize `/about`, `/about/scoring`, `/about/verification` (page bodies + metadata) into the `en` and `es` dictionaries. These three pages contain ~15 + ~120 + ~60 distinct user-visible strings, including data-table-as-content and rich text with embedded `<Link>` / `<strong>` / `<em>`.

---

## Tasks

### 4a.1 — Add namespaced keys to dictionaries

**Pseudocode** — add to `apps/web/lib/i18n/dictionaries/en.ts` (and parity-matched in `es.ts`):

```ts
about: {
  index: {
    metadataTitle: 'About',
    metadataDescription: '...',
    h1: 'About Chapa',
    intro: { before: '...', emphasis: '...', after: '...' },     // segmented for <em>
    sectionDimensions: 'Dimensions',
    sectionArchetypes: 'Developer archetypes',
    archetypeDescriptionBefore: 'Your archetype — ',
    archetypeDescriptionAfter: ' — captures how you actually contribute.',
    sectionPrivacy: 'Privacy and fairness',
    privacyBody: '...',
    sectionContact: 'Contact',
    contactPrefix: 'Reach us at ',
    contactEmail: 'hello@thecreativetoken.com',
    contactSuffix: '.',
  },
  scoring: {
    metadataTitle: 'How Chapa Scores Developer Impact',
    metadataDescription: '...',
    h1: 'How Chapa Scores Developer Impact',
    youtubeTitle: 'How Chapa Scores Developer Impact',
    intro: '...',
    // Section headings (8 total — Quality cliff, Lead-time modifier, etc.)
    sections: {
      overview: { heading: '...', body: ['...', '...'] },
      delivery: { /* ... */ },
      quality: { /* ... */ },
      consistency: { /* ... */ },
      breadth: { /* ... */ },
      craft: { /* ... */ },
      adjustments: { /* ... */ },
      tiers: { /* ... */ },
    },
    // Tables-as-data — each as an object with `headers` (string[]) and
    // `rows` (Array<Array<string>>). The page maps over rows in render.
    tables: {
      qualityComponents: {
        caption: 'Quality components',
        headers: ['Component', 'Weight', 'Notes'],
        rows: [
          ['Code review participation', '40%', 'Reviews on team PRs only'],
          // ... full table
        ],
      },
      // 7 more tables: leadTimeModifier, breadthInputs, craftInputs,
      // adjustmentLadder, tierThresholds, archetypeTriggers, dimensionWeights
    },
    cta: {
      heading: 'Help us improve this',
      body: '...',
      feedbackLink: 'Share feedback',
      methodologyLink: 'Read the full methodology',
    },
  },
  verification: {
    metadataTitle: 'How Badge Verification Works',
    metadataDescription: '...',
    h1: 'How Badge Verification Works',
    intro: '...',
    sections: {
      what: { heading: '...', body: ['...', '...'] },
      how: { heading: '...', body: ['...', '...'] },
      ttl: { heading: 'Why verification expires', body: '...' },
      api: { heading: 'API access', code: 'GET /api/verify/<hash>', body: ['...', '...'] },
      faq: { /* ... */ },
    },
    tables: {
      verificationFields: { caption: '...', headers: [...], rows: [[...], ...] },
      apiResponses:       { caption: '...', headers: [...], rows: [[...], ...] },
    },
    cta: {
      heading: 'Verify a badge now',
      body: '...',
      verifyLink: 'Open the verifier',
      backHomeLink: 'Back to home',
    },
  },
},
```

**English source:** the *current* About files contain English text — copy them verbatim into `en.ts`. The Spanish translations are written from the English. Any tables or rich-text segments use the segmented pattern.

### 4a.2 — Convert pages to use `getServerT`

For each of the three pages (server components):

```diff
+ import { getServerLocale, getServerT } from '@/lib/i18n';
+ export const dynamic = 'force-dynamic';

- export const metadata: Metadata = { title: 'About', description: '...' };
+ export async function generateMetadata({ searchParams }): Promise<Metadata> {
+   const locale = await getServerLocale((await searchParams).lang);
+   const t = getServerT(locale);
+   return {
+     title: t('about.index.metadataTitle') as string,
+     description: t('about.index.metadataDescription') as string,
+     // OG, Twitter, robots, etc.
+   };
+ }

  export default async function AboutPage({ searchParams }) {
+   const locale = await getServerLocale((await searchParams).lang);
+   const t = getServerT(locale);
    return (
      <div>
        <Navbar />
+       <LocaleSync queryLang={(await searchParams).lang} />
        <main>
-         <h1>About Chapa</h1>
+         <h1>{t('about.index.h1')}</h1>
          {/* rich text — inline the segmented keys */}
-         <p>The new way to <em>quantify</em> your impact ...</p>
+         <p>{t('about.index.intro.before')}<em>{t('about.index.intro.emphasis')}</em>{t('about.index.intro.after')}</p>

          {/* tables — map over the structured key */}
+         {(() => {
+           const tbl = t('about.scoring.tables.qualityComponents') as TableShape;
+           return <Table caption={tbl.caption} headers={tbl.headers} rows={tbl.rows} />;
+         })()}
        </main>
      </div>
    );
  }
```

(Server `t()` returns `string | string[] | object | object[]` — caller narrows via cast or a small typed helper.)

### 4a.3 — Tests

For each page:

- Render in `en` → all section headings present in English.
- Render in `es` → all section headings present in Spanish.
- `generateMetadata` returns the locale-specific title.
- Tables have the right number of rows in both locales.

Add a "no untranslated string" test: a snapshot test that asserts the rendered HTML *does not contain* any of a curated set of "smoking-gun" untranslated phrases (e.g., when rendering in `es`, the literal phrase "Help us improve this" must not appear).

### 4a.4 — Update `parity.test.ts`

Walks the new `about.*` keys; passes after both `en.ts` and `es.ts` are populated.

---

## Definition of done

### Automated

- All three pages have render tests in both locales — green.
- Parity test green (entire `about.*` namespace shape-identical).
- Typecheck/lint green.
- "No untranslated string" test green.

### Manual

- Visit `/about?lang=es` → Spanish; `/about?lang=en` → English.
- Same for `/about/scoring` and `/about/verification`.
- Tables render correctly in both locales (counts match).
- All inline links (archetype links on `/about`, verify link on `/about/verification`, methodology link on `/about/scoring`) work and have correct labels.
- Lighthouse a11y ≥ 95.

### File checklist

- [ ] `apps/web/lib/i18n/dictionaries/en.ts` — about/index, about/scoring, about/verification
- [ ] `apps/web/lib/i18n/dictionaries/es.ts` — same keys translated
- [ ] `apps/web/app/about/page.tsx`
- [ ] `apps/web/app/about/scoring/page.tsx`
- [ ] `apps/web/app/about/verification/page.tsx`
- [ ] Render tests for all three (in both locales)

---

## STOP after this phase if running solo. If running as part of a `/batch` group with 4b–4e, continue.
