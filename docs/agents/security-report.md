# Security Report
> Generated: 2026-08-10 | Health status: **RED**

## Executive Summary
The dependency-vulnerability CI gate (`pnpm run check:vulnerabilities`) is now **failing** with 4 blocking HIGH-severity findings, caused by stale `pnpm.overrides` floor versions in `package.json` that new OSV advisories (published since the last GREEN cycle on 2026-08-03, same commit `553652d3`) have overtaken — not by any code change. All other checks (secrets, XSS escaping, RLS, CORS, license compliance, dead-dependency scan) remain clean.

## Dependency Vulnerabilities
| Severity | Package | Issue | Fix |
|----------|---------|-------|-----|
| HIGH | `undici@7.28.0` | GHSA-4cwx-7wf7-3272 — cross-user info disclosure & parse-time crash via degenerate private cache directives | Raise `pnpm.overrides.undici` floor from `>=7.28.0 <8.0.0` to `>=7.29.0 <8.0.0` |
| HIGH | `brace-expansion@5.0.8` | GHSA-rgw5-rvv9-x895 — DoS via unbounded intermediate arrays, bypasses prior CVE mitigation | Raise `pnpm.overrides.brace-expansion` floor from `>=5.0.8 <6.0.0` to `>=5.0.9 <6.0.0` |
| HIGH | `js-yaml@4.3.0` | CVE-2026-59870 — quadratic CPU consumption in `!!omap` resolution, fix not backported | Raise `pnpm.overrides.js-yaml` floor from `>=4.3.0 <5.0.0` to `>=4.3.1 <5.0.0` |
| HIGH | `nanoid@3.3.16` | Custom generators can loop indefinitely when `size` is zero | Add new override `pnpm.overrides.nanoid: ">=3.3.17 <4.0.0"` (currently unpinned; resolves to 3.3.16 transitively via `postcss`, itself via `vite`/`vitest`, dev-only) |
| MODERATE (non-blocking) | `dompurify@3.4.12` | GHSA-55q2-fjhq-7xh7 — `IN_PLACE` hook removal leaves a detached subtree executable, causing XSS | Raise `pnpm.overrides.dompurify` floor from `>=3.4.12 <4.0.0` to `>=3.4.13 <4.0.0` |
| MODERATE (non-blocking) | `undici@7.28.0` | 4 additional advisories (CRLF injection via blob-like body `type`; cookie-attribute injection; 2× cache-directive info disclosure) | Same `undici` override bump above resolves all 4 |

All 5 affected packages are **transitive-only** — none appear in `dependencies`/`devDependencies` directly, all are already governed by existing `pnpm.overrides` entries in `package.json` (except `nanoid`, which needs a new entry). `undici` and `nanoid` are dev-only (pulled in by `vitest`/`jsdom` and `vite`/`postcss` respectively) — no production runtime exposure. `js-yaml` and `brace-expansion` are build/tooling transitives. `dompurify` is pulled in via PostHog's dependency graph (already documented in `docs/accepted-risks.md`) and is not imported by application code.

`pnpm audit`: 685 dependencies scanned, 4 high / 5 moderate / 0 critical / 0 low.
`pnpm run check:vulnerabilities` (osv-scanner, the actual CI gate): **exit 1** — 680 lockfile packages scanned, 4 HIGH blocking, 5 non-blocking.

**Why this wasn't caught in prior GREEN cycles**: HEAD is unchanged at `553652d3` since 2026-07-26 — no code or lockfile delta since the 2026-08-03 security cycle, which reported this same gate as clean. The advisories above were published to OSV *after* that scan; each override's floor version is now below its own newly-published patched-version threshold (e.g. `undici` floor `7.28.0` vs. new patched-version requirement `7.29.0`). This is a genuine newly-disclosed-vulnerability event, not a regression introduced by this project.

## Code Findings
- **[INFO]** No hardcoded secrets found in production source (`apps/web/**/*.{ts,tsx}`, excluding tests/fixtures) — regex sweep for API-key/token/password/secret literal patterns returned zero matches outside known test fixtures.
- **[INFO]** No `NEXT_PUBLIC_*` variable leaks server secrets — grep for `NEXT_PUBLIC_*(SECRET|SERVICE_ROLE|CLIENT_SECRET|PASSWORD|CRON_SECRET|ADMIN_SECRET)` across `apps/web` returned only a false-positive match inside `lib/agents/agent-config.ts:92`, which is this very audit's own prompt template text, not a real variable reference.
- **[INFO]** SVG XSS protection intact — all user-controlled fields pass through `escapeXml()` before rendering: `handle`/`displayName` (`apps/web/lib/render/BadgeSvg.tsx:49,51`), `avatarDataUri` (`:164`), `archetypeText` (`:188`), `tier` (`:245`), `hash`/`date` (`apps/web/lib/render/VerificationStrip.ts:13-14`).
- **[INFO]** CORS wildcard (`Access-Control-Allow-Origin: *`) confirmed scoped to exactly 2 read-only, rate-limited GET endpoints — `/api/verify/[hash]` and `/api/profile/[handle]` — both documented accepted risks (`docs/accepted-risks.md`, "Wildcard CORS on /api/verify/[hash]").
- **[INFO]** Supabase RLS: `ENABLE ROW LEVEL SECURITY`/`FORCE ROW LEVEL SECURITY` statements present across the migration set (10 grep hits, consistent with the previously-confirmed 11/11 tables — `users`, `user_platforms`, `metrics_snapshots`, `verification_records`, `tool_insights`, `merge_operations`, `feature_flags`, `studio_configs`, `supplemental_stats`, `email_campaigns`, `campaign_sends`).
- **[INFO]** `npx knip` (default scan, matching CI's actual invocation) — 0 findings.

## License Compliance
All clear. `pnpm run check:licenses`: 98 production packages scanned, all allowlisted (MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD, CC0-1.0) or explicitly documented as accepted risks in `docs/accepted-risks.md` (MPL-2.0: `@resvg/resvg-js`, `lightningcss`, `dompurify` transitive; LGPL-3.0: `@img/sharp-libvips-darwin-arm64`; CC-BY-4.0: `caniuse-lite`; Unlicense: `fast-sha256`; MIT-0: `postal-mime`; axe-core MPL-2.0 dev-only). Zero GPL/AGPL.

## Recommendations
1. **[P1 — CI-blocking]** Bump the 4 stale `pnpm.overrides` floors in `package.json` (`undici` → `>=7.29.0`, `brace-expansion` → `>=5.0.9`, `js-yaml` → `>=4.3.1`) and add a new `nanoid` override (`>=3.3.17`), then run `pnpm install` to regenerate the lockfile and re-run `pnpm run check:vulnerabilities` to confirm the gate passes. This is the actual CI gate — any push to `develop` right now would fail it.
2. **[P3]** While touching `package.json`, also bump the `dompurify` override floor to `>=3.4.13` to clear the 1 remaining moderate (non-blocking) dompurify advisory and keep `docs/accepted-risks.md`'s DOMPurify entry accurate.
3. No other action items this cycle — secrets, XSS escaping, CORS, RLS, and license compliance all confirmed clean against live source.
