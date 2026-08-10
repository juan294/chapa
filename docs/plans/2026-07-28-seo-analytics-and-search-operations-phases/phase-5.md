# Phase 5 — Chapa-Only Vendor Property Creation and Configuration

**Status:** Planned
**Batch eligibility:** Not batch-eligible
**Depends on:** Phase 4 and explicit owner authorization

## Objective

Create and configure the four Chapa-specific vendor objects, store only the necessary Chapa identifiers/credentials, and verify each object without modifying any other project.

## Evidence artifact

Create:

- `docs/seo/property-registry.md`

The registry records non-secret object names, IDs, URLs, roles, verification methods, configuration readbacks, and timestamps. It never records API secrets, DNS challenge values after verification evidence is complete, service-account JSON, or browser session data.

## Authorization gate

Before the first create, DNS write, secret write, product link, sitemap submission, or dashboard mutation:

1. show the resolved destination account and proposed Chapa object;
2. obtain explicit authorization for this live phase;
3. re-read the selected account/property after creation.

If the exact Chapa target cannot be distinguished from another project, stop.

## Implementation

### Google Analytics

1. Select the existing organization Analytics account that contains Spoken Letter.
2. Create `Chapa — Production` with timezone `Europe/Madrid` and currency `EUR`.
3. Create web stream `Chapa Web` for `https://chapa.thecreativetoken.com`.
4. Record the property ID and `G-` measurement ID.
5. Configure enhanced measurement deliberately; retain page views, scrolls, outbound clicks, site search only if Chapa exposes search, and form interactions only if they do not capture field values.
6. After Phase 4’s emission names are fixed, register the dimensions, key events, and audiences from the main plan.

### Google Search Console

1. Create Domain property `chapa.thecreativetoken.com`.
2. Resolve the authoritative DNS provider with CLI.
3. Read the exact zone/record set.
4. Add only Google’s Chapa TXT challenge record.
5. Verify with `dig` and Search Console.
6. Submit the production sitemap.
7. Inspect `/`, `/about`, one archetype, and one valid profile. Phase 8 inspects the resource routes after they are deployed.
8. Link the Chapa Search Console property to the Chapa GA4 stream.

### Bing Webmaster Tools

1. Import only the verified Chapa Search Console property.
2. Confirm the site URL and ownership.
3. Submit the sitemap and confirm robots parsing.
4. Set Site Scan’s page limit to the full sitemap count.
5. Leave Crawl Control at default.

### Microsoft Clarity

1. Create `Chapa` for the production URL.
2. Set industry to Software.
3. Set masking to Strict and verify the setting readback.
4. Enable Consent Mode/disable cookies by default.
5. Record the project ID.
6. Do not add cross-project links, identify calls, unmask selectors, or broad segments.

### Configuration storage

Use CLI/API first:

- add the Chapa GA measurement ID and Clarity project ID to Vercel Preview only;
- add provider API credentials required by Phase 7 as Chapa repository GitHub Actions secrets;
- never print secret values;
- do not copy Spoken Letter IDs or tokens into Chapa.

Production Vercel values are deferred to Phase 8.

## Automated/readback success criteria

- GA Admin readback returns the exact Chapa property, stream URL, timezone, currency, measurement ID, custom definitions, key events, and audiences.
- DNS readback shows the exact Chapa verification record without unrelated changes.
- Search Console reports verified owner status and the submitted sitemap.
- Bing reports the exact Chapa site as verified/imported and the sitemap as submitted.
- Clarity readback shows Chapa URL, Strict masking, and consent cookies disabled by default.
- Vercel Preview env-name readback shows the two Chapa variable names with no value disclosure.
- GitHub secret-name readback shows only the planned Chapa repository secret names.

## Manual success criteria

- Capture a redacted screenshot/readback of each new empty dashboard.
- Confirm no other project’s updated-at time, settings, users, tracking IDs, sitemap, masking mode, or links changed.
- Confirm GA4 Realtime remains empty before preview traffic and that empty GSC/Bing/Clarity dashboards are accepted for a new property.
- Exercise an authorized Preview session: GA4 DebugView receives the exact event/parameter names and Clarity receives an allowlisted marketing page while an excluded profile route produces no Clarity request/recording.

## Stop gate

Stop after property/configuration readbacks. Do not set Production env values, release `main`, request production recrawls, run Site Scan, or submit IndexNow.
