# Security Report
> Generated: 2026-06-29 | Health status: green

## Executive Summary
All security dimensions are clean: zero vulnerabilities in `pnpm audit`, no hardcoded secrets, all 11 Supabase tables under ENABLE + FORCE RLS, SVG user input fully escaped via `escapeXml()`, CORS wildcard scoped to two read-only endpoints only, and all non-permissive licenses formally accepted in `docs/accepted-risks.md`. One P3 carry from prior cycles remains open: `/api/challenge` handle-level rate limiter uses fail-open `rateLimit()` instead of `rateLimitStrict()`, mitigated by session auth and Resend send limits.

## Dependency Vulnerabilities

`pnpm audit` result: **0 critical / 0 high / 0 moderate / 0 low** across 628 dependencies.

| Severity | Package | Issue | Fix |
|----------|---------|-------|-----|
| — | — | No vulnerabilities found | — |

Prior YELLOW finding from 2026-06-15 (esbuild GHSA-gv7w-rqvm-qjhr HIGH via vite/vitest) was resolved via `pnpm.overrides` pinning `esbuild >= 0.28.1`. Audit is fully clean this cycle.

## Code Findings

**PASS — XSS (SVG rendering)**
All 7 user-controlled SVG fields are escaped via `escapeXml()` (`apps/web/lib/render/escape.ts`):
- `handle` — `BadgeSvg.tsx:49`
- `displayName` — `BadgeSvg.tsx:51`
- `avatarDataUri` — `BadgeSvg.tsx:164`
- `archetypeText` — `BadgeSvg.tsx:188`
- `tier` — `BadgeSvg.tsx:245`
- `hash` + `date` — `VerificationStrip.ts:13-14`

All 5 XML metacharacters (`&`, `<`, `>`, `'`, `"`) covered. `escape.test.ts` verifies all cases.

**PASS — Secret leak to client**
No `SUPABASE_SERVICE_ROLE_KEY`, `NEXTAUTH_SECRET`, `ADMIN_SECRET`, `CRON_SECRET`, `GITHUB_CLIENT_SECRET`, or `RESEND_API_KEY` appears in any `NEXT_PUBLIC_*` binding. All server secrets flow through `apps/web/lib/env.ts` with `import "server-only"` boundaries at `lib/db/supabase.ts:8`. Only publishable variables are exposed: `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, and feature-flag booleans.

**PASS — Hardcoded secrets**
No literal API keys, tokens, or passwords found in `apps/web/lib/`, `apps/web/app/`, or `packages/`. All references to secret names are in comments/JSDoc, `process.env` reads, or test fixtures with mock values (e.g. `platform-auth-fixtures.ts` uses `test-bb/cb-client-secret` strings).

**PASS — CORS**
Wildcard `Access-Control-Allow-Origin: *` is scoped to exactly 2 read-only rate-limited GET endpoints:
- `/api/verify/[hash]` — 30 req/60s rate-limited
- `/api/profile/[handle]` — 60 req/60s rate-limited

`apps/web/app/api/cors-mutation-guard.test.ts` enforces that no `POST`/`PUT`/`PATCH`/`DELETE` handler can ship a wildcard origin — fails the build if violated.

**PASS — Supabase RLS**
All 11 user tables have `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY`:

| Table | ENABLE | FORCE | Deny-anon policy |
|-------|--------|-------|-----------------|
| users | ✓ (002) | ✓ (018) | ✓ (008) |
| metrics_snapshots | ✓ (002) | ✓ (018) | ✓ (008) |
| verification_records | ✓ (002) | ✓ (018) | ✓ (008) |
| feature_flags | ✓ (003) | ✓ (018) | ✓ (008) |
| merge_operations | ✓ (007) | ✓ (018) | ✓ (008) |
| tool_insights | ✓ (015/018) | ✓ (018) | ✓ (018) |
| email_campaigns | ✓ (016) | ✓ (018) | ✓ (018) |
| campaign_sends | ✓ (016) | ✓ (018) | ✓ (018) |
| user_platforms | ✓ (010) | ✓ (018) | ✓ (008) |
| supplemental_stats | ✓ (024) | ✓ (025) | ✓ (025) |
| studio_configs | ✓ (027) | ✓ (027) | ✓ (027) |

Views: `latest_snapshots_view` + `admin_users_view` configured with `SECURITY INVOKER` (migration 014).

**P3 — `/api/challenge` fail-open rate limiter (CARRY)**
Location: `apps/web/app/api/challenge/route.ts:81`
Handle-level rate limit (3 challenges/day per handle) uses `rateLimit()` (fail-open) instead of `rateLimitStrict()`. During a Redis outage, authenticated users could exceed the 3/day email cap. Compensating controls: session auth required (only owner can challenge their own handle), Resend send limits apply. Fix: swap `rateLimit` → `rateLimitStrict` on line 81.

**INFO — Knip `--production`**
1 finding: `vitest.setup.ts` (false positive — test infrastructure file). No real unused production dependencies detected.

## License Compliance

No GPL or AGPL dependencies. Non-permissive licenses in use are all formally accepted:

| Package | License | Status |
|---------|---------|--------|
| `@resvg/resvg-js` | MPL-2.0 | Accepted — weak copyleft, file-level, unmodified use |
| `@img/sharp-libvips-darwin-arm64` | LGPL-3.0 | Accepted — dynamically linked, satisfies re-link requirement |
| `lightningcss` | MPL-2.0 | Accepted — build-time only, not bundled to users |
| `dompurify` (transitive via PostHog) | MPL-2.0 OR Apache-2.0 | Accepted — Apache-2.0 option on allowlist; not imported directly |

All documented in `docs/accepted-risks.md`. No copyleft infections of Chapa application code.

## Recommendations

| Priority | Action | Location |
|----------|--------|----------|
| P3 | Swap `rateLimit()` → `rateLimitStrict()` for handle-level guard in `/api/challenge` | `apps/web/app/api/challenge/route.ts:81` |

No P1 or P2 items. Security posture is strong across all audit dimensions.
