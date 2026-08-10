# Phase 3 — Structured Data and Bilingual Resource Cluster

**Status:** Planned
**Batch eligibility:** `[batch-eligible]` with Phase 6 after Phase 2
**Depends on:** Phases 1 and 2

## Objective

Add a truthful structured-data library and the initial bilingual Chapa resource hub/topic cluster without changing the canonical URL topology.

## Files

Create:

- `apps/web/components/seo/JsonLd.tsx`
- `apps/web/components/seo/JsonLd.test.tsx`
- `apps/web/app/[locale]/resources/page.tsx`
- `apps/web/app/[locale]/resources/_components/ResourceArticle.tsx`
- `apps/web/app/[locale]/resources/github-profile-badge/page.tsx`
- `apps/web/app/[locale]/resources/developer-impact-metrics/page.tsx`
- `apps/web/app/[locale]/resources/developer-portfolio-badge/page.tsx`
- `apps/web/app/[locale]/resources/code-review-metrics/page.tsx`
- `apps/web/app/[locale]/resources/resources-metadata.test.ts`
- `apps/web/app/[locale]/resources/resources-render.test.tsx`
- `apps/web/app/[locale]/resources/resources-schema.test.tsx`
- `apps/web/app/[locale]/resources/resources-links.test.ts`

Modify:

- `apps/web/app/layout.tsx`
- `apps/web/app/[locale]/about/page.tsx`
- `apps/web/app/[locale]/about/scoring/ScoringMethodologyContent.tsx`
- `apps/web/app/[locale]/archetypes/_components/ArchetypePage.tsx`
- `apps/web/app/LandingContent.tsx`
- `apps/web/lib/i18n/dictionaries/en.ts`
- `apps/web/lib/i18n/dictionaries/es.ts`
- `apps/web/proxy.ts`
- `apps/web/proxy.test.ts`
- `apps/web/app/sitemap.ts`
- `apps/web/app/sitemap.test.ts`
- `lighthouserc.json`
- `apps/web/app/llms.txt/route.ts`
- `apps/web/app/llms-full.txt/route.ts`

## Implementation

1. Build reusable JSON-LD components on top of `renderJsonLd()`:
   - `SiteJsonLd` for `Organization`, `WebSite`, and `SoftwareApplication`;
   - `BreadcrumbJsonLd`;
   - `ArticleJsonLd`;
   - `FaqJsonLd`.
2. Keep `Person` JSON-LD on profiles and add regression coverage that confidence and owner-only fields are absent.
3. Render visible FAQ content from the same typed data passed to `FaqJsonLd`.
4. Build `/resources` and the four guide routes from the exact route contract in the main plan.
5. Use Phase 1 suggestions to refine copy while keeping every claim grounded in current Chapa behavior and `docs/impact-v6.md`.
6. Add literal route entries to `proxy.ts`, sitemap, Lighthouse, and the public-surface manifest.
7. Add internal links in the exact modified files listed above:
   - landing/About to the resource hub;
   - hub to all guides;
   - guides to relevant scoring, verification, archetype, and profile-generation surfaces;
   - scoring and archetype shared content back to the corresponding guides.
8. Land a typed resource-CTA callback contract in the shared guide component. Phase 4 binds that contract to `resource_cta_clicked` without changing guide semantics.
9. Extend `llms.txt` and `llms-full.txt` with the new truthful resource routes and topics.

## Pseudocode

```text
resource = {
  slug,
  localized title/description/headings/body/faq,
  publishedAt,
  updatedAt,
  relatedInternalLinks,
  ctaDestination
}

render:
  metadata(canonical unprefixed path, locale)
  Article + Breadcrumb JSON-LD
  FAQ JSON-LD only when visible FAQ list is nonempty
  semantic article with one H1
  tracked CTA
```

## Automated success criteria

- JSON-LD tests parse every script as JSON and validate required type-specific properties.
- FAQ tests prove JSON-LD question/answer text equals visible text.
- Injection tests prove all dynamic/localized values pass through `renderJsonLd()`.
- Every guide has one H1, logical heading order, canonical, localized metadata, internal links, Article/Breadcrumb schema, and CTA.
- Dictionary parity, public-surface, sitemap, proxy, LLM route, and Lighthouse config tests pass.
- Typecheck, lint, test, `check:public-surface`, and build pass sequentially.

## Manual success criteria

- Editorial review in English and Spanish.
- Desktop/mobile/light/dark visual review against `docs/design-system.md`.
- Keyboard/focus review of hub cards, internal links, FAQs, and CTAs.
- Rich Results Test for the home graph, one guide, one FAQ-bearing guide, one archetype breadcrumb, and one profile.

## Stop gate

Commit and stop after the content/schema checkpoint. Do not publish, request indexing, or change vendor dashboards.
