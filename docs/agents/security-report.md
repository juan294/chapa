# Security Report
> Generated: 2026-08-03 | Health status: green

## Executive Summary
Clean cycle — zero vulnerabilities, zero secret leaks, zero license violations, and all previously-verified protections (SVG escaping, RLS, CORS scoping) remain intact on HEAD `553652d3`.

## Dependency Vulnerabilities
| Severity | Package | Issue | Fix |
|----------|---------|-------|-----|
| — | — | None found | — |

`pnpm audit`: 0 critical / 0 high / 0 moderate / 0 low across 685 dependencies.
`pnpm run check:vulnerabilities` (osv-scanner, the actual CI gate): passed — 680 lockfile packages scanned, no high/critical vulnerabilities with an available fix.

## Code Findings
- **Unused dependencies (attack surface)**: `npx knip` — 0 findings. Clean.
- **Hardcoded secrets**: none in production source. A regex sweep (`(api[_-]?key|secret|password|token)\s*[:=]\s*["'][A-Za-z0-9_-]{16,}["']`) across `apps/web/**/*.{ts,tsx}` matched only test fixtures/files (`platform-auth-fixtures.ts`, `Navbar.render.test.tsx`'s `process.env.NEXTAUTH_SECRET = "test-secret-32-characters-valid-ok"`, and similar `*.test.ts` files) — all synthetic test values, not real credentials.
- **SVG XSS vectors**: all user-controlled fields are escaped via `escapeXml()` before interpolation into SVG markup — `handle`/`displayName` (`BadgeSvg.tsx:49,51`), `avatarDataUri` (`:164`), `archetypeText` (`:188`), `tier` (`:245`), and `hash`/`date` in `VerificationStrip.ts:13-14`. No unescaped user-input interpolation found.
- **Client-side secret leakage**: no `SUPABASE_SERVICE_ROLE_KEY`, `NEXTAUTH_SECRET`, `ADMIN_SECRET`, `CRON_SECRET`, `CHAPA_VERIFICATION_SECRET`, or any `*_CLIENT_SECRET` appears in any `NEXT_PUBLIC_*` binding. Grep for `NEXT_PUBLIC_*(SECRET|SERVICE_ROLE|CLIENT_SECRET|PASSWORD)` returned zero matches.
- **CORS**: wildcard `Access-Control-Allow-Origin: *` is present only on two read-only, rate-limited GET endpoints intended for public embedding — `/api/verify/[hash]` and `/api/profile/[handle]`. `app/api/cors-mutation-guard.test.ts` mechanically fails CI if any `POST`/`PUT`/`PATCH`/`DELETE` handler ever ships a wildcard CORS header. No violations found.
- **Row-Level Security**: **11/11 Supabase tables** have `ENABLE ROW LEVEL SECURITY`, confirmed via migration grep — `users`, `metrics_snapshots`, `verification_records`, `feature_flags`, `merge_operations`, `tool_insights`, `email_campaigns`, `campaign_sends`, `user_platforms`, `studio_configs`, `supplemental_stats`. `FORCE ROW LEVEL SECURITY` is additionally applied to all 11 (9 via migration `018_fix_tool_insights_rls.sql`'s catch-up pass, plus `studio_configs` and `supplemental_stats` via their own dedicated migrations).

## License Compliance
All clear. `pnpm run check:licenses` scanned 98 production packages — all either on the MIT/Apache-2.0/BSD/ISC/0BSD/CC0-1.0 allowlist or explicitly documented as accepted risks in `docs/accepted-risks.md` (the known MPL-2.0/LGPL-3.0 weak-copyleft set: `@resvg/resvg-js`, `lightningcss`, `dompurify`, `@img/sharp-libvips-darwin-arm64`, `axe-core` dev-only). Zero GPL/AGPL dependencies.

## Recommendations
None — no new action items this cycle. This is a pure confirmation cycle; all prior-cycle protections (warm-cache ceiling fix, OAuth fail-closed rate limiting, CORS mutation guard, SVG escaping) remain in place with no regressions.
