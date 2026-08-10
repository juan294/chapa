# Phase 2 — Technical SEO, Canonicals, Sitemap, Robots, and Public-Surface Integrity

**Status:** Planned
**Batch eligibility:** Not batch-eligible
**Depends on:** Phase 1

## Objective

Make every indexable Chapa URL describe itself consistently and add executable coverage for the entire public search surface while preserving the current locale and cache architecture.

## Files

Create:

- `apps/web/lib/seo/metadata.ts`
- `apps/web/lib/seo/metadata.test.ts`
- `scripts/seo/public-surface.ts`
- `scripts/seo/public-surface.test.ts`
- `scripts/seo/check-public-surface.ts`

Modify:

- `apps/web/app/layout.tsx`
- `apps/web/app/[locale]/page.tsx`
- every indexable `apps/web/app/[locale]/**/page.tsx`
- `apps/web/app/u/[handle]/page.tsx`
- `apps/web/lib/db/users.ts`
- `apps/web/lib/db/users.test.ts`
- `apps/web/app/sitemap.ts`
- `apps/web/app/sitemap.test.ts`
- `apps/web/app/robots.ts`
- `apps/web/app/robots.test.ts`
- `apps/web/proxy.ts`
- `apps/web/proxy.test.ts`
- `package.json`
- `.github/workflows/ci.yml`
- `lighthouserc.json`

## Implementation

1. Add metadata helpers that accept an unprefixed path and locale and return:
   - a path-specific canonical;
   - path-specific Open Graph URL;
   - localized title/description/social fields;
   - no language alternates.
2. Give `/`, `/about`, `/about/scoring`, `/about/verification`, legal pages, all archetypes, and profiles their correct canonical instead of inheriting the root canonical.
3. Set `Content-Language` on the proxy rewrite response to the selected locale without reading request state in the root layout.
4. Preserve the proxy’s literal matcher.
5. Add `/about/verification` to the sitemap. Phase 3 owns every resource-page sitemap entry in the same change that creates the corresponding page.
6. Filter profile sitemap entries through `isValidHandle()` from `apps/web/lib/validation.ts`; do not emit invalid or empty handles.
7. Add a sitemap-specific data-access result in `apps/web/lib/db/users.ts` that distinguishes `{ status: "ok", users }` from `{ status: "unavailable", users: [] }` without changing existing `dbGetUsers()` callers. The sitemap still returns static routes for `unavailable`, logs/captures the failure, and does not claim dynamic profiles were loaded.
8. Keep existing noindex route metadata. Align robots tests with the route census and continue to advertise the sitemap.
9. Add `check:public-surface`, which renders/inspects a manifest of public routes and fails on:
   - absent/duplicate H1;
   - absent or wrong canonical;
   - indexable routes absent from the sitemap;
   - noindex routes present in the sitemap;
   - private routes absent from both a deliberate robots rule and/or noindex contract;
   - title/description or LLM-facing claims not present in the product contract.
10. Wire the new check into CI and add the resource routes to Lighthouse only when Phase 3 lands.

## Pseudocode

```text
canonical(path):
  normalized = path == "/" ? "/" : stripTrailingSlash(path)
  return new URL(normalized, BASE_URL)

sitemapProfiles(users):
  return users
    .filter(user => isValidHandle(user.handle))
    .map(user => profileEntry(user))

proxy(request):
  locale = resolveProxyLocale(request)
  response = rewrite(internalLocalePath(locale, request.path))
  response.headers["Content-Language"] = locale
  return response
```

## Automated success criteria

- RED-proven tests demonstrate the pre-change child canonical inheritance and invalid-handle sitemap emission, then pass with the implementation.
- Metadata tests cover every static path in both locales.
- Proxy tests pin route matching, rewrite behavior, and `Content-Language`.
- Sitemap tests cover static routes, all archetypes, valid profiles, invalid-handle exclusion, and DB-degraded output.
- DB tests pin the new sitemap-specific success/unavailable result without changing existing `dbGetUsers()` behavior.
- Public-surface tests are mutation-tested by removing one canonical, sitemap entry, H1, and robots/noindex assertion.
- `pnpm run check:public-surface`, typecheck, lint, test, `check:vercel-config`, and build pass sequentially.

## Manual success criteria

- View source for Spanish and English variants of `/`, `/about`, one archetype, and one profile.
- Confirm one canonical per page, correct page path, one H1, localized metadata, and the expected `Content-Language`.
- Confirm `/robots.txt` and `/sitemap.xml` through direct HTTP reads.

## Stop gate

Commit and stop after the technical SEO checkpoint. Do not create external properties or submit the sitemap.
