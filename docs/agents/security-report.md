# Security Report
> Generated: 2026-05-25 | Health status: yellow

## Executive Summary
One moderate transitive dependency vulnerability (`brace-expansion` via eslint, dev-path) and zero new code-level findings. RLS, secret boundaries, SVG escaping, and CORS posture are unchanged and clean.

## Dependency Vulnerabilities
| Severity | Package | Issue | Fix |
|----------|---------|-------|-----|
| moderate | brace-expansion 5.0.5 (via `apps/web > eslint > minimatch`) | GHSA-jxxr-4gwj-5jf2 / CVE-2026-45149 — `max` option applied too late, large numeric range can allocate ~505 MB before truncation (ReDoS-style DoS via unsanitized brace patterns) | Upgrade transitive to `>=5.0.6` via `pnpm update --depth Infinity brace-expansion` or `pnpm.overrides` pin |

`pnpm audit` totals: 0 critical, 0 high, **1 moderate**, 0 low. 637 production deps scanned.

## Code Findings
- **[INFO] Hardcoded "secret-looking" strings — all in tests/docs.** Grep for `(api|secret|password|token)\s*[:=]\s*['"][A-Za-z0-9_\-]{20,}['"]` matched only test fixtures (`platform-auth-fixtures.ts`, `*.test.ts`) and `docs/cli-guide.md`. No production source code holds literal credentials.
- **[CLEAN] No `NEXT_PUBLIC_*` leakage of secrets.** Grep for any `NEXT_PUBLIC_*` variant of `SUPABASE_SERVICE_ROLE_KEY`, `NEXTAUTH_SECRET`, `*_CLIENT_SECRET`, `ADMIN_SECRET`, `CRON_SECRET`, `RESEND*`, or `CHAPA_VERIFICATION_SECRET`: zero matches. `lib/db/supabase.ts:8` enforces `import "server-only"`.
- **[CLEAN] SVG XSS escaping.** All user-controlled fields rendered into SVG flow through `escapeXml()` from `apps/web/lib/render/escape.ts`. `BadgeSvg.tsx` calls it 6×, `VerificationStrip.ts` 3×. Test coverage at `escape.test.ts` (10 assertions).
- **[CLEAN] CORS.** Wildcard `Access-Control-Allow-Origin: *` is scoped to two read-only, rate-limited GET endpoints (`/api/verify/[hash]`, `/api/profile/[handle]`). Static test `cors-mutation-guard.test.ts` enforces no wildcards on mutation routes.
- **[CLEAN] RLS posture.** All 11 Supabase tables have `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY` (migration `025_force_supplemental_stats_rls.sql` closed the last gap). Deny-all-anon policies in `008_add_rls_deny_policies.sql`.
- **[INFO] Knip `--production` is clean.** No unused production exports flagged this cycle (attack surface stable).

## License Compliance
All clear with documented exceptions in `docs/accepted-risks.md`:
- `@resvg/resvg-js`, `lightningcss` — MPL-2.0 (weak file-level copyleft, unmodified usage).
- `@img/sharp-libvips-darwin-arm64` — LGPL-3.0 (dynamically linked binary, satisfies LGPL re-link clause).
- `sharp` — Apache-2.0 since v0.34.5.
- No GPL or AGPL dependencies present.

## Recommendations
1. **P2 — Patch `brace-expansion` to ≥5.0.6.** Either `pnpm up --depth Infinity brace-expansion` or add a `pnpm.overrides` pin in the root `package.json`. Dev-path only (lint tooling), but moderate CVE should not linger.
2. **P3 — No additional code-level work this cycle.** SVG escape, RLS, server-only boundary, fail-open rate limiter, and CORS guard all unchanged and covered by tests.

<!-- ENTRY:START agent=security timestamp=2026-05-25T07:00:00Z -->
## Security Scanner — 2026-05-25
- **Status**: YELLOW
- Vulnerabilities: 0 critical / 0 high / **1 moderate** (`brace-expansion` 5.0.5 via eslint > minimatch, GHSA-jxxr-4gwj-5jf2) / 0 low
- Secret leaks: **none** in production source (`NEXT_PUBLIC_*` secret-prefix scan: 0 matches; literal-key grep: only tests and `docs/cli-guide.md`)
- License issues: **none** — MPL-2.0 (`@resvg/resvg-js`, `lightningcss`) and LGPL-3.0 (`@img/sharp-libvips-darwin-arm64`, dynamically linked) covered in `docs/accepted-risks.md`. No GPL/AGPL.
- RLS: 11/11 tables ENABLE + FORCE RLS; deny-all-anon policies intact (`025_force_supplemental_stats_rls.sql` confirmed).
- CORS: wildcard scoped to 2 read-only rate-limited GETs; `cors-mutation-guard.test.ts` enforces invariant.
- XSS: 9 user-input entry points in SVG pipeline all routed through `escapeXml()` (`lib/render/escape.ts`); 23 escape call-sites across BadgeSvg + VerificationStrip + tests.
- Knip `--production`: 0 findings.
- `lib/db/supabase.ts:8` server-only boundary holds.

**Cross-agent recommendations:**
- [Coverage]: No security-relevant gaps. lib/auth 98.0%, lib/verification 100%, lib/analytics 97.3% per 2026-05-24 entry; all XSS/CORS paths covered.
- [QA]: No new security UX issues. CORS wildcard remains scoped to read-only endpoints; mutation guard static test in place.
- [Triage]: One P2 — bump `brace-expansion` transitive to ≥5.0.6 (eslint > minimatch path). Dev tooling, no production exposure, but moderate CVE should be cleared via `pnpm.overrides` or `pnpm up --depth Infinity brace-expansion`.
<!-- ENTRY:END -->
