# Security Report
> Generated: 2026-05-11 | Health status: green

## Executive Summary

All critical security controls are healthy: zero dependency vulnerabilities, no hardcoded secrets, full SVG XSS escaping, clean CORS isolation, and RLS enabled on all 11 production tables. Two low-severity informational findings are documented below — neither requires immediate action.

## Dependency Vulnerabilities

| Severity | Package | Issue | Fix |
|----------|---------|-------|-----|
| — | — | `pnpm audit` reports **0 vulnerabilities** (critical: 0, high: 0, moderate: 0, low: 0) | N/A |

## Unused Dependencies (Attack Surface Reduction)

`npx knip --production` returned **0 findings**. No unused production dependencies or dead exports detected.

## Code Findings

**LOW — Architecture disclosure via client chunk** (`/apps/web/.next/static/chunks/05qnm9t_53wk5.js`)
- The string `SUPABASE_SERVICE_ROLE_KEY` appears in a client-accessible JS chunk because `lib/db/supabase.ts` was pulled into a shared Next.js bundle. The actual key value is **not present** — confirmed by 0 JWT-prefix (`eyJ`) matches in the chunk. In browsers, `process.env.SUPABASE_SERVICE_ROLE_KEY` resolves to `undefined`. This is a bundling artifact that reveals server architecture but poses no exploit risk at current threat model.
- Risk: informational architecture disclosure. Not exploitable without additional access.
- Remediation (optional): add `lib/db/supabase.ts` to `serverExternalPackages` in `next.config.ts` or ensure all imports flow through server-only boundaries (`"server-only"` package).

**LOW — `supplemental_stats` table missing `FORCE ROW LEVEL SECURITY`** (`supabase/migrations/024_create_supplemental_stats.sql`)
- The table has `ENABLE ROW LEVEL SECURITY` and an explicit deny-all anon policy, but migration 018 (`018_fix_tool_insights_rls.sql`) which added `FORCE ROW LEVEL SECURITY` to 9 other tables predates this table's creation. `FORCE ROW LEVEL SECURITY` ensures the restriction applies even to table owners.
- Risk: negligible — app uses only the service role key (which bypasses RLS by design), and the deny-all anon policy already blocks all anon access.
- Remediation: add `ALTER TABLE supplemental_stats FORCE ROW LEVEL SECURITY;` in a new migration for defense-in-depth consistency.

**RESOLVED — `SENSITIVE_PATTERNS` branch coverage** (noted P2 in Apr-20 report)
- Coverage agent May 11 confirms `lib/analytics` at 97.3% stable. All 9 SENSITIVE_PATTERNS token-scrubbing branches are now covered by tests. P2 closed.

## SVG XSS Audit

All user-controlled input in the SVG pipeline is escaped via `escapeXml()` (`lib/render/escape.ts`) which covers all 5 XML special characters (`&`, `<`, `>`, `'`, `"`):

| Field | Escape applied |
|-------|----------------|
| `stats.handle` | `escapeXml()` at `BadgeSvg.tsx:40` |
| `stats.displayName` | `escapeXml()` at `BadgeSvg.tsx:42` |
| `avatarDataUri` | `escapeXml()` at `BadgeSvg.tsx:155` |
| `archetypeText` | `escapeXml()` at `BadgeSvg.tsx:179` |
| `impact.tier` | `escapeXml()` at `BadgeSvg.tsx:236` |
| `verificationHash` | `escapeXml()` at `VerificationStrip.ts:13` |
| `verificationDate` | `escapeXml()` at `VerificationStrip.ts:14` |

Admin `renderMarkdown()` (`app/admin/agents/cross-agent-insights.tsx:12`) correctly calls `escapeHtml()` **before** applying markdown formatting — safe against XSS in agent content.

All 12 `dangerouslySetInnerHTML` usages in production code audited: SVG is server-rendered output (trusted), admin markdown is sanitized pre-render, inline CSS strings are static constants. No unsafe injection vectors found.

## CORS Audit

| Route | CORS | Justification |
|-------|------|---------------|
| `/api/verify/[hash]` | `Access-Control-Allow-Origin: *` | Read-only, 30 req/60s rate limit. Intentional — badge verification is a public API. |
| `/api/profile/[handle]` | `Access-Control-Allow-Origin: *` | Read-only, 60 req/60s rate limit. Intentional — public profile API. |
| All POST/PUT/PATCH/DELETE routes | No CORS headers | Enforced by `cors-mutation-guard.test.ts` static analysis test. |

The mutation guard test (`app/api/cors-mutation-guard.test.ts`) runs at CI and statically asserts that no mutation route exports a wildcard CORS origin alongside mutating HTTP methods.

## Supabase RLS Audit

All 11 production tables have `ENABLE ROW LEVEL SECURITY` with explicit deny-all anon policies. 10 of 11 additionally have `FORCE ROW LEVEL SECURITY`:

| Table | ENABLE RLS | FORCE RLS | Deny-anon policy |
|-------|-----------|-----------|-----------------|
| `users` | ✓ (002) | ✓ (018) | ✓ (008) |
| `metrics_snapshots` | ✓ (002) | ✓ (018) | ✓ (008) |
| `verification_records` | ✓ (002) | ✓ (018) | ✓ (008) |
| `feature_flags` | ✓ (003) | ✓ (018) | ✓ (008, SELECT still allowed) |
| `merge_operations` | ✓ (007) | ✓ (018) | ✓ (008) |
| `user_platforms` | ✓ (010) | ✓ (018) | ✓ (010) |
| `tool_insights` | ✓ (015) | ✓ (018) | ✓ (018) |
| `email_campaigns` | ✓ (016) | ✓ (018) | ✓ (016) |
| `campaign_sends` | ✓ (016) | ✓ (018) | ✓ (016) |
| `supplemental_stats` | ✓ (024) | ✗ | ✓ (024) |
| 2 views | — | — | `security_invoker = true` (014) |

## Secret Leak Check

- `NEXT_PUBLIC_*` vars are all non-sensitive (PostHog key/host, feature flags, base URL). No server secrets exposed via `NEXT_PUBLIC_` prefix.
- Direct `process.env.SECRET_NAME` access in `app/` routes: none found outside `lib/env.ts` — all env reads centralized with `.trim()`.
- Client chunk inspection: only `SUPABASE_SERVICE_ROLE_KEY` name found (not value) — see Code Findings above.

## License Compliance

`license-checker --production` returned **no copyleft violations**.

- No GPL, AGPL, or LGPL dependencies found.
- MPL-2.0 packages (`@resvg/resvg-js`, `lightningcss`) and dual Apache-2.0/MPL-2.0 (`dompurify`) noted from prior audit — all accepted. MPL-2.0 requires source-availability for modifications to the MPL'd files only; no modifications made. No compliance action required.

## Recommendations

| Priority | Action | Location |
|----------|--------|---------|
| P3 | Add `ALTER TABLE supplemental_stats FORCE ROW LEVEL SECURITY;` in new migration for defense-in-depth consistency | New migration after 024 |
| P3 | Consider marking `lib/db/supabase.ts` as server-only to prevent the module name from appearing in client bundles | `lib/db/supabase.ts` — add `import "server-only"` at top |
| Monitor | Verify `supplemental_stats` FORCE RLS gap is added in next schema maintenance window | Low urgency — anon deny-all policy already in place |
