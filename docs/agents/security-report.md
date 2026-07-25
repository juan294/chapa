# Security Report
> Generated: 2026-07-20 | Health status: green

## Executive Summary
Clean cycle on a zero-delta tree (HEAD `8f4591e3`, v2.19.1 back-merge — no production-code commits since the 2026-07-19 runs): 0 vulnerabilities across both scanners, no secret leaks, all SVG user-input escape paths intact, CORS wildcard still scoped to the 2 read-only GETs, 11/11 tables on ENABLE+FORCE RLS, and zero license violations.

## Dependency Vulnerabilities
| Severity | Package | Issue | Fix |
|----------|---------|-------|-----|
| — | — | None found | — |

- `pnpm audit`: **0 critical / 0 high / 0 moderate / 0 low** across 685 dependencies.
- `pnpm run check:vulnerabilities` (osv-scanner, the actual CI gate per #1008): **passed** — 681 packages scanned from `pnpm-lock.yaml`, no HIGH/CRITICAL with an available fix.
- `npx knip` and `npx knip --dependencies` (pinned 6.27.0): **exit 0, zero findings** — no unused files, exports, or dependencies. The 9 `--production`-mode false positives from the 2026-07-16 cycle do not appear in the plain/default scans CI actually runs.

## Code Findings
- **[NONE — hardcoded secrets]** Grep for API-key/token/password/secret literal assignments (≥16-char values) across `apps/web` non-test source: **0 matches**. Only test fixtures and `vi.stubEnv` calls reference secret-shaped values.
- **[NONE — client secret leak]** No `SUPABASE_SERVICE_ROLE_KEY`, `NEXTAUTH_SECRET`, `ADMIN_SECRET`, `CRON_SECRET`, or `*_CLIENT_SECRET` in any `NEXT_PUBLIC_*` binding. The only sensitive-pattern `NEXT_PUBLIC_*` match is `NEXT_PUBLIC_POSTHOG_KEY` (publishable by design, read via `lib/env.ts:84`; `PostHogProvider.tsx:8` client read is the documented build-time-inlining exception). `SUPABASE_SERVICE_ROLE_KEY` reads are confined to server-side surfaces: `lib/env.ts:224`, `lib/db/supabase.ts` (server-only, lazy singleton), an ops script, and the Playwright e2e spec.
- **[NONE — SVG XSS]** All 7 user-input fields escaped via `escapeXml()`: `handle` (`BadgeSvg.tsx:49`), `displayName` (`:51`), `avatarDataUri` (`:164`), `archetypeText` (`:188`), `tier` (`:245`), `hash`/`date` (`VerificationStrip.ts:13-14`). `escape.ts` correctly uses `&apos;` for XML contexts (deliberately separate from `escapeHtml`), with a full test suite (`escape.test.ts`) covering `&`, `<`, `>`, `'`, `"`, mixed, and empty inputs. Per coverage agent 2026-07-20: `lib/render` at 100% stmts — every escape path executed under test.
- **[NONE — CORS]** Wildcard `Access-Control-Allow-Origin: *` remains scoped to exactly 2 read-only, rate-limited GETs: `/api/verify/[hash]` and `/api/profile/[handle]`. The `cors-mutation-guard.test.ts` CI invariant test is present and unchanged.
- **[NONE — RLS]** **11/11 tables ENABLE + FORCE ROW LEVEL SECURITY** verified via schema-qualified migration grep (users, user_platforms, metrics_snapshots, verification_records, tool_insights, merge_operations, feature_flags, studio_configs, supplemental_stats, email_campaigns, campaign_sends). Note: `tool_insights` shows 2 ENABLE statements across migrations (harmless idempotent re-enable), 1 FORCE — no gap.
- **[INFO — prior-cycle closures confirmed]** The `WARM_CACHE_PRIORITY_HANDLES` ceiling bypass P2 flagged to security on 2026-07-18 is closed in v2.19.1 (`rotationCeiling` fix, `warm-cache/route.ts:109-145`, with regression test). OAuth platform routes remain on fail-closed `rateLimitStrict()` + replay-consume state nonce (#1027). `/api/challenge` strict limiters unchanged.
- **[INFO — accepted risks unchanged]** GHAS code-scanning/secret-scanning disabled (repo-tier limitation) and `axe-core` MPL-2.0 (dev-only) both remain formally documented in `docs/accepted-risks.md` — doc entries confirmed standing, no re-verification required per the 2026-07-15 triage decision.

## License Compliance
**All clear.** `pnpm run check:licenses`: 96 production packages scanned, all on the allowlist (MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD, CC0-1.0) or explicitly documented as accepted risks in `docs/accepted-risks.md` (MPL-2.0: `@resvg/resvg-js`, `lightningcss`, `dompurify` dual-Apache; LGPL-3.0: `@img/sharp-libvips-*`). **0 GPL/AGPL** anywhere in the tree.

## Recommendations
1. **None blocking.** This is a confirmation cycle with zero regressions on a zero-delta tree — no P1/P2/P3 security action items.
2. (Non-security, already on cost-analyst's carry list) The stale `scopeRank` docstring at `lib/github/client.ts:36-39` still states the inverted pre-#1050 token-scoping rationale — comment-only fix, worth folding into the next docs commit so no agent re-learns the wrong model from that file.
