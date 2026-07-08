# ADR: Per-page auth/flag gating instead of a global `middleware.ts`

**Date:** 2026-07-08
**Status:** Accepted
**Refs:** Fixes #986; related #778 CSP ADR (`2026-06-20-csp-unsafe-inline-accepted-risk.md`)

## Context

Chapa gates access to a handful of routes:

- **`/studio`** — requires the `studio` feature flag to be enabled and an
  authenticated session with a usable GitHub token.
- **`/admin`** — requires an authenticated session whose handle is in
  `ADMIN_HANDLES`.
- **`/cli/authorize`** — requires an authenticated session (redirects through
  GitHub OAuth and back).

Next.js App Router offers a single `middleware.ts` at the app root as the
idiomatic place to centralize this kind of gating. Chapa deliberately does **not**
use one. Instead, each gated page does its own gate inline, at the top of its
server component, before rendering:

- `apps/web/app/studio/page.tsx` — `if (!(await isStudioEnabled())) redirect("/")`,
  then `getOptionalServerSessionFromHeaders(await headers())` +
  `getSessionGitHubToken(...)`, redirecting to `/api/auth/login` when absent.
  The page also declares `export const dynamic = "force-dynamic"`.
- `apps/web/app/admin/page.tsx` — `getOptionalServerSessionFromHeaders(...)` then
  `isAdminHandle(session.login)`, redirecting to `/` on failure.
- `apps/web/app/cli/authorize/page.tsx` — `getSessionSecret()` /
  `getOptionalServerSessionFromHeaders(...)` checks, redirecting to
  `/api/auth/login` (with a return URL) when unauthenticated. Also
  `export const dynamic = 'force-dynamic'`.

Each of these pages is already dynamic by nature (it reads request `headers()` and
a session cookie), so the inline gate costs nothing extra: the page could not have
been statically cached anyway.

## Decision

**Keep auth and feature-flag gating inline in each gated page component. Do not
introduce a root `middleware.ts` to centralize gating.**

The three gated routes above already opt into dynamic rendering because they read
per-request session state. Gating them in-place keeps the gate co-located with the
page that needs it, and — critically — keeps the gate off every *other* route.

## Why not a global `middleware.ts`

A root `middleware.ts` runs on **every matched request**, including requests for
routes that are (and should stay) statically rendered / ISR-cached and served from
the edge:

- Content pages (`/`, `/about`, `/about/scoring`, `/about/verification`,
  `/archetypes/*`, `/privacy`, `/terms`) render statically at the default locale
  and are CDN-cacheable (see the i18n section of `CLAUDE.md`).
- The public badge SVG (`/u/:handle/badge.svg`) and OG image endpoints carry their
  own cache headers and must stay edge-cacheable — the project's hottest path.

Adding a `middleware.ts` — even one whose logic only *intends* to touch
`/studio`, `/admin`, and `/cli/authorize` — pulls every request that matches its
matcher onto the middleware runtime. A too-broad matcher (or a later edit to one)
silently makes otherwise-static routes dynamic, defeating ISR and the CDN caching
the badge and content pages depend on. This is the same "middleware runs on every
request, including the edge-cached public path" hazard called out in the CSP ADR
(`2026-06-20-csp-unsafe-inline-accepted-risk.md`), where per-request middleware was
also deferred specifically to avoid disturbing cache behavior on the static/ISR
content-page strategy.

Per-page gating avoids this entirely: only the pages that are *already* dynamic pay
for a gate, and static routes are never routed through a request-time hook.

## Consequences

- **Positive:** ISR/static rendering and edge caching are preserved for content
  pages and the badge/OG endpoints. Gates are co-located with the page they
  protect, so the auth/flag requirement is visible in the page that enforces it.
  There is no single request-time chokepoint on the hot path.
- **Negative:** Gating logic is not centralized. A new gated route must remember to
  add its own inline gate (session/flag check + redirect); there is no framework
  layer that enforces "everything under X is protected." This is an accepted
  trade-off — the gated surface is small and explicit.
- **Risk to guard against:** A future contributor may add a root `middleware.ts`
  "for convenience" (to DRY up the three gates, add a redirect, set a header,
  etc.). Unless its `matcher` is scoped *narrowly* to the already-dynamic gated
  routes, it will silently pull static/ISR routes — including the edge-cached badge
  path — onto the middleware runtime and break their caching. This ADR records the
  decision so that regression is a deliberate, reviewed choice rather than an
  accidental one.

## If a `middleware.ts` is ever added anyway

Should a genuine need for middleware arise (e.g. the nonce-based CSP migration
described in the CSP ADR), scope it deliberately:

1. Give it a **narrow `matcher`** that excludes static content pages, the badge
   SVG, and OG endpoints — never a catch-all that matches everything.
2. Confirm in a preview deploy that previously-static routes still return cache
   headers / are not forced dynamic, and that the badge path stays edge-cacheable.
3. Prefer keeping per-page gates in place and using middleware only for the new,
   genuinely cross-cutting concern rather than folding the existing auth/flag gates
   into it.

## Review Schedule

Re-evaluate if the number of gated routes grows large enough that per-page gates
become a maintenance burden, or during any Next.js major upgrade that changes
middleware/caching semantics.
