# Security Report
> Generated: 2026-04-06 | Health status: green

## Executive Summary

No new vulnerabilities found. All 10 Supabase tables have RLS + FORCE + explicit deny policies, all SVG user inputs are escaped, no secrets leak to the client, and `pnpm audit` returns zero findings. The only notable delta vs the previous cycle is a knip `--production` false-positive for 8 packages and an MPL-2.0 license on `@resvg/resvg-js` (acceptable — no source modifications made).

---

## Dependency Vulnerabilities

| Severity | Package | Issue | Fix |
|----------|---------|-------|-----|
| — | — | `pnpm audit` returned **0 vulnerabilities** | — |

---

## Knip Findings (False Positives)

`npx knip --production` reported 8 unused dependencies and 1 unused file. All are **confirmed false positives** — verified by grepping source files:

| Flagged Item | Actual Status |
|--------------|---------------|
| `@resvg/resvg-js` | Used in `lib/render/svg-to-png.ts` |
| `@vercel/analytics` | Used in `components/ClientAnalytics.tsx` |
| `@vercel/speed-insights` | Used in `components/ClientAnalytics.tsx` |
| `canvas-confetti` | Used in `lib/effects/celebrations/confetti.ts` |
| `next-themes` | Used in `components/ThemeProvider.tsx`, `ThemeToggle.tsx` |
| `posthog-js` | Used in `components/PostHogProvider.tsx` |
| `resend` | Used in `lib/email/resend.ts`, `audience.ts`, `notifications.ts` |
| `svix` | Used in `app/api/webhooks/resend/route.ts` |
| `vitest.setup.ts` | Referenced in `vitest.config.ts:12` (`setupFiles`) |

**Root cause**: `--production` excludes non-entry-point files (tests, some lib files) from knip's graph, creating false negatives. Run without `--production` for accurate unused-exports analysis (0 findings on 2026-04-02).

---

## Code Findings

### XSS / SVG Rendering

- **SECURE** — All 9 user-controlled SVG fields escaped via `escapeXml()`: `handle`, `displayName`, `archetype`, `tier`, `avatarDataUri`, fallback handle, fallback error, verification hash, verification date. (`lib/render/escape.ts`)
- **SECURE** — Explicit XSS tests at `BadgeSvg.test.tsx:59-65`.
- **SECURE** — 18 `dangerouslySetInnerHTML` usages all use hardcoded demo SVGs, never user input.

### Secret Leaks / Client Exposure

- **SECURE** — No `NEXT_PUBLIC_*` variable exposes a server secret. Verified: `SUPABASE_SERVICE_ROLE_KEY`, `GITHUB_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `RESEND_API_KEY`, `ADMIN_SECRET`, `CRON_SECRET` are all server-only.
- **SECURE** — Error monitoring (`lib/analytics/server-errors.ts`) sanitizes tokens via `SENSITIVE_PATTERNS` regex before sending to PostHog. Patterns cover GitHub tokens (`ghp_`, `gho_`, `ghs_`), `sk-*`, bearer tokens, and generic `key=value` assignments.
- **SECURE** — No hardcoded API keys, tokens, or credentials found in source files.

### CORS

- **INFO** — 2 routes set `Access-Control-Allow-Origin: *`:
  - `app/api/verify/[hash]/route.ts` — public badge verification, read-only, 30 req/60s rate limit
  - `app/api/profile/[handle]/route.ts` — public profile metrics, read-only, 60 req/60s rate limit
- Both are intentional design decisions for embeddable badge ecosystem. No sensitive data exposed.

### Supabase RLS

- **SECURE** — All 10 tables: `users`, `metrics_snapshots`, `verification_records`, `merge_operations`, `feature_flags`, `user_platforms`, `tool_insights`, `campaign_sends`, `email_campaigns` (+ `engagement_flags`) have:
  - `ENABLE ROW LEVEL SECURITY`
  - `FORCE ROW LEVEL SECURITY` (applies even to table owner)
  - Explicit `deny_anon_all` policy (`USING (false)`)
- **SECURE** — 2 views have `security_invoker = true` (`014_views_security_invoker.sql`).
- App uses `SUPABASE_SERVICE_ROLE_KEY` exclusively server-side — no anon key in client bundles.

### Session & Auth

- **SECURE** — Session cookies: `HttpOnly`, `SameSite=Lax`, `Secure` (HTTPS), 10-minute `Max-Age`.
- **SECURE** — OAuth CSRF validated via `timingSafeEqual()`. AES-256-GCM token encryption (fresh IV per call). CLI tokens HMAC-SHA256 signed with 90-day expiry.
- **SECURE** — Avatar URL validation: whitelist (`avatars.githubusercontent.com`) + content-type checks.

### Rate Limiting

- **SECURE** — 31/44 routes rate-limited. Remaining 13 use admin auth, bearer token (`ADMIN_SECRET`/`CRON_SECRET`), or are internal. All fail-open (availability-first design — documented in `redis.ts`).

### Global Headers

- **SECURE** — HSTS 2yr + preload, `X-Content-Type-Options: nosniff`, `X-XSS-Protection: 1; mode=block`, restrictive `Permissions-Policy`.
- **SECURE** — CSP properly scoped in `next.config.ts`.

### Fetch Timeout Coverage

- **SECURE** — 100% coverage via `AbortSignal.timeout()` or `AbortController`. PostHog error capture is intentional fire-and-forget (acceptable).

### Craft Recompute Paths (Coverage P1 → Security Note)

- **INFO** — `dbRecomputeCraft()` (`lib/db/tool-insights.ts:149-180`) ships 0 test cases (Coverage P1 from 2026-04-06). The craft error path in `/api/refresh` and `/api/recalculate` is unverified. Not a direct security vulnerability, but an untested error path means graceful degradation behavior is unconfirmed.

---

## License Compliance

| Package | License | Assessment |
|---------|---------|------------|
| `@resvg/resvg-js@2.6.2` | MPL-2.0 | File-level weak copyleft. No modifications to `@resvg/resvg-js` source — no disclosure obligation. **Acceptable.** |
| `@chapa/shared@0.0.0` | UNLICENSED | Internal monorepo package, not published. No issue. |
| `@chapa/web@2.7.2` | UNLICENSED | Internal monorepo package, not published. No issue. |
| All other production deps | MIT, Apache-2.0, ISC | Fully permissive. No restrictions. |

**No GPL or AGPL dependencies detected.**

---

## Recommendations

### P1 (Action Required)
None.

### P2 (Worth Addressing)

1. **Add tests for `dbRecomputeCraft()` error paths** — `lib/db/tool-insights.ts:149-180` has 0 test coverage. The refresh and recalculate routes call this function but its error behavior is unverified. Risk: silent DB failure in craft recompute goes undetected. Fix: add `describe("dbRecomputeCraft")` in `tool-insights.test.ts` covering null result, DB error, and success paths.

### P3 (Monitor)

2. **MPL-2.0 `@resvg/resvg-js`** — Track that no modifications are made to the library's source. If the library is ever forked or patched, the MPL-2.0 requires those modifications to be disclosed.

3. **Knip `--production` false positives** — Run knip without `--production` flag for accurate unused-export analysis. The `--production` results are misleading and could cause unnecessary package removals.

### Carried (No Change)

4. **CORS wildcard on 2 public endpoints** — Intentional, acceptable, rate-limited.
5. **Fail-open rate limiting** — Intentional availability-first design, documented.
