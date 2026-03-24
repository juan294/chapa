# Security Report
> Generated: 2026-03-23 | Branch: `develop` | Health status: **GREEN**

## Executive Summary

The Chapa codebase maintains excellent security posture across all audit areas. Zero dependency vulnerabilities, zero hardcoded secrets, comprehensive XSS protection in SVG rendering, full RLS coverage on all Supabase tables, and no secret leakage to client-side code. One informational license finding (LGPL-3.0, dynamically linked — no action needed).

## Dependency Vulnerabilities

| Severity | Package | Issue | Fix |
|----------|---------|-------|-----|
| — | — | No known vulnerabilities found | — |

`pnpm audit` returned clean. 0 critical, 0 high, 0 medium, 0 low.

## Unused Dependencies (Attack Surface)

`npx knip` returned clean (exit 0, no findings). No unused dependencies, exports, or files flagged. This is an improvement from the previous audit (2026-03-12) which had 60 unused exports — all have been cleaned up.

## Code Findings

### Hardcoded Secrets — CLEAN

- Searched all source files for API key patterns (`sk_*`, `ghp_*`, `gho_*`, `AKIA*`), password assignments, generic secret literals, URLs with embedded credentials, and long base64 strings.
- **0 real leaks found.** All matches were test fixtures with safe placeholder values (e.g., `phc_test_key_123`, `gho_token`).
- All 10 server secrets are read from environment variables with `.trim()` applied.

### SVG XSS Protection — GREEN

All user-controlled input in SVG rendering is escaped via `escapeXml()` (`apps/web/lib/render/escape.ts:18-25`):

| Input | Escaped at | File:Line |
|-------|-----------|-----------|
| `handle` | `escapeXml(stats.handle)` | `BadgeSvg.tsx:40` |
| `displayName` | `escapeXml(stats.displayName)` | `BadgeSvg.tsx:41-43` |
| `archetype` | `escapeXml(archetypeText)` | `BadgeSvg.tsx:179` |
| `tier` | `escapeXml(impact.tier)` | `BadgeSvg.tsx:236` |
| `avatarDataUri` | `escapeXml(avatarDataUri)` | `BadgeSvg.tsx:155` |
| Fallback handle | `escapeXml(handle)` | `badge.svg/route.ts:36` |
| Fallback error | `escapeXml(message)` | `badge.svg/route.ts:42` |
| Verification hash | `escapeXml(hash)` | `VerificationStrip.ts:13` |
| Verification date | `escapeXml(date)` | `VerificationStrip.ts:14` |

- XSS-specific tests at `BadgeSvg.test.tsx:59-65` confirm `<script>` injection is escaped.
- Avatar URLs validated to `avatars.githubusercontent.com` only (`avatar.ts:23-27`).
- `escapeXml()` covers all 5 XML special chars: `&`, `<`, `>`, `'`, `"`.

### Client-Side Secret Leakage — CLEAN

- All 8 `NEXT_PUBLIC_*` variables are non-sensitive (feature flags, analytics key, base URL).
- Server secrets (`SUPABASE_SERVICE_ROLE_KEY`, `NEXTAUTH_SECRET`, `GITHUB_CLIENT_SECRET`, `ADMIN_SECRET`, `CRON_SECRET`, `CHAPA_VERIFICATION_SECRET`, `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`) are isolated to server-side code only.
- Supabase client (`lib/db/supabase.ts:26`) uses service role key server-side with `persistSession: false`.
- No API route returns secrets in response bodies.
- Error logging scrubs tokens via regex before PostHog.

### CORS Headers — GREEN (Intentional Design)

| Endpoint | CORS Policy | Rationale |
|----------|-------------|-----------|
| `/u/:handle/badge.svg` | `frame-ancestors *` | Embeddable in READMEs/iframes |
| `/api/verify/:hash` | `Access-Control-Allow-Origin: *` | Public verification API, rate-limited 30/60s |
| All other routes | `X-Frame-Options: DENY`, `frame-ancestors 'none'` | Default strict policy |

- Only `/api/verify/:hash` sets `Access-Control-Allow-Origin: *` — intentional, read-only, rate-limited.
- Global security headers in `next.config.ts:48-65`: HSTS (2yr + preload), nosniff, X-XSS-Protection, strict Referrer-Policy, restrictive Permissions-Policy.
- CSP properly scoped for PostHog and badge embedding.

### Supabase RLS — GREEN (All 9 Tables + 2 Views)

| Table | RLS Enabled | Deny Policy |
|-------|:-----------:|:-----------:|
| `users` | Yes | `deny_anon_all` |
| `metrics_snapshots` | Yes | `deny_anon_all` |
| `verification_records` | Yes | `deny_anon_all` |
| `feature_flags` | Yes | `deny_anon_all` (SELECT permitted — flags are public) |
| `merge_operations` | Yes | `deny_anon_all` |
| `user_platforms` | Yes | `deny_anon_user_platforms` |
| `tool_insights` | Yes | `deny_anon_tool_insights` |
| `email_campaigns` | Yes | `deny_anon_email_campaigns` |
| `campaign_sends` | Yes | `deny_anon_campaign_sends` |

- Views (`latest_snapshots`, `admin_users`) use `security_invoker = true`.
- All access uses `SUPABASE_SERVICE_ROLE_KEY` (server-side only) — RLS is defense-in-depth.

### Authentication & Cryptography — GREEN

- OAuth tokens encrypted with **AES-256-GCM** (fresh 12-byte IV per encryption) before cookie storage.
- CSRF state validated via `crypto.timingSafeEqual()`.
- Admin bearer token compared with constant-time `safeEqual()`.
- CLI tokens signed with HMAC-SHA256, verified with `timingSafeEqual()`, 90-day expiry.
- Session cookies: `HttpOnly`, `SameSite=Lax`, `Secure` (HTTPS), 10-minute `Max-Age`.
- Resend webhook verified via Svix HMAC.
- Badge verification via HMAC-SHA256 with `CHAPA_VERIFICATION_SECRET`.

### Rate Limiting — GREEN

- 14+ routes with rate limiting coverage.
- All fail-open by design (availability-first — documented in `redis.ts`).
- Admin routes rate-limited via `adminAuth()` (10 req/IP/60s).
- Campaign email system: 95/day send quota, batch size 50, Redis counter.
- Fetch timeout coverage: **100%** — all external calls use `AbortSignal.timeout()`.

## License Compliance

| Package | License | Risk | Action |
|---------|---------|------|--------|
| `@img/sharp-libvips-darwin-arm64` | LGPL-3.0-or-later | None | Dynamically linked — no compliance action needed |

All other dependencies use permissive licenses (MIT, Apache-2.0, BSD, ISC). No copyleft violations.

## Recommendations

| Priority | Item | Status |
|----------|------|--------|
| Info | LGPL-3.0 in sharp-libvips (dynamically linked) | Accepted — no action needed |
| Info | `Access-Control-Allow-Origin: *` on `/api/verify` | Intentional — public, read-only, rate-limited |
| Info | Fail-open rate limiting | Intentional — availability-first, documented |

No blockers, warnings, or action items. All previous security recommendations have been addressed.

## Delta from Previous Audit (2026-03-16)

| Area | Previous | Current | Change |
|------|----------|---------|--------|
| Vulnerabilities | 0 | 0 | No change |
| Secret leaks | 0 | 0 | No change |
| License issues | 1 (LGPL, accepted) | 1 (LGPL, accepted) | No change |
| RLS tables | 10 (all covered) | 9 tables + 2 views (all covered) | Consistent |
| Knip findings | 1 config hint | 0 | Improved |
| XSS vectors | All escaped | All escaped | No change |
| Fetch timeouts | 100% | 100% | No change |
| Rate-limited routes | 14+ | 14+ | No change |

**Verdict: GREEN — no regressions, minor improvement in knip cleanliness.**
