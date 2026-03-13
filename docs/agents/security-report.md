# Security Report
> Generated: 2026-03-09 | Health status: GREEN

## Executive Summary

The Chapa codebase maintains a strong security posture with zero dependency vulnerabilities, no hardcoded secrets, comprehensive XSS protection in the SVG pipeline, proper secret isolation, and full Supabase RLS coverage across all 6 tables. No blockers or regressions since the last audit (2026-03-02).

## Dependency Vulnerabilities

| Severity | Count | Details |
|----------|-------|---------|
| Critical | 0 | — |
| High | 0 | — |
| Medium | 0 | — |
| Low | 0 | — |

`pnpm audit` reports **no known vulnerabilities**. The previous `minimatch` ReDoS (dev-only, via eslint) has been resolved since the 2026-03-02 audit.

## Unused Dependencies (Attack Surface)

`npx knip` reports **clean** — no unused files, exports, or dependencies detected.

## Code Findings

### Hardcoded Secrets — CLEAR

- All 10 server-side secrets stored in `.env.local` (gitignored, never committed)
- All env var reads use `.trim()` to prevent whitespace-induced auth failures
- No secrets in `NEXT_PUBLIC_*` variables — only public analytics keys and feature flags
- Test files use properly-mocked credentials (`gho_test`, `sk-test`, etc.)
- Git history clean of accidentally-committed credentials

### SVG XSS Prevention — SECURE

All user-controlled input is escaped via `escapeXml()` (`apps/web/lib/render/escape.ts:11-18`) before SVG rendering:

| Entry Point | File:Line | Escaped |
|-------------|-----------|---------|
| User handle | `BadgeSvg.tsx:25` | `escapeXml(stats.handle)` |
| Display name | `BadgeSvg.tsx:27` | `escapeXml(stats.displayName)` |
| Avatar data URI | `BadgeSvg.tsx:140` | `escapeXml(avatarDataUri)` |
| Archetype label | `BadgeSvg.tsx:164` | `escapeXml(archetypeText)` |
| Tier label | `BadgeSvg.tsx:221` | `escapeXml(impact.tier)` |
| Verification hash | `VerificationStrip.ts:13-14` | `escapeXml()` |
| Fallback SVG | `badge.svg/route.ts:35,41` | `escapeXml()` |

XSS tests exist at `BadgeSvg.test.tsx:600-626` covering `<script>`, `onload=`, and event handler injection.

### Secret Leakage — CLEAR

- `SUPABASE_SERVICE_ROLE_KEY` — server-only (`lib/db/supabase.ts:16`)
- `GITHUB_CLIENT_SECRET` — server-only (`api/auth/callback/route.ts:84`)
- `NEXTAUTH_SECRET` — server-only (session creation, admin auth, badge route)
- `CHAPA_VERIFICATION_SECRET` — server-only (`lib/verification/hmac.ts:46`)
- OAuth tokens encrypted at rest with AES-256-GCM before storage in `user_platforms` table

### CORS Configuration — APPROPRIATE

| Route | CORS | Justification |
|-------|------|---------------|
| `/api/verify/[hash]` | `Access-Control-Allow-Origin: *` | Intentional — public verification endpoint, read-only, rate-limited (30 req/60s) |
| All other routes | Same-origin (default) | No CORS headers set |

CSP headers in `next.config.ts:17-88`: badge SVG allows `frame-ancestors *` (embeddable), all other routes set `frame-ancestors 'none'` + `X-Frame-Options: DENY`.

### Supabase RLS — COMPLETE

| Table | RLS Enabled | Policy |
|-------|-------------|--------|
| `users` | Yes | `deny_anon_all` (ALL ops denied for anon) |
| `metrics_snapshots` | Yes | `deny_anon_all` |
| `verification_records` | Yes | `deny_anon_all` |
| `merge_operations` | Yes | `deny_anon_all` |
| `feature_flags` | Yes | `feature_flags_read_all` (SELECT only) + `deny_anon_all` (write-protected) |
| `user_platforms` | Yes | `deny_anon_user_platforms` |

- Views use `security_invoker = true` to prevent privilege escalation
- Service role key used exclusively server-side — no anon key in codebase
- All DB wrapper functions fail gracefully when Supabase is unavailable

### OAuth Security — SECURE

- All 3 GitHub OAuth fetches now have `AbortSignal.timeout(10000)` — resolves the previously flagged indefinite hang risk (`lib/auth/github.ts:118,142,180`)
- Bitbucket and Codeberg OAuth equivalents already had timeouts
- Token exchange uses server-side fetch only
- State parameter validated with timing-safe comparison

## License Compliance

| Package | License | Risk |
|---------|---------|------|
| `@img/sharp-libvips-darwin-arm64` | LGPL-3.0 | **None** — dynamically linked native binary, no source modification, no compliance action needed |

All other dependencies use MIT, Apache-2.0, BSD, or ISC licenses. No copyleft violations.

## Resolved Since Last Audit (2026-03-02)

1. **`minimatch` ReDoS (high, dev-only)** — No longer reported by `pnpm audit`. Resolved via dependency updates.
2. **GitHub OAuth timeout gap** — All 3 functions (`exchangeCodeForToken`, `fetchGitHubUser`, `fetchGitHubUserEmail`) now have `AbortSignal.timeout(10000)`.
3. **`badge:notified:*` indefinite TTL concern** — Confirmed 365-day TTL (not indefinite) by cost analyst.

## Recommendations

| Priority | Item | Status |
|----------|------|--------|
| Low | Monitor `@img/sharp-libvips-darwin-arm64` LGPL-3.0 on future updates | Ongoing |
| Low | Consider periodic audit of `user_platforms` encrypted token format if key rotation is implemented | Future |

No blocking or high-priority security items.
