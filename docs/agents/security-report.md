# Security Report
> Generated: 2026-04-13 | Health status: GREEN

## Executive Summary

The Chapa codebase maintains a strong security posture. No hardcoded secrets, no XSS vectors, and no RLS gaps were found. The only vulnerabilities are 3 dev-only vite issues (via vitest) with no production exposure. One new LGPL-3.0 transitive dependency (`@img/sharp-libvips-darwin-arm64`) surfaced — binary-only, no compliance action needed.

## Dependency Vulnerabilities

| Severity | Package | Issue | Fix |
|----------|---------|-------|-----|
| HIGH | vite 7.3.1 (via vitest) | `server.fs.deny` bypassed with queries ([GHSA-v2wj-q39q-566r](https://github.com/advisories/GHSA-v2wj-q39q-566r)) | Bump vite ≥7.3.2 via `pnpm.overrides` or wait for vitest peer bump |
| HIGH | vite 7.3.1 (via vitest) | Arbitrary file read via dev server WebSocket ([GHSA-p9ff-h696-f583](https://github.com/advisories/GHSA-p9ff-h696-f583)) | Bump vite ≥7.3.2 |
| MODERATE | vite 7.3.1 (via vitest) | Path traversal in optimized deps `.map` handling ([GHSA-4w7w-66w2-5vf9](https://github.com/advisories/GHSA-4w7w-66w2-5vf9)) | Bump vite ≥7.3.2 |

**Risk assessment:** All 3 vulnerabilities are in `vite`, a dev-only dependency pulled in by `vitest`. Vite's dev server is never deployed to production. **No production exposure.**

## Unused Dependencies (Knip --production)

Knip flagged 8 packages + 1 file as unused in production entry graph. **All are false positives** — confirmed in use via non-entry paths:

| Package | Reason it's used |
|---------|-----------------|
| `@resvg/resvg-js` | SVG-to-PNG conversion (`lib/render/svg-to-png.ts`) |
| `@vercel/analytics` | Loaded via Next.js plugin in `next.config.ts` |
| `@vercel/speed-insights` | Loaded via Next.js plugin in `next.config.ts` |
| `canvas-confetti` | Dynamic import in experiment pages |
| `next-themes` | ThemeProvider in `layout.tsx` |
| `posthog-js` | Dynamic PostHog client initialization |
| `resend` | Server-side email sending (`lib/email/`) |
| `svix` | Webhook signature verification (`lib/email/webhook.ts`) |
| `vitest.setup.ts` | Referenced in `vitest.config.ts:12 setupFiles` |

**Do not remove any of these packages.**

## Code Findings

### Secrets & Credential Handling
- **PASS** — No hardcoded secrets in source code. All sensitive values loaded via `process.env.*`.
- **PASS** — `NEXT_PUBLIC_*` variables contain only feature flags and public URLs. No server secrets exposed.
- **PASS** — Error logging sanitizes 9 sensitive patterns (GitHub tokens, API keys, Bearer tokens) via `SENSITIVE_PATTERNS` regex in `lib/analytics/server-errors.ts:16-30`.
- **PASS** — `.env.example` contains only empty template keys.
- **PASS** — `.env`, `.env.local`, `.env.*.local` are in `.gitignore`.

### SVG XSS Protection
- **PASS** — All user-controlled input (handle, displayName, avatar URI, archetype text, tier label) escaped via `escapeXml()` in `lib/render/escape.ts:18-25`.
- **PASS** — SVG error fallback in `badge.svg/route.ts:36,42` escapes both handle and message.
- **PASS** — Explicit XSS test suite at `BadgeSvg.test.tsx:59-65`.
- **PASS** — 18 `dangerouslySetInnerHTML` uses audited — all hardcoded demo SVG or pre-escaped `renderBadgeSvg()` output.
- **PASS** — JSON-LD injection prevented via `JSON.stringify().replace(/</g, "\\u003c")` in share page.

### CORS Configuration
- **PASS** — Wildcard `Access-Control-Allow-Origin: *` on exactly 2 read-only public endpoints:
  - `/api/verify/[hash]` — rate-limited 30 req/60s
  - `/api/profile/[handle]` — rate-limited 60 req/60s
- **PASS** — All authenticated, admin, and write endpoints have no CORS headers (same-origin only).

### Row Level Security (Supabase)
- **PASS** — RLS enabled on all tables via `002_enable_rls.sql`.
- **PASS** — Explicit `deny_anon_all` policies on all tables via `008_add_rls_deny_policies.sql`.
- **PASS** — 2 views use `security_invoker = true`.
- **PASS** — Server uses `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS server-side, never exposed to client).
- **PASS** — No raw SQL, no `.sql()` calls — all queries use Supabase client with parameterized `.from()`.

### Authentication & Session Security
- **PASS** — OAuth CSRF protection via `timingSafeEqual()` state verification.
- **PASS** — Token encryption: AES-256-GCM with fresh IV per call.
- **PASS** — CLI tokens: HMAC-SHA256 signed, 90-day expiry.
- **PASS** — Session cookies: `HttpOnly`, `SameSite=Lax`, `Secure`, 10-minute `Max-Age`.

### Rate Limiting & Timeouts
- **PASS** — Rate limiting on 67 route files. Remaining routes use admin/bearer auth or are internal.
- **PASS** — Fetch timeout coverage: 100% — all external calls have `AbortSignal.timeout()`.
- **PASS** — Rate limiter fails open (availability-first design, documented in `redis.ts`).

## License Compliance

| License | Package(s) | Risk |
|---------|-----------|------|
| MPL-2.0 | `@resvg/resvg-js`, `@resvg/resvg-js-darwin-arm64` | File-level weak copyleft. No source modifications made. No compliance action needed. |
| MPL-2.0 / Apache-2.0 | `dompurify` | Dual-licensed with Apache-2.0. Use under Apache-2.0. No issue. |
| LGPL-3.0-or-later | `@img/sharp-libvips-darwin-arm64` | **NEW** — Transitive binary dependency via `sharp`. Pre-compiled native binary, no source modifications. LGPL requires offering source for the library itself (not your code). Binary distribution via npm satisfies this. No compliance action needed. |

**No GPL or AGPL dependencies found.** All clear for production use.

## Recommendations

### P3 — Low Priority (dev-only)
1. **Bump vite to ≥7.3.2** — Add `pnpm.overrides` for `vite: ">=7.3.2"` or wait for vitest to bump its peer dependency. No production risk, but cleans up `pnpm audit` output.

### Carried Items (unchanged from 2026-04-06)
2. **INFO** — `dbRecomputeCraft()` error paths now have test coverage (resolved by triage 2026-04-07). No remaining security-adjacent test gaps.

### Monitoring
- Rate limiter fail-open behavior — acceptable given CDN + GitHub API secondary limits.
- `@img/sharp-libvips-darwin-arm64` LGPL-3.0 — monitor for any source modification requirements if sharp usage changes.

## Delta from Last Report (2026-04-06)

| Item | 2026-04-06 | 2026-04-13 | Change |
|------|-----------|-----------|--------|
| `pnpm audit` vulns | 0 | 3 (dev-only) | vite 7.3.1 introduced via vitest upgrade |
| Secret leaks | 0 | 0 | Unchanged |
| XSS vectors | 0 | 0 | Unchanged |
| CORS wildcards | 2 (intentional) | 2 (intentional) | Unchanged |
| RLS coverage | 100% | 100% | Unchanged |
| License flags | 1 (MPL-2.0) | 2 (MPL-2.0 + LGPL-3.0) | sharp-libvips binary added |
| Fetch timeouts | 100% | 100% | Unchanged |
| Rate-limited routes | 31/44 | 67 files | Measurement improved (file count vs route count) |
| `dbRecomputeCraft` P2 | Open | Resolved | Triage 2026-04-07 added tests |
