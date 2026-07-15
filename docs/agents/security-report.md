# Security Report
> Generated: 2026-07-13 | Health status: green | HEAD: `9bfb9a6c`

## Executive Summary
The codebase is clean across all eight audit dimensions: zero dependency vulnerabilities, no secret leaks, no unused production dependencies, all SVG user input escaped, all Supabase tables RLS-enforced, CORS scoped to read-only endpoints, and no strong-copyleft license violations.

## Dependency Vulnerabilities
`pnpm audit` — **0 vulnerabilities across 628 dependencies** (0 critical / 0 high / 0 moderate / 0 low).

| Severity | Package | Issue | Fix |
|----------|---------|-------|-----|
| — | — | None found | — |

## Code Findings

- **[INFO] Secrets scan — clean.** No hardcoded API keys, tokens, or passwords in `apps/web` source. The only matches are test fixtures with literal `test-*` values (`lib/test-helpers/platform-auth-fixtures.ts:70,105,139`) — not real credentials.
- **[INFO] Client secret leak check — clean.** No `SUPABASE_SERVICE_ROLE_KEY`, `NEXTAUTH_SECRET`, `ADMIN_SECRET`, `CRON_SECRET`, or `*_CLIENT_SECRET` bound to any `NEXT_PUBLIC_*` var. The only public var is `NEXT_PUBLIC_POSTHOG_KEY` (a publishable analytics key, `lib/env.ts:84`) — safe to expose by design.
- **[INFO] SVG XSS — all user input escaped.** Every user-controlled field is passed through `escapeXml()` (`lib/render/escape.ts`): `handle` (`BadgeSvg.tsx:49`), `displayName` (`:51`), `avatarDataUri` (`:164`), `archetypeText` (`:188`), `tier` (`:245`), and `hash`/`date` (`VerificationStrip.ts:13-14`). Both branches of the header-name ternary are escaped.
- **[INFO] CORS — wildcard scoped correctly.** `Access-Control-Allow-Origin: *` appears only on two read-only, rate-limited GET endpoints: `/api/profile/[handle]` and `/api/verify/[hash]`. No mutation route sets a permissive CORS header (guarded by `cors-mutation-guard.test.ts`).
- **[INFO] RLS — 11/11 tables enforced.** All Supabase tables (`users`, `user_platforms`, `metrics_snapshots`, `verification_records`, `tool_insights`, `merge_operations`, `feature_flags`, `studio_configs`, `supplemental_stats`, `email_campaigns`, `campaign_sends`) have both `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY`.
- **[INFO] Attack surface — no unused production deps.** `knip --production` reports only 2 test-infra false positives (`vitest.setup.ts`, `vitest.contract-setup.ts`). Zero unused runtime dependencies.

## License Compliance
**All clear — no strong copyleft.** Scanned 373 packages in the pnpm store: **zero GPL / AGPL / SSPL / EUPL / CDDL / OSL** dependencies. Weak-copyleft packages found are all formally documented in `docs/accepted-risks.md`:

| Package | License | Status |
|---------|---------|--------|
| `dompurify` | MPL-2.0 OR Apache-2.0 | Accepted (Apache option on allowlist; transitive via PostHog) |
| `lightningcss` (+ platform binary) | MPL-2.0 | Accepted (build-time only, not bundled) |
| `axe-core` | MPL-2.0 | dev-only (a11y testing, not distributed) |
| `@resvg/resvg-js`, `@img/sharp-libvips-*` | MPL-2.0 / LGPL-3.0 | Accepted (dynamic-link / unmodified use) |

## Recommendations
No action items this cycle — every dimension is GREEN and all findings are confirmations of previously-hardened controls.

1. **(Monitor)** GitHub Advanced Security (code + secret scanning) remains disabled on this repo's tier — an accepted permanent limitation. Dependabot vulnerability alerts remain enabled with 0 open.
2. **(Housekeeping)** Consider adding `axe-core`'s MPL-2.0 to `docs/accepted-risks.md` for completeness, even though it is a non-distributed dev dependency.
