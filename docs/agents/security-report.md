# Security Report
> Generated: 2026-08-17 | Health status: green

## Executive Summary
No dependency vulnerabilities, no hardcoded secrets, no client-side secret leakage, no CORS or RLS gaps, and no unescaped SVG input were found. HEAD `0482da44` (develop). The four packages flagged RED on 2026-08-10 (`undici`, `brace-expansion`, `js-yaml`, `nanoid`) plus the related `dompurify` moderate finding are confirmed patched via `pnpm.overrides` and resolve to their fixed versions in the lockfile.

## Dependency Vulnerabilities
| Severity | Package | Issue | Fix |
|----------|---------|-------|-----|
| — | — | None found | `pnpm audit` (0 advisories across 680 packages) and `pnpm run check:vulnerabilities` (osv-scanner, the actual CI gate — 680 lockfile packages) both pass clean |

Previously-blocking findings (2026-08-10 RED cycle) — verified resolved this cycle:
- `undici` → override floor `>=7.29.0`, installed `7.29.0` (dev-only, via `jsdom`/`vitest`)
- `brace-expansion` → override floor `>=5.0.9`, present in `pnpm.overrides`
- `js-yaml` → override floor `>=4.3.1`
- `nanoid` → override floor `>=3.3.17`, installed `3.3.18` (dev-only, via `postcss`→`vite`)
- `dompurify` → override floor `>=3.4.13 <4.0.0`, installed `3.4.13`

All five were fixed in commits `fbdfa87c` and `042f55e0` (#1058), shipped in release v2.19.0/v2.20.0.

## Code Findings
No findings this cycle. Verification performed:
- **Secrets**: regex sweep of `apps/web/{app,lib,components}` and `packages` for API-key/token/password/secret literal patterns (excluding tests/fixtures/`process.env` references) — zero matches.
- **SVG XSS**: all user-controlled fields rendered into badge SVG markup pass through `escapeXml()` (`apps/web/lib/render/escape.ts`) — `handle`/`displayName` (`BadgeSvg.tsx:50,52`), `avatarDataUri` (`:170`), `archetypeText` (`:194`), `tier` (`:251`), `hash`/`date` (`VerificationStrip.ts:13-14`).
- **`NEXT_PUBLIC_*` leakage**: grepped for `NEXT_PUBLIC_*(SECRET|SERVICE_ROLE|CLIENT_SECRET|PASSWORD|PRIVATE)` across `apps/web` (source + env files) — zero matches. No secret-bearing var is exposed to the client bundle.
- **CORS**: wildcard `Access-Control-Allow-Origin: *` is present only on the two documented read-only, rate-limited GETs (`/api/verify/[hash]`, `/api/profile/[handle]`) — enforced by `cors-mutation-guard.test.ts`, which fails if the pattern appears on any other route.
- **RLS**: all 11 Supabase tables (`users`, `metrics_snapshots`, `verification_records`, `feature_flags`, `merge_operations`, `user_platforms`, `tool_insights`, `email_campaigns`, `campaign_sends`, `supplemental_stats`, `studio_configs`) have both `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY` set across `supabase/migrations/*.sql` — verified by cross-referencing every `CREATE TABLE` against both ALTER statements, not sampled.
- **Unused dependencies (attack surface)**: `npx knip` (default scan) and `npx knip --dependencies` both exit clean with zero findings, matching CI's actual invocation.

## License Compliance
All clear — `pnpm run check:licenses` scanned 98 production packages; all allowlisted (MIT/Apache-2.0/BSD/ISC/0BSD/CC0-1.0) or explicitly documented as accepted risks in `docs/accepted-risks.md` (the standing MPL-2.0/LGPL-3.0 set: `@resvg/resvg-js`, `lightningcss`, `dompurify`, `@img/sharp-libvips-darwin-arm64`, dev-only `axe-core`). Zero GPL/AGPL dependencies.

## Recommendations
No action items this cycle — pure confirmation. Nothing to escalate to Triage.
