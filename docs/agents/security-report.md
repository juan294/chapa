# Security Report
> Generated: 2026-03-16 | Health status: GREEN

## Executive Summary

The Chapa codebase maintains a strong security posture with zero dependency vulnerabilities, no hardcoded secrets, comprehensive XSS protection in SVG rendering, and RLS enabled on all 10 Supabase tables. No regressions since the 2026-03-09 audit. New campaign email system (tables + API routes) follows existing security patterns correctly.

## Dependency Vulnerabilities

| Severity | Package | Issue | Fix |
|----------|---------|-------|-----|
| — | — | No known vulnerabilities found | — |

`pnpm audit` reports clean across all workspaces. Previous `minimatch` ReDoS (dev-only) remains resolved.

## Code Findings

### Hardcoded Secrets: NONE

- All 10 server-side secrets accessed via `process.env` with `.trim()` — no hardcoded values in source
- Test files use placeholder tokens (`ghp_test`, `sk-test-key`) — expected and excluded from production builds
- Error logging (`lib/analytics/server-errors.ts:16-30`) scrubs GitHub tokens, API keys, and Bearer tokens before sending to PostHog
- `.env.example` contains only empty placeholders

### Client-Side Secret Exposure: NONE

- `SUPABASE_SERVICE_ROLE_KEY`, `NEXTAUTH_SECRET`, `GITHUB_CLIENT_SECRET`, `ADMIN_SECRET`, `CRON_SECRET`, `CHAPA_VERIFICATION_SECRET`, `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET` — all server-only
- 7 `NEXT_PUBLIC_*` vars are non-sensitive (PostHog key/host, feature flags, base URL)
- `NEXT_PUBLIC_INSIGHTS_ENABLED` (new) is a boolean flag — no secret exposure risk

### SVG XSS Protection: COMPREHENSIVE

- `escapeXml()` in `lib/render/escape.ts:18-25` covers all 5 XML entities (`&`, `<`, `>`, `'`, `"`)
- All 7 user-input entry points escaped: handle, displayName, avatar data URI, archetype, tier, verification hash, date
- Fallback SVG in `badge.svg/route.ts:36-42` also escapes handle and error message
- Explicit XSS test vectors at `BadgeSvg.test.tsx:600-626` (script injection, event handler injection)
- Unit tests for `escapeXml()` in `escape.test.ts` verify each entity individually and combined

### CORS Configuration: INTENTIONAL & RESTRICTED

- `/api/verify/[hash]`: `Access-Control-Allow-Origin: *` — intentional, read-only, rate-limited (30 req/60s). Full OPTIONS preflight handling
- Badge SVG endpoint: `frame-ancestors *` via CSP — allows embedding in READMEs/iframes
- All other routes: `X-Frame-Options: DENY`, `frame-ancestors 'none'`
- Global security headers: `X-Content-Type-Options: nosniff`, `X-XSS-Protection: 1; mode=block`, `Strict-Transport-Security: max-age=63072000`, `Referrer-Policy: strict-origin-when-cross-origin`

### RLS (Row Level Security): ALL 10 TABLES COVERED

| Table | RLS Enabled | Deny Policy | Migration |
|-------|-------------|-------------|-----------|
| `users` | Yes | `deny_anon_all` | 002, 008 |
| `metrics_snapshots` | Yes | `deny_anon_all` | 002, 008 |
| `verification_records` | Yes | `deny_anon_all` | 002, 008 |
| `feature_flags` | Yes | `deny_anon_all` + public SELECT | 003, 008 |
| `merge_operations` | Yes | `deny_anon_all` | 007, 008 |
| `user_platforms` | Yes | `deny_anon_user_platforms` | 010 |
| `tool_insights` | Yes | deny policy | 015 |
| `email_campaigns` | Yes | deny policy | 016 |
| `campaign_sends` | Yes | deny policy | 016 |

- 2 views (`latest_snapshots`, `admin_users`) use `security_invoker = true` (migration 014)
- `feature_flags` has intentional public SELECT policy — flags are non-sensitive
- All data access uses `SUPABASE_SERVICE_ROLE_KEY` (server-side only, bypasses RLS)

### OAuth & Authentication: SOLID

- CSRF protection via state cookie validation on callback
- Rate limiting on OAuth callback: 10 req/IP/15 min
- Redirect URL validation prevents open redirects (`callback/route.ts:30-42`)
- OAuth tokens encrypted with AES-256-GCM before storage in `user_platforms`
- All 3 GitHub OAuth fetches have `AbortSignal.timeout(10000)` (`lib/auth/github.ts:118,142,180`)
- Session cookies are HttpOnly, Secure, SameSite=Lax

### Rate Limiting: COMPREHENSIVE

| Endpoint | Limit | Window |
|----------|-------|--------|
| Badge SVG | 100 req/IP | 60s |
| Verify API | 30 req/IP | 60s |
| OAuth callback | 10 req/IP | 15 min |
| History API | 30 req/IP | 60s |
| Refresh | 5 req/IP | 60s |
| Health | 30 req/IP | 60s |

- Fail-open design: when Redis is unavailable, requests are allowed (availability-first — documented in `redis.ts` and `docs/accepted-risks.md`)
- Campaign email system: daily send quota capped at 95, batch size 50. Redis counter prevents abuse.

### Knip (Unused Dependencies): CLEAN

- 1 configuration hint only (redundant entry pattern in `knip.json`)
- No unused dependencies flagged as security risk
- Performance agent notes 24 genuinely unused exports — attack surface reduction opportunity but no active vulnerability

### Fetch Timeout Coverage: 100%

- All external fetch calls have `AbortSignal.timeout()` or `AbortController` — confirmed by cost analyst (2026-03-16)
- Prevents hanging connections from becoming resource exhaustion vectors

## License Compliance

| Package | License | Risk | Action |
|---------|---------|------|--------|
| `@img/sharp-libvips-darwin-arm64` | LGPL-3.0 | None | Dynamically linked — no copyleft obligation triggered |

All other dependencies are MIT, Apache-2.0, BSD, or ISC. No GPL or AGPL dependencies.

## Delta vs Last Security Report (2026-03-09)

| Area | Change |
|------|--------|
| Vulnerabilities | Unchanged: 0 across all severities |
| RLS tables | 6 → 10 (added `user_platforms`, `tool_insights`, `email_campaigns`, `campaign_sends`) — all with deny policies |
| Secret leaks | Unchanged: none |
| XSS coverage | Unchanged: 7 entry points, all escaped |
| CORS | Unchanged: only verify endpoint allows `*` |
| License | Unchanged: 1 LGPL-3.0 (dynamic link, no action) |
| New code | Campaign email system follows existing security patterns (auth checks, rate limiting, RLS) |

## Recommendations

### Priority: LOW (Hardening — No Active Vulnerabilities)

1. **Campaign API error-path coverage** — Campaign routes at 77–78% test coverage. Auth checks are in place but error paths need more test assertions. (Cross-ref: Coverage agent 2026-03-16)

2. **Admin routes missing Supabase timeout** — 5 admin + 1 feature-flags route lack explicit query timeouts. Low traffic, low urgency, but worth adding for defense-in-depth. (Carried from cost analyst)

3. **Unused export cleanup** — 24 genuinely unused exports identified by performance agent. While not a vulnerability, reducing unused code shrinks the attack surface.

4. **Auth cookie JSDoc** — `createSessionCookie()`, `readSessionCookie()`, `clearSessionCookie()` in `lib/auth/github.ts` lack JSDoc. No vulnerability, but documentation reduces misuse risk. (Cross-ref: Documentation agent 2026-03-13)

### No Action Required

- `NEXT_PUBLIC_INSIGHTS_ENABLED` env var missing from CLAUDE.md — documentation gap, not a security issue (boolean flag)
- Fail-open rate limiting — accepted risk, documented in `docs/accepted-risks.md`
- `feature_flags` public SELECT policy — intentional, flags are non-sensitive
