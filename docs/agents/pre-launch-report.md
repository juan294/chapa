# Pre-Launch Audit Report (v10 — Full Security Audit)
> Generated on 2026-02-13 | Branch: `develop` | Commit: `6c66ab3` | 6 specialists + 4 security investigators

## Verdict: CONDITIONAL — 0 blockers, 3 high-priority hardening items, 20 accepted risks

All previous blockers (B1: timing-safe HMAC, B2: timing-safe OAuth state) have been **fixed**. All previous warnings (W4-W9, W11-W12) have been **resolved**. The project has no critical vulnerabilities. Three HIGH-priority hardening items remain — all are defense-in-depth improvements with mitigating factors. The project is **ready for launch** with these items tracked as post-launch improvements.

---

## Previous Blockers — RESOLVED

| # | Issue | Fix | Commit |
|---|-------|-----|--------|
| ~~B1~~ | CLI token HMAC compared with `===` | `timingSafeEqual()` | `c379d16` |
| ~~B2~~ | OAuth state compared with `===` | `timingSafeEqual()` | `c379d16` |

## Previous Warnings — RESOLVED

| # | Issue | Resolution | Commit |
|---|-------|------------|--------|
| ~~W4~~ | No test for `/api/cli/auth/poll` | 14 new route tests added | `1d0ab2f` |
| ~~W6~~ | Undocumented env vars | CLAUDE.md updated | `9e3f055` |
| ~~W7~~ | Cache TTL spec mismatch | CLAUDE.md updated to 6h | `9e3f055` |
| ~~W8~~ | `global-error.tsx` white background | Dark theme applied | `b9013ab` |
| ~~W9~~ | `next-themes` unnecessary | Removed entirely | `b69a971` |
| ~~W11~~ | `ShortcutCheatSheet` not lazy-loaded | `next/dynamic` with `ssr: false` | `4df739a` |
| ~~W12~~ | 7 ESLint warnings | All fixed (0 warnings) | `b9013ab` |

---

## High-Priority Hardening (post-launch)

| # | Finding | Severity | Mitigating Factors |
|---|---------|----------|--------------------|
| H1 | **Open redirect** — `chapa_redirect` cookie not re-validated in OAuth callback | HIGH | Cookie is `HttpOnly; SameSite=Lax`, set only by validated login route. Requires subdomain cookie injection to exploit. |
| H2 | **Rate limiting fails open** when Redis is unavailable | HIGH | Intentional availability design. Vercel + Upstash have high uptime. All auth endpoints have additional protections (CSRF state, encryption). |
| H3 | **CLI poll endpoint lacks rate limiting** — unauthenticated | HIGH | Session IDs are UUID v4 (128-bit random). 5-minute TTL. One-time use (deleted after retrieval). Brute-force is computationally infeasible. |

---

## Medium-Priority Improvements

| # | Finding | Risk | Recommendation |
|---|---------|------|----------------|
| M1 | SSRF — `fetchAvatarBase64()` has no URL allowlist | Low practical risk: URL comes from GitHub API, `mergeStats()` preserves primary avatar | Allowlist `avatars.githubusercontent.com` |
| M2 | `avatarDataUri` unescaped in SVG `href` | Low: data is server-generated base64 from GitHub | Apply `escapeXml()` as defense-in-depth |
| M3 | Session cookie payload not schema-validated after decryption | Low: AES-256-GCM provides integrity (auth tag) | Add runtime shape validation |
| M4 | Case-sensitive handle comparison in refresh endpoint | Low: mismatch returns 403, user retries | Normalize to lowercase |
| M5 | Studio config GET returns 200 instead of 401 when unauthed | Low: returns `{ config: null }`, no data leak | Return 401 status |
| M6 | Verification hash truncated to 32 bits | Low: rate-limited (30/min/IP), read-only endpoint | Increase to 12-16 hex chars |
| M7 | CLI token detection via dot heuristic | Low: GitHub PATs don't contain dots currently | Add `chapa_cli.` prefix |
| M8 | Webhook endpoint lacks rate limiting | Low: Svix signature verification required | Add basic rate limit |

---

## Accepted Risks (LOW)

| # | Finding | Accepted Because |
|---|---------|-----------------|
| L1 | `impact.tier`/`archetype` unescaped in SVG text | Values are TypeScript string literal unions from pure function, not user-controlled |
| L2 | Cache key case sensitivity for handles | Wastes some cache space, no security impact |
| L3 | Health endpoint exposes package version | Standard practice, no sensitive info |
| L4 | Logout uses GET method | Impact limited to nuisance logout, session cookie is HttpOnly |
| L5 | `x-forwarded-for` spoofable outside Vercel | Deployed on Vercel which sets this reliably |
| L6 | No CORS preflight on verify endpoint | Verify is read-only, CORS not strictly needed |
| L7 | Session endpoint lacks rate limiting | Returns only requesting user's own public info |
| L8 | CSP uses `unsafe-inline` | Next.js App Router limitation, tracked upstream |
| L9 | Badge config stored without TTL | Small data per user, acceptable growth |
| L10 | User enumeration via badge/share page | GitHub handles are already publicly enumerable |
| L11 | CLI credentials stored as plaintext JSON | Standard CLI pattern (like `gh`, `npm`), file permissions 0600 |
| L12 | No `next/image` usage | Images are few and small; backlog item |
| W5 | No E2E tests | Unit/integration coverage is strong (1203 tests); backlog item |

---

## Security Strengths (confirmed by all 4 investigators)

- **Encryption**: AES-256-GCM session cookies with random IV, HMAC-SHA256 for CLI tokens and verification
- **Auth**: Timing-safe comparisons, 128-bit CSRF state, minimal OAuth scope (`read:user`)
- **XSS**: `escapeXml()` covers all 5 XML special chars, applied to user-controlled SVG text
- **Cookies**: `HttpOnly`, `SameSite=Lax`, conditional `Secure` on all cookies
- **Headers**: HSTS (2yr + preload), CSP, X-Content-Type-Options, X-Frame-Options, Permissions-Policy
- **Validation**: Strict regex for handles, allowlist for badge config, shape validation for stats
- **Dependencies**: 0 `pnpm audit` vulnerabilities, all MIT licenses
- **CI**: Gitleaks on every push + daily full-history scan, 6 workflows all green
- **Secrets**: No hardcoded secrets in source, `.env` gitignored, `.trim()` on 100% of env vars
- **API responses**: Session endpoint never leaks OAuth tokens (verified with test)
- **Webhooks**: Svix HMAC signature verification (industry standard)
- **Degradation**: Redis failures fail gracefully, GitHub rate limits serve cached data

---

## Quality Assurance

**Tests**: 77 files, **1203 tests, 0 failures** (2.44s)
**TypeScript**: Clean across all 3 workspace packages
**Lint**: 0 errors, 0 warnings
**Build**: Succeeds (Next.js 16.1.6 + Turbopack)
**CI**: All 6 workflows green on `develop`
**Client bundles**: All under 500KB. Largest chunk: 220KB.
**Git**: Clean working tree, no stale worktrees

---

## Recommendation

**Ship it.** The 3 HIGH items are defense-in-depth hardening with strong mitigating factors, not exploitable vulnerabilities. File them as issues and address post-launch.
