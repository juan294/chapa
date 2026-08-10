# Chapa SEO and Analytics Current State

**Date:** 2026-07-28
**Reference blueprint:** `/Users/juan/code/spoken-letter/docs/plans/2026-07-27-seo-starter-guide-action-plan.md`
**Scope:** Current Chapa source, deployed public surface, analytics seams, release automation, and the reusable Spoken Letter patterns that correspond to those surfaces.

## Research boundary

This document records what exists. It does not select an implementation design.

The user stated that Chapa does not yet have a Google Analytics property, Google Search Console property, Bing Webmaster Tools site, or Microsoft Clarity project. Those vendor-account facts are treated as user-provided starting state. No vendor property, project, DNS record, secret, or production setting was created or changed during this research.

The shared checkout already contained edits to four `docs/agents/*` reports. This research did not touch them.

## Product and public URL model

Chapa is a bilingual, server-rendered Next.js application for developer-impact profiles and embeddable badges. English and Spanish are the supported locales, with Spanish as the default (`apps/web/lib/i18n/types.ts:1-4`).

The public content routes use unprefixed URLs. The proxy selects locale from the `chapa-locale` cookie, then `Accept-Language`, then the Spanish default, and rewrites the request internally to a locale segment without changing the browser-visible URL (`apps/web/proxy.ts:16-24`, `apps/web/proxy.ts:27-36`, `apps/web/proxy.ts:54-59`). The exact proxy surface is the landing page, the three `/about*` pages, legal pages, and seven archetype pages (`apps/web/proxy.ts:62-77`).

Both locale variants are generated at build time and unsupported locale params are rejected (`apps/web/app/[locale]/layout.tsx:4-22`). The landing page and the localized content pages use force-static rendering with one-hour revalidation; representative definitions are the landing page, About page, and scoring page (`apps/web/app/[locale]/page.tsx:7-14`, `apps/web/app/[locale]/about/page.tsx:9-16`, `apps/web/app/[locale]/about/scoring/page.tsx:6-10`).

## Layer 1: metadata and on-page structure

The root metadata defines the production metadata base, title template, description, manifest and icon, Open Graph card, Twitter card, and a base canonical (`apps/web/app/layout.tsx:39-79`).

Localized metadata is generated from the route locale on the About, scoring, verification, privacy, terms, and archetype pages. The About and scoring implementations include localized title, description, Open Graph, and Twitter fields (`apps/web/app/[locale]/about/page.tsx:18-37`, `apps/web/app/[locale]/about/scoring/page.tsx:12-31`). Privacy and terms include localized title, description, and Open Graph fields (`apps/web/app/[locale]/privacy/page.tsx:14-28`, `apps/web/app/[locale]/terms/page.tsx:14-28`). Each archetype route supplies localized title and description; Builder is representative of the repeated route pattern (`apps/web/app/[locale]/archetypes/builder/page.tsx:12-22`).

The About page has one H1, section H2s, descriptive links to every archetype, and links to the scoring and verification explainers (`apps/web/app/[locale]/about/page.tsx:52-104`). The landing page contains the main H1 and primary action, archetype links, and footer links to About, scoring, terms, and privacy (`apps/web/app/LandingContent.tsx:110-141`, `apps/web/app/LandingContent.tsx:202-234`, `apps/web/app/LandingContent.tsx:456-460`).

Dynamic profile pages use one-hour ISR and generate a profile-specific canonical, Open Graph `profile` metadata, Twitter metadata, and a daily cache-busted profile image URL (`apps/web/app/u/[handle]/page.tsx:1-1`, `apps/web/app/u/[handle]/page.tsx:44-80`).

The public app also exposes `/llms.txt`, `/llms-full.txt`, and `/.well-known/security.txt`. The first two contain product, scoring, endpoint, embedding, privacy, audience, and keyword descriptions with CDN caching (`apps/web/app/llms.txt/route.ts:1-75`, `apps/web/app/llms-full.txt/route.ts:1-116`). The security contact document is generated from a dedicated route (`apps/web/app/.well-known/security.txt/route.ts:1-16`).

## Layer 2: sitemap, robots, and indexing controls

The dynamic sitemap contains five static pages, seven archetype pages, and one `/u/{handle}` page for every row returned by `dbGetUsers()` (`apps/web/app/sitemap.ts:17-69`). Static pages and archetypes receive per-class change frequencies and priorities; profile `lastModified` values come from user registration time (`apps/web/app/sitemap.ts:20-67`). Tests pin the static pages, all archetypes, and DB-backed profile behavior (`apps/web/app/sitemap.test.ts:16-80`).

The robots route allows the root and embeddable badge SVG paths, disallows API, admin, experiments, generation, and CLI paths, and advertises the sitemap (`apps/web/app/robots.ts:6-16`). Its tests pin those rules and the production sitemap URL (`apps/web/app/robots.test.ts:9-53`).

Route metadata separately marks admin, CLI authorization, coming-soon, experiments, generating, and verification surfaces as non-indexable (`apps/web/app/admin/page.tsx:10-13`, `apps/web/app/cli/authorize/page.tsx:19-26`, `apps/web/app/coming-soon/page.tsx:11-18`, `apps/web/app/experiments/layout.tsx:5-14`, `apps/web/app/generating/[handle]/page.tsx:14-25`, `apps/web/app/verify/page.tsx:6-15`, `apps/web/app/verify/[hash]/page.tsx:18-32`).

The current source has no IndexNow key file, IndexNow submission script, sitemap-submission command, or production-deploy indexing workflow. The root package scripts enumerate the existing build, verification, maintenance, and release commands (`package.json:5-35`).

## Layer 3: structured data and social media images

The root layout emits a `SoftwareApplication` JSON-LD entity containing Chapa’s name, URL, description, application category, free offer, keywords, and feature list (`apps/web/app/layout.tsx:125-158`).

Profile pages emit `Person` JSON-LD with the display name, GitHub URL and `sameAs`, plus a public score/tier description when profile data exists (`apps/web/app/u/[handle]/page.tsx:202-215`, `apps/web/app/u/[handle]/page.tsx:228-234`).

Both paths use the shared `renderJsonLd()` serializer, which escapes `<`, `>`, and `&` before script injection (`apps/web/lib/jsonld.ts:1-11`).

The site-wide `/og-image` endpoint renders a 1200-by-630 PNG and returns one-day shared-cache headers (`apps/web/app/og-image/route.ts:4-25`). Profile OG images validate the handle, use a date-keyed Redis cache, materialize the profile on a miss, render the badge to PNG, and return six-hour CDN cache headers (`apps/web/app/u/[handle]/og-image/route.ts:16-27`, `apps/web/app/u/[handle]/og-image/route.ts:34-112`).

The repository contains no `Organization`, `WebSite`, `FAQPage`, `Article`, or `BreadcrumbList` JSON-LD entity.

## Layer 4: content architecture and search intent

Chapa’s existing indexable topic cluster consists of the landing page, About hub, scoring explainer, verification explainer, and seven archetype pages. The About hub links to all seven archetypes and both detailed explainers (`apps/web/app/[locale]/about/page.tsx:52-104`). Each archetype uses the same localized static route pattern (`apps/web/app/[locale]/archetypes/builder/page.tsx:6-31`).

The repository has no `/resources` route tree and no automated keyword-intent extractor. The web package exposes development, build, lint, typecheck, E2E, and bundle-analysis scripts (`apps/web/package.json:6-13`).

The Spoken Letter reference uses a localized resource hub and guide pages with per-page metadata, semantic headings, internal links, Article/Breadcrumb JSON-LD, and instrumented calls to action (`/Users/juan/code/spoken-letter/src/app/[locale]/resources/page.tsx:30-84`, `/Users/juan/code/spoken-letter/src/app/[locale]/resources/how-to-record-yoto-cards-for-grandchildren/page.tsx:13-28`, `/Users/juan/code/spoken-letter/src/app/[locale]/resources/how-to-record-yoto-cards-for-grandchildren/page.tsx:44-54`, `/Users/juan/code/spoken-letter/src/app/[locale]/resources/how-to-record-yoto-cards-for-grandchildren/page.tsx:67-139`).

The reference also contains a Google Autocomplete extractor that expands product-specific seed phrases and writes a deduplicated Markdown report (`/Users/juan/code/spoken-letter/scripts/seo/fetch-autocomplete-insights.mjs:1-120`).

## Layer 5: analytics and privacy

The root layout mounts `ClientInstrumentation` after the application providers (`apps/web/app/layout.tsx:165-174`). That component mounts deferred PostHog, the client error reporter, Vercel Analytics, and Vercel Speed Insights (`apps/web/components/ClientInstrumentation.tsx:1-19`).

PostHog loads only when both public environment variables are configured. It imports the client library on the first click, scroll, or keydown, or after a five-second fallback; automatic pageview capture is disabled, page-leave capture is enabled, and persistence uses local storage (`apps/web/components/PostHogProvider.tsx:6-50`).

The client event wrapper does nothing during server rendering or before PostHog finishes loading; afterward it forwards the event and properties to PostHog (`apps/web/lib/analytics/posthog.ts:18-26`). Current client call sites include Studio open/change/save activity, share and download activity, embed-copy activity, and client/API errors (`apps/web/app/studio/StudioClient.tsx:82-140`, `apps/web/components/BadgeToolbar.tsx:87-97`, `apps/web/components/BadgeToolbar.tsx:232-274`, `apps/web/components/CopyButton.tsx:14`, `apps/web/components/ClientErrorReporter.tsx:19-24`, `apps/web/hooks/useSession.ts:35-40`).

Server errors and operational events use the configured PostHog capture endpoint through a separate server module that redacts secret-like fields before delivery (`apps/web/lib/analytics/server-errors.ts:1-13`, `apps/web/lib/analytics/server-errors.ts:19-43`, `apps/web/lib/analytics/server-errors.ts:148-182`).

The English and Spanish privacy copy name PostHog, describe page views and key events, and state that personal information is not sent to analytics services (`apps/web/lib/i18n/dictionaries/en.ts:553-582`, `apps/web/lib/i18n/dictionaries/es.ts:553-582`).

The current PostHog initialization path has no consent-state or route predicate (`apps/web/components/PostHogProvider.tsx:7-24`, `apps/web/components/PostHogProvider.tsx:29-42`). Vercel Analytics and Speed Insights are mounted globally through client-only dynamic imports (`apps/web/components/ClientAnalytics.tsx:1-24`).

The repository contains no Google tag, GA4 measurement ID, Microsoft Clarity project ID, consent provider, or cookie banner. The example environment file currently declares PostHog but no GA4 or Clarity variables (`.env.example:18-20`).

## Layer 6: security and privacy boundaries

The default Content Security Policy permits connections to Chapa, PostHog EU, GitHub, jsDelivr, and Vercel scripts; it permits YouTube privacy-enhanced frames and GitHub/YouTube images (`apps/web/next.config.ts:17-44`). All non-badge routes deny framing, while badge SVGs receive an embeddable frame policy (`apps/web/next.config.ts:67-87`, `apps/web/next.config.ts:111-125`).

Public profile API responses contain public impact dimensions, scores, archetype, tier, and timestamps, but not confidence (`apps/web/app/api/profile/[handle]/route.ts:58-102`). Share-page confidence and challenge controls render only for the owner (`apps/web/components/dashboard/ScoreExplanationPanel.tsx:218-262`).

The share page stays ISR-safe by resolving ownership from the client session endpoint rather than a request-time server session read (`apps/web/app/u/[handle]/page.tsx:109-129`, `apps/web/hooks/useSession.ts:19-53`). The session endpoint uses strict rate limiting and sends `no-store, private` for both anonymous and authenticated responses (`apps/web/app/api/auth/session/route.ts:8-35`).

## Layer 7: CI, deployment, and operational evidence

The repository’s integration branch is `develop`; production deploys from `main`, and releases move through a PR from `develop` to `main` (`CLAUDE.md:293-303`, `CLAUDE.md:327-332`).

CI runs on pushes and pull requests to both branches and includes lint/typecheck, sharded unit tests with coverage aggregation, contract tests, build, E2E, deployment smoke, and a release-PR migration check (`.github/workflows/ci.yml:1-11`, `.github/workflows/ci.yml:79-80`, `.github/workflows/ci.yml:136-191`, `.github/workflows/ci.yml:293-294`, `.github/workflows/ci.yml:399-400`, `.github/workflows/ci.yml:485-486`, `.github/workflows/ci.yml:605-663`, `.github/workflows/ci.yml:717-760`).

Lighthouse runs on pull requests to `develop` and `main`. Accessibility is blocking at 0.9, while performance, best-practices, and SEO are warning-level measurements (`.github/workflows/lighthouse.yml:1-29`, `.github/workflows/lighthouse.yml:52-70`, `lighthouserc.json:1-30`).

The Vercel Root Directory is `apps/web`; the Vercel config therefore lives at `apps/web/vercel.json`, and a repository script validates that placement plus all cron/function paths (`scripts/check-vercel-config.ts:37-45`, `scripts/check-vercel-config.ts:74-142`). The current config registers warm-cache, audience sync, campaign processing, and latency-check crons (`apps/web/vercel.json:1-33`).

Chapa exposes `/api/version` and the release-verification workflow uses an immutable preview URL and expected SHA as evidence inputs (`.github/workflows/release-verification.yml:1-79`, `.github/workflows/release-verification.yml:510-631`). Nightly production verification reads the deployed version identity after smoke checks (`.github/workflows/nightly-prod-probe.yml:52-80`).

## Deployed readback on 2026-07-28

Read-only `curl` requests to `https://chapa.thecreativetoken.com` returned:

- `200` for `/robots.txt`, `/sitemap.xml`, `/`, and `/about`;
- an HTTP-to-HTTPS `308` for the production host;
- pre-rendered Spanish content for `/` and `/about`;
- the metadata and root `SoftwareApplication` JSON-LD represented by the source paths above;
- a sitemap containing the static, archetype, and DB-backed profile entries represented by `apps/web/app/sitemap.ts:17-69`;
- no DNS resolution for `www.chapa.thecreativetoken.com`.

The exact commands used were:

```bash
curl -sSIL https://chapa.thecreativetoken.com/robots.txt
curl -sSIL https://chapa.thecreativetoken.com/sitemap.xml
curl -sSIL https://chapa.thecreativetoken.com/
curl -sSIL https://chapa.thecreativetoken.com/about
curl -sSIL http://chapa.thecreativetoken.com/
curl -sSIL https://www.chapa.thecreativetoken.com/
curl -sS https://chapa.thecreativetoken.com/robots.txt
curl -sS https://chapa.thecreativetoken.com/sitemap.xml
curl -sS https://chapa.thecreativetoken.com/
curl -sS https://chapa.thecreativetoken.com/about
```

## Reusable Spoken Letter implementation patterns

The Spoken Letter implementation provides factual examples of:

1. a shared safe structured-data component library (`/Users/juan/code/spoken-letter/src/components/seo/json-ld.tsx:6-140`);
2. sitemap-derived IndexNow submission with host validation, key-file parity tests, and a production-branch workflow (`/Users/juan/code/spoken-letter/scripts/submit-indexnow.ts:12-100`, `/Users/juan/code/spoken-letter/scripts/submit-indexnow.test.ts:15-93`, `/Users/juan/code/spoken-letter/.github/workflows/indexnow.yml:17-56`);
3. Google Consent Mode initialization plus a shared stored consent decision (`/Users/juan/code/spoken-letter/src/components/analytics/google-analytics-bootstrap.tsx:23-50`, `/Users/juan/code/spoken-letter/src/components/analytics/cookie-banner.tsx:24-72`);
4. a positive Clarity route allowlist and consent predicate (`/Users/juan/code/spoken-letter/src/components/analytics/microsoft-clarity.tsx:9-93`);
5. a typed analytics event catalogue and a test binding registered dimension names to emitted parameters (`/Users/juan/code/spoken-letter/src/lib/analytics/events.ts:1-115`, `/Users/juan/code/spoken-letter/src/lib/analytics/custom-dimensions.test.ts:5-78`);
6. a daily aggregate SEO ledger that reads GA4, Search Console, Clarity, and Bing independently (`/Users/juan/code/spoken-letter/scripts/seo/collect-analytics.ts:6-29`, `/Users/juan/code/spoken-letter/scripts/seo/collect-analytics.ts:268-387`, `/Users/juan/code/spoken-letter/.github/workflows/seo-ledger.yml:21-83`);
7. a claim-based public-surface verification command wired into CI (`/Users/juan/code/spoken-letter/scripts/lib/public-surface.ts:1-12`, `/Users/juan/code/spoken-letter/scripts/check-public-surface.ts:28-53`, `/Users/juan/code/spoken-letter/.github/workflows/ci.yml:120-128`).

Spoken Letter’s public locale topology differs from Chapa’s. Spoken Letter publishes locale-prefixed URLs with sitemap language alternates (`/Users/juan/code/spoken-letter/src/app/sitemap.ts:13-37`), while Chapa keeps both localized render variants behind one unprefixed public URL (`apps/web/proxy.ts:27-36`).

## Historical decisions that remain in force

The July 15 i18n ADR is the current authority for Chapa’s localized public URLs: locale-specific server routes are internal, public/canonical URLs stay unprefixed, and links, sitemap entries, canonical metadata, and Open Graph URLs retain that topology (`docs/decisions/2026-07-15-i18n-middleware-carve-out.md:31-47`, `docs/decisions/2026-07-15-i18n-middleware-carve-out.md:86-100`).

The same ADR requires the locale proxy matcher to remain an exact route list. New public content routes are represented literally rather than by widening the matcher to a wildcard (`docs/decisions/2026-07-15-i18n-middleware-carve-out.md:49-84`, `docs/decisions/2026-07-15-i18n-middleware-carve-out.md:147-152`).

Static/CDN-cached public content and separately cached profile/badge/OG routes are deliberate architectural boundaries (`docs/decisions/2026-07-08-no-middleware-adr.md:47-70`, `docs/decisions/2026-07-15-i18n-middleware-carve-out.md:86-100`).

The release procedure is `develop` to `main`, with an immutable candidate SHA, exact preview identity, separately authorized production operations, and post-release production identity/read-only verification (`docs/release/release-playbook.md:1-16`, `docs/release/release-playbook.md:41-72`, `docs/release/release-playbook.md:119-167`).

The current deployment configuration is resolved relative to `apps/web`, and its four registered cron jobs are protected by the root-directory decision and CI validation (`docs/decisions/2026-07-16-vercel-json-must-live-in-root-directory.md:8-39`, `docs/decisions/2026-07-16-vercel-json-must-live-in-root-directory.md:63-78`).
