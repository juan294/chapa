# Security Report
> Generated: 2026-04-20 | Health status: green

## Executive Summary

Zero vulnerabilities in production dependencies (vite was bumped to ≥8.0.8 in triage 2026-04-17, resolving prior dev-only CVEs). All security controls remain intact — XSS escaping, RLS, CORS posture, secret isolation, and license compliance are unchanged from the 2026-04-13 baseline. One carried item: `lib/analytics/server-errors.ts` SENSITIVE_PATTERNS scrubbing branches (63.63%) lack test coverage, flagged by coverage agent — adding tests is the only open recommendation.

## Dependency Vulnerabilities

| Severity | Package | Issue | Fix |
|----------|---------|-------|-----|
| — | — | No known vulnerabilities found (`pnpm audit` clean) | — |

**Notes:**
- Previous high/moderate findings in `vite <7.3.2` (GHSA-xxx, dev-only via vitest) were resolved in triage 2026-04-17 by bumping vite ≥8.0.8, jsdom ≥29.0.2, vitest 4.1.4.
- All production dependencies are clean.

## Knip Analysis (Attack Surface)

`npx knip --production` reports **8 packages** as "unused" — all are confirmed false positives (same 8 as 2026-04-13):

| Package | False Positive Reason |
|---------|----------------------|
| `@resvg/resvg-js` | Used in `svg-to-png.ts` (OG image route) |
| `@vercel/analytics` | Used in `layout.tsx` Analytics component |
| `@vercel/speed-insights` | Used in `layout.tsx` SpeedInsights component |
| `canvas-confetti` | Used in experiments page |
| `next-themes` | Used in ThemeProvider/ThemeToggle |
| `posthog-js` | Used in PostHog client provider |
| `resend` | Used in email campaign routes |
| `svix` | Used in webhooks/resend verification |

`vitest.setup.ts` flagged as unused file — it is registered in `vitest.config.ts:12 setupFiles`. All 8 packages are in active use. **Do not remove any of these.**

## Code Findings

- **[INFO] XSS — SAFE**: 9 user-input entry points in SVG pipeline (`stats.handle`, `stats.displayName`, `impact.tier`, `impact.archetype`, `verificationHash`, `verificationDate`, `avatarDataUri`, etc.) all escaped via `escapeXml()` in `apps/web/lib/render/escape.ts`. Explicit XSS tests at `BadgeSvg.test.tsx:59–65`. 18 `dangerouslySetInnerHTML` uses — all safe (server-rendered SVG with escaped inputs; JSON-LD via `JSON.stringify()`).

- **[INFO] Avatar URL — SAFE**: `fetchAvatarBase64()` (`lib/render/avatar.ts:8–43`) enforces hostname whitelist (`avatars.githubusercontent.com` only), MIME type whitelist (`image/png|jpeg|gif|webp`), and 5s abort timeout. Returns `undefined` on any validation failure.

- **[INFO] Secret leaks — NONE**: No hardcoded tokens, API keys, or passwords found in source. `SENSITIVE_PATTERNS` regex (9 patterns) in `lib/analytics/server-errors.ts` scrubs tokens before PostHog logging. All `NEXT_PUBLIC_*` vars are non-sensitive.

- **[INFO] CORS — INTENTIONAL**: 2 routes with wildcard `Access-Control-Allow-Origin: *` — `/api/verify/[hash]` (30 req/60s rate limit) and `/api/profile/[handle]` (60 req/60s rate limit). Both are read-only public endpoints by design. All 17 mutation endpoints (POST/PUT/PATCH/DELETE) have no CORS headers, relying on browser same-origin enforcement + server-side auth.

- **[INFO] RLS — COMPREHENSIVE**: All 9 Supabase tables have `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY` + explicit deny-all policies for the anon role (migrations 002, 008, 018). Both views (`latest_snapshots`, `admin_users`) use `security_invoker = true` (migration 014). Application exclusively uses `SUPABASE_SERVICE_ROLE_KEY` server-side — no anon key exposed.

- **[INFO] OAuth — STRONG**: CSRF state validated via `timingSafeEqual()`. OAuth tokens encrypted AES-256-GCM (fresh IV per call). CLI tokens HMAC-SHA256 signed with 90-day expiry. Session cookies: `HttpOnly`, `SameSite=Lax`, `Secure`, 10-minute `Max-Age`.

- **[INFO] Fetch timeouts — 100%**: All external calls use `AbortSignal.timeout()` or `withTimeout()` wrapper. Confirmed across GitHub, Supabase, Bitbucket, Codeberg, PostHog, OG image, sync-audience routes.

- **[P2] SENSITIVE_PATTERNS test gap**: `lib/analytics/server-errors.ts` branches at 63.63% (carried from coverage agent 2026-04-20). The 9 SENSITIVE_PATTERNS regex branches (token scrubbing before error logs) lack test coverage. These are the guards that prevent accidental secret leakage in PostHog events. Tests should cover all 9 pattern types (Bearer tokens, ghp_ prefixes, sk_live_, etc.) to confirm scrubbing fires correctly.

## License Compliance

| Package | License | Status |
|---------|---------|--------|
| `@resvg/resvg-js` | MPL-2.0 | Acceptable — file-level copyleft, binary usage only, no source modifications |
| `lightningcss` | MPL-2.0 | Acceptable — file-level copyleft, binary usage only, no source modifications |
| `dompurify` | Apache-2.0 OR MPL-2.0 | Acceptable — dual-license, Apache-2.0 applies |
| All others | MIT / ISC / Apache-2.0 / BSD | All clear |

No GPL, AGPL, or LGPL licenses detected. MPL-2.0 is file-level copyleft and requires sharing modifications to the MPL-licensed files themselves — since we use these as unmodified binary dependencies, there is no compliance obligation. **No action required.**

## Recommendations

1. **[P2] Add SENSITIVE_PATTERNS branch tests** (`lib/analytics/server-errors.ts`): Write tests covering all 9 token-scrubbing regex patterns to confirm they fire before PostHog event submission. This closes the 63.63% branch coverage gap flagged by the coverage agent and validates a security-critical code path. Priority: medium — no known leakage, but the guard is untested.

2. **[INFO] Knip false positives**: The 8 flagged packages are all in active use. Do not remove them. Knip's production entry-point graph misses dynamic imports and JSX component references in this configuration.

3. **[MONITOR] Dependency audit cadence**: `pnpm audit` is now clean. Continue running weekly — the previous vite vulnerability was dev-only and resolved promptly.
