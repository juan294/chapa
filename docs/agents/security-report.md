# Security Report
> Generated: 2026-06-15 | Health status: yellow

## Executive Summary
Application code is clean — no secret leaks, all SVG user input escaped, RLS forced on all 10 tables, CORS wildcards scoped to read-only rate-limited GETs, and no strong copyleft. The single concern is two **dev-only** `esbuild` advisories (1 high, 1 low) reaching the tree transitively through `vite`/`vitest`; neither code path is exercised by the Node/Vercel production deployment, but the high-severity advisory should be cleared with a one-line override.

## Dependency Vulnerabilities
| Severity | Package | Issue | Fix |
|----------|---------|-------|-----|
| High | esbuild 0.28.0 (`.>vite>esbuild`, dev-only) | GHSA-gv7w-rqvm-qjhr (CVE) — missing binary integrity check in the **Deno** module enables RCE via attacker-controlled `NPM_CONFIG_REGISTRY`. Not reachable from this Node/Vercel build (no Deno runtime). | Add `"esbuild": ">=0.28.1"` to `pnpm.overrides`, then `pnpm install` |
| Low | esbuild 0.28.0 (`.>vite>esbuild`, dev-only) | GHSA-g7r4-m6w7-qqqr — arbitrary file read when running the esbuild dev server on **Windows**. Not used (vitest, macOS/Linux CI). | Same override `>=0.28.1` clears both |

`pnpm audit`: **1 high, 1 low** — both the same `esbuild` package, both dev-tooling transitive deps with no production exposure. `npx knip --production`: **0 unused dependencies** (no attack-surface bloat).

## Code Findings
- **[GREEN] Secret leaks — none.** No real API keys/tokens/passwords in source. Only matches are test fixtures (`platform-auth-fixtures.ts`: `test-bb-client-secret`, `test-cb-client-secret`) — obvious mocks, not credentials.
- **[GREEN] NEXT_PUBLIC leak — none.** No `SUPABASE_SERVICE_ROLE_KEY` or `NEXTAUTH_SECRET` appears under any `NEXT_PUBLIC_*` binding. The only `NEXT_PUBLIC_*` secret-shaped name is `NEXT_PUBLIC_POSTHOG_KEY`, which is a PostHog **publishable** client key (intended to ship to the browser). All server config flows through `lib/env.ts` with `.trim()`.
- **[GREEN] SVG XSS — all entry points escaped.** `lib/render/BadgeSvg.tsx` routes every user-controlled field through `escapeXml()` (`lib/render/escape.ts`): `handle` (:40), `displayName` (:42), `avatarDataUri` (:155), `archetypeText` (:179), `tier` (:236); `VerificationStrip.ts` escapes hash/date. `escapeXml` covers all five XML metacharacters (`& < > ' "`).
- **[GREEN] CORS — scoped wildcards only.** `Access-Control-Allow-Origin: *` is set on exactly two routes: `/api/profile/[handle]` and `/api/verify/[hash]` — both read-only, rate-limited GETs. `cors-mutation-guard.test.ts` statically enforces that no mutation route emits a wildcard.
- **[GREEN] RLS — 10/10 tables.** All base tables (`users`, `metrics_snapshots`, `verification_records`, `feature_flags`, `merge_operations`, `tool_insights`, `email_campaigns`, `campaign_sends`, `user_platforms`, `supplemental_stats`) have both `ENABLE` and `FORCE ROW LEVEL SECURITY`, with deny-all-anon policies (migrations 008/018, FORCE via 018 + 025).

## License Compliance
**All clear** — no GPL/AGPL/strong-copyleft dependencies. Present weak-copyleft deps are MPL-2.0 (`lightningcss` build tooling, `axe-core` dev a11y testing) — file-level copyleft with no source modification, already covered in `docs/accepted-risks.md`. No LGPL packages currently installed (`sharp` now ships Apache-2.0).

## Recommendations
1. **(High, low-effort)** Add `"esbuild": ">=0.28.1"` to the existing `pnpm.overrides` block in `package.json` (alongside `brace-expansion`, `minimatch`, etc.) and run `pnpm install` to clear both esbuild advisories. Dev-only, zero production exposure, but clears the audit to GREEN.
2. **(Nice-to-have)** Route `PostHogProvider.tsx:8-9` reads of `NEXT_PUBLIC_POSTHOG_KEY/HOST` through `lib/env.ts` for consistency (access-pattern only — both vars are non-sensitive publishable values; no security gap).
