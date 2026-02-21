# Accepted Risks & Known Limitations

> Last reviewed: 2026-02-21 | Audit: v21

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

## HMAC verification hash truncated to 64 bits (#401)

- **Risk:** The SHA-256 badge verification hash is truncated to 16 hex characters (64 bits), reducing collision resistance from 2^128 to 2^32 for birthday attacks.
- **Mitigation:** The hash is used for badge data integrity verification, not for passwords, authentication, or access control. An attacker who finds a collision can only produce an alternative input that verifies -- they cannot forge arbitrary badge data without the HMAC secret. Finding a meaningful collision (one that produces valid badge JSON) is significantly harder than a random collision. 2^32 attempts is computationally feasible but not economically motivated for badge verification.
- **Severity:** Low
- **Future improvement:** Consider increasing to 32 hex characters (128 bits) when a verification URL migration is feasible. This would raise birthday resistance to 2^64.

## No edge middleware for admin protection (#402)

- **Risk:** Admin routes (`/admin`, `/api/admin/*`) are protected at the component/handler level rather than via Next.js edge middleware.
- **Mitigation:** Admin access requires both a valid authenticated session AND the user's GitHub handle being present in the `ADMIN_HANDLES` environment variable. Component-level protection is functionally equivalent to middleware protection -- unauthorized requests are rejected before any admin data is returned. The admin surface is small (one dashboard page, one API route) and does not handle destructive operations.
- **Severity:** Low
- **Future improvement:** Add `middleware.ts` with admin route matching when Next.js middleware stabilizes further or if the admin surface area grows significantly.

## MPL-2.0 / LGPL-3.0 dependency (sharp/libvips) (#450)

- **Risk:** The `sharp` image processing library is MPL-2.0 licensed and depends on `libvips` which is LGPL-3.0 (dynamically linked). Neither is on the project's explicit allowlist (MIT, Apache-2.0, BSD, ISC).
- **Mitigation:** `sharp` is used by Next.js for image optimization and by `@resvg/resvg-js` for OG image generation — no viable alternative exists. LGPL-3.0 with dynamic linking does not require open-sourcing our code. MPL-2.0 is file-level copyleft only — modifications to MPL-licensed files must be shared, but our own code is unaffected. Both are compatible with our MIT license.
- **Severity:** Low
- **Accepted:** 2026-02-21

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

---

## Review schedule

These accepted risks should be re-evaluated:
- When upgrading Next.js major versions (CSP nonce support may land)
- When adding new admin functionality (middleware protection becomes more valuable)
- When verification URLs are redesigned (hash length can be increased)
- Quarterly as part of routine security review
