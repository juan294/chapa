# Accepted Risks & Known Limitations

> Last reviewed: 2026-08-18 | Audit: v43

Documented security, infrastructure, and performance decisions that were evaluated during pre-launch audits and accepted as reasonable tradeoffs. Items here are intentional and should not be flagged as warnings in audits.

---

## Project scale policy: no new gates, monitoring infra, or disproportionate hardening (2026-08-18)

- **Risk:** Chapa is maintained by a single developer with a very small user base. Pre-launch audits are written from a general "public launch under scrutiny" posture and will keep proposing things that are good practice for a funded team with an on-call rotation and real attack surface at scale: new CI gates, expanded coverage-floor enforcement, third-party uptime monitors, alert deduplication/throttling systems, paid log-retention integrations, secret-rotation runbooks, supply-chain checksum pinning, least-privilege CI permission audits, and defensive hardening against threat models (sustained abuse traffic, tail-latency SLO breaches, IP-spoofing edge cases) that don't apply at this project's actual scale.
- **Why accepted:** More gates and more process are themselves a cost — for a solo maintainer, every new CI check, coverage floor, monitoring dashboard, or runbook is something *they* personally have to maintain, and a false-positive/red gate blocks *their own* ability to ship, with no team to absorb the friction. This project has already accumulated more CI/release-process machinery (E2E Pro release verification, multi-stage evidence pipeline, license/vulnerability scanning, migration-drift gates, contract tests, bundle-size budgets, etc.) than a solo project with barely any users needs, and the explicit direction going forward is to *not* add to that pile. A finding that only makes sense under a "large team, many users, adversarial attacker, formal incident response" threat model is out of scope here, even if it would be correct advice for a bigger project.
- **What this covers (reject, do not re-raise as findings):** proposals to add new CI gates, git hooks, or lint/typecheck/coverage enforcement scope; new external monitoring/alerting services or infrastructure (uptime monitors, alert dedup/throttling, log-retention/APM integrations, multi-sample SLO monitoring); security/privacy hardening sized for an adversary or user volume this project doesn't have (rate-limit tightening against abuse with no realistic attacker, IP-spoofing edge cases, CI supply-chain checksum pinning, GitHub Actions least-privilege permission audits, secret-rotation documentation, Node-version dashboard-drift insurance); and architecture-purity refactors proposed for their own sake (e.g., "consolidate N duplicate implementations into one contract") where the current code works and nothing is actually broken.
- **What this does NOT cover:** genuine bugs that affect the product or data — a route that returns wrong data, a cache that never gets invalidated, a UI state a real visitor can hit, data corruption, or a durable write that silently fails. Those get fixed regardless of user count. The line is "does this fix something that's actually broken" vs. "does this add ceremony/infrastructure that only pays off at a scale or threat level this project isn't at."
- **Mitigation:** None needed — this is a standing policy, not a specific technical risk. `/pre-launch` and `/remediate` should read this entry and not raise or re-raise findings in the categories above for this project.
- **Severity:** N/A (process policy, not a technical risk)
- **Accepted:** 2026-08-18

---

## Pending-migrations gate tolerates one migra artifact on `admin_users` (#1064)

- **Risk:** `pnpm run check:pending-migrations` treats a schema diff consisting *solely* of a `drop view` + `create or replace view` pair for `public.admin_users`, matching one exact pinned body, as clean. An `admin_users` change that normalized to precisely that text would pass unnoticed.
- **Why accepted:** The tolerated text is what the view already is, so reaching it requires changing the view to itself. migra emits this block on every run against the production project even when nothing differs — verified read-only on 2026-08-11: production's `pg_get_viewdef('public.admin_users')` is textually identical to what `014_views_security_invoker.sql` produces, `pg_class.reloptions` is `{security_invoker=true}` as that migration sets, and the emitted block is byte-for-byte identical (674 characters) whether or not a migration recreates the view. No migration content can silence it, which is why `032_reconcile_remote_schema.sql` deliberately omits the view. Without this tolerance the gate blocks *every* release PR, including ones that change no migrations — which is how it behaved when it first started running, and a gate that always fails is a gate nobody reads.
- **Mitigation:** The tolerance is pinned to the exact statement pair, whitespace-normalized, in `TOLERATED_MIGRA_ARTIFACT` (`scripts/check-pending-migrations.ts`). Three regression tests in `check-pending-migrations.test.ts` assert that the gate still blocks when the artifact is accompanied by any other statement, when the `admin_users` body genuinely changes, and when the same body shape appears for a different view. Real drift in any other object is unaffected. The proper fix is replacing migra with schema introspection, tracked in #1064.
- **Severity:** Low (one admin-only view, pinned body, blocking behavior preserved everywhere else)
- **Accepted:** 2026-08-11

---

## Production migration-history label mismatch on version 004 (#1064)

- **Risk:** Production's applied-migrations history records version `004` under the name `add_agent_feature_flags` — the name that belongs to `005` — while the repository file at that version is `004_add_user_email.sql`. A history table entry has the wrong label for its version.
- **Why accepted:** This is bookkeeping only, not schema drift. The schema production actually holds matches the repository file exactly: `users.email` (text, nullable) and `users.email_notifications` (boolean, NOT NULL, default true) both exist as `004_add_user_email.sql` specifies, verified read-only against production on 2026-08-11. `check:pending-migrations` diffs schema state, not migration-history labels, so this mismatch does not affect the gate — confirmed passing on PR #1063's linked-production CI run after the `032_reconcile_remote_schema.sql` reconciliation.
- **Mitigation:** None required — correcting a Supabase migration-history label retroactively risks its own drift for zero schema benefit. Re-evaluate only if the Supabase CLI ever begins validating history labels against file names as part of `db diff`.
- **Severity:** Low (cosmetic, no schema or gate impact)
- **Accepted:** 2026-08-18

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
- **Mitigation:** Admin access requires both a valid authenticated session AND
  the user's GitHub handle being present in the `ADMIN_HANDLES` environment
  variable. Component- and handler-level protection rejects unauthorized
  requests before any admin data is returned. The current surface is one
  dashboard plus 12 API route handlers, including campaign mutation and send
  operations; each handler enforces the appropriate shared admin or
  bearer-token guard.
- **Severity:** Low
- **Future improvement:** Re-evaluate a route-wide `proxy.ts` admin guard if the
  surface grows further; handler-level authorization remains authoritative.

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

- **Risk:** `@resvg/resvg-js@2.6.2` (and its platform-specific binary
  `@resvg/resvg-js-darwin-arm64`) uses MPL-2.0 (weak copyleft), which is outside
  the project's permissive-license allowlist. Used for SVG-to-PNG rendering in
  OG image generation.
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

- **Risk:** `lightningcss` and `lightningcss-darwin-arm64` are licensed under
  MPL-2.0, which is outside the project's permissive-license allowlist.
- **Accepted because:** MPL-2.0 is a weak copyleft that only requires sharing modifications to MPL-licensed files themselves — not the entire project. lightningcss is a build-time dependency (Tailwind CSS processor) that is not bundled into the production application. No MPL-licensed code is distributed to end users.
- **Mitigation:** None required. The dependency is transitive via Tailwind and not directly imported.
- **Severity:** Low
- **Accepted:** 2026-03-27

## DOMPurify transitive dependency license (PostHog toolbar)

- **Risk:** `dompurify@3.4.13` appears in the lockfile through PostHog's transitive dependency graph, and is also pinned by a root `pnpm.overrides` security floor. Its license expression is `(MPL-2.0 OR Apache-2.0)`.
- **Accepted because:** Chapa does not import DOMPurify directly; it is pulled in by PostHog tooling. The package offers Apache-2.0 as an alternative license, which is already on the project allowlist. The override keeps the transitive package on the patched floor without adding a runtime sanitizer dependency to application code.
- **Mitigation:** Keep the override until PostHog's dependency range guarantees the patched version. Re-check this entry during dependency upgrades and license audits.
- **Severity:** Low
- **Accepted:** 2026-06-21

## axe-core MPL-2.0 license (dev-only)

- **Risk:** `axe-core` (pulled in transitively for accessibility testing) is
  licensed under MPL-2.0, which is outside the project's permissive-license
  allowlist.
- **Accepted because:** `axe-core` is a `devDependency` used only by the a11y test suite — it is never imported by application code and never bundled into the production build. No MPL-licensed code is distributed to end users.
- **Mitigation:** None required. Confirmed dev-only via `pnpm -r why axe-core` and the license scan in security-agent cycles.
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
- **Accepted because:** Equivalent coverage already runs in CI on every PR: the `Secret Scanning` workflow runs Gitleaks, and the `Security Scan` workflow runs the OSV-backed `pnpm run check:vulnerabilities` gate plus `pnpm run check:licenses`. Weekly security-agent cycles independently re-verify secrets, dependency vulnerabilities, and license compliance against live source. Dependabot security alerts are a separate, unaffected surface and remain enabled.
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

## ~~Static content pages render at DEFAULT_LOCALE; non-default locale applied client-side (2026-06-19)~~ — Resolved

- **Risk:** Content pages (about, archetypes, privacy, terms, etc.) were CDN-cached at `DEFAULT_LOCALE` (`es`). A user whose `chapa-locale` cookie was `en` received Spanish server-rendered HTML and saw a brief locale flash on mount as the client applied the English dictionary.
- **Resolution:** The deferred "future milestone" this entry anticipated shipped as #1023 (FE-H1): the 9 content pages moved to per-locale route segments (`app/[locale]/...`), with a narrowly-scoped `apps/web/proxy.ts` rewriting the canonical unprefixed URL to the internal locale route. Both `en`/`es` variants are pre-rendered at build time, so the rewrite always resolves to a cache hit — no client-side re-render, no flash, and ISR/CDN caching is preserved. See `docs/decisions/2026-07-15-i18n-middleware-carve-out.md`. The shared nav/command-bar chrome (not the page bodies) still renders via the client `LanguageProvider` and may show a brief flash on non-default-locale loads — a much narrower, accepted residual, out of scope for #1023.
- **Severity:** None (resolved for the 9 content pages)
- **Accepted:** 2026-06-19 | **Resolved:** 2026-07-15

---

## useTranslation fallback locale is English, not app default (2026-05-03)

- **Risk:** `useTranslation()` falls back to English (`'en'`) when called outside a `LanguageProvider`. The app default locale is Spanish (`'es'`). Any client component rendered outside the provider tree (e.g., in tests, Storybook, isolated embeds) will display English strings.
- **Mitigation:** All public-facing pages wrap children in `LanguageProvider` via `layout.tsx`. Tests exercise English strings via the fallback intentionally. The fallback behavior is documented and logged with `console.warn`. No production path renders outside the provider.
- **Severity:** Low
- **Accepted:** 2026-05-03

---

## OAuth app requests no `repo` scope — user refresh cannot see private repos (2026-07-16)

- **Risk:** The GitHub OAuth login requests only `read:user user:email` (`lib/auth/github.ts`, `OAUTH_SCOPES`). A user's session token therefore cannot read their private repositories, so `/api/refresh` sees only public merged PRs. GitHub offers no read-only classic scope for private repos — `repo` grants full read/write.
- **Decision (owner, 2026-07-16):** keep the narrow scopes. Asking every user for full private-repo access to render a badge is a disproportionate trust demand, and existing users would all have to re-consent.
- **Mitigation:** post-#1050, a scope-blind refresh is labeled `fetchScope: "public"` and can never outrank or overwrite the server token's complete data — it is *rejected* (last-known-good served), not corrupting. Post-#1060 that holds for **every** data source, not just GitHub: rejection now serves the last-known-good GitHub-derived data re-composed with the current EMU supplemental and linked-platform stats. Previously rejection re-cached a baseline that had never seen the current supplemental, so a refresh taken right after `chapa merge` silently discarded the merge for 6h — the one case where rejection *was* corrupting. The hourly `warm-cache` cron (#1052) refreshes every score with the `repo`-scoped server `GITHUB_TOKEN`, so freshness no longer depends on user-initiated refreshes. `/api/health` asserts the server token retains `repo` (`insufficient_scope` otherwise, #1047). If `repo` is ever added to `OAUTH_SCOPES`, `fetchScope` updates automatically — it derives from the same constant.
- **Severity:** Low (a private-heavy user's manual Refresh is a near-no-op; the cron covers freshness within the hour)
- **Accepted:** 2026-07-16

---

## Consistency dimension weights window tenure three ways (2026-07-16)

- **Risk / observation:** all three Consistency terms — streak (`sqrt(activeDays/365)`), evenness (CV over 52 weeks incl. pre-tenure zero-weeks), and weekCoverage (`activeWeeks/totalWeeks`) — penalize the same underlying fact for accounts younger than the 365-day window. A perfectly consistent 6-month developer (e.g. 180 active days, 100% coverage since starting) scores ~61, below an erratic 12-month one.
- **Decision (owner, 2026-07-16):** working as intended. The product's stated claim is "Impact over the last 12 months"; sustaining activity across a full year *is* the thing being measured, and the score climbing as the window fills (verified: 23 → 41 → 61 over five months for a real profile) is what makes the number meaningful. The `Emerging` archetype exists precisely to represent newer accounts.
- **Mitigation:** none needed. If this is ever revisited, it is a product redesign requiring an ADR and a recompute for all users (options documented in the 2026-07-16 session: scope evenness/weekCoverage to observed tenure with a minimum-window floor), not a bug fix.
- **Severity:** None (documented design intent)
- **Accepted:** 2026-07-16

---

## Review schedule

These accepted risks should be re-evaluated:
- When upgrading Next.js major versions (CSP nonce support may land)
- When adding new admin functionality (middleware protection becomes more valuable)
- Quarterly as part of routine security review
