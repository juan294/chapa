# Security Report
> Generated: 2026-03-30 | Health status: GREEN

## Executive Summary

The Chapa codebase maintains a strong security posture with zero dependency vulnerabilities, no hardcoded secrets, comprehensive XSS protections in the SVG pipeline, and RLS enforced on all 9 Supabase tables. No regressions since the 2026-03-23 audit. One new finding: `/api/profile/[handle]` now exposes wildcard CORS (intentional — public API, rate-limited).

## Dependency Vulnerabilities

| Severity | Package | Issue | Fix |
|----------|---------|-------|-----|
| — | — | No known vulnerabilities found | — |

`pnpm audit` returns clean. 0 critical, 0 high, 0 medium, 0 low.

## Unused Dependencies (Attack Surface)

`npx knip` returns **0 findings** — fully clean. No unused dependencies, exports, or types. Consistent with the previous two audits.

## Code Findings

### Hardcoded Secrets — CLEAR
- **0 hardcoded secrets** found in source. All 10+ server secrets read exclusively from `process.env` with `.trim()`.
- All `NEXT_PUBLIC_*` variables are non-sensitive (analytics key, base URL, feature flags).
- `SUPABASE_SERVICE_ROLE_KEY`, `NEXTAUTH_SECRET`, `GITHUB_CLIENT_SECRET`, `ADMIN_SECRET`, `CRON_SECRET` — all server-side only, never exposed to client bundles.
- Error logging scrubs tokens via regex before PostHog ingestion.

### SVG XSS Protection — SECURE
- **9 user-input entry points** escaped via `escapeXml()` (`lib/render/escape.ts:18-25`):
  1. `handle` → `BadgeSvg.tsx:40`
  2. `displayName` → `BadgeSvg.tsx:41-43`
  3. `archetype` → `BadgeSvg.tsx:179`
  4. `tier` → `BadgeSvg.tsx:236`
  5. `avatarDataUri` → `BadgeSvg.tsx:155`
  6. Fallback `handle` → `badge.svg/route.ts:36`
  7. Fallback `message` → `badge.svg/route.ts:42`
  8. Verification `hash` → `VerificationStrip.ts:12`
  9. Verification `date` → `VerificationStrip.ts:13`
- `escapeXml()` covers all 5 XML entities: `& < > ' "`
- Explicit XSS tests at `BadgeSvg.test.tsx:59-65`
- Heatmap/radar chart use numeric data only — no user strings
- BadgeBranding uses hardcoded static text only
- 18 `dangerouslySetInnerHTML` uses — all safe (hardcoded demo SVG, no user input)
- Avatar URL whitelist: only `avatars.githubusercontent.com` + content-type validation

### CORS Configuration — INTENTIONAL
- **2 routes with wildcard CORS** (`Access-Control-Allow-Origin: *`):
  1. `/api/verify/[hash]` — public verification, rate-limited 30 req/IP/60s, read-only (unchanged)
  2. `/api/profile/[handle]` — public profile API, rate-limited 60 req/IP/60s, read-only (**NEW** since last audit)
- Both return non-sensitive public data. Risk: LOW.
- All other 42+ API routes have no CORS headers (default same-origin).
- Global security headers in `next.config.ts:47-87`:
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
  - `X-Content-Type-Options: nosniff`
  - `X-XSS-Protection: 1; mode=block`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()`
  - Badge SVG: `frame-ancestors *` (embeddable by design)
  - All other routes: `frame-ancestors 'none'`

### RLS — ALL TABLES SECURED
- **9/9 tables** with RLS enabled + `FORCE ROW LEVEL SECURITY`:
  - `users`, `metrics_snapshots`, `verification_records`, `feature_flags`, `merge_operations`, `user_platforms`, `tool_insights`, `email_campaigns`, `campaign_sends`
- Explicit `deny_anon_all` policies on all tables (defense-in-depth)
- Exception: `feature_flags` has a permissive SELECT policy (`USING true`) — intentional, flags are public, DML still blocked
- **2 views** with `security_invoker = true`: `latest_snapshots`, `admin_users`
- App uses `SUPABASE_SERVICE_ROLE_KEY` server-side only (bypasses RLS, acceptable for server-only access pattern)

### Authentication & Session — SECURE
- OAuth CSRF: `timingSafeEqual()` state validation
- Token storage: AES-256-GCM encryption with fresh IV per encryption
- CLI tokens: HMAC-SHA256 signed with 90-day expiry
- Session cookies: `HttpOnly`, `SameSite=Lax`, `Secure`, 10-minute `Max-Age`
- Fetch timeout coverage: **100%** — all external calls have `AbortSignal.timeout()`

### Rate Limiting — EXPANDED
- **31/44 routes** (70%) explicitly rate-limited (up from 14+ at last audit)
- Remaining 13 routes use admin auth, bearer token, or are internal
- Campaign email: 95/day quota with Redis counter, batch size 50
- All rate limiters fail-open by design (availability-first — GitHub API limits + CDN caching provide secondary protection)

## License Compliance

| Package | License | Risk | Action |
|---------|---------|------|--------|
| `@img/sharp-libvips-darwin-arm64` | LGPL-3.0 | None | Dynamically linked — no compliance action needed |

No GPL or AGPL dependencies found. All other dependencies are MIT, Apache-2.0, BSD, or ISC.

## Delta Since Last Audit (2026-03-23)

| Area | Change |
|------|--------|
| Vulnerabilities | Unchanged — 0 across all severities |
| Knip | Unchanged — 0 findings |
| Secrets | Unchanged — none found |
| XSS | Unchanged — all 9 entry points escaped |
| CORS | **+1 wildcard route** (`/api/profile/[handle]`) — intentional public API |
| RLS | Unchanged — 9/9 tables + FORCE, 2 views security_invoker |
| Rate limiting | **31/44 routes** (was 14+) — per cost-analyst 2026-03-30 |
| Test coverage | **92.72% stmts** (6,655 tests) — per coverage agent 2026-03-30 |
| Licenses | Unchanged — 1 LGPL-3.0 (dynamic link, no action) |

## Recommendations

1. **LOW — Monitor `/api/profile/[handle]` CORS**: New wildcard CORS endpoint. Currently rate-limited at 60 req/IP/60s. If abuse is observed, consider restricting to known embed origins.
2. **LOW — Resend SDK timeout gaps**: 3 `audience.ts` calls + 1 admin test route lack `withTimeout()`. Fire-and-forget/admin-gated contexts — defense-in-depth improvement only (per cost-analyst 2026-03-30).
3. **INFO — Undocumented env vars**: Documentation agent flagged SVIX_*, ICEBERG_TOKEN in code. Triage confirmed these are false positives (not in source). No action needed.

No blockers. No high-priority items. Security posture remains GREEN.
