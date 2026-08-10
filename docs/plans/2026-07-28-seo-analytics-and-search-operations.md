# Chapa SEO, Analytics, and Search Operations Plan

**Date:** 2026-07-28
**Status:** Planned
**Research:** `docs/research/2026-07-28-seo-and-analytics-current-state.md`
**Reference blueprint:** `/Users/juan/code/spoken-letter/docs/plans/2026-07-27-seo-starter-guide-action-plan.md`
**Integration branch:** `develop`
**Production branch:** `main`

## Outcome

Put a complete, privacy-safe SEO and search-measurement system in place for Chapa:

- reliable metadata, canonicals, crawl controls, sitemap integrity, and structured data;
- a bilingual search-intent resource cluster that fits Chapa’s existing URL architecture;
- Google Analytics 4, Google Search Console, Bing Webmaster Tools, and Microsoft Clarity properties created specifically for Chapa;
- one consent decision governing GA4, Clarity, PostHog, and client analytics;
- sitemap-derived IndexNow submission after the exact production deployment is live;
- a durable aggregate SEO ledger and a repeatable review cadence;
- exact-SHA preview and production verification without changing any other project’s properties, DNS records, secrets, or dashboards.

## Scope decisions

These decisions are final for this plan and leave no clarification markers.

### 1. Preserve Chapa’s canonical URL topology

Chapa will keep one unprefixed public URL per page. The internal `/en/...` and `/es/...` render variants remain implementation details, consistent with `docs/decisions/2026-07-15-i18n-middleware-carve-out.md`.

Consequences:

- every indexable page gets its own unprefixed canonical;
- the proxy matcher remains an exact literal list;
- no locale-prefixed public URLs or `hreflang` alternates are introduced;
- the proxy adds a response `Content-Language` matching the selected locale;
- both English and Spanish copy remain server-rendered, but search engines see one canonical URL for the two negotiated language variants.

The alternative—public `/es` and `/en` URLs with `hreflang`—would allow separate language indexation but reverses the current ADR, changes every public URL, and expands migration/redirect scope. It is not part of this plan.

### 2. Extend the current analytics stack

GA4 and Clarity complement rather than replace PostHog, Vercel Analytics, and Speed Insights:

- PostHog remains the product and operational event stream.
- GA4 measures acquisition, content journeys, and conversion/key events.
- Clarity records only static marketing and resource pages.
- Vercel Analytics and Speed Insights remain the lightweight traffic/performance layer.

All client analytics share one versioned consent state. Server-side operational error reporting remains outside the marketing-consent path because it is part of service security and reliability, not behavioral analytics.

### 3. Use a positive Clarity allowlist

Clarity may run only on:

- `/`
- `/about`
- `/about/scoring`
- `/about/verification`
- `/archetypes/builder`
- `/archetypes/guardian`
- `/archetypes/marathoner`
- `/archetypes/polymath`
- `/archetypes/artificer`
- `/archetypes/balanced`
- `/archetypes/emerging`
- `/resources`
- the four resource-guide paths introduced by Phase 3

Clarity never runs on `/u/*`, `/studio`, `/admin`, `/generating/*`, `/verify*`, `/cli/*`, `/api/*`, or experiment routes. This excludes public personal profiles and every authenticated/product-data surface by default.

The Clarity project uses Strict masking and Consent Mode with cookies disabled until a valid consent signal. Because the allowlist contains only static editorial pages, Chapa does not send an identified user ID to Clarity.

### 4. Use direct first-party components, not Google Tag Manager

GA4 and Clarity are integrated through reviewed Next.js components, following the existing `ClientInstrumentation` seam. This keeps consent, route gating, CSP, event names, and tests in the repository. Google Tag Manager is not introduced.

### 5. Reuse the existing organization accounts

Create new Chapa-specific properties/projects inside the existing accounts that already contain Spoken Letter:

| Tool | Chapa object |
|---|---|
| Google Analytics | Property `Chapa — Production`; web stream `Chapa Web`; URL `https://chapa.thecreativetoken.com`; timezone `Europe/Madrid`; currency `EUR` |
| Google Search Console | Domain property `chapa.thecreativetoken.com` |
| Bing Webmaster Tools | Site imported from the verified Chapa Search Console property |
| Microsoft Clarity | Project `Chapa`; URL `https://chapa.thecreativetoken.com`; industry `Software` |

Do not create a new organization/account unless the selected account lacks permission to create the Chapa object. If that happens, stop and report the permission boundary.

### 6. External mutations stay behind an implementation gate

This plan is not authorization to create vendor properties, add DNS records, set Vercel variables, add GitHub secrets, submit URLs, or release to production.

Phase 5 begins with an explicit owner checkpoint. Once authorized, the agent performs the work through CLI/API first and the signed-in Chrome session second. The agent must resolve the exact account/property before every create or update action and must not select or modify another project.

## Search intent and initial content cluster

Phase 1 collects live Google Autocomplete suggestions for these Chapa-specific seed families:

1. GitHub profile badges and README badges
2. Developer impact and engineering impact
3. Developer portfolio proof and developer metrics
4. Code-review and delivery metrics
5. Multi-platform developer profiles

Phase 3 ships one hub and four initial guides:

| Route | Primary intent |
|---|---|
| `/resources` | Developer-impact and profile-badge learning hub |
| `/resources/github-profile-badge` | How to add and use a live GitHub profile badge |
| `/resources/developer-impact-metrics` | Which developer-impact metrics communicate delivery, quality, consistency, breadth, and craft |
| `/resources/developer-portfolio-badge` | How to show verified developer impact in a portfolio |
| `/resources/code-review-metrics` | How code-review activity contributes to an impact profile |

Autocomplete results refine titles, descriptions, headings, FAQs, and internal anchor text. They do not change these route contracts during implementation.

Every guide:

- is fully translated in English and Spanish;
- uses one H1 and a logical H2/H3 hierarchy;
- links to the relevant existing About, scoring, verification, archetype, and profile surfaces;
- includes visible content that exactly matches any emitted FAQ schema;
- includes `Article` and `BreadcrumbList` JSON-LD;
- has an instrumented, truthful CTA to generate or view a Chapa profile;
- is added literally to the proxy matcher, sitemap, public-surface gate, and Lighthouse set.

## Structured-data design

Reuse `renderJsonLd()` as the only serializer.

Add:

- site-level `Organization`, `WebSite`, and the existing `SoftwareApplication` graph;
- `BreadcrumbList` for About detail pages, archetypes, the resource hub, and guides;
- `Article` for guides;
- `FAQPage` only when the same questions and answers are visibly rendered;
- the existing `Person` profile entity unchanged with respect to private/owner-only fields.

The executable contract is a test suite that parses every JSON-LD script and asserts required properties, URL/canonical alignment, visible FAQ parity, and the absence of confidence, handles in analytics properties, email addresses, tokens, or other private fields.

## Analytics contract

### Consent

`analytics-consent-v1` has three states: `unknown`, `accepted`, and `rejected`.

- GA Consent Mode initializes to denied before GA configuration.
- `accepted` updates GA consent, enables PostHog, mounts Vercel Analytics/Speed Insights, and permits Clarity only on allowlisted routes.
- `rejected` keeps those client analytics inactive.
- Changing an accepted decision to rejected calls each vendor’s opt-out/consent API, clears only Chapa-owned analytics storage/cookies, and reloads once.
- The banner and settings control are keyboard accessible and translated in English and Spanish.

### Event vocabulary

The shared event module sends a typed event to every configured, consented destination without exposing a GitHub handle, display name, email address, repository name, token, or free-text content.

| Event | GA4 key event | Core parameters |
|---|---:|---|
| `login_started` | No | `locale`, `source_surface` |
| `auth_success` | Yes | `locale`, `source_surface` |
| `profile_viewed` | No | `locale`, `profile_context`, `archetype`, `tier` |
| `badge_generation_started` | No | `locale`, `source_surface` |
| `badge_generated` | Yes | `locale`, `archetype`, `tier`, `connected_platform_count` |
| `embed_copied` | Yes | `locale`, `embed_format`, `profile_context` |
| `badge_downloaded` | Yes | `locale`, `profile_context` |
| `share_clicked` | No | `locale`, `share_platform`, `profile_context` |
| `studio_opened` | No | `locale` |
| `config_saved` | Yes | `locale`, `changed_category` |
| `resource_cta_clicked` | No | `locale`, `content_slug`, `cta_destination` |

Current call sites use this vocabulary through one adapter. Where an existing PostHog dashboard uses a different historical name, the PostHog destination maps the canonical event to that single legacy name while GA4 receives the canonical name. The adapter never emits both names to the same destination, and the mapping is pinned by tests and documented in the measurement contract.

### GA4 custom definitions

Register these event-scoped dimensions only after code and tests pin the exact emitted parameter names:

- `locale`
- `source_surface`
- `profile_context`
- `archetype`
- `tier`
- `connected_platform_count`
- `embed_format`
- `share_platform`
- `content_slug`
- `cta_destination`
- `changed_category`

Create these audiences:

- `Generated badge, never copied embed`
- `Opened Studio, never saved configuration`
- `Resource reader, never authenticated`

Create funnel, resource-path, segment-overlap, and weekly-cohort explorations after Realtime confirms event collection.

## Search operations contract

### Search Console

Use a subdomain-scoped Domain property for `chapa.thecreativetoken.com`. DNS verification adds only the exact Google TXT challenge record at the authoritative DNS provider. Read the zone first, write one record, verify with `dig`, then verify ownership. Submit `https://chapa.thecreativetoken.com/sitemap.xml`, inspect the landing page, one guide, one archetype, and one valid public profile, and link the property to the Chapa GA4 web stream.

### Bing Webmaster Tools

Import only the verified Chapa Search Console property. Submit the sitemap, confirm robots parsing, run URL Inspection on the same baseline URLs, configure Site Scan to cover the full sitemap count, and activate IndexNow. Leave crawl control at its default.

### Clarity

Create only the `Chapa` project, set Strict masking, disable cookies by default/enable Consent Mode, record the generated project ID, and install it through the repository component. Create marketing-content segments only after production verification shows allowlisted sessions and zero recordings from excluded routes.

## IndexNow design

Generate one 32-character hexadecimal Chapa key during Phase 6. Commit its public verification file under `apps/web/public/` and keep the same value in the submission module.

The submission command:

1. fetches the live production sitemap;
2. parses only `<loc>` elements;
3. deduplicates URLs;
4. rejects empty batches and every off-host URL;
5. verifies the public key file before submission;
6. posts the batch to `https://api.indexnow.org/indexnow`;
7. accepts HTTP 200 or 202 only;
8. emits no secret or personal data.

The workflow is declared for `main` and manual dispatch, but the submission job is fail-closed behind the repository variable `CHAPA_INDEXNOW_ENABLED == "true"`. The variable is absent/false when Phase 6 lands. Phase 8 may enable it only after explicit IndexNow authorization. The job polls `/api/version` until production reports the triggering SHA, then reads the live sitemap and submits it. It does not use a fixed sleep as release proof and never submits for `develop`.

## Durable SEO ledger

Create `docs/analytics/seo-ledger.jsonl` and `docs/analytics/README.md`.

One scheduled workflow appends a daily aggregate record only when the repository variable `CHAPA_SEO_LEDGER_ENABLED == "true"`. The variable is absent/false when the workflow lands and Phase 8 enables it only after explicit authorization. Each record contains:

- GA4 users, sessions, organic sessions, key events, and resource landing-page sessions;
- Search Console clicks, impressions, CTR, position, top query groups, and top landing pages;
- Bing clicks, impressions, indexed-page count, crawl issues, and IndexNow status where the API exposes them;
- Clarity sessions, dead-click rate, rage-click rate, scroll depth, and allowlisted route coverage.

Each source degrades independently. A provider failure writes an explicit source status without discarding the other providers’ metrics. The ledger stores aggregate counts and route/query groups only—never user identifiers, session replay payloads, raw query exports, credentials, or profile handles.

A weekly report compares the last complete seven-day period with the prior period. A monthly review covers indexation, search queries, content performance, audience/key-event conversion, Clarity friction, and content-refresh candidates.

## Phase map

| Phase | Name | Dependency | Batch |
|---:|---|---|---|
| 1 | Search-intent baseline and executable SEO contract | None | No |
| 2 | Technical SEO, canonicals, sitemap, robots, and public-surface integrity | Phase 1 | No |
| 3 | Structured data and bilingual resource cluster | Phase 2 | `[batch-eligible]` with Phase 6 |
| 4 | Unified consent, GA4, Clarity, and typed events | Phase 2 | No |
| 5 | Chapa-only vendor property creation and configuration | Phase 4; explicit authorization | No |
| 6 | Sitemap-derived IndexNow and exact-deployment workflow | Phase 2 | `[batch-eligible]` with Phase 3 |
| 7 | Aggregate SEO ledger and review operations | Phases 5 and 6 | No |
| 8 | Release, production verification, initial submissions, and handoff | Phases 3–7 | No |

Phase details:

- `docs/plans/2026-07-28-seo-analytics-and-search-operations-phases/phase-1.md`
- `docs/plans/2026-07-28-seo-analytics-and-search-operations-phases/phase-2.md`
- `docs/plans/2026-07-28-seo-analytics-and-search-operations-phases/phase-3.md`
- `docs/plans/2026-07-28-seo-analytics-and-search-operations-phases/phase-4.md`
- `docs/plans/2026-07-28-seo-analytics-and-search-operations-phases/phase-5.md`
- `docs/plans/2026-07-28-seo-analytics-and-search-operations-phases/phase-6.md`
- `docs/plans/2026-07-28-seo-analytics-and-search-operations-phases/phase-7.md`
- `docs/plans/2026-07-28-seo-analytics-and-search-operations-phases/phase-8.md`

## Verification policy

Each implementation phase follows red-green-refactor, plan-compliance review, `/simplify`, and sequential verification.

Minimum local sequence after relevant phases:

```bash
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run check:vercel-config
pnpm run build
```

Add targeted commands for:

- autocomplete report generation;
- public-surface verification;
- JSON-LD parsing and visible-content parity;
- analytics dimension/event-name ratchets;
- consent and Clarity route allowlist behavior;
- IndexNow parser, host validation, key-file parity, and response handling;
- SEO ledger schema and provider-degradation behavior.

Manual/browser verification is separate from automated evidence:

- view-source metadata, canonical, JSON-LD, H1, and `Content-Language`;
- cookie/consent behavior before acceptance, after acceptance, after rejection, and after changing the decision;
- GA4 DebugView/Realtime events with exact parameters;
- Clarity allowlisted recording plus excluded-route non-recording;
- Search Console and Bing ownership, sitemap, robots, and URL Inspection;
- Rich Results Test for SoftwareApplication, Article/Breadcrumb, FAQ, and Person samples;
- exact-SHA preview and production identity through `/api/version`.

## Rollback

- Code/config rollback: revert the phase commit through the normal branch workflow.
- Analytics rollback: remove the Chapa measurement/project IDs from Vercel and redeploy; do not delete vendor properties.
- Consent rollback: fail closed—client analytics stay disabled when configuration or consent state is invalid.
- Clarity rollback: disable the Chapa project or remove only the Chapa project ID; leave all other projects untouched.
- Search Console/Bing rollback: stop submissions and preserve verified properties/history; do not delete properties as a first response.
- IndexNow rollback: disable the Chapa workflow and leave the public key file harmlessly in place.
- Ledger rollback: disable the scheduled workflow; retain already committed aggregate rows.

No rollback step deletes another project, rewrites shared DNS zones broadly, rotates organization-wide credentials, or removes historical vendor data.

## Design-system applicability

The cookie banner, analytics settings control, and resource pages are user-facing UI and must use `docs/design-system.md`:

- JetBrains Mono headings and Plus Jakarta Sans body text;
- the existing violet/amber token system;
- light and dark themes;
- visible focus states and full keyboard support;
- bilingual copy with dictionary parity;
- no new generic component styling outside existing primitives.

Vendor dashboards, scripts, workflows, and operational documents do not require design-system review.

## Official operational references

- Google Analytics property and web-stream setup: <https://support.google.com/analytics/answer/14183469>
- Search Console property types and verification: <https://support.google.com/webmasters/answer/34592>
- Search Console sitemap submission: <https://support.google.com/webmasters/answer/7451001>
- GA4 and Search Console linking: <https://support.google.com/analytics/answer/10737381>
- Bing site import and verification: <https://www.bing.com/webmasters/help/add-and-verify-site-12184f8b>
- Clarity getting started: <https://learn.microsoft.com/en-au/clarity/setup-and-installation/getting-started>
- Clarity masking: <https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-masking>
- Clarity Consent Mode: <https://learn.microsoft.com/en-us/clarity/setup-and-installation/consent-mode>
- IndexNow protocol: <https://www.indexnow.org/documentation>

## Out of scope

- Changing the public URL topology to `/en` and `/es`
- Paid search, Google Ads, Microsoft Ads, or revenue attribution
- Replacing PostHog or Vercel analytics
- Recording public profiles, authenticated pages, or user-authored content in Clarity
- Sending GitHub handles, emails, repository names, tokens, confidence reasons, or free text to analytics
- Organization/team SEO pages, pricing pages, or claims unsupported by current Chapa behavior
- Deleting, editing, or reusing another project’s vendor property, DNS verification record, tracking ID, IndexNow key, or credential
