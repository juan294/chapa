# Security Report
> Generated: 2026-07-06 | Health status: green

## Executive Summary
No new vulnerabilities, secret leaks, or license violations since the last cycle (2026-06-29); `pnpm audit` is fully clean across 1,087 dependencies and every previously-flagged item (esbuild dev-CVE, `/api/challenge` fail-open rate limiter) remains resolved.

## Dependency Vulnerabilities
| Severity | Package | Issue | Fix |
|----------|---------|-------|-----|
| — | — | None found — `pnpm audit` reports 0 critical / 0 high / 0 moderate / 0 low across 1,087 dependencies | — |

## Code Findings

- **[INFO] Hardcoded secrets** — none. Grepped `apps/web/app`, `apps/web/lib`, `apps/web/components`, `packages` for API-key/token/password literal patterns; zero matches outside test fixtures. All server secrets flow through `apps/web/lib/env.ts` with `.trim()` boundaries.
- **[INFO] SVG/XSS escaping** — confirmed intact. `BadgeSvg.tsx` escapes all user-controlled fields via `escapeXml()`: `handle` (`:49`), `displayName`/`headerName` (`:50-52`, escaped on both branches — falls back to the already-escaped `safeHandle` when no display name), `avatarDataUri` (`:164`), `archetypeText` (`:188`), `tier` (`:245`). `VerificationStrip.ts` escapes `hash`/`date` (`:13-14`). No unescaped interpolation of user input found.
- **[INFO] `NEXT_PUBLIC_*` leak check** — none. Grepped all `NEXT_PUBLIC_*` reads in `lib/env.ts` and across `app`/`components`/`lib` for `SERVICE_ROLE`, `NEXTAUTH_SECRET`, `ADMIN_SECRET`, `CRON_SECRET`, `VERIFICATION_SECRET`, `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `CLIENT_SECRET` — zero hits (the one grep match is a doc-comment listing these as things to check, not an actual leak). Only `NEXT_PUBLIC_POSTHOG_KEY` (publishable) and feature-flag booleans are public.
- **[INFO] `server-only` guards** — present on all 7 auth/verification modules (`lib/auth/github.ts`, `unsubscribe-token.ts`, `admin.ts`, `session.ts`, `cron.ts`, `cli-token.ts`, `lib/verification/hmac.ts`), matching the fix applied in the 2026-06-24 triage cycle.
- **[INFO] `/api/challenge` rate limiting** — confirmed both the IP-level (`rateLimitStrict`, 5/hour) and handle-level (`rateLimitStrict`, 3/day) limiters remain on the fail-closed `rateLimitStrict()` path (`apps/web/app/api/challenge/route.ts:24,81`). The fail-open P3 closed in the 2026-07-01 triage cycle has not regressed.
- **[INFO] CORS** — wildcard `Access-Control-Allow-Origin: *` scoped to exactly 2 read-only, rate-limited GET endpoints (`/api/verify/[hash]`, `/api/profile/[handle]`). `cors-mutation-guard.test.ts` statically asserts no POST/PUT/PATCH/DELETE handler ships a wildcard CORS header.
- **[INFO] RLS** — all 11 Supabase tables (`users`, `metrics_snapshots`, `verification_records`, `feature_flags`, `merge_operations`, `user_platforms`, `tool_insights`, `email_campaigns`, `campaign_sends`, `supplemental_stats`, `studio_configs`) have `ENABLE ROW LEVEL SECURITY`, and all have a corresponding `FORCE ROW LEVEL SECURITY` (verified via migrations 002, 003, 007, 010, 015, 016, 018, 024, 025, 027). Deny-all-anon policies in place; views use `SECURITY INVOKER` (014).
- **[INFO] Knip `--production`** — 2 findings, both false positives: `vitest.contract-setup.ts` and `vitest.setup.ts` (test infrastructure, flagged as "unused files" only because knip's production scan doesn't follow vitest config references). No real unused production dependencies — zero attack-surface reduction opportunities.
- **[INFO] GitHub security posture** — Dependabot vulnerability alerts enabled (confirmed via 204 response on `/vulnerability-alerts`), 0 open security PRs. One non-security Dependabot PR remains open and deferred: #924 (`actions/checkout` 6→7, major version bump, previously explained in PR comments).

## License Compliance
All clear — 0 GPL/AGPL matches across the full dependency tree (root + `apps/web`, production dependencies). Existing weak-copyleft acceptances are unchanged and documented in `docs/accepted-risks.md`:
- MPL-2.0: `@resvg/resvg-js`, `lightningcss`, `dompurify` (transitive via PostHog) — file-level copyleft, unmodified dependencies, no obligation to open-source Chapa code.
- LGPL-3.0: `@img/sharp-libvips-darwin-arm64` — dynamically linked, satisfies LGPL's re-linking requirement without restriction.

## Recommendations
1. No action required this cycle — all findings are informational confirmations that prior fixes (esbuild override, `/api/challenge` strict rate limiting, `server-only` guards, RLS FORCE policies) remain in place with no regressions.
2. Continue monitoring Dependabot PR #924 (`actions/checkout` major bump) at the next convenient dependency-upgrade window; no urgency since it's CI-tooling only.
