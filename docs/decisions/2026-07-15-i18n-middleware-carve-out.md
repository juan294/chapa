# ADR Addendum: Locale-segmented content-page proxy (the anticipated middleware carve-out)

**Date:** 2026-07-15
**Status:** Accepted
**Refs:** Fixes #1023 (FE-H1); amends `docs/decisions/2026-07-08-no-middleware-adr.md`

## Context

`docs/decisions/2026-07-08-no-middleware-adr.md` records the decision to keep
`/studio`, `/admin`, and `/cli/authorize` gated by inline per-page checks
rather than a root `middleware.ts`, specifically to avoid pulling
static/ISR content pages and the badge SVG hot path onto the middleware
runtime. That ADR explicitly anticipated a future "genuine cross-cutting
concern" that might justify middleware anyway, and prescribed a three-part
process for that case: (1) a narrowly-scoped `matcher`, (2) confirmation via
build output that previously-static routes stay static, (3) keeping the
existing per-page gates in place rather than folding them into the new
middleware.

Issue #1023 (FE-H1) is that anticipated case. Chapa's i18n system exposed
translation only via a client React context (`useTranslation()`), so 9
content pages (`/`, `/about`, `/about/scoring`, `/about/verification`,
`/privacy`, `/terms`, and the 7 `/archetypes/*` pages) were split into a thin
static server `page.tsx` plus a whole-page `"use client"` `*PageClient`
component. This meant: (a) large, purely-static markup shipped as client JS
with no interactivity benefit, and (b) the root layout rendered statically
at `DEFAULT_LOCALE` ('es'), so non-default-locale users saw Spanish HTML
paint first, then a client-side re-render to their detected locale after
hydration read the `chapa-locale` cookie — the "locale flash" bug.

## Decision

Migrate the 9 content pages to real, locale-segmented React Server
Components under `app/[locale]/...`, and add a narrowly-scoped root file
(originally `middleware.ts`; renamed to `proxy.ts` per the Next.js 16
middleware→proxy convention change, see below) that rewrites the canonical,
unprefixed request path (e.g. `/about`) to the internal `/[locale]/about`
route. Both locale variants (`/en/...` and `/es/...`) are statically
pre-rendered at build time via `generateStaticParams` in
`app/[locale]/layout.tsx`, so the rewrite always resolves to a cache hit —
translated copy renders correctly on the very first response, with no
client-side re-render.

This is exactly the carve-out the 2026-07-08 ADR anticipated: middleware
exists **only** for this one cross-cutting concern (locale resolution for
static content pages), scoped as narrowly as the ADR's own checklist
requires.

## The `proxy.ts` matcher (exact scope)

```ts
export const config = {
  matcher: [
    "/",
    "/about",
    "/about/scoring",
    "/about/verification",
    "/privacy",
    "/terms",
    "/archetypes/builder",
    "/archetypes/guardian",
    "/archetypes/marathoner",
    "/archetypes/polymath",
    "/archetypes/artificer",
    "/archetypes/balanced",
    "/archetypes/emerging",
  ],
};
```

Every entry is a literal, exact path — no wildcards, no dynamic segments, no
catch-alls. This list is unit-tested (`apps/web/proxy.test.ts`) to assert:

- the matcher is exactly these 13 literal paths, and
- it does **not** contain `/u/testhandle`, `/u/testhandle/badge.svg`,
  `/u/testhandle/og-image`, `/api/health`, `/api/verify/abc123`, `/studio`,
  `/admin`, `/cli/authorize`, `/verify`, `/verify/abc123`,
  `/experiments/aurora`, `/generating/testhandle`, `/coming-soon`,
  `/_next/static/chunk.js`, or `/favicon.svg`.

`/verify/*` (badge cryptographic verification, a distinct existing flow) and
`/about/verification` (one of the 9 migrated *explainer* pages) are easy to
confuse by name — the matcher only ever lists `/about/verification`, never
`/verify` or `/verify/*`.

## What this does NOT change

- **The existing per-page auth/flag gates are untouched.** `/studio`,
  `/admin`, and `/cli/authorize` keep their inline
  `getOptionalServerSessionFromHeaders` / `isStudioEnabled()` /
  `isAdminHandle()` checks exactly as described in the 2026-07-08 ADR. They
  are not folded into `proxy.ts`, and `proxy.ts`'s matcher does not include
  their paths.
- **The badge/OG hot path is untouched.** `/u/[handle]`,
  `/u/[handle]/badge.svg`, and `/u/[handle]/og-image` are not in the
  matcher and are unaffected by this change.
- **No redirects.** `proxy.ts` only calls `NextResponse.rewrite()`, never
  `NextResponse.redirect()`. The browser URL bar, all internal `<Link>`
  hrefs, `sitemap.ts`, and every page's `generateMetadata` canonical/OG URLs
  continue to reference the unprefixed path.

## `middleware.ts` → `proxy.ts` rename

While implementing this, `next build` emitted a deprecation warning: "The
`middleware` file convention is deprecated. Please use `proxy` instead."
Next.js 16 renamed the root middleware file convention to `proxy.ts` (same
runtime, same `NextRequest`/`NextResponse` API, same `config.matcher`
mechanism — only the file name and the exported function's expected name
changed, from `middleware` to `proxy`). The file was renamed and the
exported function renamed to match (`export function proxy(...)`) to avoid
shipping a deprecation warning on every build. This is purely a naming
change; none of the reasoning, scope, or matcher above are affected by it.
The 2026-07-08 ADR's prose still says "middleware" throughout — that
document is left as-is (it predates the Next.js 16 rename and its reasoning
is unaffected), and this addendum is the canonical reference for the
current file name.

## Verification performed (per the 2026-07-08 ADR's checklist)

1. **Narrow matcher** — see above; unit-tested in `apps/web/proxy.test.ts`.
2. **Build output confirms static generation is preserved** — `pnpm run
   build` shows all 9 migrated routes (13 entries counting the 7 archetype
   slugs individually) as `●` (SSG, "prerendered as static HTML (uses
   generateStaticParams)"), each with both `/en/...` and `/es/...` static
   variants. `/u/[handle]`, `/u/[handle]/badge.svg`, `/studio`, `/admin`,
   `/cli/authorize`, `/api/*`, `/verify/[hash]`, `/experiments/*`,
   `/generating/[handle]`, and `/coming-soon` all remain `ƒ` (dynamic),
   unchanged from before this migration.
3. **Per-page gates not folded in** — confirmed by inspection of
   `apps/web/app/studio/page.tsx`, `apps/web/app/admin/page.tsx`, and
   `apps/web/app/cli/authorize/page.tsx`: unchanged, still gate inline.

## Residual risk / recommended follow-up

Local `next build` output is the strongest proxy available in this sandboxed
environment for "ISR/CDN caching is preserved," but it cannot fully
substitute for a live Vercel preview deploy. **Recommended follow-up:**
after this change merges and a preview deploy is available, confirm via
`curl -I` (or the Vercel dashboard) that:

- `/about`, `/privacy`, `/archetypes/builder`, etc. return
  `Cache-Control` / `x-vercel-cache: HIT` headers consistent with ISR on
  repeat requests, and
- `/u/:handle/badge.svg` and other out-of-scope routes are unaffected by the
  new `proxy.ts` (their existing cache headers are unchanged).

## Review schedule

Re-evaluate alongside the 2026-07-08 ADR's own review schedule, and any time
a new content page is added that should be locale-segmented (add its path to
the `proxy.ts` matcher and its route under `app/[locale]/`) — never widen the
matcher to a prefix or wildcard pattern.
