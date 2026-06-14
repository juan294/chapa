# Agent Shared Context
> Cross-agent intelligence — agents read this before running and write findings after finishing.
> Pruned automatically to keep the last 3 entries per agent type.
>
> **Rules:**
> 1. Read this file before starting any work
> 2. Write an entry after finishing — use the format below
> 3. Cross-agent recommendations are mandatory
> 4. Maximum 3 entries per agent type — remove the oldest when adding a new one
> 5. Be specific with findings — numbers, file paths, and actionable items

<!-- ENTRY:START agent=cost-analyst timestamp=2026-06-14T03:00:00Z -->
## Cost Analyst — 2026-06-14
- **Status**: GREEN
- Estimated monthly cost at 10K users: **~$50–75/mo**. Unchanged.
- **Cost-surface diff since 2026-06-13 cycle**: ZERO. HEAD still pinned at `5ef06c09` — **29th consecutive carry/audit cycle**, no executable app-code change. All key claims re-verified in source this cycle (not blind-carried): `redis.ts`, migrations, `campaigns.ts`, `supabase.ts`, `notifications.ts` all read fresh.
- Redis: per-user/per-entity keys all TTL'd; **3 persistent TTL-0 singletons only** — `stats:badges_generated` (counter, `redis.ts:259`), `stats:unique_badges` (HLL ~12KB fixed, `redis.ts:260`), `cron:warm-cache:offset` (rotation cursor, `warm-cache/route.ts:145`, the ONLY intentional TTL-0 `cacheSet`). `cacheSet` default TTL 21600s with `ttlSeconds>0` guard (`redis.ts:69,75-76`); **24 non-test `cacheSet` call sites re-counted, 23/24 carry explicit positive TTL** (1 exception = bounded rotation cursor). `cacheIncr` refreshes TTL after INCRBY (`redis.ts:382-386`); `cacheReserveQuota` refreshes TTL in-pipeline (`redis.ts:221`). Redis client `retry:{retries:0}` (`redis.ts:36`). Two 1-year keys (fixed cardinality, overwrite): `config:<login>` (`studio/config/route.ts:73`) and `badge:notified:<handle>` (`MARKER_TTL=31_536_000`, `notifications.ts:18,106`). Growth risk: LOW.
- Supabase: **10 base tables, 10/10 ENABLE + FORCE RLS** (raw grep: 12 ENABLE = 10 tables + 2 re-enables, 10 FORCE; 25 migrations, latest `025_force_supplemental_stats_rls.sql`). Singleton lazy service-role client `supabase.ts:14-34`, `import "server-only"` line 8, `persistSession:false`. No N+1 in `lib/db/`.
- External calls: **0 uncached**. Health GitHub probe `unstable_cache` 60s (`health/route.ts:59`); feature-flags ISR 300s; badge/profile GitHub cache-first (6h + 7d SWR) with in-flight dedup + Redis lock. Server fetch-timeout coverage 100% — **8 modules** carry `AbortSignal.timeout` (GitHub queries, Resend, GitHub/Bitbucket/Codeberg OAuth, health probe, avatar, server-errors). PostHog batched fire-and-forget.
- Badge `maxDuration=35` (`badge.svg/route.ts:29`). Success `s-maxage=21600 / SWR=86400` / error `s-maxage=300 / SWR=600`.
- **P2-1 CARRIED**: `dbGetCampaignStats()` 4-query parallel COUNT (`campaigns.ts:815-820`); threshold comment `campaigns.ts:790-792`. Not yet triggered (>5K sends/campaign).
- **MONITOR M7/M8 CARRIED**: `config:` and `badge:notified:` 1y TTL — overwrite semantics, fixed cardinality, no per-user accumulation. No action.
- **P1s: NONE. P2s: 1 active (P2-1, threshold-gated). P3s: 0.**

**Cross-agent recommendations:**
- [Performance]: Bundle flat at 1,949 KB raw / 622.6 KB gzipped (performance 2026-06-11). M-bundle stays closed; no new cost-performance pressure.
- [Security]: No cost-security regressions. `server-only` boundary + FORCE RLS on all 10 base tables re-verified intact. Fail-open rate limiter (documented accepted risk) and 100% server fetch-timeout coverage maintained.
- [Coverage]: lib/cache 98.13%, lib/db 96.48%, app/api 97.48% — all stable per coverage 2026-06-14. No cost-path coverage gaps.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=triage timestamp=2026-06-14T05:45:55Z -->
## Triage — 2026-06-14
- **Reports processed**: 6 (cost-analyst GREEN, performance GREEN, coverage GREEN, documentation GREEN, cc-rpi-update GREEN, qa GREEN)
- **Action items resolved**: 4 — performance agent now verifies dependency state with `pnpm install --frozen-lockfile` before build sizing; coverage/QA scheduled runs share a `vitest-heavy-agent` lock to reduce worker-pool contention; documentation agent no longer flags direct `NEXT_PUBLIC_*` reads in client components used for Next.js build-time inlining; `getSessionSecret` JSDoc was already present.
- **Dependabot**: 0 open PRs.
- **Summary**: Clean GREEN triage cycle. Added scheduled-agent hardening for stale dependency measurements and shared-host vitest contention. Local verification passed: 7,594/7,594 tests, typecheck clean, lint clean.

**Cross-agent recommendations:**
- [Performance]: Keep the dependency-state check before every bundle/build measurement so future reports cannot measure stale `node_modules`.
- [Coverage]: The new shared lock should reduce coverage/QA overlap on the same host; continue reporting any worker-spawn timeouts as environmental unless isolation reruns fail.
- [Documentation]: Treat client-component direct `NEXT_PUBLIC_*` reads as valid when build-time inlining is required; server modules should continue using `lib/env` accessors.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=cost-analyst timestamp=2026-06-13T03:00:00Z -->
## Cost Analyst — 2026-06-13
- **Status**: GREEN
- Estimated monthly cost at 10K users: **~$50–75/mo**. Unchanged.
- **Cost-surface diff since 2026-06-12 cycle**: ZERO. HEAD pinned at `5ef06c09` — third consecutive cycle on this commit. **28th consecutive carry/audit cycle** — no executable app-code change. All key claims re-verified in source this cycle.
- Redis: per-user/per-entity keys all TTL'd; **3 persistent TTL-0 singletons only** — `stats:badges_generated` (counter), `stats:unique_badges` (HLL ~12KB fixed), `cron:warm-cache:offset` (rotation cursor, `warm-cache/route.ts:145`). All fixed-cardinality. `cacheSet` default TTL 21600s (`redis.ts:69`); **24 non-test `cacheSet` call sites, 23/24 carry explicit positive TTL** (1 exception = bounded rotation cursor). `cacheIncr` refreshes TTL after INCRBY (`redis.ts:384-385`); `cacheReserveQuota` refreshes TTL in-pipeline (`redis.ts:221`). Two 1-year keys (fixed cardinality, overwrite): `config:<login>` (`studio/config/route.ts:73`) and `badge:notified:<handle>` (`notifications.ts:106`). Growth risk: LOW.
- Supabase: **10 base tables, 10/10 ENABLE + FORCE RLS** (25 migrations, latest `025_force_supplemental_stats_rls.sql`). Singleton lazy service-role client `lib/db/supabase.ts:15-34`, `import "server-only"` line 8, `persistSession:false`. No N+1 in `lib/db/`.
- External calls: **0 uncached**. Health GitHub probe `unstable_cache` 60s (`health/route.ts:59`); feature-flags ISR 300s (`feature-flags.ts:49`); badge/profile GitHub cache-first (6h + 7d SWR) with in-flight dedup + Redis lock. **17 `AbortSignal.timeout` server fetch sites = 100% coverage**. PostHog batched fire-and-forget.
- Badge `maxDuration=35` (`badge.svg/route.ts:29`). Success `s-maxage=21600 / SWR=86400` / error `s-maxage=300 / SWR=600`.
- **P2-1 CARRIED**: `dbGetCampaignStats()` 4-query parallel COUNT (`campaigns.ts:797-835`); threshold comment `campaigns.ts:790-792`. Not yet triggered (>5K sends/campaign).
- **MONITOR M7/M8 CARRIED**: `config:` and `badge:notified:` 1y TTL — overwrite semantics, fixed cardinality, no per-user accumulation. No action.
- **P1s: NONE. P2s: 1 active (P2-1, threshold-gated). P3s: 0.**

**Cross-agent recommendations:**
- [Performance]: Bundle flat (1,949 KB raw / 622.6 KB gzipped per 2026-06-11). M-bundle stays closed; no new cost-performance pressure.
- [Security]: No cost-security regressions. `server-only` boundary + FORCE RLS on all 10 base tables re-verified intact. Fail-open rate limiter (documented accepted risk) and 100% server fetch-timeout coverage maintained.
- [Coverage]: lib/cache 98.13%, lib/db 96.48%, app/api 97.48% — all stable per coverage 2026-06-12. No cost-path coverage gaps.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=cost-analyst timestamp=2026-06-12T03:00:00Z -->
## Cost Analyst — 2026-06-12
- **Status**: GREEN
- Estimated monthly cost at 10K users: **~$50–75/mo**. Unchanged.
- **Cost-surface diff since 2026-06-11 cycle**: ZERO. HEAD pinned at `5ef06c09` — second consecutive cycle on this commit (matches coverage agent 2026-06-12). **27th consecutive carry/audit cycle** — no executable app-code change. All key claims re-verified in code this cycle, not blind-carried.
- Redis: per-user/per-entity keys all TTL'd; **3 persistent TTL-0 singletons only** — `stats:badges_generated` (counter), `stats:unique_badges` (HLL ~12KB fixed), `cron:warm-cache:offset` (rotation cursor, `warm-cache/route.ts:145`, the ONLY intentional TTL-0 `cacheSet`). All fixed-cardinality. `cacheSet` default TTL 21600s with `ttlSeconds > 0` guard (`redis.ts:69,75-76`); **24 non-test `cacheSet` call sites re-counted, 23/24 carry explicit positive TTL** (1 exception = bounded rotation cursor). `cacheIncr` refreshes TTL after INCRBY (`redis.ts:384-385`); `cacheReserveQuota` refreshes TTL in-pipeline (`redis.ts:221`). Two 1-year keys (fixed cardinality, overwrite): `config:<login>` (`studio/config/route.ts:73`) and `badge:notified:<handle>` (`lib/email/notifications.ts:106`). Growth risk: LOW.
- Supabase: **10 base tables, 10/10 ENABLE + FORCE RLS** (re-verified: 12 ENABLE = 10 tables + 2 re-enables, 10 FORCE; 25 migrations, latest `025_force_supplemental_stats_rls.sql`). Singleton lazy service-role client `lib/db/supabase.ts:15-34`, `import "server-only"` line 8, `persistSession:false`, `pingSupabase` under 5s `withTimeout`. No N+1 in `lib/db/`.
- External calls: **0 uncached**. Health GitHub probe `unstable_cache` 60s (`health/route.ts:59`); feature-flags ISR 300s; badge/profile GitHub cache-first (6h + 7d SWR) with in-flight dedup + Redis lock. **17 `AbortSignal.timeout` server fetch sites = 100% coverage** (GitHub 15s, Resend 5s, OAuth providers, avatar, alert webhook). PostHog batched fire-and-forget.
- Badge `maxDuration=35` (`badge.svg/route.ts:29`). Success `s-maxage=21600 / SWR=86400` / error `s-maxage=300 / SWR=600`.
- Bundle confirmed flat post-dep-bumps by performance 2026-06-11 (1,949 KB raw / 622.6 KB gzipped) — my prior cycle's confirmation request satisfied; no cold-start memory regression.
- **P2-1 CARRIED**: `dbGetCampaignStats()` 4-query parallel COUNT (`campaigns.ts:815-818`); threshold comment `campaigns.ts:790-792`. Not yet triggered (>5K sends/campaign).
- **MONITOR M7/M8 CARRIED**: `config:` and `badge:notified:` 1y TTL — overwrite semantics, fixed cardinality, no per-user accumulation. No action.
- **P1s: NONE. P2s: 1 active (P2-1, threshold-gated). P3s: 0.**

**Cross-agent recommendations:**
- [Performance]: Post-bump bundle confirmation received (2026-06-11, flat at 1,949 KB / 622.6 KB) — nothing outstanding from cost side. M-bundle stays closed.
- [Security]: No cost-security regressions. `server-only` boundary + FORCE RLS on all 10 base tables re-verified intact. Fail-open rate limiter (documented accepted risk) and 100% server fetch-timeout coverage maintained.
- [Coverage]: lib/cache 98.13%, lib/db 96.48%, app/api 97.48% — all stable per coverage 2026-06-12 (GREEN, 0 flakes, 2nd cycle on HEAD `5ef06c09`). No cost-path coverage gaps.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=triage timestamp=2026-06-10T10:00:00Z -->
## Triage — 2026-06-10
- **Reports processed**: 3 (cc-rpi GREEN, cost-analyst GREEN, coverage GREEN)
- **Action items resolved**: 0 — all reports GREEN with no new action items
- **Dependabot**: PR #851 (dev-and-types patch×4, CI green) auto-merged; PR #850 (production patch+minor×8, CI green) auto-merged; PR #848 gitleaks/gitleaks-action 2→3 (major) deferred — third consecutive deferral, requires human review of breaking changes.
- **Summary**: Clean all-GREEN cycle. 7590/7590 tests, 96.78% coverage, zero cost regressions, cc-rpi at v1.18.0. HEAD at `48206b13` (25th consecutive carry cycle, no executable code change).

**Cross-agent recommendations:**
- [QA]: Coverage flat at 7590/7590, 96.78% stmts, zero flakes across 3 runs. All P3 carries (Canvas/WebGL, flag-gated experiments, lazy wrappers) remain accepted.
- [Security]: No regressions. RLS 10/10 FORCE, `pnpm audit` clean. PR #848 (gitleaks major v2→v3) still awaiting human review — third consecutive deferral.
- [Cost Analyst]: All GREEN. Cost surface unchanged. P2-1 (threshold-gated `dbGetCampaignStats()`) and MONITOR M7/M8 carries unchanged.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=triage timestamp=2026-06-06T10:00:00Z -->
## Triage — 2026-06-06
- **Reports processed**: 4 (cc-rpi GREEN, cost-analyst GREEN, coverage GREEN, documentation GREEN)
- **Action items resolved**: 0 — all reports GREEN with no new action items
- **Dependabot**: PR #848 gitleaks/gitleaks-action 2→3 (major) deferred — second consecutive deferral, requires human review of breaking changes.
- **Summary**: Clean all-GREEN cycle. 7590/7590 tests, 96.77% coverage, zero cost regressions, docs 100% current. HEAD still at `e275ae6c` (21st consecutive carry).

**Cross-agent recommendations:**
- [QA]: Coverage stable at 7590/7590, 96.77% stmts. All prior P3 carries (Canvas/WebGL, flag-gated, lazy wrappers) remain accepted.
- [Security]: No regressions. RLS 10/10 FORCE, `pnpm audit` clean, SVG escape intact. PR #848 (gitleaks major) awaiting human review.
- [Cost Analyst]: All GREEN. No cost-surface changes. Carries P2-1 (threshold-gated) and MONITOR M7 unchanged.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=triage timestamp=2026-06-04T10:15:00Z -->
## Triage — 2026-06-04
- **Reports processed**: 7 (cc-rpi GREEN, cost-analyst GREEN, coverage GREEN, documentation GREEN, performance GREEN, qa GREEN, security GREEN)
- **Action items resolved**: 3 — (1) JSDoc added to 8 campaign-send DB helpers in `lib/db/campaigns.ts` (including lease-token concurrency semantics); (2) `vitest.setup.ts` localStorage polyfill for Node.js 26 compatibility (fixes 119 test regressions across 2 files); (3) `UserMenu.tsx` null-safe `window.localStorage` check.
- **Dependabot**: PR #849 production group (6 updates, CI green) auto-merged; PR #848 gitleaks/gitleaks-action 2→3 (major) deferred for human review.
- **Summary**: All GREEN cycle. Documentation polish applied. Node.js 26 compatibility regression fixed (localStorage undefined in vitest JSDOM). 7590/7590 tests passing.

**Cross-agent recommendations:**
- [QA]: Node.js 26 breaks JSDOM localStorage unless polyfilled — `vitest.setup.ts` now has the fix. Re-run QA agent to confirm 7590/7590.
- [Security]: No regressions. JSDoc additions are doc-only; UserMenu localStorage null-check is purely defensive.
- [Cost Analyst]: No cost-surface changes. Carries unchanged: P2-1 (threshold-gated) and MONITOR M7.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=triage timestamp=2026-05-25T13:02:00Z -->
## Triage — 2026-05-25
- **Reports processed**: 5 (cc-rpi-update GREEN, cost-analyst GREEN, coverage FAILED, security YELLOW, documentation GREEN)
- **Action items resolved**: 2 code fixes + 1 noted agent failure + 1 Dependabot auto-merge
- **Summary**: Security YELLOW cleared — `brace-expansion` override bumped `>=5.0.5→>=5.0.6` (GHSA-jxxr-4gwj-5jf2, moderate, dev-only); `pnpm audit` now reports 0 vulnerabilities. Cost P3 carry resolved — wrapped `pingGitHub` with `unstable_cache(revalidate=60)` in `/api/health/route.ts` so concurrent probes share one GitHub call. Documentation low-priority items already resolved in prior cycle (light-value columns present in `docs/design-system.md`). Coverage agent login failure noted — no code fix possible; re-run manually. Dependabot PR #847 (production group, 5 updates, all CI green) auto-merged.

**Cross-agent recommendations:**
- [Coverage]: Coverage agent failed with "Not logged in" — re-run required. Prior coverage baseline: 7590 tests (+1 from this cycle), lib/cache 98.1%, lib/db 96.5%, app/api 97.5%.
- [Security]: `brace-expansion` CVE cleared. `pnpm audit` now 0 vulnerabilities. All other security posture unchanged (RLS 11/11, CORS guard, SVG escape, server-only boundary).
- [Cost Analyst]: Health endpoint GitHub probe now cached at 60 s via `unstable_cache`. P3 carry resolved. P2-1 (`dbGetCampaignStats` GROUP BY RPC) remains threshold-gated at cycle 25 — no change.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=documentation timestamp=2026-06-05T10:00:00Z -->
## Documentation Agent — 2026-06-05
- **Status**: GREEN
- Stale docs: 0 | Missing docs: 0 | Env var mismatches: 0
- Route coverage: **44/44 API routes + 6 special route.ts + 34 page files documented** (100%). Scripted diff of every filesystem route path against CLAUDE.md → 0 missing. HEAD `2d7eb73c → e275ae6c` since last cycle = JSDoc-only commit `8e00aa18` + deps bump `e275ae6c`; no routes added/removed.
- Design system: **38/38 `--color-*` tokens** in `docs/design-system.md` match `apps/web/styles/globals.css` exactly (38 each, no orphans either direction).
- Env vars: **all production vars documented** (100%). All app config flows through `lib/env.ts` (ESLint `no-restricted-syntax` forbids scattered `process.env`). Raw-grep extras (`KV_REST_API_*`, `RESEND_BASE_URL`, `SUPABASE_SECRET_KEY`, `__NEXT_*`, `VERCEL_*`) are `.next/` build-cache + framework internals, not app code. `CI`/`DEPLOYMENT_SMOKE_STRICT`/`PLAYWRIGHT_BASE_URL` test-only (intentional omissions).
- JSDoc: `lib/impact/v6.ts` 9/9, `lib/cache/redis.ts` 13/13, `lib/github/client.ts` 2/2, `lib/auth/session.ts` 8 doc-comments/5 exports. **`lib/db/campaigns.ts` now 14/14 documented — prior campaign-send lease-token gap RESOLVED in `8e00aa18`.**
- Required docs all present/non-empty: `impact-v4.md` (131, deprecated), `impact-v5.md` (152), `impact-v6.md` (287, current truth), `svg-design.md` (173), `design-system.md` (236), `README.md` (224, Quick Start L75), `shared-context.md` (546).
- TODO/FIXME doc-gap scan: 1 false positive (`lib/agents/agent-config.ts:281` = this prompt's own template text).
- Report at `docs/agents/documentation-report.md`.

**Cross-agent recommendations:**
- [QA]: No documentation-related UX issues. All user-facing routes documented; no doc changes affect runtime behavior.
- [Security]: No security doc gaps. All `NEXT_PUBLIC_*` vars confirmed non-sensitive; `server-only` Supabase boundary and admin-auth routes documented in CLAUDE.md. No undocumented exports with security surface.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=documentation timestamp=2026-06-12T10:00:00Z -->
## Documentation Agent — 2026-06-12
- **Status**: GREEN
- Stale docs: 0 | Missing docs: 0 | Env var mismatches: 0
- Route coverage: **82 filesystem routes (48 API + 34 pages) all documented** (100%). HEAD `5ef06c09` — 2nd consecutive cycle on this commit; only deps bumps and agent-script changes since 2026-06-05 cycle, no routes added/removed.
- Design system: **38/38 `--color-*` tokens** in `docs/design-system.md` match `apps/web/styles/globals.css` exactly. Zero drift, zero orphans.
- Env vars: **all 32 production vars documented** (100%). All app config flows through `lib/env.ts`. Minor inconsistency: `PostHogProvider.tsx:8-9` reads `NEXT_PUBLIC_POSTHOG_KEY`/`NEXT_PUBLIC_POSTHOG_HOST` directly instead of via `lib/env.ts` — both vars documented, access pattern only.
- JSDoc: `lib/impact/v6.ts` 9/9, `lib/cache/redis.ts` 16/16, `lib/db/campaigns.ts` 13/13. **Low-priority gap**: `lib/auth/session.ts:31` (`getSessionSecret`) missing one-line JSDoc — 4/5 exports documented.
- Required docs all present/non-empty: `impact-v4.md` (131, deprecated), `impact-v5.md` (152), `impact-v6.md` (287, current truth), `svg-design.md` (173), `design-system.md` (236), `README.md` (224, Quick Start L75), `shared-context.md` (515+).
- TODO/FIXME doc-gap scan: 0 real findings (1 false positive at `lib/agents/agent-config.ts:281`).
- Report at `docs/agents/documentation-report.md`.

**Cross-agent recommendations:**
- [QA]: No documentation-related UX issues. All user-facing routes documented; no doc changes affect runtime behavior.
- [Security]: No security doc gaps. All `NEXT_PUBLIC_*` vars confirmed non-sensitive; `server-only` Supabase boundary and admin-auth routes documented in CLAUDE.md. `PostHogProvider.tsx` direct env reads are NEXT_PUBLIC_ only — no server-secret exposure.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=security timestamp=2026-05-11T09:00:00Z -->
## Security Scanner — 2026-05-11
- **Status**: GREEN
- Vulnerabilities: **0 critical, 0 high, 0 moderate, 0 low** — `pnpm audit` fully clean.
- Secret leaks: **none** — no actual key values in client bundles (0 JWT-prefix matches). `SUPABASE_SERVICE_ROLE_KEY` name only (not value) appears in one client chunk — architecture disclosure, not exploit. All env reads go through `lib/env.ts` with `.trim()`.
- License issues: MPL-2.0 (`@resvg/resvg-js`, `lightningcss`) + dual Apache-2.0/MPL-2.0 (`dompurify`) — no source modifications, no compliance action. No GPL/AGPL/LGPL found.
- Knip `--production`: **0 findings** this cycle (clean output).
- XSS: **7 user-input entry points** in SVG pipeline (`handle`, `displayName`, `avatarDataUri`, `archetypeText`, `tier`, `verificationHash`, `verificationDate`), all escaped via `escapeXml()`. Admin `renderMarkdown` uses `escapeHtml()` before formatting — safe. 12 `dangerouslySetInnerHTML` uses audited — all safe.
- CORS: **2 routes** with wildcard `*` — `/api/verify/[hash]` (30 req/60s) + `/api/profile/[handle]` (60 req/60s). Read-only, rate-limited. `cors-mutation-guard.test.ts` enforces no wildcard on mutation routes.
- RLS: **11 tables** all have ENABLE RLS + deny-all anon. 10/11 have FORCE RLS. `supplemental_stats` has ENABLE + deny-all but no FORCE — low severity (P3).
- **P3 (new)**: `supplemental_stats` missing `ALTER TABLE ... FORCE ROW LEVEL SECURITY` — add in next migration. Risk negligible (deny-all anon policy already in place).
- **P3 (new)**: Add `import "server-only"` to `lib/db/supabase.ts` to prevent module name from appearing in client chunks.
- **SENSITIVE_PATTERNS P2 CLOSED**: Coverage agent May 11 confirms `lib/analytics` 97.3% — all 9 token-scrubbing branches now covered.

**Cross-agent recommendations:**
- [Coverage]: lib/analytics 97.3% stable — SENSITIVE_PATTERNS P2 fully retired. No new security-coverage gaps.
- [QA]: No security-related UX issues. All XSS vectors covered. CORS mutation guard enforced by static test.
- [Cost Analyst]: No new cost-security conflicts. Fail-open rate limiter intact. Fetch timeouts 100%.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=qa timestamp=2026-04-29T09:00:00Z -->
## QA Agent — 2026-04-29
- **Status**: GREEN
- Tests: 7,272/7,272 passed across 409 files, 0 failed, 0 skipped
- Type errors: 0
- Lint issues: 0
- A11y issues: 0 — all `<img>` have alt, focus-visible in globals.css + 4 production components, prefers-reduced-motion respected, aria-label in 20+ components, heading hierarchy correct in all pages, 14 error boundaries, multiple loading/empty states
- Design system: 0 violations in production components. global-error.tsx hardcoded hex intentional (documented). apple-icon.tsx + icon.tsx hardcoded (static assets, accepted). experiments/** accepted P3 (Canvas/WebGL).

**Cross-agent recommendations:**
- [Coverage]: `og-image/route.ts` 60% funcs (`route.ts:77,97`) is the only critical-path gap — 5th carry cycle, must address this triage. `dirty-stats.ts` 75% funcs is a one-test fix.
- [Security]: No new security-related quality issues. All XSS vectors covered. All interactive elements accessible. global-error.tsx hardcoded hex does not touch server secrets.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=qa timestamp=2026-05-06T09:00:00Z -->
## QA Agent — 2026-05-06
- **Status**: GREEN
- Tests: 7567/7567 passed across 445 files, 0 failed, 0 skipped
- Type errors: 0
- Lint issues: 0
- A11y issues: 1 low-severity — `<tr role="button" tabIndex={0}>` in campaigns table (`app/admin/campaigns/campaigns-dashboard.tsx:900`) missing `aria-label`. Admin-only surface. All other `<img>` tags have alt, focus-visible in globals.css + 4 production components, heading hierarchy correct, 13 error boundaries, 13 loading states.
- Design system: **0 violations** in production components. Accepted exceptions unchanged: `global-error.tsx`, `apple-icon.tsx`, `icon.tsx` static assets, `experiments/**` Canvas/WebGL.

**Cross-agent recommendations:**
- [Coverage]: Prior P2s (verify, about/scoring, about/verification, cli/authorize pages) confirmed resolved per coverage-agent May 6. Remaining P2s: 7 archetype pages `generateMetadata` runtime tests, `cli/authorize/error.tsx` 0% stmts, `lib/i18n/detect.ts` ~75% branches.
- [Security]: No security-related quality issues. Campaigns `<tr role="button">` missing `aria-label` is a11y only — no data exposure. All XSS vectors and interactive elements covered.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=documentation_agent timestamp=2026-04-24T07:03:08Z -->
## Documentation Agent — 2026-04-24
- **Status**: GREEN
- Stale docs: 0
- Missing docs: 0
- Env var mismatches: 0 (33/33 production vars documented; `TESTPLATFORM_*`, `CI`, `NODE_ENV` intentionally omitted)
- Route coverage: 44/44 API routes + 24/24 pages documented
- Design tokens: 38/38 color tokens in `globals.css` match `docs/design-system.md`
- Required docs present and non-empty: `impact-v4.md`, `impact-v5.md`, `impact-v6.md`, `svg-design.md`, `design-system.md`, `README.md` (215 lines with Quick Start), `shared-context.md` (371 lines, fresh through 2026-04-24)
- TODO/FIXME referencing doc gaps: 0 (1 false positive in agent-config template literal)

**Cross-agent recommendations:**
- [QA]: No user-facing features with doc gaps. All feature-flagged routes (studio, experiments, insights, bitbucket, codeberg) have both CLAUDE.md entries and env var documentation.
- [Security]: No outdated security docs. `docs/accepted-risks.md` present. All `NEXT_PUBLIC_*` vars confirmed non-sensitive and documented. OAuth flows (GitHub, Bitbucket, Codeberg) and HMAC verification (`docs/badge-verification.md`) docs align with current implementation.
<!-- ENTRY:END -->


<!-- ENTRY:START agent=documentation timestamp=2026-05-29T10:00:00Z -->
## Documentation Agent — 2026-05-29
- **Status**: GREEN
- Route coverage: **44/44 API routes + 6 special routes + 34 page files documented** (100%). Cross-checked every `route.ts`/`page.tsx` in `apps/web/app/` against CLAUDE.md — no undocumented routes, no documented-but-missing routes. New-since-prior: none (HEAD `2d7eb73c`).
- Design system: **38/38 `--color-*` tokens** in `docs/design-system.md` exactly match `apps/web/styles/globals.css`. Zero drift, zero orphans either direction.
- Env vars: **all production vars documented** (100%). Verified against `lib/env.ts` + `process.env.*` grep. `CI`/`NODE_ENV`/`ANALYZE`/`DEPLOYMENT_SMOKE_STRICT`/`PLAYWRIGHT_BASE_URL` are standard build/test vars (intentional omissions). `CHAPA_ALERT_WEBHOOK_URL` now in CLAUDE.md env block (prior 05-08 gap RESOLVED).
- Required docs: all present/non-empty — `impact-v4.md` (131, deprecated), `impact-v5.md` (152), `impact-v6.md` (287, current truth), `svg-design.md` (173), `README.md` (224, Quick Start at L75), `design-system.md` (236), `shared-context.md` (548).
- JSDoc: `lib/impact/v6.ts` 9/9, `lib/cache/redis.ts` 13/13, `lib/github/client.ts` 2/2, `lib/auth/session.ts` now documented (prior gap resolved). **NEW low-priority gap**: `lib/db/campaigns.ts` — several campaign-send helpers lack JSDoc; notably `dbClaimPendingSends` (`campaigns.ts:626`) has non-obvious lease-token/expiry concurrency semantics worth documenting; `dbMarkSendsSent`/`dbMarkSendsFailed` optional `leaseToken` contract undocumented.
- TODO/FIXME doc-gap scan: 1 false positive (`lib/agents/agent-config.ts:281` = this prompt's own template text).
- Report written to `docs/agents/documentation-report.md`. Stale docs: 0. Missing docs: 1 (low). Env mismatches: 0.

**Cross-agent recommendations:**
- [QA]: No documentation-related UX issues. All user-facing routes documented. No doc changes affect runtime behavior.
- [Security]: No security doc gaps. All `NEXT_PUBLIC_*` vars confirmed non-sensitive; `server-only` Supabase boundary and admin-auth routes all documented in CLAUDE.md. Campaign-send lease helpers (admin-only) are the only undocumented exports — no security exposure.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=qa_agent timestamp=2026-05-13T07:03:35Z -->
## QA Agent — 2026-05-13
- **Status**: GREEN
- Tests: 7589/7589 passed (445 files), 0 failed, 0 skipped
- Type errors: 0
- Lint issues: 0
- A11y issues: 0 — campaigns `<tr role="button" aria-label>` gap confirmed resolved; all `<img>` have alt; focus-visible global + 4 component-level; prefers-reduced-motion in globals.css + StudioClient; heading hierarchy clean across all audited pages; 13 error boundaries, 13 loading states

**Cross-agent recommendations:**
- [Coverage]: All paths clean. No new untested areas discovered this cycle. Coverage agent May 13 confirms stable 96.84% stmts, 0 flakes.
- [Security]: No security-related quality issues. All XSS escape paths covered. CORS mutation guard enforced by static test. Interactive elements all accessible via keyboard.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=triage timestamp=2026-05-22T06:00:00Z -->
## Triage — 2026-05-22
- **Reports processed**: 7 (cc-rpi-update GREEN, cost-analyst GREEN, coverage YELLOW, documentation GREEN, performance YELLOW, qa GREEN, security GREEN)
- **Action items resolved**: 3 — fixed flaky `engagement-dashboard` test race (findByText), added JSDoc to private helpers in `lib/auth/session.ts`, added GROUP BY migration threshold comment to `lib/db/campaigns.ts`
- **Pre-resolved**: 2 items found already fixed in code (aria-label on campaigns `<tr>`, LGPL-3.0 entry in accepted-risks.md)
- **Deferred**: Performance P2 bundle analyzer (requires interactive browser run, informational monitor, bundle flat 7 cycles)
- **Dependabot**: PR #844 (production group) + PR #845 (@types/node patch) — both auto-merged after CI green
- **Summary**: Coverage flake eliminated, auth session helpers documented, cost comment added. Codebase fully clean.

**Cross-agent recommendations:**
- [Coverage]: Engagement-dashboard flaky test fixed — `findByText` replaces synchronous `getByText` after async state updates. Watch for similar patterns in other admin dashboard tests.
- [Performance]: Bundle flat 7/7 cycles. Gzipped size dropped ~140 KB vs May 14 (likely Turbopack chunk consolidation in Next.js 16.2.6). `ANALYZE=true pnpm run build` still deferred — interactive-only, informational monitor.
- [Security]: LGPL-3.0 entry already in `docs/accepted-risks.md` from prior cycle. Posture GREEN, 0 vulnerabilities.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=documentation_agent timestamp=2026-05-22T07:26:10Z -->
## Documentation Agent — 2026-05-22
- **Status**: GREEN
- Stale docs: 0
- Missing docs: 0 critical (3 minor design-system table formatting gaps remain — 3rd cycle carry, non-functional)
- Env var mismatches: 0

**Cross-agent recommendations:**
- [QA]: No documentation-related UX gaps. All user-facing routes (33 pages) documented.
- [Security]: No security doc gaps. All env vars (`CHAPA_ALERT_WEBHOOK_URL`, `ADMIN_SECRET`, `CRON_SECRET`, `CHAPA_VERIFICATION_SECRET`, `RESEND_WEBHOOK_SECRET`) documented; `NEXT_PUBLIC_*` vars confirmed non-sensitive. SDK-internal env names surfaced by grep (`SUPABASE_SECRET_KEY`, `RESEND_BASE_URL`, `KV_REST_API_*`, `ICEBERG_TOKEN`) are Next.js / library bundled references, not real app config.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=cost_analyst timestamp=2026-05-25T01:39:17Z -->
## Cost Analyst — 2026-05-25
- **Status**: GREEN
- Redis key growth risk: LOW
- Uncached external calls: 1 (health endpoint GitHub probe, P3 carry cycle 12)
- Resource leak risks: 0
- Estimated monthly cost at 10K users: **~$50–75/mo**. Unchanged.
- **Commits this cycle**: **zero** to cost surface since 2026-05-24 entry. HEAD unchanged at `1ed6aa96`. Pure carry/audit cycle.
- Redis: **16 production prefixes + 3 persistent singletons** (25/28 keys with TTLs, 89%). `cacheSet` defaults to 21,600s; all call sites pass explicit TTL. `cacheIncr` always refreshes TTL (race-safe).
- Supabase: **11 tables** unchanged; **11/11 FORCE RLS** confirmed (latest migration `025_force_supplemental_stats_rls.sql`). Singleton lazy client at `lib/db/supabase.ts:14` guarded by `import "server-only"` (line 8).
- Feature-flags ISR: `unstable_cache(revalidate=300)` at `lib/feature-flags.ts:84-94` active — flag reads cached at data layer.
- Badge `maxDuration=35` at `app/u/[handle]/badge.svg/route.ts:29` — 11th cycle hold.
- **P2-1 CARRIED (cycle 25)**: `dbGetCampaignStats()` 4-query parallel COUNT aggregation. Threshold comment in source at `lib/db/campaigns.ts:722-726`. Not yet triggered.
- **P3 CARRIED (cycle 12)**: Health endpoint at `app/api/health/route.ts:31` calls `api.github.com/rate_limit` uncached. ~5–10 calls/hr — well inside 60/hr unauth limit. Fix: `unstable_cache(revalidate=60)`. Low priority.
- **MONITOR M7 CARRIED**: `config:` TTL 31,536,000s (1y per user). PUT replaces — no accumulation.
- **MONITOR M-bundle CARRIED**: Bundle 2,266 KB raw / 706 KB gzipped (flat 9/9 cycles per perf 2026-05-14). Sustained +34.7% over 4 weeks unresolved. `ANALYZE=true pnpm run build` still needs interactive run.
- GitHub API cache-first unchanged (6h primary + 7d stale fallback). 100% fetch timeout coverage. `_inflight` dedup Map bounded.
- Coverage context (May 24): 7589 tests GREEN across 3 clean runs, 0 flakes, lib/cache 98.1%, lib/db 96.5%, app/api 97.5% — all stable. Prior engagement-dashboard flake confirmed RESOLVED.
- **P1s: NONE. P2s: 1 active (P2-1, threshold-gated). P3s: 1 carry (health probe).**

**Cross-agent recommendations:**
- [Performance]: Bundle flat 9/9 cycles. 4-week +34.7% trend stable but unresolved; `ANALYZE=true pnpm run build` still needs interactive run to localize source. Carry-only.
- [Security]: No cost-security regressions. `server-only` boundary on Supabase client + FORCE RLS on all 11 tables intact. Fail-open rate limiter and 100% fetch timeout coverage maintained. Health endpoint P3 (uncached GitHub probe) is not a security risk — GitHub's own rate limits provide secondary protection.
- [Coverage]: lib/cache 98.1%, lib/db 96.5%, app/api 97.5% — all stable per May 24. engagement-dashboard flake fix holding. No cost-path coverage gaps.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=security timestamp=2026-05-25T07:00:00Z -->
## Security Scanner — 2026-05-25
- **Status**: YELLOW
- Vulnerabilities: 0 critical / 0 high / **1 moderate** (`brace-expansion` 5.0.5 via eslint > minimatch, GHSA-jxxr-4gwj-5jf2, CVE-2026-45149) / 0 low
- Secret leaks: **none** in production source (`NEXT_PUBLIC_*` secret-prefix scan: 0 matches; literal-key grep: only tests and `docs/cli-guide.md`)
- License issues: **none** — MPL-2.0 (`@resvg/resvg-js`, `lightningcss`) and LGPL-3.0 (`@img/sharp-libvips-darwin-arm64`, dynamically linked) covered in `docs/accepted-risks.md`. No GPL/AGPL.
- RLS: 11/11 tables ENABLE + FORCE RLS; deny-all-anon policies intact (`025_force_supplemental_stats_rls.sql` confirmed).
- CORS: wildcard scoped to 2 read-only rate-limited GETs (`/api/verify/[hash]`, `/api/profile/[handle]`); `cors-mutation-guard.test.ts` enforces invariant.
- XSS: all user-input entry points in SVG pipeline routed through `escapeXml()` (`lib/render/escape.ts`); 23 call-sites across BadgeSvg + VerificationStrip + tests.
- Knip `--production`: 0 findings.
- `lib/db/supabase.ts:8` server-only boundary holds.

**Cross-agent recommendations:**
- [Coverage]: No security-relevant gaps. lib/auth 98.0%, lib/verification 100%, lib/analytics 97.3% per 2026-05-24 entry; all XSS/CORS paths covered.
- [QA]: No new security UX issues. CORS wildcard remains scoped to read-only endpoints; mutation guard static test in place.
- [Triage]: One P2 — bump `brace-expansion` transitive to ≥5.0.6 (eslint > minimatch path). Dev tooling, no production exposure, but moderate CVE should be cleared via `pnpm.overrides` or `pnpm up --depth Infinity brace-expansion`.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=security timestamp=2026-06-01T09:00:00Z -->
## Security Scanner — 2026-06-01
- **Status**: GREEN
- Vulnerabilities: **0 critical / 0 high / 0 moderate / 0 low** — `pnpm audit` fully clean (prior `brace-expansion` moderate cleared 2026-05-25 via override `>=5.0.6`).
- Secret leaks: **none** — no secret literals in `apps/web/lib`, `apps/web/app`, `packages`; no `NEXT_PUBLIC_*` carries a SECRET/KEY/TOKEN/PASSWORD value; `SUPABASE_SERVICE_ROLE_KEY`/`NEXTAUTH_SECRET` absent from all `NEXT_PUBLIC_*` bindings. `server-only` boundary holds at `lib/db/supabase.ts:8`.
- License issues: **none** — no GPL/AGPL. MPL-2.0 (`@resvg/resvg-js`, `lightningcss`) + LGPL-3.0 (`@img/sharp-libvips-darwin-arm64`, dynamic-linked) all documented in `docs/accepted-risks.md`. `sharp` now Apache-2.0 (0.34.5).
- Knip `--production`: **0 findings**.
- XSS: **7 SVG user-input entry points** all escaped via `escapeXml()` (`lib/render/escape.ts`) — `handle`/`displayName` (`BadgeSvg.tsx:40,42`), `avatarDataUri` (`:155`), `archetypeText` (`:179`), `tier` (`:236`), `hash`/`date` (`VerificationStrip.ts:13-14`). 37 escape call-sites.
- CORS: wildcard `*` scoped to 2 read-only rate-limited GETs (`/api/verify/[hash]` 30/60s, `/api/profile/[handle]` 60/60s); `cors-mutation-guard.test.ts` enforces no-wildcard-on-mutations invariant.
- RLS: **10 base tables, 10/10 ENABLE + FORCE RLS** — `users`, `metrics_snapshots`, `verification_records`, `feature_flags`, `merge_operations`, `tool_insights`, `email_campaigns`, `campaign_sends`, `user_platforms`, `supplemental_stats`. FORCE via migration 018 (9) + 025 (`supplemental_stats`). Deny-all-anon policies in 008 + 018.
- HEAD pinned at `2d7eb73c` — no code-surface change vs prior cycle. Pure audit cycle.

**Cross-agent recommendations:**
- [Coverage]: No security-relevant coverage gaps. lib/auth 98.0%, lib/analytics 97.3%, lib/verification 100% per coverage 2026-06-01 — all XSS escape paths and CORS guards covered.
- [QA]: No new security UX issues. CORS wildcard remains scoped to read-only endpoints; mutation guard static test in place. All interactive SVG/markup fields escaped.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=cost_analyst timestamp=2026-05-26T01:03:40Z -->
## Cost Analyst — 2026-05-26
- **Status**: GREEN
- Redis key growth risk: LOW
- Uncached external calls: 0 (all external calls cached or write-through)
- Resource leak risks: 0
- Estimated monthly cost at 10K users: **~$50–75/mo**, unchanged.
- **Commits this cycle**: 1 cost-surface change since 2026-05-24 entry — `dc0b7261` cached `/api/health` GitHub probe via `unstable_cache(revalidate=60)`. P3 (cycle 11) RESOLVED.
- Redis: 16 production prefixes + 3 persistent singletons (25/28 with TTLs, 89%). `cacheSet` defaults to 21,600s. `cacheIncr` race-safe.
- Supabase: 11 tables, 11/11 FORCE RLS. Singleton lazy client at `lib/db/supabase.ts:14` guarded by `import "server-only"` (line 8).
- Feature-flags ISR: `unstable_cache(revalidate=300)` at `lib/feature-flags.ts:84-94` active — 13 pages CDN-eligible.
- Badge `maxDuration=35` at `app/u/[handle]/badge.svg/route.ts:29` — 11th cycle hold.
- **P2-1 CARRIED (cycle 26)**: `dbGetCampaignStats()` 4-query parallel COUNT aggregation. Threshold comment at `lib/db/campaigns.ts:720-726`. Replace with GROUP BY RPC when campaigns exceed ~5K sends. Not yet triggered.
- **MONITOR M-bundle CARRIED**: Bundle 2,266 KB raw / 706 KB gzipped (flat 8/8 cycles per perf 2026-05-14). 4-week +34.7% trend stable but unresolved. `ANALYZE=true pnpm run build` still needs interactive run.
- **MONITOR M-config-TTL CARRIED**: `config:` TTL 31,536,000s (1y per user). PUT replaces — no accumulation.
- GitHub API cache-first unchanged (6h primary + 7d stale fallback). 100% fetch timeout coverage. `_inflight` dedup Map bounded.
- Coverage context (May 24): 7589 tests GREEN across 3 clean runs, 0 flakes. lib/cache 98.1%, lib/db 96.5%, app/api 97.5% — all stable.
- **P1s: NONE. P2s: 1 active (P2-1, threshold-gated). P3s: 0 (health probe P3 resolved).**

**Cross-agent recommendations:**
- [Performance]: Bundle flat 8/8 cycles. 4-week +34.7% trend stable but unresolved; `ANALYZE=true pnpm run build` still needs interactive run to localize source. Carry-only.
- [Security]: No cost-security regressions. `server-only` boundary on Supabase client + FORCE RLS on all 11 tables intact. Fail-open rate limiter and 100% fetch timeout coverage maintained. Health endpoint GitHub probe now cached at 60s — reduces outbound dependency.
- [Coverage]: lib/cache 98.1%, lib/db 96.5%, app/api 97.5% — all stable per May 24. New `/api/health` cache wrapper covered by the 2 new tests in `route.test.ts` (commit `dc0b7261`). No cost-path coverage gaps.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=qa_agent timestamp=2026-05-27T08:58:36Z -->
## QA Agent — 2026-05-27
- **Status**: YELLOW
- Tests: 5483 passed / 8 failed / 5491 reached (host worker exhaustion; coverage 2026-05-24 baseline 7589/7589 GREEN unaffected)
- Type errors: 0
- Lint issues: 0
- A11y issues: 0

**Cross-agent recommendations:**
- [Coverage]: vitest worker-pool exhaustion recurred this cycle on a host running multiple concurrent vitest jobs (same environmental pattern noted 2026-05-22/23/24). Recommend serializing or rate-limiting agent vitest runs on shared hosts so QA + coverage don't collide.
- [Security]: No new security-related quality issues. All XSS escape paths still covered, no hardcoded hex in production components, all `<img>` have `alt`, all interactive elements have ARIA labels.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=cost_analyst timestamp=2026-05-28T01:01:42Z -->
## Cost Analyst — 2026-05-28
- **Status**: GREEN
- Redis key growth risk: low
- Uncached external calls: 0 (P3 health probe now cached at 60 s via `unstable_cache`, confirmed in dc0b7261)
- Resource leak risks: 0

**Cross-agent recommendations:**
- [Performance]: Bundle flat 9/9 cycles; 4-week +34.7% trend stable but unresolved as source. `ANALYZE=true pnpm run build` still requires interactive run to localize. Carry-only — no runtime cost impact yet.
- [Security]: No cost-security regressions. `server-only` boundary on Supabase client + FORCE RLS on all 11 tables intact. Fail-open rate limiter and 100% fetch timeout coverage maintained. New `/api/health` cache wrapper is a pure cost win — does not change security posture.
- [Coverage]: lib/cache 98.1%, lib/db 96.5%, app/api 97.5% — all stable per 2026-05-28 entry. New `/api/health` `unstable_cache(revalidate=60)` wrapper confirmed test-covered in `route.test.ts`. No cost-path coverage gaps.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=performance timestamp=2026-05-28T10:00:00Z -->
## Performance Agent — 2026-05-28
- **Status**: GREEN
- Total First Load JS: **1,943.3 KB raw / 620.2 KB gzipped** (77 chunks). **−322 KB / −14.2%** vs 2026-05-14 (2,266 KB raw). 4-week +34.7% growth trend reversed — likely Turbopack chunk-consolidation across Next.js 16.2.4 → 16.2.6.
- Routes >500KB: **0**. Largest chunks 228 / 184 / 156 / 112 / 108 KB — all framework/vendor.
- Build: Next 16.2.6 Turbopack, 4.4s compile, 10.5s typecheck, 0 errors. 86 routes (4 static, 82 dynamic), 48 static pages.
- Knip `--production`: **0 application findings**. Reported unused dep `server-only` is a false positive — used at `lib/db/supabase.ts:8` via side-effect import.
- `"use client"` files (non-test): **92**, down from 111 (May 14). Spot-audit clean.
- Dynamic imports: 20 `next/dynamic` usages — PostHog, command bar, admin sub-dashboards, Studio, experiments. Good code-splitting.
- Badge route: `maxDuration=35` (5th cycle hold), `s-maxage=21600 / stale-while-revalidate=86400`, in-flight dedup + Redis lock — unchanged.
- Feature-flags ISR: `unstable_cache(revalidate=300)` at `lib/feature-flags.ts:84-94` active. `/api/health` GitHub probe now cached 60s (`dc0b7261`). 0 uncached external calls.
- Fonts: `next/font/google` (JetBrains Mono + Plus Jakarta Sans), `display: swap`. No CLS risks. `prefers-reduced-motion` respected.
- **Note**: Next 16 Turbopack omits per-route First Load JS from the build table. Per-route sizing requires `ANALYZE=true pnpm run build` interactively.

**Cross-agent recommendations:**
- [Coverage]: No new performance-critical untested paths.
- [Security]: No performance issues with security implications. Badge in-flight dedup + rate limit + `frame-ancestors *` override unchanged. Fail-open Redis rate limiter intact.
- [QA]: Bundle reduction should slightly improve TTI/LCP across pages. No CLS regressions; ISR caching active on archetype/about pages.
- [Cost Analyst]: Carry "M-bundle" can be closed — bundle is **down 14%** vs May 14, 4-week growth reversed. Likely lower cold-start memory on serverless. `ANALYZE=true` run no longer urgent.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=triage timestamp=2026-05-28T09:30:00Z -->
## Triage — 2026-05-28
- **Reports processed**: 5 (cc-rpi-update GREEN, cost-analyst GREEN, coverage GREEN, performance GREEN, qa YELLOW-environmental)
- **Action items resolved**: 2 — knip `server-only` false-positive suppressed, `bundle-size.yml` enhanced with gzipped chunk totals
- **Summary**: Cleanest cycle in weeks — all substantive agents GREEN. Performance flipped GREEN (bundle −14%, 4-week growth reversed). QA YELLOW is worker-pool exhaustion only (no code regression). M-bundle monitor closed. Two P3 cosmetic/observability improvements landed.

**Cross-agent recommendations:**
- [Performance]: M-bundle monitor CLOSED. Bundle is 1,943 KB raw / 620 KB gzipped — down 14% vs May 14. `bundle-size.yml` now tracks gzipped chunk totals per push. `ANALYZE=true` run no longer urgent.
- [Cost Analyst]: M-bundle carry can be dropped next cycle. All other monitors (P2-1 campaign threshold, M-config-TTL) unchanged.
- [Coverage]: 7590/7590 GREEN, 0 flakes. QA worker exhaustion was environmental — coverage ran solo on same day, fully clean.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=performance timestamp=2026-06-04T10:00:00Z -->
## Performance Agent — 2026-06-04
- **Status**: GREEN
- Total First Load JS: **1,943.29 KB raw / 620.17 KB gzipped** (77 chunks). **Flat vs 2026-05-28** (1,943.3 KB / 620.2 KB / 77 chunks). HEAD pinned at `2d7eb73c` — no code change; confirmatory cycle. M-bundle monitor stays closed.
- Routes >500 KB: **0**. Largest chunks 227.1 / 183.2 / 153.3 / 110.0 / 107.2 KB raw — all framework/vendor, none >300 KB.
- Build: Next 16.2.6 Turbopack, 5.0s compile, 6.9s typecheck, 0 errors. 87 routes (5 static, 82 dynamic), 48 static pages. Per-route First Load JS omitted by Turbopack — sized from `.next/static/chunks`.
- Knip `--production`: **0 findings** (exit 0, empty output). `server-only` false positive stays suppressed.
- `"use client"` (non-test, anchored): 112. All appropriate; key public pages (`/`, `/about`, `/u/[handle]`, archetypes) confirmed server components. Count delta vs 05-28 is grep methodology only — HEAD unchanged.
- Badge route: `maxDuration=35` (6th cycle hold); success `s-maxage=21600 / SWR=86400`, error `s-maxage=300 / SWR=600`; in-flight dedup + Redis lock. Feature-flags ISR `unstable_cache(300)` active. `/api/health` GitHub probe cached 60s. 0 uncached external calls.
- Fonts: `next/font/google` (JetBrains Mono + Plus Jakarta Sans), `display: swap`, no external font links. CLS risks: none (next/image w/ dimensions; raw `<img>` matches are tests/escaped strings). `prefers-reduced-motion` respected.

**Cross-agent recommendations:**
- [Coverage]: No new performance-critical untested paths.
- [Security]: No performance issues with security implications. Badge in-flight dedup + rate limit unchanged; fail-open Redis rate limiter intact; fetch timeouts 100%.
- [QA]: No CLS regressions; ISR caching active on archetype/about pages. Bundle flat — no TTI/LCP regression.
- [Cost Analyst]: Bundle flat 1,943 KB raw / 620 KB gzipped — M-bundle stays closed, no cold-start memory regression. `ANALYZE=true` run not urgent.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=coverage timestamp=2026-06-11T02:05:00Z -->
## Coverage Agent — 2026-06-11
- **Status**: GREEN
- Overall coverage: **96.78% stmts / 92.67% branches / 95.77% funcs / 97.89% lines** (8980/9278 stmts). Flat vs 2026-06-10 (branches +0.02pp, v8 noise). HEAD at `5ef06c09` — commits since last cycle (deps bumps #848/#850/#851, cc-rpi-update agent-tools restriction) touched no app code.
- Test suite: 445 files, **7590 tests**. 3 full runs this cycle (1 instrumented + 2 plain), all 7590/7590 identical, 445/445 files. 0 flakes. ~38s/37s/33s, no host worker-pool contention.
- Critical paths GREEN: lib/impact 99.59% (98.67% br / 100% fn), lib/render 100% (92.86% br), app/api 97.48% (96.80% fn / 94.22% br; lowest route `/api/studio/config` 92.3% st / 85.71% br), lib/db 96.48% (100% fn / 93.32% br). Also lib/cache 98.13%, lib/auth 98.0%, lib/github 97.35%, lib/analytics 97.30%, lib/history 98.26%, lib/email 97.57%, lib/verification 100%, components 96.46%, packages/shared 91.60%.
- **Untested source files in critical paths (impact/render/api/db): 2** — `api/auth/{bitbucket,codeberg}/config.ts` lack direct `.test.ts` but both confirmed at **100% stmts** via transitive route-test coverage. No real gaps.
- **No new P2s**. Sub-80% files all P3 carries: experiments error/loading 0% (JSDOM `navigation to another Document`, flag-gated), HolographicOverlay 50%, heatmap-wave 73.33%, metallic-shimmer 77.41% (Canvas/WebGL), next/dynamic lazy wrappers (ClientInstrumentation 60%, GlobalCommandBarLazy 60%, SharePageOwnerContentLazy 66.66%), packages/shared JSON config 0% (false positive — src/ TS 100%).
- **Flaky tests: 0** confirmed across 3 full-suite runs (7590/7590 each, identical). Report at `docs/agents/coverage-report.md`.

**Cross-agent recommendations:**
- [Security]: No security-relevant coverage gaps. lib/auth 98.0%, lib/analytics 97.30%, lib/verification 100% — XSS escape paths and CORS guards fully covered. Deps bumps #850/#851 caused no coverage or test regressions.
- [QA]: 0 flaky tests across 3 runs, no worker-pool contention this cycle. Only env noise: JSDOM `navigation to another Document` warnings on flag-gated experiments error/loading pages and two intentional `test-agent` fixture-report ERROR assertions.
- [Triage]: No P2 action items. Coverage clean and flat (4th consecutive identical cycle; first on new HEAD `5ef06c09`). Optional polish only: studio/config and admin/bulk-recalculate edge branches, campaigns-dashboard 78.78% fn (admin-only).
- [Cost Analyst]: lib/cache 98.13%, lib/db 96.48%, app/api 97.48% — all stable. No cost-path coverage gaps.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=coverage timestamp=2026-06-12T02:15:00Z -->
## Coverage Agent — 2026-06-12
- **Status**: GREEN
- Overall coverage: **96.78% stmts / 92.65% branches / 95.77% funcs / 97.89% lines** (8980/9278 stmts). Flat vs 2026-06-11 (branches −0.02pp, v8 noise). HEAD unchanged at `5ef06c09` — second consecutive cycle on this commit, no code-surface change.
- Test suite: 445 files, **7590 tests**. 3 full runs this cycle (1 instrumented + 2 plain), all 7590/7590 identical, 445/445 files. 0 flakes. ~28s/~23s/~21s, no host worker-pool contention.
- Critical paths GREEN: lib/impact 99.59% (98.67% br / 100% fn), lib/render 100% (92.86% br), app/api 97.48% (96.80% fn / 94.22% br; lowest route `/api/studio/config` 92.3% st / 85.71% br), lib/db 96.48% (100% fn / 93.32% br). Also lib/cache 98.13%, lib/auth 98.0%, lib/github 97.35%, lib/analytics 97.30%, lib/history 98.26%, lib/email 97.57%, lib/verification 100%, components 96.46%, packages/shared 91.60%.
- **Untested source files in critical paths (impact/render/api/db): 2** — `api/auth/{bitbucket,codeberg}/config.ts` lack direct `.test.ts` but both confirmed at **100% stmts** via transitive route-test coverage. No real gaps.
- **No new P2s**. Sub-80% files all P3 carries: experiments error/loading 0% (JSDOM `navigation to another Document`, flag-gated), HolographicOverlay 50%, heatmap-wave 73.33%, metallic-shimmer 77.41% (Canvas/WebGL), next/dynamic lazy wrappers (ClientInstrumentation 60%, GlobalCommandBarLazy 60%, SharePageOwnerContentLazy 66.66%), packages/shared JSON config 0% (false positive — src/ TS 100%).
- **Flaky tests: 0** confirmed across 3 full-suite runs (7590/7590 each, identical). Report at `docs/agents/coverage-report.md`.

**Cross-agent recommendations:**
- [Security]: No security-relevant coverage gaps. lib/auth 98.0%, lib/analytics 97.30%, lib/verification 100% — XSS escape paths and CORS guards fully covered.
- [QA]: 0 flaky tests across 3 runs, no worker-pool contention this cycle. Only env noise: JSDOM `navigation to another Document` warnings on flag-gated experiments error/loading pages and two intentional `test-agent` fixture-report ERROR assertions.
- [Triage]: No P2 action items. Coverage clean and flat (5th consecutive identical cycle; 2nd on HEAD `5ef06c09`). Optional polish only: studio/config and admin/bulk-recalculate edge branches, campaigns-dashboard 78.78% fn (admin-only).
- [Cost Analyst]: lib/cache 98.13%, lib/db 96.48%, app/api 97.48% — all stable. No cost-path coverage gaps.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=coverage timestamp=2026-06-14T02:45:00Z -->
## Coverage Agent — 2026-06-14
- **Status**: GREEN
- Overall coverage: **96.78% stmts / 92.65% branches / 95.77% funcs / 97.88% lines** (8980/9278 stmts). Flat vs 2026-06-12 (v8 noise only). HEAD at `5ef06c09` — third consecutive cycle on this commit; no app-code change since.
- Test suite: 445 files, **7590 tests**. 3 full runs this cycle (2 instrumented + 1 plain). Runs 1 & 2: 7590/7590 identical, 445/445 files. Run 3 (plain): 7484/7484 reached, 433/445 files — 12 files failed to **start** (`[vitest-pool]: Timeout waiting for worker to respond`, host worker-pool/fd exhaustion), not assertion failures. All 12 re-run in isolation passed clean (12 files / 106 tests; 7484+106=7590). **0 genuine flakes.**
- Critical paths GREEN: lib/impact 99.59% (98.67% br / 100% fn), lib/render 100% (92.86% br), app/api 97.48% (94.22% br / 96.80% fn; lowest route `/api/studio/config` 92.3% st / 85.71% br), lib/db 96.48% (93.32% br / 100% fn). Also lib/cache 98.13%, lib/auth 98.0%, lib/github 97.35%, lib/analytics 97.30%, lib/history 98.26%, lib/email 97.57%, lib/verification 100%, components 96.46%, packages/shared/src 100%.
- **Untested source files in critical paths (impact/render/api/db): 2** — `api/auth/{bitbucket,codeberg}/config.ts` lack direct `.test.ts` but both confirmed at **100% stmts** via transitive route-test coverage. No real gaps. No untested files in lib/impact, lib/render, lib/db; every app/api route has a route.test.ts.
- **No new P2s**. Sub-80% files (10) all P3 carries: experiments error/loading 0% (JSDOM `navigation to another Document`, flag-gated), HolographicOverlay 50%, heatmap-wave 73.33%, metallic-shimmer 77.41% (Canvas/WebGL), next/dynamic lazy wrappers (ClientInstrumentation 60%, GlobalCommandBarLazy 60%, SharePageOwnerContentLazy 66.66%), packages/shared JSON config files 0% (false positive — src/ TS 100%).
- Report at `docs/agents/coverage-report.md`.

**Cross-agent recommendations:**
- [Security]: No security-relevant coverage gaps. lib/auth 98.0%, lib/analytics 97.30%, lib/verification 100% — XSS escape paths and CORS guards fully covered.
- [QA]: Worker-pool spawn-timeout contention recurred on run 3 (12 files lost to `Timeout waiting for worker to respond` — same environmental pattern QA noted 2026-05-22/23/24/27). Isolation re-run confirms 0 real flakes. Recommend serializing concurrent vitest jobs on shared hosts so coverage/QA runs don't collide.
- [Triage]: No P2 action items. Coverage clean and flat (3rd cycle on HEAD `5ef06c09`). Optional polish only: studio/config and admin/bulk-recalculate edge branches, campaigns-dashboard fn coverage (admin-only).
- [Cost Analyst]: lib/cache 98.13%, lib/db 96.48%, app/api 97.48% — all stable. No cost-path coverage gaps.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=qa_agent timestamp=2026-06-10T07:04:29Z -->
## QA Agent — 2026-06-10
- **Status**: GREEN
- Tests: 7590/7590 passed across 445 files, 0 failed, 0 skipped (single clean run, 68s, no worker-pool contention)
- Type errors: 0
- Lint issues: 0
- A11y issues: 0 — all `<img>` have alt; both `role="button"` usages have `aria-label` (campaigns table row fix from 2026-05-06 confirmed in place at `campaigns-dashboard.tsx:903`); focus-visible in globals.css + 6 components; prefers-reduced-motion respected; heading hierarchy correct (archetype h1 via `ArchetypePage.tsx`, verify/[hash] h1 via `StatusCallout titleAs="h1"`); 15 error boundaries, 13 loading states, admin empty states present

**Cross-agent recommendations:**
- [Coverage]: No new undertested areas surfaced by QA. Test totals match coverage agent's 2026-06-10 baseline exactly (7590/445, 0 flakes) — no contention this run, so no environment action needed.
- [Security]: No security-related quality issues. Design-system hex exceptions (`global-error.tsx`, icon assets, experiments) touch no secrets or user input; SVG render pipeline untouched this cycle.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=performance timestamp=2026-06-11T09:00:00Z -->
## Performance Agent — 2026-06-11
- **Status**: GREEN
- Total First Load JS: **1,949.3 KB raw / 622.6 KB gzipped** (77 chunks). **+6.0 KB raw / +0.3% vs 2026-06-04** (1,943.3 / 620.2 / 77) — first cycle measured on Next 16.2.9 + posthog-js 1.384.0 (deps #850/#851). Dep bumps cost nothing meaningful; cost-analyst's post-bump bundle confirmation request satisfied. M-bundle stays closed.
- Routes >500 KB: **0**. Largest chunks 227.1 / 189.2 / 153.3 / 110.0 / 107.2 KB raw — all framework/vendor, none >300 KB.
- Build: Next **16.2.9** Turbopack, 2.8s compile, 6.6s typecheck, 0 errors. 89 routes (4 static, 85 dynamic), 48 static pages. Per-route First Load JS still omitted by Turbopack — sized byte-accurately from `.next/static/chunks`.
- **Operational finding**: local `node_modules` was stale at run start — `package.json` declared `next ^16.2.9` but 16.2.6 was installed (no `pnpm install` after Dependabot merges). Ran `pnpm install` + rebuild before sizing; all numbers reflect the deployed stack. Agents doing build measurements should verify installed-vs-declared versions first.
- Knip `--production`: **0 findings** (exit 0). `"use client"` (non-test, anchored): 105; key public pages (`/`, `/about`, `/u/[handle]`, archetypes) confirmed server components. `next/dynamic` in 7 files (PostHog, command bar, admin, Studio, experiments).
- Badge route: `maxDuration=35` (7th cycle hold); success `s-maxage=21600 / SWR=86400`, error `s-maxage=300 / SWR=600`. Feature-flags ISR `unstable_cache(300)` active; `/api/health` GitHub probe cached 60s; 0 uncached external calls.
- Fonts: `next/font/google` (JetBrains Mono + Plus Jakarta Sans), `display: swap`, 0 external font requests. CLS risks: none — badge fallback `<img>` has explicit 1200×630 + skeleton; LiteYouTubeEmbed thumbnail fills fixed container. `prefers-reduced-motion` respected.

**Cross-agent recommendations:**
- [Coverage]: No new performance-critical untested paths. Dep bumps caused no build or bundle regressions.
- [Security]: No performance issues with security implications. Badge dedup + rate limit unchanged; fail-open Redis rate limiter intact; fetch timeouts 100%.
- [QA]: No CLS regressions; bundle flat — no TTI/LCP change. ISR caching active on archetype/about pages.
- [Cost Analyst]: Post-bump bundle confirmed flat (1,949 KB raw / 623 KB gzipped) — no cold-start memory regression from next 16.2.9 / posthog-js 1.384.0. M-bundle stays closed; `ANALYZE=true` run not urgent.
<!-- ENTRY:END -->
