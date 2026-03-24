# Accepted Risks & Known Limitations

> Last reviewed: 2026-03-22 | Audit: v22

Documented security, infrastructure, and performance decisions that were evaluated during pre-launch audits and accepted as reasonable tradeoffs. Items here are intentional and should not be flagged as warnings in audits.

---

## CSP unsafe-inline for scripts (#396)

- **Risk:** Next.js App Router injects inline scripts for hydration, requiring `'unsafe-inline'` in `script-src`.
- **Mitigation:** No user-controlled HTML injection points exist in the application. All user input (GitHub handles, display names) is escaped before rendering into SVG and HTML. Monitor Next.js for nonce-based CSP support.
- **Severity:** Low

## CSP unsafe-eval in development (#397)

- **Risk:** unsafe-eval is enabled for Next.js HMR in development mode.
- **Mitigation:** Gated behind `NODE_ENV !== "production"`. Does not affect production builds. The CSP middleware explicitly excludes `unsafe-eval` when running in production.
- **Severity:** None (dev-only)

## Rate limiter fail-open (#398)

- **Risk:** When Redis (Upstash) is unavailable, the rate limiter allows all requests through instead of blocking them.
- **Mitigation:** Intentional availability-first design for embeddable badges. Blocking every embedded badge because Redis is temporarily down is worse than briefly losing rate enforcement. GitHub's own API rate limits and Vercel CDN caching (`s-maxage=21600`) provide secondary protection. See `lib/cache/redis.ts` for the full rationale.
- **Severity:** Low

## IP extraction trusts proxy headers (#399)

- **Risk:** `x-real-ip` and `x-forwarded-for` headers could be spoofed by clients outside a trusted proxy.
- **Mitigation:** On Vercel (production), these headers are set by the trusted CDN edge and cannot be spoofed by end users. Spoofing only affects rate limit bucket assignment, not data access or authentication. The worst case is a spoofed IP bypassing rate limits, which is already covered by GitHub API limits and CDN caching (see #398).
- **Severity:** Low (Vercel-specific deployment)

## CSP unsafe-inline for styles (#400)

- **Risk:** unsafe-inline is required in style-src by Next.js inline styles and Tailwind v4 runtime theme switching.
- **Mitigation:** Style injection is categorically lower severity than script injection. Style-based attacks (CSS exfiltration) require specific conditions that don't apply here (no sensitive data in form fields rendered alongside attacker-controlled styles). Script-based XSS is independently blocked by the `script-src` directive.
- **Severity:** Low

## ~~HMAC verification hash truncated to 64 bits (#401)~~ — Resolved

- **Risk:** The SHA-256 badge verification hash was truncated to 16 hex characters (64 bits), reducing collision resistance from 2^128 to 2^32 for birthday attacks.
- **Resolution:** Hash increased to 32 hex characters (128 bits) in #617. Birthday resistance is now 2^64, computationally infeasible for any attacker. Verification endpoints accept legacy 8-char and 16-char hashes for backward compatibility.
- **Severity:** None (resolved)
- **Accepted:** 2026-02-24 | **Updated:** 2026-03-24

## No edge middleware for admin protection (#402)

- **Risk:** Admin routes (`/admin`, `/api/admin/*`) are protected at the component/handler level rather than via Next.js edge middleware.
- **Mitigation:** Admin access requires both a valid authenticated session AND the user's GitHub handle being present in the `ADMIN_HANDLES` environment variable. Component-level protection is functionally equivalent to middleware protection -- unauthorized requests are rejected before any admin data is returned. The admin surface is small (one dashboard page, one API route) and does not handle destructive operations.
- **Severity:** Low
- **Future improvement:** Add `middleware.ts` with admin route matching when Next.js middleware stabilizes further or if the admin surface area grows significantly.

## ~~MPL-2.0 / LGPL-3.0 dependency (sharp/libvips) (#450)~~ — Resolved

- **Risk:** The `sharp` image processing library was MPL-2.0 licensed and depends on `libvips` which is LGPL-3.0 (dynamically linked).
- **Resolution:** As of `sharp@0.34.5`, the package license changed to **Apache-2.0**, which is on the project allowlist. LGPL-3.0 for libvips (dynamically linked) remains acceptable — dynamic linking does not require open-sourcing our code.
- **Severity:** None (resolved)
- **Accepted:** 2026-02-21 | **Updated:** 2026-03-22

## MPL-2.0 dependency (@resvg/resvg-js) (#464, #596)

- **Risk:** `@resvg/resvg-js@2.6.2` (and its platform-specific binary `@resvg/resvg-js-darwin-arm64`) uses MPL-2.0 (weak copyleft), which is not on the project's explicit allowlist (MIT, Apache-2.0, BSD, ISC). Used for SVG-to-PNG rendering in OG image generation.
- **Note:** `@vercel/analytics` was previously MPL-2.0 but has changed to **MIT** as of v2.0.1, resolving that concern.
- **Mitigation:** MPL-2.0 is a file-level weak copyleft license — it only requires sharing modifications to the MPL-licensed source files themselves. Chapa uses the package as an unmodified dependency via its public API, so there is no obligation to open-source any of Chapa's own code. MPL-2.0 is not GPL, AGPL, or LGPL and is explicitly compatible with proprietary and MIT-licensed projects. No modifications are made to the package's source files.
- **Severity:** Low
- **Accepted:** 2026-02-24 | **Updated:** 2026-03-22

## Wildcard CORS on /api/verify/[hash] (#596)

- **Risk:** The badge verification endpoint uses `Access-Control-Allow-Origin: *`, allowing any origin to call it from client-side JavaScript.
- **Mitigation:** Intentional design. The verification endpoint is public, read-only, and rate-limited. Badge embeds on third-party sites (READMEs, portfolios, blogs) need client-side verification capability — restricting CORS would break the core use case. The endpoint returns only verification status and public badge data; no sensitive information is exposed.
- **Severity:** Low
- **Accepted:** 2026-03-22

## dangerouslySetInnerHTML with server-rendered SVG (#596)

- **Risk:** The share page (`/u/[handle]/page.tsx`), landing page, and archetype pages inject badge SVG into the DOM via `dangerouslySetInnerHTML`, which bypasses React's XSS protections.
- **Mitigation:** Safe because all SVG is generated server-side by `renderBadgeSvg()` with `escapeXml()` (in `lib/render/escape.ts`) applied to all user-controlled text (GitHub handle, display name). No user-controlled raw SVG reaches any `dangerouslySetInnerHTML` injection point. The SVG rendering pipeline is a pure function that takes sanitized inputs and produces deterministic output.
- **Severity:** Low
- **Accepted:** 2026-03-22

## Turbopack NFT trace warning on agents-summary route (#596)

- **Risk:** The `/api/admin/agents-summary` route uses `process.cwd()` + `node:fs` to read agent log files at runtime, causing a Turbopack "NFT trace" build warning about dynamic filesystem access.
- **Mitigation:** This is an admin-only route behind session auth + `ADMIN_HANDLES` check. The `process.cwd()` pattern is documented in code comments (see `apps/web/app/api/admin/agents-summary/route.ts:61`). Alternative approaches (`import.meta.dirname` with relative traversal) are more brittle. The warning is cosmetic — no user-facing impact, no data leakage, no functional issue.
- **Severity:** None (cosmetic build warning)
- **Accepted:** 2026-03-22

---

## Infrastructure

## `packages/shared` has no build step (#450)

- **Risk:** The shared types package has no `tsc` build or compiled output.
- **Mitigation:** Next.js `transpilePackages` handles TypeScript compilation of workspace packages at build time. Adding a separate build step would add complexity and staleness risk without benefit. `pnpm run typecheck` validates the shared package.
- **Severity:** None
- **Accepted:** 2026-02-21

## pnpm build warnings (core-js, protobufjs) (#450)

- **Risk:** `pnpm install` shows deprecation warnings for `core-js` and `protobufjs`.
- **Mitigation:** These are transitive dependencies pulled in by PostHog and other packages. We do not control their version selection. Warnings are cosmetic and do not affect functionality or security. They will resolve when upstream packages update.
- **Severity:** None
- **Accepted:** 2026-02-21

---

## Performance

## No per-route bundle size reporting with Turbopack (#450)

- **Risk:** Turbopack (Next.js 16) does not emit per-route "First Load JS" sizes like Webpack did, making it harder to catch per-route size regressions.
- **Mitigation:** Bundle size is monitored via CI workflows (Dead Code Detection + Bundle Size Analysis). Individual chunks are inspected from `.next/static/chunks/`. The largest chunk is 219KB — well under the 500KB threshold. No route exceeds 300KB.
- **Severity:** Low
- **Accepted:** 2026-02-21

## Experiment pages fully client-rendered (#596)

- **Risk:** All 13 experiment pages (`/experiments/*`) use `"use client"`, meaning they are fully client-rendered with no SSR benefits (SEO, initial paint from server HTML).
- **Mitigation:** Intentional design. Experiment pages are visual demos for badge effects (particles, 3D tilt, aurora, hexmap, etc.) that rely heavily on canvas, requestAnimationFrame, and interactive state — SSR provides no benefit for these. All 13 pages are gated behind the `experiments_enabled` feature flag (disabled by default in production). They are internal prototyping tools, not user-facing production features.
- **Severity:** None
- **Accepted:** 2026-03-22

---

## Review schedule

These accepted risks should be re-evaluated:
- When upgrading Next.js major versions (CSP nonce support may land)
- When adding new admin functionality (middleware protection becomes more valuable)
- When verification URLs are redesigned (hash length can be increased)
- Quarterly as part of routine security review
