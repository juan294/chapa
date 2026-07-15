# Accepted Risks & Known Limitations

> Last reviewed: 2026-07-15 | Audit: v42

Documented security, infrastructure, and performance decisions that were evaluated during pre-launch audits and accepted as reasonable tradeoffs. Items here are intentional and should not be flagged as warnings in audits.

---

## CSP unsafe-inline for scripts (#396, #778, #959)

- **Risk:** Next.js App Router injects inline scripts for hydration, requiring `'unsafe-inline'` in `script-src`. This is a known limitation of the framework — removing it causes hydration to fail.
- **Why accepted:** The primary XSS surface (SVG user input) is separately guarded by `escapeXml()` in `apps/web/lib/render/escape.ts`, applied to all user-controlled text (GitHub handle, display name) before SVG rendering. No untrusted HTML reaches any `innerHTML`/`dangerouslySetInnerHTML` sink without prior sanitization.
- **Mitigation in place:** `escapeXml()` covers all SVG rendering paths; `unsafe-eval` is correctly dev-only (excluded from production CSP via the `isDev` guard in `next.config.ts`).
- **When to revisit:** When Next.js adds nonce-based CSP support (track Next.js releases — follow [nextjs/next.js#42427](https://github.com/vercel/next.js/issues/42427)). At that point, migrate to a per-request nonce injected via middleware and remove `'unsafe-inline'` from `script-src`.
- **Severity:** Low
- **See:** `docs/decisions/2026-06-20-csp-unsafe-inline-accepted-risk.md` (#778) — full rationale and a staged nonce-migration plan to remove `'unsafe-inline'`.

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

## Stateless session cookie has no server-side revocation mechanism (SE-L2, #1038)

- **Risk:** `chapa_session` is a fully stateless, AES-256-GCM-encrypted cookie (see `createSessionCookie`/`readSessionCookie` in `apps/web/lib/auth/github.ts:355-465`) whose only expiry check is the embedded `iat` timestamp, enforced against a 24h `SESSION_MAX_AGE_SECONDS` window on every read. There is no server-side session store or revocation list. `POST /api/auth/logout` (`apps/web/app/api/auth/logout/route.ts`) only clears the cookie client-side (`clearSessionCookie()`, `Max-Age=0`) — it does not and cannot invalidate a copy of the cookie value that has already been exfiltrated. A compromised `chapa_session` value remains valid until its 24h `iat`-based expiry elapses, regardless of logout. The only mass-invalidation lever is rotating `NEXTAUTH_SECRET`, which logs out every user on the platform.
- **Why accepted rather than fixed:** Adding real revocation (e.g., a per-user `sessionEpoch` checked in Redis on every request) would couple auth availability to Redis uptime on every single authenticated request — a new, permanent outage dependency for a system that today treats Redis as best-effort everywhere else. Making that check fail-open (to avoid introducing that outage vector, consistent with this project's existing fail-open rate-limiter philosophy — see the "Rate limiter fail-open (#398)" entry above) would silently defeat the very guarantee revocation exists to provide: during an active incident (the exact moment revocation matters most), a Redis blip would make the "revoked" session pass anyway. A fix that only works when the dependency it avoids coupling to happens to be up is not an improvement to the failure mode that matters.
- **Mitigating factors:** The 24h window bounds the blast radius of any single exfiltrated cookie — there is no indefinite-lifetime token in play. `NEXTAUTH_SECRET` rotation remains available as a full mass-invalidation escape hatch for a severe incident (e.g., confirmed credential-store compromise), at the cost of logging out all users.
- **Severity:** Low
- **See:** `apps/web/lib/auth/github.ts`, `apps/web/app/api/auth/logout/route.ts` — pre-launch audit finding SE-L2.
- **Accepted:** 2026-07-15

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

## LGPL-3.0 dependency (@img/sharp-libvips-darwin-arm64) (#676)

- **Risk:** `@img/sharp-libvips-darwin-arm64` (a platform binary bundled with `sharp`) is licensed LGPL-3.0-or-later. LGPL requires that end users can re-link the library with a modified version of it.
- **Accepted because:** `sharp` uses dynamic linking to libvips, which satisfies LGPL's re-linking requirement without any obligation on Chapa's part. We are not distributing the binary to end users as a standalone artifact, nor are we GPL-licensing our own code. This is the standard use pattern that LGPL explicitly permits for proprietary software.
- **Mitigation:** None required. LGPL-3.0 with dynamic linking imposes no restrictions on Chapa's code or distribution model.
- **Severity:** Low
- **Accepted:** 2026-04-03

## MPL-2.0 License (lightningcss) (#627)

- **Risk:** `lightningcss` and `lightningcss-darwin-arm64` are licensed under MPL-2.0, which is not in our stated license policy (MIT, Apache-2.0, BSD, ISC).
- **Accepted because:** MPL-2.0 is a weak copyleft that only requires sharing modifications to MPL-licensed files themselves — not the entire project. lightningcss is a build-time dependency (Tailwind CSS processor) that is not bundled into the production application. No MPL-licensed code is distributed to end users.
- **Mitigation:** None required. The dependency is transitive via Tailwind and not directly imported.
- **Severity:** Low
- **Accepted:** 2026-03-27

## DOMPurify transitive dependency license (PostHog toolbar)

- **Risk:** `dompurify@3.4.11` appears in the lockfile through PostHog's transitive dependency graph, and is also pinned by a root `pnpm.overrides` security floor. Its license expression is `(MPL-2.0 OR Apache-2.0)`.
- **Accepted because:** Chapa does not import DOMPurify directly; it is pulled in by PostHog tooling. The package offers Apache-2.0 as an alternative license, which is already on the project allowlist. The override keeps the transitive package on the patched floor without adding a runtime sanitizer dependency to application code.
- **Mitigation:** Keep the override until PostHog's dependency range guarantees the patched version. Re-check this entry during dependency upgrades and license audits.
- **Severity:** Low
- **Accepted:** 2026-06-21

## axe-core MPL-2.0 license (dev-only)

- **Risk:** `axe-core` (pulled in transitively for accessibility testing) is licensed under MPL-2.0, which is not in our stated license policy (MIT, Apache-2.0, BSD, ISC).
- **Accepted because:** `axe-core` is a `devDependency` used only by the a11y test suite — it is never imported by application code and never bundled into the production build. No MPL-licensed code is distributed to end users.
- **Mitigation:** None required. Confirmed dev-only via `pnpm audit`/license scan in every security agent cycle.
- **Severity:** None (dev-only)
- **Accepted:** 2026-07-15

## CC-BY-4.0 dependency (caniuse-lite) (#1012)

- **Risk:** `caniuse-lite` (transitive, via `browserslist` → Next.js/`styled-jsx`/`@babel/helper-compilation-targets`, and via `eslint-plugin-react-hooks` in dev) is licensed CC-BY-4.0 (Creative Commons Attribution), not in our stated license policy.
- **Accepted because:** CC-BY-4.0 is an attribution-only content license (not copyleft — it imposes no share-alike or source-disclosure obligation). `caniuse-lite` ships a static browser-support data table, not application logic; it's consumed at build time by Autoprefixer/Browserslist and is not modified or redistributed as a standalone work by Chapa.
- **Mitigation:** None required. Excluded from the license-compliance allowlist gate (`scripts/check-licenses.ts`, `DEFAULT_EXCLUDED_PACKAGES`).
- **Severity:** None
- **Accepted:** 2026-07-15

## Unlicense dependency (fast-sha256) (#1012)

- **Risk:** `fast-sha256` (transitive, via `resend`/`svix` → `standardwebhooks`, used for webhook HMAC signing) is released under the Unlicense — a public-domain dedication, not in our stated license policy.
- **Accepted because:** The Unlicense places the work in the public domain with no conditions whatsoever (no attribution, no share-alike, no restriction on use or redistribution) — strictly more permissive than MIT, which is already on the allowlist. There is no meaningful compliance risk.
- **Mitigation:** None required. Excluded from the license-compliance allowlist gate (`scripts/check-licenses.ts`, `DEFAULT_EXCLUDED_PACKAGES`).
- **Severity:** None
- **Accepted:** 2026-07-15

## MIT-0 dependency (postal-mime) (#1012)

- **Risk:** `postal-mime` (transitive, via `resend`, used for email parsing) is released under MIT-0 (MIT No Attribution), not in our stated license policy.
- **Accepted because:** MIT-0 is textually identical to MIT with the attribution clause removed — it is a strict subset of MIT's already-minimal obligations. No meaningful compliance difference from the allowlisted MIT license.
- **Mitigation:** None required. Excluded from the license-compliance allowlist gate (`scripts/check-licenses.ts`, `DEFAULT_EXCLUDED_PACKAGES`).
- **Severity:** None
- **Accepted:** 2026-07-15

## Infrastructure

## GitHub Advanced Security (code scanning + secret scanning) unavailable on repo tier

- **Risk:** Native GitHub code scanning (CodeQL) and secret scanning are disabled on this repository (`403`/`404` from the respective alert APIs) — GitHub Advanced Security is not licensed for private repositories on this plan tier, so these alert surfaces cannot be enabled without a paid upgrade.
- **Accepted because:** Equivalent coverage already runs in CI on every PR: the `Secret Scanning` workflow runs Gitleaks, and the `Security Scan` workflow runs `pnpm audit` (dependency vulnerabilities) and a license-compliance check. Weekly security-agent cycles independently re-verify secrets, dependency vulnerabilities, and license compliance against live source. Dependabot security alerts (a separate, unaffected feature) remain enabled with 0 open alerts.
- **Mitigation:** None required today. Re-evaluate if the repo tier changes or if GHAS becomes available for private repos on the current plan.
- **Severity:** Low
- **Accepted:** 2026-07-15

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

## Profile type threshold boundary (0.15 review-to-PR ratio)

- **Risk:** A developer with exactly 15% review rate sits on the solo/collaborative boundary. Crossing the threshold changes which Quality formula is used and whether Quality is included in the composite.
- **Mitigation:** The threshold is intentionally conservative (solo-favoring) because the collaborative path has a much stronger impact on scores. Edge cases near the boundary will see modest score changes when crossing. The threshold (0.15) is a shared constant (`SOLO_REVIEW_RATIO_THRESHOLD`) that can be tuned.
- **Severity:** Low
- **Accepted:** 2026-03-28

---

## Per-platform quality-signal availability

- **Risk:** PR-description, feature-branch, issue-linkage, batch-size, and lead-time signals are computed only from GitHub. GitLab, Bitbucket, and Codeberg do not expose them, so a profile whose merged work is mostly on those platforms has a Quality dimension based on limited data. For solo profiles, Quality is display-only and excluded from the composite.
- **Mitigation:** The share-page "How is my score calculated" panel states this per platform. Quality is never counted in the solo composite, so the gap does not depress the headline score for solo developers.
- **Severity:** Low
- **Accepted:** 2026-06-24

---

## In-memory inflight badge render map provides no cross-instance dedup (PE-L3)

- **Risk:** `inflightBadgeRenders` (`apps/web/app/u/[handle]/badge.svg/route.ts:50`) is a module-level `Map` used to coalesce concurrent badge render requests hitting the same serverless instance. On Vercel, each invocation typically runs on its own isolated instance, so this in-memory map rarely coalesces cross-instance concurrent requests — the real dedup mechanism is the Redis SETNX render lock plus stale-yesterday serve.
- **Mitigation:** The Redis lock (`acquireBadgeRenderLock`) and stale-serve fallback bound the blast radius regardless of whether the in-memory map fires; the map is a same-instance optimization only, not a correctness dependency. No unbounded growth risk — entries are cleaned up in a `finally` block after each render.
- **Severity:** Low
- **Accepted:** 2026-07-01

---

## Post-response side effects in badge route

- **Risk:** After rendering a badge SVG, side effects (metrics snapshot capture, analytics events, cache warm, verification record store) are scheduled with Next.js `after()` and run via `Promise.allSettled` in `runPublicProfileSideEffects` (`apps/web/lib/profile/public-profile.ts`). Individual rejections are absorbed by `allSettled` with no retry and no alert, and the side-effect path currently has no `captureServerError`/PostHog instrumentation — failures produce, at most, whatever each callee logs internally.
- **Mitigation:** Side effects are non-critical by design: the badge SVG is already returned to the requester before they run. Missing a single daily snapshot is acceptable — the next request or cron job (`/api/cron/warm-cache`) will fill the gap. A daily per-handle guard key (`sideeffects:done:{handle}:{date}`) prevents repeat work. This is intentional availability-first design; observability for this path is tracked as a follow-up improvement.
- **Severity:** Low
- **Accepted:** 2026-04-04

---

## ~~Public-page i18n requires dynamic rendering (2026-05-02)~~ — Resolved

- **Risk:** All translated public pages used `export const dynamic = 'force-dynamic'`, disabling ISR/static caching. First-byte time was per-request rather than served from CDN cache.
- **Resolution:** Content pages now use `force-static` / ISR (v2.11.0). Pages are statically rendered at `DEFAULT_LOCALE` (`es`) at build/revalidation time and served from CDN. Non-default-locale users (English) receive the `es`-rendered HTML from the CDN; their locale is applied client-side on mount from the `chapa-locale` cookie (brief locale flash acceptable — see new risk below).
- **Severity:** None (resolved)
- **Accepted:** 2026-05-02 | **Updated:** 2026-06-19

## Static content pages render at DEFAULT\_LOCALE; non-default locale applied client-side (2026-06-19)

- **Risk:** Content pages (about, archetypes, privacy, terms, etc.) are CDN-cached at `DEFAULT_LOCALE` (`es`). A user whose `chapa-locale` cookie is `en` receives Spanish server-rendered HTML and sees a brief locale flash on mount as the client applies the English dictionary.
- **Mitigation:** Intentional tradeoff to keep content pages CDN-cacheable (ISR). The flash is short (<100 ms on fast connections) and affects only users who have explicitly switched to English. Full per-locale SSR would require per-locale route segments (e.g., `/en/about`) — a significant routing change deferred to a future milestone. The badge SVG endpoint (`/u/:handle/badge.svg`) and share page are unaffected.
- **Severity:** Low
- **Accepted:** 2026-06-19

---

## useTranslation fallback locale is English, not app default (2026-05-03)

- **Risk:** `useTranslation()` falls back to English (`'en'`) when called outside a `LanguageProvider`. The app default locale is Spanish (`'es'`). Any client component rendered outside the provider tree (e.g., in tests, Storybook, isolated embeds) will display English strings.
- **Mitigation:** All public-facing pages wrap children in `LanguageProvider` via `layout.tsx`. Tests exercise English strings via the fallback intentionally. The fallback behavior is documented and logged with `console.warn`. No production path renders outside the provider.
- **Severity:** Low
- **Accepted:** 2026-05-03

---

## Review schedule

These accepted risks should be re-evaluated:
- When upgrading Next.js major versions (CSP nonce support may land)
- When adding new admin functionality (middleware protection becomes more valuable)
- Quarterly as part of routine security review
