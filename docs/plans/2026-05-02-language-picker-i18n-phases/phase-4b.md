# Phase 4b — Archetype guides (7 pages)

**Status:** [batch-eligible after Phase 2]
**Depends on:** Phase 2 merged.
**Worktree:** `.worktrees/i18n-archetypes` or `../chapa-i18n-archetypes`.
**Files affected:** `apps/web/app/archetypes/{builder,guardian,marathoner,polymath,artificer,balanced,emerging}/page.tsx`. No overlap with Phase 4a/4c/4d/4e.

---

## Goal

Localize the seven archetype guide pages. Each page has the same structural shape (~25–35 strings: terminal command line, h1 with colored span, "Dominant dimension" line, badge `aria-label`, 4–6 essay paragraphs, Key signals subsection, footer links). Translate them as a uniform namespace under `archetypes.<key>.*`.

---

## Tasks

### 4b.1 — Define a per-archetype shape

Add to `dictionaries/en.ts` (mirrored in `es.ts`):

```ts
archetypes: {
  // 7 entries: builder, guardian, marathoner, polymath, artificer, balanced, emerging
  // Each entry has the same shape — parity test will catch divergence.
  builder: {
    displayName: 'The Builder',
    metadataTitle: 'The Builder — Chapa archetype',
    metadataDescription: '...',
    terminalCommand: 'chapa archetype builder',
    h1Before: 'The ',
    h1Highlight: 'Builder',
    dominantDimensionLabel: 'Dominant dimension:',
    dominantDimensionValue: 'Delivery',
    badgeAriaLabel: 'Example Chapa badge for The Builder archetype',
    essay: ['paragraph 1...', 'paragraph 2...', /* etc. */],   // string[]; render as <p> per entry
    sectionsHowChapaIdentifies: 'How Chapa identifies a Builder',
    sectionsWhatLooksLike: 'What a Builder looks like in practice',
    sectionsRadarShape: 'The Builder’s radar shape',
    keySignalsHeading: 'Key signals',
    keySignals: [
      { tier: 'PRIMARY',    label: 'High Delivery',    description: '...' },
      { tier: 'SECONDARY',  label: 'Steady Consistency', description: '...' },
      { tier: 'SUPPORTING', label: 'Moderate Breadth', description: '...' },
    ],
    backLink: '← Back to features',
    methodologyLink: 'Full scoring methodology →',
  },
  guardian:    { /* same shape, "Quality Champion" displayName */ },
  marathoner:  { /* ... */ },
  polymath:    { /* ... */ },
  artificer:   { /* ... */ },
  balanced:    { /* ... */ },
  emerging:    { /* ... */ },
},
```

**English source** = current page text (verbatim). **Spanish source** = newly written, terse, matches the existing tone in `SPANISH_PUBLIC_COPY.landing.archetypes`.

### 4b.2 — Extract a shared archetype-page helper (optional but recommended)

Each archetype page is structurally identical. Create a shared server component `apps/web/app/archetypes/_components/ArchetypePage.tsx` that takes an archetype key and reads the right namespace. The 7 page files become thin wrappers:

```tsx
// apps/web/app/archetypes/builder/page.tsx
import { ArchetypePage } from '../_components/ArchetypePage';
export const dynamic = 'force-dynamic';
export async function generateMetadata({ searchParams }) {
  return generateArchetypeMetadata('builder', searchParams);
}
export default async function BuilderPage({ searchParams }) {
  return <ArchetypePage archetypeKey="builder" searchParams={searchParams} />;
}
```

This collapses 7 × ~180 LOC into one shared component + 7 × ~10 LOC wrappers and dramatically simplifies the diff.

### 4b.3 — Per-archetype tests

- Render each archetype page in `en` → expected English headline.
- Render each archetype page in `es` → expected Spanish headline.
- Parity test: every archetype object has the same shape.

### 4b.4 — Add archetype-specific error/loading boundaries

If `apps/web/app/archetypes/error.tsx` / `loading.tsx` use shared keys (`common.tryAgain`, etc.) — these come from Phase 2's chrome additions. No new keys needed; just rewire.

---

## Definition of done

### Automated

- 7 archetype pages have render tests in both locales — green.
- Parity test passes across all 7 archetype namespaces.
- Typecheck/lint green.

### Manual

- Visit each `/archetypes/<key>?lang=es` and `?lang=en` → both render correctly.
- The colored archetype name in h1 still uses the right archetype color token (not a translation concern; ensure the JSX wraps `h1Highlight` with the existing `text-archetype-<key>` class).
- Footer links work in both locales.

### File checklist

- [ ] `apps/web/lib/i18n/dictionaries/en.ts` — archetypes namespace
- [ ] `apps/web/lib/i18n/dictionaries/es.ts` — same keys translated
- [ ] `apps/web/app/archetypes/_components/ArchetypePage.tsx` (new shared component)
- [ ] 7 page files reduced to thin wrappers
- [ ] Render tests for all 7 in both locales

---

## STOP after this phase if running solo.
