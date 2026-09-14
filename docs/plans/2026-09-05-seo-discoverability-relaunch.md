# Chapa SEO and discoverability plan for the relaunch

**Date:** 2026-09-05
**Status:** Approved 2026-09-05 with D1 option A. Phase 0 complete the same day (vendor objects and IDs in `docs/analytics/README.md`). Phases 1+ wait for the hackathon freeze to lift on 2026-09-21.
**Source baseline:** `develop` @ `c1ce31cb`
**Supersedes:** `docs/plans/2026-07-28-seo-analytics-and-search-operations.md` (never implemented; its research at `docs/research/2026-07-28-seo-and-analytics-current-state.md` is partly stale: the default locale is now `en` (#1201), canonicals shipped in #1127, `potentialAction` JSON-LD shipped, and the palette is jade).
**Sibling plans this one must sequence against:** `2026-09-05-chapa-redesign.md` (new UI), `2026-09-05-scoring-relaunch.md` (v7 scoring, phase 13 rewrites every public claim).

## Outcome

After this plan, Chapa is:

- **Indexed** by Google and Bing (and therefore DuckDuckGo, Yahoo, Ecosia, Brave's fallback) with a verified property in each, the sitemap submitted, and every indexable page inspected once.
- **Measured** in Google Analytics 4 (acquisition, key events), Google Search Console and Bing Webmaster Tools (queries, impressions, indexation), Microsoft Clarity (friction on marketing pages only), on top of the existing PostHog, Vercel Analytics and Speed Insights.
- **Consented**: one banner, one stored decision, governing GA4, Clarity, PostHog and Vercel client analytics. Chapa is operated from Spain, so this is not optional.
- **Findable for the right queries**: a small bilingual guide cluster targeting the search intents Chapa actually answers, with structured data that earns rich results.
- **Fast to re-index**: IndexNow pings Bing on every production release, bound to the exact deployed SHA.
- **Governed by tests**: every indexable route must have a title, description, canonical, OG image and JSON-LD that parses; every private route must be `noindex`. A page cannot ship half-tagged.

## What already exists (do not rebuild)

| Surface | Where | State |
|---|---|---|
| `robots.txt` | `apps/web/app/robots.ts` | Allows `/` and badge SVG; disallows `/api/`, `/admin/`, `/experiments/`, `/generating/`, `/cli/`; points at the sitemap. Missing: `/settings/`, `/studio` (owner-only), `/verify/` hashes (decide, see Phase 1). |
| `sitemap.xml` | `apps/web/app/sitemap.ts` | 6 static pages + 7 archetypes + every registered user's `/u/:handle`. Two defects: static entries stamp `lastModified: new Date()` on every request (a lie search engines learn to ignore), and profile entries use `registeredAt` (never changes). |
| Root metadata | `apps/web/app/layout.tsx:47-82` | `metadataBase`, title template, description, manifest, SVG icon, OG + Twitter cards with `/og-image`. |
| Per-page metadata + canonical | all 13 `app/[locale]/**/page.tsx`, `app/u/[handle]/page.tsx:63-113`, `/verify`, `/studio`, `/settings` | Canonicals on every content page (#1127). Share page has canonical + dynamic OG image with cache-busting version. |
| `noindex` | `/settings`, `/admin`, `/generating/*`, `/cli/authorize`, `/coming-soon`, `/experiments/*`, `/verify` (index:false, follow:true), `/studio?demo=1` | Correct. `/verify/[hash]` is NOT noindexed and NOT in the sitemap, so it sits in limbo. |
| JSON-LD | `apps/web/lib/structured-data.ts` (SoftwareApplication with `potentialAction`) on the root layout; `Person` on `/u/:handle` (confidence redacted, pinned by test) | Missing `Organization`, `WebSite`, `BreadcrumbList`, `FAQPage`, `Article`. |
| Locale | `apps/web/proxy.ts` rewrites unprefixed URLs to `/[locale]/...`; `DEFAULT_LOCALE = 'en'` (`lib/i18n/types.ts:15`) | One URL serves EN or ES depending on cookie / `Accept-Language`. No `Content-Language`, no `Vary`, no `hreflang`. Crawlers send no cookie and usually no `Accept-Language`, so **search engines only ever see the English page**. |
| Analytics | `components/PostHogProvider.tsx:24-31` (lazy, `capture_pageview: false`, localStorage persistence), `components/ClientAnalytics.tsx:7-12` (Vercel Analytics + Speed Insights) | No GA4, no Clarity, no consent gate. PostHog persists without consent today. |
| CSP | `apps/web/next.config.ts:17-45` | Strict. GA4 and Clarity hosts are not allowed; adding them is a deliberate change in Phase 3. |
| Lighthouse CI | `lighthouserc.json:7-12`, `.github/workflows/lighthouse.yml` | Audits `/`, `/about`, `/about/scoring`, `/u/juan294` with the SEO category on. Extend, don't replace. |
| LLM surfaces | `apps/web/app/llms.txt/route.ts`, `llms-full.txt`, WebMCP `SITE_TOOL_MAP` | Exist. Their copy describes v6 scoring and must move with scoring-relaunch phase 13. |
| Vendor accounts | none for Chapa | The organisation's Google and Microsoft accounts already hold Spoken Letter properties. Chapa gets its own property/site/project inside those accounts, never a shared one. |

## Decisions

### D1. Keep one canonical URL per page; Spanish indexation is the open decision

Today `/about` is one URL with two negotiated bodies. That is fine for humans and invisible to search engines for Spanish. There are two honest options:

| Option | What ships | Cost | What you get |
|---|---|---|---|
| **A. Keep topology, declare it** (recommended for the relaunch) | `Content-Language` + `Vary: Accept-Language, Cookie` headers from `proxy.ts`; English is the indexed variant; record the ES gap in `docs/accepted-risks.md` with a revisit trigger | Two headers, one test | Zero URL change during a relaunch that is already large. English is where the README-badge audience searches. |
| **B. Public `/es/*` URLs with `hreflang`** | `/es/about` becomes a real public URL; `/about` stays English canonical; `alternates.languages` on all 13 content pages; sitemap doubles; `LanguageSwitcher` navigates instead of reloading; ADR `2026-07-15-i18n-middleware-carve-out.md` is reversed | A routing change touching proxy, sitemap, switcher, every content page's metadata, and the redesign's copy contract | Spanish queries can rank. Roughly doubles indexable pages. |

**Recommendation: A now, B as its own plan after the relaunch has settled**, triggered when Search Console shows Spanish-language query impressions landing on English pages, or when you decide Spanish developers are a target segment. The rest of this plan is written for A and does not block B later.

### D2. Direct components, no Google Tag Manager

GA4 loads through `@next/third-parties/google`'s `GoogleAnalytics` component and Clarity through one `next/script` component. Consent, route allowlists, CSP entries and event names stay in the repository under tests. GTM would move them into a dashboard nobody reviews.

### D3. Clarity runs only on static marketing pages

Allowlist: `/`, `/about`, `/about/scoring`, `/about/verification`, the seven `/archetypes/*` pages, `/resources` and its guides. Never `/u/*` (other people's names and numbers), `/studio`, `/settings`, `/admin`, `/verify*`, `/generating/*`, `/cli/*`. Strict masking, cookies off until consent, no identified user ID.

### D4. One consent decision, fail closed

`chapa-analytics-consent` with `unknown | accepted | rejected`. Nothing marketing-side loads until `accepted`. Rejecting after accepting calls each vendor's opt-out, clears only Chapa-owned analytics storage, and reloads once. Server-side error capture (`captureServerError`) is operational, not behavioural, and stays outside consent. PostHog joins the gate (it currently persists without one).

### D5. Analytics never receive a GitHub handle, name, email, repo name or free text

Already the PostHog convention; GA4 and Clarity inherit it through a single typed event adapter. `profile_context` is `owner | visitor`, `archetype` and `tier` are enums.

### D6. Copy truth is owned by the scoring relaunch

`SoftwareApplication.description`, meta descriptions, `llms.txt` and the guides all describe how scoring works. Scoring-relaunch phase 13 (S17, #1312) rewrites those claims for v7. Phases 2 and 4 below land **after** S17 or are written by the same owner, so SEO surfaces never advertise a formula the badge no longer uses.

### D7. External mutations happen only with explicit authorisation, one vendor at a time

Creating properties, adding a DNS TXT record, setting Vercel env vars, submitting a sitemap and enabling IndexNow are each a named checkpoint. The agent reads the current state before every write, targets Chapa's object only, and never touches Spoken Letter's.

## Sequencing against the hackathon freeze and the relaunch

Nothing in this repository may be committed or deployed until WebMCP judging ends on 2026-09-21 17:00 PT. That splits the work cleanly:

**Can start now (no repo changes, no deploy):** Phase 0. Google Analytics property, Search Console domain property with DNS verification, Bing import, Clarity project, sitemap submission, baseline URL inspection. Production already serves `robots.txt`, `sitemap.xml`, canonicals and JSON-LD, and the relaunch keeps every public URL, so indexing today's pages seeds domain history rather than wasting it. The only visible effect on the live site is nothing.

**After the freeze, alongside the redesign:** Phases 1, 3, 5 (technical hygiene, consent + analytics, IndexNow). They touch headers, a banner and a workflow, not page bodies.

**After scoring-relaunch phase 13 (S17):** Phases 2 and 4 (structured data copy, guide cluster). They are content.

**After the relaunch release:** Phase 6 (vendor configuration that needs live events), Phase 7 (ledger and cadence).

## Phases

| Phase | Name | Depends on | Repo changes | Batch |
|---:|---|---|---|---|
| 0 | Vendor properties, ownership, first submission | authorisation | none | can run during the freeze |
| 1 | Technical SEO hygiene and the public-surface contract | freeze lifted | yes | `[batch-eligible]` with 3 and 5 |
| 2 | Structured data | 1, scoring S17 | yes | no |
| 3 | Consent, GA4, Clarity, typed events, CSP | freeze lifted | yes | `[batch-eligible]` with 1 and 5 |
| 4 | Bilingual guide cluster (`/resources`) | 1, 2, redesign content shell, scoring S17 | yes | no |
| 5 | IndexNow bound to the deployed SHA | freeze lifted | yes | `[batch-eligible]` with 1 and 3 |
| 6 | Post-release vendor configuration and production verification | 3, 4, 5 released | dashboards only | no |
| 7 | Search-operations cadence and ledger | 6 | small | no |

### Phase 0. Vendor properties, ownership, first submission

Owner: user + agent in the signed-in Chrome session and the DNS provider. Checkpoint before every write.

1. **Google Analytics 4**: property `Chapa`, web stream `Chapa Web`, URL `https://chapa.thecreativetoken.com`, timezone `Europe/Madrid`, currency `EUR`. Enhanced measurement on except "form interactions". Record the `G-` measurement ID. Do not install the tag yet (Phase 3 does that with consent).
2. **Google Search Console**: Domain property `chapa.thecreativetoken.com`. Read the zone at the DNS provider, add exactly one TXT record, confirm with `dig TXT chapa.thecreativetoken.com`, verify. Submit `https://chapa.thecreativetoken.com/sitemap.xml`. Run URL Inspection on `/`, `/about/scoring`, `/archetypes/builder` and `/u/juan294`; request indexing for the first three. Link the property to the GA4 stream.
3. **Bing Webmaster Tools**: "Import from Google Search Console" (no second verification). Submit the sitemap. Confirm robots.txt parses. Run URL Inspection on the same four URLs. Generate an IndexNow key here and keep it for Phase 5; do not enable anything.
4. **Microsoft Clarity**: project `Chapa`, URL above, industry Software. Set masking to Strict and enable Consent Mode (cookies off by default). Record the project ID. Do not install yet.
5. **Baseline record**: `docs/analytics/README.md` with the property IDs (IDs are public in any case), who owns each, the date, and the URL-inspection results. This file is written locally and committed after the freeze.

Verification: each vendor shows Chapa's object with the right URL; Search Console reports the sitemap as "Success" with the expected URL count (6 + 7 + users); Bing shows the import; nothing in Spoken Letter's properties changed (screenshot the property lists before and after).

### Phase 1. Technical SEO hygiene and the public-surface contract

Files: `apps/web/app/sitemap.ts`, `apps/web/app/robots.ts`, `apps/web/proxy.ts`, `apps/web/app/verify/[hash]/page.tsx`, `apps/web/app/layout.tsx`, `lighthouserc.json`, one new contract test.

1. **Sitemap truthfulness.** Static entries get a build-time `lastModified` (the deployment's commit date via `lib/env.ts`, or omit the field). Profile entries use the handle's latest `metrics_snapshots` date, which changes daily and is the honest signal. Cap the profile list at Google's 50,000-URL / 50 MB limit by paginating into a sitemap index when `dbGetUsers` grows past a threshold; today one file is fine, so the test asserts the count and the threshold rather than building the index prematurely.
2. **`robots.txt` completeness.** Disallow `/settings`, `/studio`, `/verify/` (hash pages), `/u/*/og-image`. Keep `/u/*/badge.svg` allowed: it is what people embed and it carries the handle's canonical link in `llms.txt`.
3. **`/verify/[hash]`**: `robots: { index: false, follow: true }` with a canonical to itself. A verification record is not a landing page; it is proof for someone who already has the link.
4. **Locale declaration (D1 option A).** `proxy.ts` sets `Content-Language: en|es` and `Vary: Accept-Language, Cookie` on rewritten responses. Google treats these as hints only, but Bing and every cache honour `Vary`. One test per header.
5. **Site verification fallback.** `metadata.verification.google` and `.other['msvalidate.01']` in `app/layout.tsx`, read from `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` and `NEXT_PUBLIC_BING_SITE_VERIFICATION` through `lib/env.ts`, empty by default. DNS verification is primary; this survives a DNS migration.
6. **Public-surface contract test** (`apps/web/app/public-surface.contract.test.ts`). Renders `generateMetadata` for every route in a literal list and asserts: indexable routes have title, description, canonical equal to the route, OG image and no `noindex`; private routes have `noindex`; the sitemap contains exactly the indexable set; the proxy matcher, the sitemap's static list and the Lighthouse URL list agree. Adding a page without updating all three fails CI. This is the gate that makes the rest of the plan hold.
7. **Lighthouse**: add `/about/verification`, one archetype page and (in Phase 4) `/resources` to `lighthouserc.json`; keep the SEO category assertion at 1.0 for content pages.
8. **Meta description length.** Bing's URL inspection on 2026-09-05 flagged the root description (`app/layout.tsx`, about 200 characters) as too long; its limit is 160. Trim it, and have the Phase 1 contract test assert every indexable route's description is 50 to 160 characters so this cannot recur on the 13 content pages or the guides.
9. **Redirect and status audit** (script, not code): `www.`, `http://`, trailing slashes and uppercase handles all resolve to one canonical with a single 301 hop; `/u/does-not-exist` returns a real 404 status, not a 200 with a "not found" body. Record results in `docs/analytics/README.md`.

Verification: `pnpm run typecheck; pnpm run lint; pnpm run test; pnpm run build`; `curl -sI` for the header and redirect matrix on a preview deployment; Search Console URL Inspection on the preview is not possible, so inspect after release in Phase 6.

### Phase 2. Structured data

Files: `apps/web/lib/structured-data.ts`, `apps/web/lib/jsonld.ts` (keep `renderJsonLd` as the only serializer), the 13 content pages, a new `structured-data.contract.test.ts`.

1. **Site graph on the root layout**: `Organization` (name Chapa, `url`, `logo` `/logo-512.png`, `sameAs` the GitHub repo), `WebSite` (`name`, `url`, `inLanguage: ["en","es"]`), and the existing `SoftwareApplication`, all in one `@graph` with stable `@id`s so `Person` on profiles can reference the publisher.
2. **`BreadcrumbList`** on `/about/*`, `/archetypes/*`, `/resources/*`.
3. **`FAQPage`** on `/about/scoring` only when the same Q&A is visibly rendered on the page (Google removed FAQ rich results for most sites in 2023; ship it for Bing and for the AI answer engines that read it, but never as hidden text).
4. **`Person`** on `/u/:handle` stays as is; confidence redaction stays pinned by the existing test.
5. **Contract test**: parse every emitted `<script type="application/ld+json">`, validate required properties per type, assert the `url` fields equal the page canonical, assert FAQ text equals visible text, and assert the forbidden-field list (`confidence`, `confidencePenalties`, emails, tokens, handles inside analytics properties) is absent.
6. **Copy**: `SoftwareApplication.description`, `featureList` and `keywords` are rewritten by the same owner as scoring S17, in the same PR, so JSON-LD, `llms.txt` and the About page describe one formula.

Verification: Rich Results Test and Schema.org validator on the preview for one page of each type; the contract test in CI.

### Phase 3. Consent, GA4, Clarity, typed events, CSP

Files: `apps/web/components/ConsentBanner.tsx`, `apps/web/lib/analytics/consent.ts`, `apps/web/lib/analytics/events.ts` (the adapter), `apps/web/components/GoogleAnalytics.tsx`, `apps/web/components/ClarityScript.tsx`, `apps/web/components/PostHogProvider.tsx`, `apps/web/components/ClientAnalytics.tsx`, `apps/web/next.config.ts`, `apps/web/lib/env.ts`, both dictionaries, `/settings` (a "Analytics" row with the current decision and a change control).

1. **Consent state** (D4): storage key, three states, a `useConsent()` hook, and a `ConsentBanner` that follows `docs/design-system.md` (JetBrains Mono heading, jade CTA with `bg-amber-dark` for white text, keyboard reachable, EN/ES). The banner renders on every route but loads no vendor until accepted.
2. **GA4** via `@next/third-parties/google`: `gtag('consent','default', {analytics_storage:'denied', ad_storage:'denied'})` before config; `update` on accept. Measurement ID from `NEXT_PUBLIC_GA_MEASUREMENT_ID`. Page views on for GA4 only (PostHog keeps `capture_pageview: false`).
3. **Clarity** via one `next/script` component gated on consent AND the D3 route allowlist, with `clarity('consent')` called only on `accepted`. Project ID from `NEXT_PUBLIC_CLARITY_PROJECT_ID`.
4. **PostHog and Vercel Analytics** move behind the same gate. Vercel Speed Insights is performance telemetry with no cookie; keep it outside consent and say so in the privacy page.
5. **Typed event adapter**: one `track(event, params)` that fans out to every configured, consented destination. Vocabulary (GA4 key events marked): `login_started`, `auth_success`*, `profile_viewed`, `badge_generation_started`, `badge_generated`*, `embed_copied`*, `badge_downloaded`*, `share_clicked`, `studio_opened`, `config_saved`*, `resource_cta_clicked`. Existing `trackEvent` call sites in `BadgeToolbar.tsx`, `CopyButton.tsx`, `ClientErrorReporter.tsx` and the agent-traffic tracking from #1262 route through it. Where a PostHog dashboard depends on a historical name, the PostHog destination maps to that one legacy name and the mapping is a test fixture.
6. **CSP** additions in `next.config.ts`: `script-src` + `https://www.googletagmanager.com https://www.clarity.ms`; `connect-src` + `https://*.google-analytics.com https://*.analytics.google.com https://*.clarity.ms`; `img-src` + `https://www.google-analytics.com`. Document the widening in `docs/accepted-risks.md`. Vercel env vars added for production and preview only after the code is on `develop`.
7. **Privacy page**: list GA4, Clarity, PostHog, Vercel Analytics, what each stores, and how to withdraw. EN and ES.

Tests: consent state machine; nothing loads in `unknown`/`rejected`; Clarity never mounts on `/u/*` even when accepted; adapter parameter allowlist rejects any string that matches a handle pattern; CSP string contains exactly the added hosts.

Verification: GA4 DebugView shows events with exact parameter names from the preview; Clarity dashboard shows a session from `/about` and none from `/u/juan294`; the banner passes axe and keyboard checks; bundle-size gate stays under 350 KB (both vendor scripts are external, not bundled).

### Phase 4. Bilingual guide cluster

Files: `apps/web/app/[locale]/resources/page.tsx` and four guide routes, `apps/web/proxy.ts` matcher, `sitemap.ts`, dictionaries, `lighthouserc.json`, the Phase 1 contract list.

Routes and primary intent:

| Route | Query family |
|---|---|
| `/resources` | hub: developer impact, profile badges |
| `/resources/github-profile-badge` | "github profile badge", "readme badge generator", "github stats card" |
| `/resources/developer-impact-metrics` | "developer impact metrics", "engineering impact score", "measure developer productivity fairly" |
| `/resources/developer-portfolio-badge` | "developer portfolio proof", "verified developer stats" |
| `/resources/code-review-metrics` | "code review metrics", "pull request review stats" |

The autocomplete baseline was captured on 2026-09-05: `docs/research/2026-09-05-search-intent-baseline.md`. Its "What changes in Phase 4" table replaces the query families above for titles and H2s. The short version: "github readme badges" and "github readme stats" are the head terms, "developer impact" is not a search term at all (it autocompletes to Genshin Impact), and the reachable neighbours are "developer metrics", "engineering metrics" and "developer portfolio github". Each guide: one H1, `Article` + `BreadcrumbList` JSON-LD, internal links to `/about/scoring`, the relevant archetype, and a truthful CTA (`resource_cta_clicked`), rendered with the redesign's `ContentPageHeader` and `OnThisPageIndex`, fully translated, and added literally to the proxy matcher, the sitemap, the contract test and Lighthouse. This is the single largest ranking lever in the plan: today Chapa has 13 indexable content pages, all about itself, and nothing that answers a question someone types before they know Chapa exists.

Verification: contract test, parity test, Lighthouse SEO 1.0, a manual read of both languages.

### Phase 5. IndexNow bound to the deployed SHA

Files: `apps/web/public/<key>.txt`, `scripts/indexnow-submit.ts`, `.github/workflows/indexnow.yml`.

1. Commit the 32-hex key file from Phase 0 under `apps/web/public/`.
2. `scripts/indexnow-submit.ts`: fetch the live sitemap, parse `<loc>` only, dedupe, reject off-host URLs and empty batches, verify the key file is reachable, POST to `https://api.indexnow.org/indexnow`, accept 200/202 only, log counts and never URLs with handles. Tests cover the parser, host validation and response handling.
3. Workflow on `push` to `main` and manual dispatch, fail-closed behind repo variable `CHAPA_INDEXNOW_ENABLED == "true"` (absent when this lands). It polls `/api/version` until production reports the triggering SHA (the same mechanism E2E Pro uses), then submits. No fixed sleeps. Never runs for `develop`.
4. Google ignores IndexNow; Google gets the sitemap `lastmod` from Phase 1 plus Search Console's own recrawl. Do not build a Google Indexing API integration: it is restricted to job postings and live streams and misuse gets the property flagged.

### Phase 6. Post-release vendor configuration and production verification

Runs after the relaunch is on `main` and Phases 3, 4, 5 are live. No repo changes.

1. Enable `CHAPA_INDEXNOW_ENABLED` and confirm the first submission in Bing's IndexNow report.
2. GA4: register event-scoped custom dimensions (`locale`, `source_surface`, `profile_context`, `archetype`, `tier`, `connected_platform_count`, `embed_format`, `share_platform`, `content_slug`, `cta_destination`, `changed_category`) only after Realtime shows the exact parameter names; mark the starred events as key events; create the three audiences (generated badge but never copied embed; opened Studio but never saved; resource reader never authenticated); build the acquisition-to-badge funnel exploration.
3. Search Console: confirm the sitemap re-read, re-inspect the Phase 0 URLs plus one guide, check Core Web Vitals and the Page Indexing report for "Crawled, currently not indexed" on profile pages (expected for low-signal profiles; not a defect).
4. Bing: Site Scan over the full sitemap; confirm URL count matches.
5. Clarity: confirm recordings exist for allowlisted routes and zero for `/u/*`; create the "marketing pages" segment.
6. Live checks on production: `view-source` for canonical, JSON-LD, `Content-Language`; consent before/after/withdrawn; Rich Results Test on one page per schema type; `/api/version` SHA equals the release candidate.

### Phase 7. Search-operations cadence and ledger

1. `docs/analytics/seo-ledger.jsonl` with one aggregate row per week: GA4 users/sessions/organic/key events; Search Console clicks/impressions/CTR/position and top query groups; Bing clicks/impressions/indexed count; Clarity sessions and rage/dead-click rates. Aggregates only, never handles or raw queries.
2. A scheduled workflow appends the row, fail-closed behind `CHAPA_SEO_LEDGER_ENABLED`, each provider degrading independently with an explicit status field. Credentials are a GA4 service account and a Search Console service account scoped to Chapa's properties only; Bing uses its API key; Clarity has a data-export API with a token.
3. A monthly review checklist in `docs/analytics/README.md`: indexation delta, new query groups worth a guide, pages losing position, Clarity friction, and whether the D1 trigger for Spanish URLs has fired.

This phase is the lowest priority. Search Console's weekly email and GA4's built-in reports cover the first two months; build the ledger once there is enough traffic for a trend to mean something.

## Beyond search engines (small, do alongside Phase 4)

Discoverability for a developer tool is only partly web search. Cheap, one-time items, none needing code:

- GitHub repository: description, topics (`github-badge`, `readme-badge`, `developer-metrics`, `svg-badge`, `developer-portfolio`, `nextjs`), social preview image (the OG image), website field, a "Used by" showcase in the README.
- Submit to the badge and README-tooling awesome lists that accept PRs, and to the Vercel and Supabase showcase forms.
- `llms.txt` and WebMCP already make Chapa legible to AI assistants; keep them in the Phase 2 copy sweep so they stay truthful.

## Verification policy

Every implementation phase follows the repository loop: tests first, implement, review, `/simplify`, then sequentially:

```bash
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run check:circular
pnpm run check:vercel-config
pnpm run build
```

Manual evidence is separate from automated evidence and is recorded in `docs/analytics/README.md` with dates: vendor dashboards, DebugView, Rich Results Test, URL Inspection, `curl -sI` header matrices, before/after screenshots of the vendor property lists.

## Rollback

- Code: revert the phase commit through the normal branch flow.
- Analytics: remove the measurement, project or verification IDs from Vercel and redeploy; never delete a vendor property as a first response.
- Consent: fail closed; invalid state means nothing loads.
- Clarity: pause the Chapa project.
- Search Console and Bing: stop submissions, keep the property and its history.
- IndexNow: set the repo variable to false; the key file is harmless.
- DNS: the single TXT record can be removed; it affects nothing else in the zone.

## Out of scope

- Public `/es/*` URLs and `hreflang` (D1 option B, its own plan when triggered).
- Google Tag Manager, Google Ads, Microsoft Ads, any paid acquisition.
- Replacing PostHog or Vercel Analytics.
- Google Indexing API.
- Recording profiles, authenticated pages or user content in Clarity.
- Any claim about scoring that scoring-relaunch S17 has not approved.

## References

- Search Console property types and verification: <https://support.google.com/webmasters/answer/34592>
- Sitemap submission: <https://support.google.com/webmasters/answer/7451001>
- GA4 property and web stream: <https://support.google.com/analytics/answer/14183469>
- GA4 and Search Console link: <https://support.google.com/analytics/answer/10737381>
- Consent Mode: <https://developers.google.com/tag-platform/security/guides/consent>
- `@next/third-parties` GoogleAnalytics: <https://nextjs.org/docs/app/guides/third-party-libraries#google-analytics>
- Bing import from Search Console: <https://www.bing.com/webmasters/help/add-and-verify-site-12184f8b>
- IndexNow: <https://www.indexnow.org/documentation>
- Clarity masking and consent: <https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-masking>, <https://learn.microsoft.com/en-us/clarity/setup-and-installation/consent-mode>
