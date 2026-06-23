# Security Report
> Generated: 2026-06-22 | Health status: **green**

## Executive Summary

All eight security checks pass cleanly: zero dependency vulnerabilities (pnpm audit clean at all severities), no hardcoded secrets, full XSS escaping in the SVG pipeline, no server secrets reachable by client code, CORS wildcard scoped only to two read-only rate-limited endpoints, and all 10 Supabase tables with ENABLE + FORCE RLS. The single informational finding is a missing `server-only` guard on auth and verification modules (defense-in-depth only — Next.js strips non-`NEXT_PUBLIC_` vars at build time regardless).

---

## Dependency Vulnerabilities

`pnpm audit` output (628 total, 0 dev dependencies counted):

| Severity | Count | Notes |
|----------|-------|-------|
| Critical | 0 | — |
| High | 0 | — |
| Moderate | 0 | — |
| Low | 0 | — |

**Result: CLEAN.** Prior advisories cleared by existing `pnpm.overrides`:
- `esbuild >=0.28.1` — cleared 2026-06-15 HIGH (GHSA-gv7w-rqvm-qjhr, Deno RCE)
- `brace-expansion >=5.0.6` — cleared 2026-05-25 MODERATE (GHSA-jxxr-4gwj-5jf2, ReDoS)
- `js-yaml >=4.2.0` — cleared 2026-06-19 (CVE-2026-53550, build-tool)

---

## Knip Analysis (Attack Surface / Unused Dependencies)

`npx knip --production` flagged 9 "unused" dependencies + 1 "unused" file. All are **false positives**:

| Flagged Dep | Actual Usage | Verdict |
|-------------|-------------|---------|
| `@resvg/resvg-js` | SVG-to-PNG via `lib/render/svgToPng.ts` (dynamic Turbopack load) | False positive |
| `@vercel/analytics` | `components/ClientAnalytics.tsx` via `next/dynamic` | False positive |
| `@vercel/speed-insights` | Lazy client component | False positive |
| `canvas-confetti` | `lib/effects/celebrations/confetti.ts`, Studio + experiments | False positive |
| `next-themes` | `components/ThemeProvider.tsx`, `ThemeToggle.tsx` | False positive |
| `posthog-js` | `components/ClientAnalytics.tsx` via `next/dynamic` | False positive |
| `resend` | `lib/email/resend.ts` | False positive |
| `server-only` | `lib/db/supabase.ts:8` | False positive |
| `svix` | `app/api/webhooks/resend/route.ts` — Resend webhook HMAC verification | False positive |
| `vitest.setup.ts` | Test setup file, not a production file | False positive |

Knip does not resolve `next/dynamic` call sites; all 9 deps are actively used. **No dead production dependencies.**

---

## Code Findings

- **[INFO] Missing `server-only` guard on auth/verification modules** — `lib/db/supabase.ts` imports `server-only` as the sole boundary guard, but `lib/auth/session.ts`, `lib/auth/cli-token.ts`, `lib/auth/github.ts`, `lib/auth/admin.ts`, `lib/auth/cron.ts`, `lib/auth/unsubscribe-token.ts`, and `lib/verification/hmac.ts` all read `NEXTAUTH_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_SECRET`, or `CRON_SECRET` without the `server-only` import. In practice these are never imported from client components — Next.js strips non-`NEXT_PUBLIC_` env vars at build time — but adding the guard would make the boundary explicit and fail the build immediately if someone accidentally imports them client-side.

  **Severity:** Informational (defense-in-depth, no current exposure)
  **Affected files:** 7 files in `apps/web/lib/auth/` and `apps/web/lib/verification/hmac.ts`

- **[PASS] SVG XSS escaping** — All user-controlled entry points in the badge pipeline are escaped via `escapeXml()` (`lib/render/escape.ts`). Covered fields: `handle` (BadgeSvg:49), `displayName` (:51), `avatarDataUri` (:164), `archetypeText` (:188), `tier` (:245), `hash` and `date` (VerificationStrip:13–14), and the error fallback in `badge.svg/route.ts:56,62`. All five XML metacharacters (`& < > ' "`) replaced by named entities. No raw user interpolation in SVG output.

- **[PASS] HMAC timing safety** — All signature comparisons use `crypto.timingSafeEqual`: OAuth state cookies (GitHub/Bitbucket/Codeberg/GitLab), CLI token verification (`cli-token.ts:71`), and unsubscribe token verification (`unsubscribe-token.ts:74`). No string-equality HMAC comparisons anywhere in the auth pipeline.

- **[PASS] Resend webhook HMAC** — `app/api/webhooks/resend/route.ts` reads the raw request body before JSON parsing (as required by Svix), validates all three Svix headers (`svix-id`, `svix-timestamp`, `svix-signature`), and calls `verifyWebhookSignature()` before processing any payload.

- **[PASS] No hardcoded secrets** — Grepped `apps/web/app`, `apps/web/lib`, and `packages` for common key patterns (GitHub PAT prefixes, Resend `re_`, AWS AKIA, OpenAI `sk-`, Slack `xox*`). Zero matches in production source. The only secret-shaped strings in the codebase are in test fixtures (`platform-auth-fixtures.ts` mock values labeled `test-*`) and the CLI guide doc.

---

## CORS

Wildcard `Access-Control-Allow-Origin: *` is scoped to exactly two endpoints:

| Route | Method | Rate limit | Auth required |
|-------|--------|-----------|---------------|
| `/api/verify/[hash]` | GET | 30 req/60s | No |
| `/api/profile/[handle]` | GET | 60 req/60s | No |

Both are read-only, rate-limited, and serve public data. All mutation endpoints (generate, refresh, studio, admin, supplemental) return no CORS headers, blocking cross-origin POST/PUT/DELETE. The `cors-mutation-guard.test.ts` file enforces this invariant at test time.

---

## `NEXT_PUBLIC_` Secret Leak Check

All vars prefixed `NEXT_PUBLIC_` in `lib/env.ts`:

| Variable | Value type | Sensitive? |
|----------|-----------|-----------|
| `NEXT_PUBLIC_POSTHOG_KEY` | Publishable analytics write key | No (intended for client) |
| `NEXT_PUBLIC_POSTHOG_HOST` | Analytics host URL | No |
| `NEXT_PUBLIC_BASE_URL` | Site URL | No |
| `NEXT_PUBLIC_BITBUCKET_ENABLED` | Boolean flag string | No |
| `NEXT_PUBLIC_CODEBERG_ENABLED` | Boolean flag string | No |
| `NEXT_PUBLIC_GITLAB_ENABLED` | Boolean flag string | No |
| `NEXT_PUBLIC_EXPERIMENTS_ENABLED` | Boolean flag string | No |
| `NEXT_PUBLIC_INSIGHTS_ENABLED` | Boolean flag string | No |
| `NEXT_PUBLIC_STUDIO_ENABLED` | Boolean flag string | No |

`SUPABASE_SERVICE_ROLE_KEY`, `NEXTAUTH_SECRET`, `ADMIN_SECRET`, `CRON_SECRET`, `CHAPA_VERIFICATION_SECRET`, and `RESEND_WEBHOOK_SECRET` are all server-side only and absent from any `NEXT_PUBLIC_*` binding. **No secret leakage.**

---

## Supabase RLS

All 10 base tables verified with both `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY`:

| Table | ENABLE RLS | FORCE RLS | Migration |
|-------|-----------|----------|-----------|
| `users` | 002 | 018 | ✓ |
| `metrics_snapshots` | 002 | 018 | ✓ |
| `verification_records` | 002 | 018 | ✓ |
| `feature_flags` | 003 | 018 | ✓ |
| `merge_operations` | 007 | 018 | ✓ |
| `user_platforms` | 010 | 018 | ✓ |
| `tool_insights` | 015 | 018 | ✓ |
| `email_campaigns` | 016 | 018 | ✓ |
| `campaign_sends` | 016 | 018 | ✓ |
| `supplemental_stats` | 024 | 025 | ✓ |

Deny-all-anon policies added in migrations 008 and 018. `FORCE RLS` ensures the service-role client used in API routes cannot bypass row-level policies accidentally. **10/10 ENABLE + FORCE RLS.**

---

## License Compliance

`license-checker --production` returned no GPL or AGPL packages.

Previously documented exceptions in `docs/accepted-risks.md`:
- **MPL-2.0**: `@resvg/resvg-js`, `lightningcss` — file-level copyleft (not library-level), does not require open-sourcing the application
- **LGPL-3.0**: `@img/sharp-libvips-darwin-arm64` — dynamically linked, permissive exception applies; `sharp` itself is Apache-2.0 since 0.34.5

**All clear. No GPL or AGPL violations.**

---

## Recommendations

| Priority | Item | Action |
|----------|------|--------|
| P3 | Add `server-only` to auth and verification modules | `import "server-only"` at the top of `lib/auth/session.ts`, `lib/auth/cli-token.ts`, `lib/auth/github.ts`, `lib/auth/admin.ts`, `lib/auth/cron.ts`, `lib/auth/unsubscribe-token.ts`, and `lib/verification/hmac.ts`. Defense-in-depth — no current exposure. |
| P3 | Suppress knip false positives for dynamic imports | Add explicit `ignoreDependencies` entries in `knip.json` for the 9 dynamically-loaded deps so future knip runs stay noise-free. |

No P1 or P2 items.

---

## SHARED_CONTEXT_ENTRY

```
<!-- ENTRY:START agent=security timestamp=2026-06-22T00:00:00Z -->
## Security Scanner — 2026-06-22
- **Status**: GREEN
- Vulnerabilities: 0 critical / 0 high / 0 moderate / 0 low (pnpm audit clean; all prior overrides effective)
- Secret leaks: none (no NEXT_PUBLIC_* carries server secrets; no hardcoded keys in production source)
- License issues: none (no GPL/AGPL; MPL-2.0 + LGPL-3.0 documented in accepted-risks.md)
- RLS: 10/10 ENABLE + FORCE RLS on all Supabase tables
- CORS: wildcard scoped to 2 read-only rate-limited GETs only; mutation guard test in place
- XSS: all 7 SVG user-input fields escaped via escapeXml(); timing-safe HMAC comparisons throughout
- Knip --production: 9 false positives (all deps in active use via next/dynamic); 0 real unused deps
- One INFO finding: `server-only` guard missing on 7 auth/verification files (defense-in-depth only, no current exposure)

**Cross-agent recommendations:**
- [Coverage]: No security-critical coverage gaps. lib/auth 97.4%, lib/verification 100%, all XSS paths exercised.
- [QA]: No security UX issues. CORS wildcard scoped; mutation guard invariant test active.
- [Triage]: P3 only — add `server-only` to 7 auth/verification files and add knip ignoreDependencies entries. No P1/P2 action required.
<!-- ENTRY:END -->
```
