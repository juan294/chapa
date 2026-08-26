# Security Report
> Generated: 2026-08-24 | Health status: green

## Executive Summary
No blocking issues found. `pnpm audit` and the CI vulnerability gate (`osv-scanner`) are both clean, no hardcoded secrets or `NEXT_PUBLIC_*` leakage were found, all SVG user input is escaped, all 11 Supabase tables have `ENABLE`+`FORCE` RLS, CORS wildcard access is still correctly scoped to the two public read-only endpoints, and license compliance is clean. HEAD `b513861f` (develop).

## Dependency Vulnerabilities
| Severity | Package | Issue | Fix |
|----------|---------|-------|-----|
| — | — | None found | `pnpm audit` (685 deps) and `pnpm run check:vulnerabilities` (osv-scanner, 680 lockfile packages, the actual CI gate) both report zero critical/high/moderate/low findings | n/a |

Note: the 2026-08-10 RED cycle (`undici`, `brace-expansion`, `js-yaml`, `nanoid`, `dompurify`) was fixed via `pnpm.overrides` bumps in PR #1058 and remains resolved — re-verified in the current lockfile, not just carried forward from a prior report.

## Code Findings
- **[INFO] Secrets**: Regex sweep for API-key/token/password/secret literal patterns across `apps/web/{app,lib,components}` and `packages` (excluding `*.test.ts`/fixtures) — zero matches.
- **[INFO] `NEXT_PUBLIC_*` leakage**: Grepped for `NEXT_PUBLIC_*(SECRET|SERVICE_ROLE|CLIENT_SECRET|PASSWORD|PRIVATE)` — zero matches. No `SUPABASE_SERVICE_ROLE_KEY` or `NEXTAUTH_SECRET` exposed to the client.
- **[INFO] SVG XSS escaping**: All user-controlled text is passed through `escapeXml()` before interpolation into SVG markup — `handle`/`displayName` (`apps/web/lib/render/BadgeSvg.tsx:50,52`), `avatarDataUri` (`:170`), `archetypeText` (`:194`), `tier` (`:251`), and `hash`/`date` in the verification strip (`apps/web/lib/render/VerificationStrip.ts:13-14`).
- **[INFO] CORS**: Wildcard `Access-Control-Allow-Origin: *` remains scoped to exactly the two intended public read-only, rate-limited GET endpoints — `/api/verify/[hash]` and `/api/profile/[handle]`. No other route sets a CORS header. `cors-mutation-guard.test.ts` is present and would fail if a mutating route adopted a wildcard.
- **[INFO] RLS**: All 11 real Supabase tables (`users`, `metrics_snapshots`, `verification_records`, `feature_flags`, `merge_operations`, `tool_insights`, `email_campaigns`, `campaign_sends`, `user_platforms`, `studio_configs`, `supplemental_stats`) confirmed with both `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY` via direct grep of every `ALTER TABLE` in `supabase/migrations/*.sql` — not sampled.
- **[INFO] Unused dependencies / dead code (attack surface)**: `npx knip` (default scan) and `npx knip --dependencies` both exit clean with zero findings, matching CI's actual invocation.
- **[RESOLVED, multi-cycle carry]** The `scopeRank` docstring in `apps/web/lib/github/client.ts:35-41`, flagged as an inverted/stale comment by the Cost Analyst across 5 consecutive cycles (2026-07-19 → 2026-07-23), now correctly states the model: `authenticated` = private-inclusive server `GITHUB_TOKEN`, `public` = the user's scope-blind OAuth session token. Confirmed fixed in current source, not carried from a prior report.

## License Compliance
All clear. `pnpm run check:licenses` scanned 98 production packages — all allowlisted (MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD, CC0-1.0) or covered by a documented accepted-risk exception in `docs/accepted-risks.md` (the standing MPL-2.0/LGPL-3.0 set: `@resvg/resvg-js`, `lightningcss`, `dompurify`, `@img/sharp-libvips-darwin-arm64`, dev-only `axe-core`). Zero GPL/AGPL dependencies.

## Recommendations
No action items this cycle. This is a pure confirmation audit — no new findings, and the one long-running carried item (`scopeRank` docstring) is now resolved.
