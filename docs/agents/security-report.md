# Security Report
> Generated: 2026-03-02 | Health status: green

## Executive Summary

The Chapa codebase demonstrates strong security practices across all audited domains. Two high-severity ReDoS vulnerabilities exist in `minimatch` (transitive via eslint, dev-only), and one LGPL-3.0 dependency (`@img/sharp-libvips-darwin-arm64`) is present but acceptable as a dynamically-linked native binary. No hardcoded secrets, no XSS vectors, no client-side secret leaks, and full RLS coverage on all Supabase tables.

## Dependency Vulnerabilities

| Severity | Package | Issue | Fix |
|----------|---------|-------|-----|
| high | `minimatch` >=10.0.0 <10.2.3 | ReDoS via matchOne() combinatorial backtracking (GHSA-7r86-cg39-jmmj) | Upgrade to >=10.2.3 |
| high | `minimatch` >=10.0.0 <10.2.3 | ReDoS via nested *() extglobs (GHSA-23c5-xmqv-rm74) | Upgrade to >=10.2.3 |

**Mitigating factors:** Both vulnerabilities are in `minimatch` pulled transitively by `eslint`. This is a **dev-only dependency** — it does not ship in the production bundle and cannot be triggered by user input at runtime.

**Unused dependencies (knip):** Clean — no unused dependencies detected.

## Code Findings

### Hardcoded Secrets
- **CLEAN** — No hardcoded API keys, tokens, passwords, or credentials found in source code
- All sensitive values sourced from environment variables with `.trim()` applied
- `.env` and `.env.local` properly gitignored
- Test files use obviously fake credentials (`ghp_ci_fallback`, `Bearer re_test_123`, `Bearer mytoken`)

### SVG XSS Protection
- **CLEAN** — All user-controlled strings escaped via `escapeXml()` before SVG interpolation
- Escape function at `apps/web/lib/render/escape.ts` handles all 5 XML entities (&, <, >, ', ")
- User input entry points verified:
  - `BadgeSvg.tsx:26` — handle via `escapeXml(stats.handle)`
  - `BadgeSvg.tsx:27-29` — displayName via `escapeXml(stats.displayName)`
  - `BadgeSvg.tsx:57,165` — archetype via `escapeXml(archetypeText)`
  - `BadgeSvg.tsx:222` — tier via `escapeXml(impact.tier)`
  - `BadgeSvg.tsx:141` — avatar data URI via `escapeXml(avatarDataUri)`
  - `VerificationStrip.ts:12-14` — hash and date via `escapeXml()`
  - `badge.svg/route.ts:33-42` — fallback SVG escapes handle and message
- No event handlers (`onclick`, `onload`) in SVG markup
- No `style` attributes with user input
- XSS tests with malicious payloads (`<script>`, `onload="alert(1)"`) in `BadgeSvg.test.tsx:553-577`
- Input validation: `isValidHandle()` regex restricts handle to alphanumeric + hyphen

### Client-Side Secret Exposure
- **CLEAN** — No server secrets in `NEXT_PUBLIC_*` variables
- 7 NEXT_PUBLIC_ vars, all non-sensitive: base URL, PostHog analytics, feature flags
- All 10 server-only secrets verified isolated to server-side code paths

### CORS Configuration
- **CLEAN** — Only 1 route has CORS: `/api/verify/[hash]` with `Access-Control-Allow-Origin: *`
- This is intentional — badge verification must work cross-origin for embedded badges
- Endpoint is rate-limited (30 req/60s per IP) and read-only
- All other routes: no CORS headers (blocked by default)
- Security headers in `next.config.ts:46-90`: HSTS, X-Content-Type-Options, X-XSS-Protection, Permissions-Policy, X-Frame-Options: DENY (except badge SVG)

### Supabase RLS
- **CLEAN** — All 6 tables have RLS enabled with explicit deny policies for `anon` role
- Tables: `users`, `metrics_snapshots`, `verification_records`, `merge_operations`, `feature_flags`, `user_platforms`
- Defense-in-depth: `USING (false)` policies on all tables for anon (migration `008_add_rls_deny_policies.sql`)
- `feature_flags` has an additional permissive SELECT policy (non-sensitive boolean toggles)
- Service role key used only server-side via singleton client (`lib/db/supabase.ts`)
- No anon key exposed to client

## License Compliance

| Package | License | Risk |
|---------|---------|------|
| `@img/sharp-libvips-darwin-arm64` | LGPL-3.0-or-later | Low |

**Assessment:** LGPL-3.0 applies to `libvips`, a dynamically-linked native image processing library used by `sharp`. Under LGPL-3.0, dynamic linking is permitted without requiring the host application to be open-sourced. The `sharp` package itself is Apache-2.0. No GPL or AGPL dependencies found. **No compliance action required.**

All other dependencies use permissive licenses (MIT, Apache-2.0, BSD, ISC).

## Recommendations

### Priority 1 (Low urgency — dev-only)
- **Update eslint** to resolve `minimatch` ReDoS vulnerabilities. While dev-only and not exploitable in production, keeping dependencies clean reduces noise in future audits.

### Priority 2 (Informational)
- **Monitor `badge:notified:*` Redis keys** — These grow indefinitely (1 byte each per unique handle). Currently negligible but could accumulate at scale. Consider periodic cleanup or TTL.
- **Feature flag queries lack caching** — `isStudioEnabled()`, `isBitbucketEnabled()`, `isCodebergEnabled()` hit Supabase directly on every call. Not a security risk but increases surface area. (Cross-ref: Cost Analyst finding)

### No Action Required
- Fail-open rate limiting is intentional and documented in `docs/accepted-risks.md`
- Token encryption at rest in `user_platforms` table is properly implemented
- All security-critical code paths have 88%+ test coverage (Cross-ref: Coverage Agent finding)
