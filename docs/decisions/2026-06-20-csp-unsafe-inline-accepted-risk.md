# ADR: CSP `script-src 'unsafe-inline'` — Accepted Risk + Nonce Migration Plan

**Date:** 2026-06-20
**Status:** Accepted (risk); Proposed (future nonce migration)
**Refs:** Refs #778 (SE-L4); related accepted risks #396 (script), #397 (eval), #400 (style)

## Context

The production Content-Security-Policy is built in `apps/web/next.config.ts`
(`buildCsp()`) and applied to all routes via the `headers()` config. The
`script-src` directive currently includes `'unsafe-inline'`:

```ts
const scriptSrc = [
  "'self'",
  // 'unsafe-inline' is required by Next.js App Router for inline scripts
  // (hydration, page transitions). Removing it requires nonce-based CSP
  // which Next.js does not yet support without custom middleware.
  "'unsafe-inline'",
  ...(isDev ? ["'unsafe-eval'"] : []),  // dev-only, for Fast Refresh/HMR
  "blob:",
].join(" ");
```

`'unsafe-inline'` in `script-src` weakens CSP's XSS protection: if an attacker
could inject script into the page, the policy would not block it. The directive is
present because **Next.js App Router emits inline bootstrap/hydration scripts**
(the inline `self.__next_f` flight payloads and page-transition scripts). With
`'unsafe-inline'` removed and no nonce, those inline scripts are blocked and the
app fails to hydrate.

`'unsafe-eval'` is a separate, dev-only concern (gated behind
`NODE_ENV !== "production"` for Fast Refresh/HMR) and is not part of this decision —
see accepted risk #397.

## Decision

**Accept `script-src 'unsafe-inline'` as a known, low-severity risk for now.** Do
not ship a nonce-based CSP yet, because the safe migration requires per-request
middleware that is risky to introduce to a live site without staged testing.

This ADR records *why* it is accepted and lays out a concrete migration plan so
the directive can be removed deliberately rather than indefinitely.

## Why the risk is low (mitigations)

- **No user-controlled HTML injection points.** All user-controlled text (GitHub
  handles, display names) is escaped before rendering into HTML and SVG
  (`escapeXml()` / `escapeHtml()`). There is no path where attacker-controlled
  markup reaches the DOM as raw HTML.
- **Server-generated SVG only.** The share/landing/archetype pages inject badge
  SVG via `dangerouslySetInnerHTML`, but that SVG is produced server-side by the
  pure `renderBadgeSvg()` pipeline from sanitized inputs (accepted risk in
  `docs/accepted-risks.md`, #596). No user-controlled raw SVG reaches the DOM.
- **Defense in depth elsewhere.** `X-Content-Type-Options: nosniff`,
  `Referrer-Policy`, HSTS, a restrictive `connect-src`/`img-src`/`frame-src`
  allowlist, and `X-Frame-Options: DENY` (on all non-badge routes) remain in force.
  `'unsafe-inline'` weakens one layer, not the whole stack.
- **Production excludes `'unsafe-eval'`.** Only `'unsafe-inline'` is present in
  prod; `eval` is dev-only.

**Severity: Low.**

## Why not migrate now

Nonce-based CSP in Next.js App Router requires a `middleware.ts` that, on **every
request**, generates a cryptographic nonce, injects it into the CSP header, and
exposes it so Next.js can stamp it onto its inline scripts. This has three
properties that make it risky to ship untested to a live site:

1. It runs on **every request** (including the edge-cached public badge path),
   touching the hot path the project most cares about.
2. A subtly wrong nonce (e.g., not propagated to a Next-emitted inline script)
   **blocks hydration site-wide** — a full client-side outage, not a graceful
   degradation.
3. Per-request nonces interact with CDN caching: a cached page must not carry a
   stale nonce, so the nonced routes effectively become dynamic, which conflicts
   with the project's ISR/`force-static` content-page strategy unless scoped
   carefully.

Given the live production site and the low severity of the current risk, the
prudent posture is to keep `'unsafe-inline'` until the nonce migration can be built
and verified behind a staged rollout.

## Future Nonce Migration Plan

When undertaken (its own RPI cycle, on `develop`, behind staged verification):

1. **Add `apps/web/middleware.ts`** that, per request, generates a random nonce
   (`crypto.randomUUID()` / 128-bit base64) and sets the response CSP header to
   `script-src 'self' 'nonce-<value>'` (dropping `'unsafe-inline'`). Centralize the
   directive builder so `next.config.ts` and middleware stay in sync — or move CSP
   header construction entirely into middleware so there is one source of truth.
2. **Propagate the nonce to Next.js.** Pass the nonce through a request header that
   the App Router reads, and apply it to any first-party `next/script` usage via
   the `nonce` prop. Verify Next stamps the nonce onto its own inline bootstrap
   scripts.
3. **Scope to dynamic routes first.** Apply nonced CSP to routes that are already
   dynamic (auth, studio, admin) before touching ISR/static content pages, so
   cache behavior is not disturbed. Confirm the badge SVG and OG endpoints —
   which carry their own headers and must stay edge-cacheable — are unaffected.
4. **Remove `'unsafe-inline'` from `script-src`** in `buildCsp()` only after
   steps 1–3 are verified end to end (hydration works, no console CSP violations,
   badge/CDN caching intact).
5. **Verify** in preview deploys before any `main` merge: load every page type,
   watch the browser console for `Refused to execute inline script` violations,
   and confirm OAuth, Studio, and badge rendering all work.

Keep `style-src 'unsafe-inline'` as a separate, lower-severity item (#400);
nonce-ing styles is a distinct effort and not required to remove the script-src
risk.

## Consequences

- **Positive (now):** No live-site risk from an untested middleware change; the
  XSS surface is already closed by input escaping and the absence of HTML injection
  points.
- **Negative (now):** CSP provides weaker script-injection defense than a nonced
  policy would — accepted given the mitigations above.
- **Future:** A clear, staged path to remove `'unsafe-inline'` exists, gated on
  Next.js nonce support holding stable and on staged verification.

## Review Schedule

Re-evaluate on every Next.js major upgrade (improved first-party nonce support may
reduce migration risk) and during quarterly security review.
