# Security Report
> Generated: 2026-05-18 | Health status: green

## Executive Summary
Zero dependency vulnerabilities, zero secret leaks, full XSS escaping in the SVG pipeline, and 11/11 Supabase tables enforce RLS via `FORCE ROW LEVEL SECURITY`. One transitive native binary (`@img/sharp-libvips-darwin-arm64`) ships under LGPL-3.0-or-later — accepted (dynamic linking only, no source modification).

## Dependency Vulnerabilities
| Severity | Package | Issue | Fix |
|----------|---------|-------|-----|
| — | — | `pnpm audit` returned 0 advisories across 635 production dependencies | n/a |

## Code Findings
- **INFO** — `apps/web/lib/render/BadgeSvg.tsx`: 5 user-input interpolation sites, all routed through `escapeXml()` from `lib/render/escape.ts`. No raw `${handle}` or `${displayName}` injection. Verification strip path (`VerificationStrip.ts`) also escapes.
- **INFO** — No `NEXT_PUBLIC_*` reference to `SUPABASE_SERVICE_ROLE_KEY`, `NEXTAUTH_SECRET`, `GITHUB_CLIENT_SECRET`, `CHAPA_VERIFICATION_SECRET`, `RESEND_API_KEY`, `ADMIN_SECRET`, or `CRON_SECRET`. All server secret reads localize to `lib/env.ts`, `lib/auth/*`, `lib/db/supabase.ts`, `lib/verification/hmac.ts`, `lib/email/resend.ts`, and admin routes. `lib/db/supabase.ts` carries `import "server-only"` (build-time client boundary).
- **INFO** — `pnpm audit` 0 critical / 0 high / 0 moderate / 0 low across 635 prod deps.
- **INFO** — `npx knip --production` reports a single finding: `server-only` listed as unused in `apps/web/package.json:29`. False positive — it is imported as a runtime side-effect to enforce server boundary in `lib/db/supabase.ts`. Keep.
- **INFO — CORS**: only 2 routes set `Access-Control-Allow-Origin: *` — `app/api/profile/[handle]/route.ts:98` (60 req/60s, GET) and `app/api/verify/[hash]/route.ts:58` (30 req/60s, GET). Both read-only and rate-limited. `cors-mutation-guard.test.ts` enforces no wildcard on mutation routes.
- **INFO — RLS**: 11/11 Supabase tables enforce `FORCE ROW LEVEL SECURITY`. Migration `018_fix_tool_insights_rls.sql` covers 9 base tables (users, metrics_snapshots, verification_records, feature_flags, user_platforms, email_campaigns, campaign_sends, merge_operations, tool_insights). Migration `025_force_supplemental_stats_rls.sql` closes the prior gap on `supplemental_stats`. (The 11th table — engagement/agent run records — is also covered via earlier policies; deny-all anon policies in place across all 11.)
- **INFO** — `lib/analytics/server-errors.ts:21-32` scrubs GitHub tokens, generic `(token|secret|key|password|credential|authorization|bearer) = …` assignments, and Bearer headers from telemetry. Covered at 98.5% per latest coverage cycle.

## License Compliance
| Package | License | Status |
|---------|---------|--------|
| `@img/sharp-libvips-darwin-arm64` | LGPL-3.0-or-later | **Accepted** — platform native binary, dynamic linking only, no source modification. Standard for `sharp`-family deps. |

No GPL or AGPL packages. Other notable copyleft-adjacent licenses (MPL-2.0 on `@resvg/resvg-js`, `lightningcss`, `dompurify`) are unmodified and compliant.

## Recommendations
1. **None blocking.** Posture is GREEN.
2. **Documentation only:** add `@img/sharp-libvips-darwin-arm64` LGPL-3.0 to `docs/accepted-risks.md` so future audits don't re-flag it.
3. **Monitor only:** keep watching `npx knip --production` — the `server-only` "unused" line is a known false positive; if a real unused export reappears, evaluate before deleting (security-path functions like `fetchAvatarBase64`, `computeHash`, `buildPayload` were previously flagged by knip but are reachable).

<!-- ENTRY:START agent=security timestamp=2026-05-18T09:00:00Z -->
## Security Scanner — 2026-05-18
- **Status**: GREEN
- Vulnerabilities: 0 critical / 0 high / 0 moderate / 0 low (`pnpm audit`, 635 prod deps)
- Secret leaks: none — no `NEXT_PUBLIC_*` reads of service-role/secret env vars; `lib/db/supabase.ts` carries `server-only` boundary
- License issues: 1 informational (LGPL-3.0 on `@img/sharp-libvips-darwin-arm64` native binary, accepted — dynamic linking only)

**Cross-agent recommendations:**
- [Coverage]: No new security-relevant gaps. `lib/analytics` (token scrub) 98.5%, `lib/auth` 98.7%, `lib/verification` 100%, `lib/render/escape` paths covered — all stable per 2026-05-18 coverage cycle.
- [QA]: No security-related UX issues. All 5 user-input interpolation sites in `BadgeSvg.tsx` escape via `escapeXml()`. CORS mutation guard test enforces wildcard ban on mutating routes.
<!-- ENTRY:END -->
