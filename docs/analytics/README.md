# Chapa analytics and search operations

> ## Resume here (written 2026-09-05)
>
> **Situation.** The SEO plan (`docs/plans/2026-09-05-seo-discoverability-relaunch.md`) is approved with option A (one canonical URL per page). Phase 0, the vendor setup, is finished: every vendor object below exists and is configured. These docs are committed on the local branch `docs/seo-phase-0` (not pushed), because the WebMCP hackathon freeze forbids pushes and deploys until judging ends on **2026-09-21 17:00 PT** (2026-09-22 02:00 Madrid).
>
> **First thing to do after the freeze lifts:**
> 1. Check out `docs/seo-phase-0`, rebase it on the latest `develop`, push the branch and open a PR into `develop`.
> 2. Check the three things that were still settling on 2026-09-05: Search Console sitemap status (should have moved from `Couldn't fetch` to `Success` with 49 URLs), the two indexing requests (`/archetypes/builder`, `/u/juan294`), and Bing's sitemap (`Processing` → processed).
> 3. Start Phases 1, 3 and 5 of the plan. They are independent of each other and of the redesign, and they can run in parallel worktrees. Phase 1 includes the one defect Bing already found: the root meta description in `apps/web/app/layout.tsx` is ~200 characters and must be ≤160.
> 4. Phases 2 and 4 wait for scoring-relaunch phase 13 (issue #1312), because they describe the scoring formula.
>
> **What you need to have on hand:** the AWS CLI profile `creativetoken` (run `aws login --profile creativetoken` if it has expired; pick the AWSPersonal 481665111394 session), and the Chrome sessions for Google, Microsoft and AWS. All IDs are in the table below; none are secrets.
>
> **Do not** create a second GA4 property, Clarity project, Search Console property or Bing site. They all exist.


Owner: Juan González. Plan: `docs/plans/2026-09-05-seo-discoverability-relaunch.md`.

All IDs below are public by nature (they ship in page source). Secrets never go in this file.

## Vendor objects

| Vendor | Object | Identifier | Created | Notes |
|---|---|---|---|---|
| Google Analytics 4 | Account `Spoken Letter` (398659195) → property `Chapa` | property `552872166` | 2026-09-05 | Timezone Spain (Madrid), currency EUR, industry Computers & Electronics, size Small. The account already holds unrelated products (Sutura Case Lab), so it is the de facto umbrella account. |
| Google Analytics 4 | Web stream `Chapa Web` | stream `15723725309`, measurement ID `G-H2GJ3R0804` | 2026-09-05 | URL `https://chapa.thecreativetoken.com`. Enhanced measurement on with **form interactions off**. Tag NOT installed yet: Phase 3 installs it behind consent. |
| Google Search Console | Domain property `chapa.thecreativetoken.com` | `sc-domain:chapa.thecreativetoken.com` | 2026-09-05 (verified via DNS TXT) | Verification is a DNS TXT record on `chapa.thecreativetoken.com` in Route 53 (zone `thecreativetoken.com`, AWS nameservers `awsdns-02/54/22/10`). Value: `google-site-verification=ABcZIekZxUJta5-duYGZkbWKIVjl64UlSJvcb1Rq14o`. The zone lives in AWS account 481665111394 (AWSPersonal), hosted zone `Z05609513HH99AFEUOPD3`, not in 106403001709 where the CLI default profile signs in; the CLI profile `creativetoken` (`aws login --profile creativetoken`) reaches it. The TXT was added on 2026-09-05 through the console as a second value beside the existing SPF string; the authoritative server returned both values within seconds. |
| Bing Webmaster Tools | Site `https://chapa.thecreativetoken.com/` | imported from Search Console | 2026-09-05 | Imported via the Google OAuth link (scope `webmasters.readonly`, view-only; revocable from the Google account's connected apps). Sitemap submitted manually the same day, status `Processing`. Existing sites (spokenletter.com, sutura-case-lab.vercel.app) untouched. |
| Microsoft Clarity | Project `Chapa` | project ID `ydi5xgut2p` | 2026-09-05 | URL `https://chapa.thecreativetoken.com`, industry Technology & Telecommunications. **Masking: Strict. Cookies: Off** (the site must call `clarity('consent')` after the user accepts). Bot detection on. Tag NOT installed yet: Phase 3 installs it behind consent on the marketing-page allowlist only. Existing projects in the account (Spoken Letter, Sutura Case Lab) untouched. |

## Phase 0 status

| Step | State |
|---|---|
| GA4 property + web stream | done 2026-09-05 |
| Search Console property | verified 2026-09-05 |
| Sitemap submission | submitted 2026-09-05; first status `Couldn't fetch` (normal on a new property; sitemap serves 200 `application/xml`, 49 URLs, to a Googlebot UA). Google had already discovered the sitemap on its own before the property existed. |
| Baseline URL inspection | done 2026-09-05, see table below |
| Bing import | done 2026-09-05, sitemap submitted |
| Clarity project + masking + cookies off | done 2026-09-05 |
| GA4 ↔ Search Console link | done 2026-09-05 (property `chapa.thecreativetoken.com` ↔ stream `Chapa Web`). Search Console reports appear under GA4 Reports → Library once published. |
| GA4 event data retention | set to 14 months on 2026-09-05 (default was 2). User data retention was already 14 months. |
| IndexNow key | generated 2026-09-05: `7ea93889c01181a7b92927485e01e206`. Not yet hosted; Phase 5 commits `apps/web/public/7ea93889c01181a7b92927485e01e206.txt` (containing the key) and the submission script. Public by design: the protocol proves ownership by serving the key file, so it is not a secret. |

## Baseline URL inspection (Google, 2026-09-05)

| URL | Result | Action |
|---|---|---|
| `/` | Indexed. Last crawl 2026-08-31, Googlebot smartphone. Canonical = self. Discovered via sitemap and referrers `/about`, `/archetypes/artificer`, `/archetypes/polymath`, plus two external pages. | none |
| `/about/scoring` | Indexed. | none |
| `/archetypes/builder` | Unknown to Google. No referring sitemap or page detected. | indexing requested |
| `/u/juan294` | Unknown to Google. | indexing requested |

Two of the seven archetype pages appear as referrers to the home page, so Google has crawled some archetype pages but not `builder`. Worth re-checking in the Pages report after a week.

## Baseline URL inspection (Bing, 2026-09-05)

| URL | Result |
|---|---|
| `/` | Indexed successfully. One SEO issue: **meta description too long** (the root description in `apps/web/app/layout.tsx` is about 200 characters; Bing wants 25 to 160). One markup type detected (the SoftwareApplication JSON-LD). Fix in Phase 1. |
