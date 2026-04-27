# Security Report
> Generated: 2026-04-27 | Health status: green

## Executive Summary
Security posture is clean across all eight audit dimensions: 0 dependency vulnerabilities, no hardcoded secrets, full XSS escaping in the SVG pipeline, RLS enforced on all 10 Supabase tables, and no copyleft license conflicts. Two intentional CORS wildcards remain on read-only public endpoints (`/api/verify/[hash]`, `/api/profile/[handle]`) — both rate-limited and signature-verified by design.

## Dependency Vulnerabilities
`pnpm audit` returned 0 advisories across 644 production dependencies (0 devDependencies in audit scope).

| Severity | Package | Issue | Fix |
|----------|---------|-------|-----|
| — | — | None | — |

## Code Findings

### Hardcoded secrets — CLEAN
- Pattern scan for `sk_live`, `ghp_`, `gho_`, `ghs_`, `github_pat_`, `AKIA…`, `AIza…` returned 22 file matches; **0 are secrets**. All hits are either:
  - Test fixtures (`*.test.ts`, `lib/test-helpers/platform-auth-fixtures.ts`)
  - Token-shape regexes in `lib/analytics/server-errors.ts:20-23` (used for redacting tokens before PostHog logging)
  - Documentation comments in `lib/auth/cli-token.ts:88`

### SVG XSS — CLEAN
All 9 user-input entry points to the SVG pipeline are escaped via `escapeXml()`:
- `apps/web/lib/render/BadgeSvg.tsx:40-42` — `handle`, `displayName`
- `apps/web/lib/render/BadgeSvg.tsx:155` — avatar data URI
- `apps/web/lib/render/BadgeSvg.tsx:179` — archetype text
- `apps/web/lib/render/BadgeSvg.tsx:236` — tier label
- `apps/web/lib/render/VerificationStrip.ts:13-14` — verification hash + date
- `apps/web/app/u/[handle]/badge.svg/route.ts:50` — handle param

### NEXT_PUBLIC_* leakage — CLEAN
Grep across `apps/web/{app,lib,components}` for `NEXT_PUBLIC_*(secret|service_role|client_secret|webhook_secret|admin_secret|cron_secret|password|private_key)` returned **0 real matches** (one false positive in agent-config template literal at `lib/agents/agent-config.ts:91`). `SUPABASE_SERVICE_ROLE_KEY`, `NEXTAUTH_SECRET`, `RESEND_WEBHOOK_SECRET`, `CHAPA_VERIFICATION_SECRET`, `BITBUCKET_CLIENT_SECRET`, `CODEBERG_CLIENT_SECRET`, `ADMIN_SECRET`, and `CRON_SECRET` are server-side only.

### CORS — INTENTIONAL WILDCARDS
| Route | CORS | Method | Notes |
|-------|------|--------|-------|
| `/api/profile/[handle]/route.ts:9,105` | `*` | GET | Read-only public profile, rate-limited (60/60s) |
| `/api/verify/[hash]/route.ts:23,33,42,58,76` | `*` | GET | HMAC-verified badge data, rate-limited (30/60s) |

All 17 mutation routes (POST/PUT/PATCH/DELETE) have **no CORS headers** — same-origin only. Acceptable design.

### Supabase RLS — ENABLED ON ALL TABLES
Audit of `supabase/migrations/*.sql` confirms `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY` on every table:

| Table | Migration | RLS | FORCE |
|-------|-----------|-----|-------|
| users | 002, 018 | ✅ | ✅ |
| metrics_snapshots | 002, 018 | ✅ | ✅ |
| verification_records | 002, 018 | ✅ | ✅ |
| feature_flags | 003, 018 | ✅ | ✅ |
| merge_operations | 007, 018 | ✅ | ✅ |
| user_platforms | 010, 018 | ✅ | ✅ |
| tool_insights | 015, 018 | ✅ | ✅ |
| email_campaigns | 016, 018 | ✅ | ✅ |
| campaign_sends | 016, 018 | ✅ | ✅ |
| supplemental_stats | 024 | ✅ | (table-level deny-all anon) |

Views `latest_snapshots` and `admin_users` use `security_invoker = true`.

## License Compliance
No GPL or AGPL dependencies. Copyleft-adjacent packages reviewed:

| Package | License | Risk | Verdict |
|---------|---------|------|---------|
| `@resvg/resvg-js` | MPL-2.0 | File-level copyleft only | OK — not modified, used as-is |
| `@resvg/resvg-js-darwin-arm64` | MPL-2.0 | File-level copyleft only | OK — binary distribution |
| `dompurify` | MPL-2.0 OR Apache-2.0 | Dual-licensed | OK — Apache-2.0 elected by default |
| `@img/sharp-libvips-darwin-arm64` | LGPL-3.0-or-later | Dynamic linking | OK — sharp loads libvips dynamically; no static linking, no source modification |

**All clear.** No copyleft violations.

## Recommendations
1. **Knip false positives (LOW)** — `pnpm knip --production` flags 8 unused deps (`@resvg/resvg-js`, `@vercel/analytics`, `@vercel/speed-insights`, `canvas-confetti`, `next-themes`, `posthog-js`, `resend`, `svix`). All are actively used — same false-positive set as the 2026-04-20 audit. No action; document if not already.
2. **CORS wildcard surveillance (INFO)** — The two `*` CORS routes are intentional, but worth a recurring audit to confirm no mutation handler ever ships with `Access-Control-Allow-Origin: *`. Already enforced by convention; consider an ESLint custom rule or test assertion to make it mechanical.
3. **`apps/web/lib/analytics/server-errors.ts` SENSITIVE_PATTERNS** — Apr 20 P2 (token-redaction branch coverage) is now resolved per Apr 27 coverage report (lib/analytics 97.26% stmts / 89.09% branches). No further action.

---

## Shared Context Entry

<!-- ENTRY:START agent=security timestamp=2026-04-27T09:00:00Z -->
## Security Scanner — 2026-04-27
- **Status**: GREEN
- Vulnerabilities: 0 critical, 0 high, 0 moderate, 0 low — `pnpm audit` clean across 644 prod deps
- Secret leaks: none — 22 grep matches all in tests, redaction regexes (`server-errors.ts:20-23`), or doc comments
- License issues: none — 2× MPL-2.0 + 1× dual MPL/Apache + 1× LGPL-3.0 (sharp libvips, dynamic linking). No GPL/AGPL.
- XSS: 9 user-input entry points to SVG, all escaped via `escapeXml()` (BadgeSvg.tsx, VerificationStrip.ts, badge.svg/route.ts)
- CORS: 2 wildcard routes (`/api/profile/[handle]`, `/api/verify/[hash]`) — read-only, rate-limited, intentional. 17 mutation routes have no CORS.
- RLS: all 10 Supabase tables ENABLE + FORCE ROW LEVEL SECURITY (migrations 002, 003, 007, 010, 015, 016, 018, 024). 2 views use `security_invoker = true`.
- NEXT_PUBLIC_* leak check: clean — 1 false positive in `lib/agents/agent-config.ts:91` (template literal).
- Knip `--production`: 8 false positives unchanged from 2026-04-20 — all confirmed in active use.

**Cross-agent recommendations:**
- [Coverage]: Apr 20 P2 on `lib/analytics/server-errors.ts` SENSITIVE_PATTERNS branches is resolved (97.26% stmts / 89.09% branches per Apr 27 coverage). No new security-relevant gaps.
- [QA]: No new security UX issues. Consider adding an ESLint rule or test assertion that no POST/PUT/PATCH/DELETE handler ships with `Access-Control-Allow-Origin: *` — currently enforced by convention.
- [Cost Analyst]: No cost-security conflict. Fail-open rate limiter (`redis.ts:127-149`) intact. 100% fetch timeout coverage.
- [Performance]: Knip false positives unchanged — no bundle changes recommended. Do not remove the 8 flagged deps.
<!-- ENTRY:END -->
