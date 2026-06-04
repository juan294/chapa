# Security Report
> Generated: 2026-06-01 | Health status: green

## Executive Summary
All automated and manual security checks pass: `pnpm audit` reports zero vulnerabilities, no secrets leak to the client, all 10 Supabase tables enforce FORCE RLS with deny-all-anon policies, and every user-controlled SVG field is escaped. No blockers, no warnings.

## Dependency Vulnerabilities
| Severity | Package | Issue | Fix |
|----------|---------|-------|-----|
| — | — | No known vulnerabilities (`pnpm audit` clean) | None required |

The prior moderate `brace-expansion` CVE (GHSA-jxxr-4gwj-5jf2) was cleared in the 2026-05-25 cycle via override bump to `>=5.0.6`. Audit now fully clean.

## Code Findings
- **[INFO] Hardcoded secrets — none.** Source scan across `apps/web/lib`, `apps/web/app`, and `packages` found no secret literals. All env reads go through `lib/env.ts` with `.trim()`.
- **[INFO] Client secret leakage — none.** No `NEXT_PUBLIC_*` variable carries a `SECRET`/`KEY`/`TOKEN`/`PASSWORD` value; `SUPABASE_SERVICE_ROLE_KEY` and `NEXTAUTH_SECRET` never appear in any `NEXT_PUBLIC_*` binding. Server-only Supabase boundary holds (`lib/db/supabase.ts:8` `import "server-only"`).
- **[INFO] SVG XSS — all entry points escaped.** 7 user-controlled fields routed through `escapeXml()` (`lib/render/escape.ts`): `handle`, `displayName` (`BadgeSvg.tsx:40,42`), `avatarDataUri` (`:155`), `archetypeText` (`:179`), `tier` (`:236`), plus `hash` and `date` in `VerificationStrip.ts:13-14`. 37 escape call-sites total across the render pipeline.
- **[INFO] CORS — wildcard scoped to read-only GETs.** `Access-Control-Allow-Origin: *` appears only on `/api/verify/[hash]` (rate-limited 30/60s) and `/api/profile/[handle]` (rate-limited 60/60s). `cors-mutation-guard.test.ts` statically enforces no wildcard on mutation routes.
- **[INFO] RLS — 10/10 tables ENABLE + FORCE.** Base tables: `users`, `metrics_snapshots`, `verification_records`, `feature_flags`, `merge_operations`, `tool_insights`, `email_campaigns`, `campaign_sends`, `user_platforms`, `supplemental_stats`. ENABLE via migrations 002 + per-table create migrations; FORCE via 018 (9 tables) + 025 (`supplemental_stats`). Deny-all-anon policies in 008 + 018. Service-role-only access bypasses RLS server-side as designed.
- **[INFO] Unused dependencies — none.** `npx knip --production` returned zero findings (reduced attack surface).

## License Compliance
All clear — no GPL/AGPL. Weak-copyleft dependencies are documented in `docs/accepted-risks.md`:
- `@resvg/resvg-js`, `lightningcss` — MPL-2.0 (file-level copyleft, used unmodified via public API; lightningcss is build-time only)
- `@img/sharp-libvips-darwin-arm64` — LGPL-3.0 (dynamically linked, re-linking requirement satisfied)
- `sharp` itself is now Apache-2.0 (allowlisted) as of 0.34.5

No source modifications to any copyleft package; no compliance action required.

## Recommendations
1. **No action required this cycle.** Posture is GREEN across all eight audit dimensions.
2. Maintain the `cors-mutation-guard.test.ts` invariant and `server-only` Supabase boundary on any new API/data routes.
3. Continue routing all new user-controlled SVG/markup fields through `escapeXml()` / `escapeHtml()`.
