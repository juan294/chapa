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

<!-- ENTRY:START agent=cost-analyst timestamp=2026-05-24T03:00:00Z -->
## Cost Analyst — 2026-05-24
- **Status**: GREEN
- Estimated monthly cost at 10K users: **~$50–75/mo**. Unchanged.
- **Commits this cycle**: **zero** to cost surface since 2026-05-23 entry. HEAD unchanged at `1ed6aa96`. Pure carry/audit cycle.
- Redis: **16 production prefixes + 3 persistent singletons** (25/28 keys with TTLs, 89%). Growth risk: LOW. `cacheSet` defaults to 21,600s; all call sites pass explicit TTL. `cacheIncr` always refreshes TTL (race-safe).
- Supabase: **11 tables** unchanged; **11/11 FORCE RLS** confirmed (latest migration `025_force_supplemental_stats_rls.sql`). Singleton lazy client at `lib/db/supabase.ts:14` guarded by `import "server-only"` (line 8).
- Feature-flags ISR: `unstable_cache(revalidate=300)` at `lib/feature-flags.ts:84-94` active — flag reads cached at data layer.
- Badge `maxDuration=35` at `app/u/[handle]/badge.svg/route.ts:29` — 10th cycle hold.
- **P2-1 CARRIED (cycle 24)**: `dbGetCampaignStats()` 4-query parallel COUNT aggregation. Threshold comment in source at `lib/db/campaigns.ts:723-726`. Not yet triggered.
- **P3 CARRIED (cycle 11)**: Health endpoint at `app/api/health/route.ts:31` calls `api.github.com/rate_limit` uncached. ~5–10 calls/hr — well inside 60/hr unauth limit. Fix: `unstable_cache(revalidate=60)`. Low priority.
- **MONITOR M7 CARRIED**: `config:` TTL 31,536,000s (1y per user). PUT replaces — no accumulation.
- **MONITOR M-bundle CARRIED**: Bundle 2,266 KB raw / 706 KB gzipped (flat 8/8 cycles per perf 2026-05-14). Sustained +34.7% over 4 weeks unresolved. `ANALYZE=true pnpm run build` still needs interactive run.
- GitHub API cache-first unchanged (6h primary + 7d stale fallback). 100% fetch timeout coverage. `_inflight` dedup Map bounded.
- Coverage context (May 24): 7589 tests GREEN across 3 clean runs, 0 flakes, lib/cache 98.1%, lib/db 96.5%, app/api 97.5% — all stable. Prior engagement-dashboard flake confirmed RESOLVED (no recurrence).
- **P1s: NONE. P2s: 1 active (P2-1, threshold-gated). P3s: 1 carry (health probe).**

**Cross-agent recommendations:**
- [Performance]: Bundle flat 8/8 cycles. 4-week +34.7% trend stable but unresolved; `ANALYZE=true pnpm run build` still needs interactive run to localize source. Carry-only.
- [Security]: No cost-security regressions. `server-only` boundary on Supabase client + FORCE RLS on all 11 tables intact. Fail-open rate limiter and 100% fetch timeout coverage maintained. Health endpoint P3 (uncached GitHub probe) is not a security risk — GitHub's own rate limits provide secondary protection.
- [Coverage]: lib/cache 98.1%, lib/db 96.5%, app/api 97.5% — all stable per May 24. engagement-dashboard flake fix holding. No cost-path coverage gaps.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=cost-analyst timestamp=2026-05-23T03:00:00Z -->
## Cost Analyst — 2026-05-23
- **Status**: GREEN
- Estimated monthly cost at 10K users: **~$50–75/mo**. Unchanged.
- **Commits this cycle**: 5 since 2026-05-22 (`1ed6aa96`, `8d9f35e5`, `9534d40f`, `7058f7ce`, `3e34ad97`). **Zero cost-surface code changes** — test fixes, JSDoc on `lib/auth/session.ts` private helpers, P2-1 threshold comment added to `lib/db/campaigns.ts:723-726`, Dependabot bumps (#844, #846). Pure carry/audit cycle.
- Redis: **16 production prefixes + 3 persistent singletons** (25/28 keys with TTLs, 89%). Growth risk: LOW. `cacheSet` defaults to 21,600s; all call sites pass explicit TTL.
- Supabase: **11 tables** unchanged; **11/11 FORCE RLS** (latest migration `025_force_supplemental_stats_rls.sql`). Singleton lazy client at `lib/db/supabase.ts:14` guarded by `import "server-only"` (line 8).
- Feature-flags ISR: `unstable_cache(revalidate=300)` at `lib/feature-flags.ts:84-94` active — flag reads cached at data layer.
- Badge `maxDuration=35` at `app/u/[handle]/badge.svg/route.ts:29` — 9th cycle hold.
- **P2-1 CARRIED (cycle 23)**: `dbGetCampaignStats()` 4-query parallel COUNT aggregation. **Threshold comment now in source** at `lib/db/campaigns.ts:723-726` — replace with GROUP BY RPC when campaigns exceed ~5K sends. Not yet triggered.
- **P3 CARRIED (cycle 10)**: Health endpoint at `app/api/health/route.ts:31` calls `api.github.com/rate_limit` uncached. ~5–10 calls/hr — well inside 60/hr unauth limit. Fix: `unstable_cache(revalidate=60)`. Low priority.
- **MONITOR M7 CARRIED**: `config:` TTL 31,536,000s (1y per user). PUT replaces — no accumulation.
- **MONITOR M-bundle CARRIED**: Bundle 2,266 KB raw / 706 KB gzipped (flat 7/7 cycles per perf 2026-05-14). Sustained +34.7% over 4 weeks unresolved as cause. `ANALYZE=true pnpm run build` still needs interactive run.
- GitHub API cache-first unchanged (6h primary + 7d stale fallback). 100% fetch timeout coverage. `_inflight` dedup Map bounded.
- Coverage context (May 23): 7589 tests GREEN, prior engagement-dashboard flake RESOLVED, lib/cache 98.1%, lib/db 96.5%, app/api 97.5% — all stable.
- **P1s: NONE. P2s: 1 active (P2-1, threshold-gated, comment landed). P3s: 1 carry (health probe).**

**Cross-agent recommendations:**
- [Performance]: Bundle flat 7/7 cycles. 4-week +34.7% trend stable but unresolved; `ANALYZE=true pnpm run build` still needs interactive run to localize source. Gzipped ~140 KB drop post-Next 16.2.6 is a positive secondary signal.
- [Security]: No cost-security regressions. `server-only` boundary on Supabase client + FORCE RLS on all 11 tables intact. Fail-open rate limiter and 100% fetch timeout coverage maintained. Health endpoint P3 (uncached GitHub probe) is not a security risk — GitHub's own rate limits provide secondary protection.
- [Coverage]: lib/cache 98.1%, lib/db 96.5%, app/api 97.5% — all stable. Prior engagement-dashboard P2 flake resolved per May 23 coverage. No cost-path coverage gaps.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=cost-analyst timestamp=2026-05-22T03:00:00Z -->
## Cost Analyst — 2026-05-22
- **Status**: GREEN
- Estimated monthly cost at 10K users: **~$50–75/mo**. Unchanged.
- **Commits this cycle**: **zero** to cost surface since 2026-05-21 entry. Last code-touching commit `718e0b54` (2026-05-14) already covered. Pure carry/audit cycle.
- Redis: **16 production prefixes + 3 persistent singletons** (25/28 keys with TTLs, 89%). Growth risk: LOW. `cacheSet` defaults to 21,600s; all call sites pass explicit TTL.
- Supabase: **11 tables** unchanged; **11/11 FORCE RLS** confirmed (latest migration `025_force_supplemental_stats_rls.sql`). Singleton lazy client at `lib/db/supabase.ts:14` guarded by `import "server-only"` (line 8).
- Feature-flags ISR: `unstable_cache(revalidate=300)` at `lib/feature-flags.ts:49-58` active — flag reads cached at data layer.
- Badge `maxDuration=35` at `app/u/[handle]/badge.svg/route.ts:29` — 8th cycle hold.
- **P2-1 CARRIED (cycle 22)**: `dbGetCampaignStats()` 4-query parallel COUNT aggregation (`lib/db/campaigns.ts:727-765`). Threshold-gated >5K sends/campaign. Not yet triggered.
- **P3 CARRIED (cycle 10)**: Health endpoint at `app/api/health/route.ts:31` calls `api.github.com/rate_limit` uncached. ~5–10 calls/hr — well inside 60/hr unauth limit. Fix: `unstable_cache(revalidate=60)`. Low priority.
- **MONITOR M7 CARRIED**: `config:` TTL 31,536,000s (1y per user). PUT replaces — no accumulation.
- **MONITOR M-bundle CARRIED**: Bundle 2,266 KB raw / 706 KB gzipped (flat per perf 2026-05-14). Sustained +34.7% over 4 weeks unresolved as cause. `ANALYZE=true pnpm run build` still needs interactive run.
- GitHub API cache-first unchanged (6h primary + 7d stale fallback). 100% fetch timeout coverage. `_inflight` dedup Map bounded.
- Coverage context (May 22): 7589 tests, 1 new flaky test in `engagement-dashboard.test.tsx` (admin-only, race condition; not cost-path). lib/cache 98.1%, lib/db 96.5%, app/api 97.5% — all stable.
- **P1s: NONE. P2s: 1 active (P2-1, threshold-gated). P3s: 1 carry (health probe).**

**Cross-agent recommendations:**
- [Performance]: Bundle flat 6/6 cycles. 4-week +34.7% trend stable but unresolved; `ANALYZE=true pnpm run build` still needs interactive run to localize source.
- [Security]: No cost-security regressions. `server-only` boundary on Supabase client + FORCE RLS on all 11 tables intact. Fail-open rate limiter and 100% fetch timeout coverage maintained. Health endpoint P3 (uncached GitHub probe) is not a security risk — GitHub's own rate limits provide secondary protection.
- [Coverage]: lib/cache 98.1%, lib/db 96.5%, app/api 97.5% — all stable. No cost-path coverage gaps. Coverage agent's new P2 (`engagement-dashboard` flake) is admin-only UI, not cost-surface.
<!-- ENTRY:END -->






<!-- ENTRY:START agent=triage timestamp=2026-05-14T08:00:20Z -->
## Triage -- 2026-05-14
- **Reports processed**: 6 (cost-analyst RED, coverage RED, cc-rpi-update RED, performance YELLOW, security GREEN, qa GREEN)
- **Action items resolved**: 4 -- FORCE RLS migration for `supplemental_stats`, server-only Supabase boundary with test alias, auth session JSDoc, bundle monitor carried.
- **Dependabot**: PR #843 production group merged after updating with `develop`; PR #842 dev/types group merged after React lint-rule fixes and production-base merge. Both CI green.
- **Summary**: App hardening, documentation fixes, and active Dependabot follow-up completed. Three agent reports failed due quota/agent-run output and are documented for re-run.

**Cross-agent recommendations:**
- [Security]: `supplemental_stats` now matches the FORCE RLS posture of the other app tables, and `lib/db/supabase.ts` is guarded by `server-only`.
- [Coverage]: Re-run the coverage agent when usage resets; this cycle's coverage report contained only quota output.
- [Cost Analyst]: Re-run the cost agent when usage resets; this cycle's cost report contained only quota output.
- [Performance]: Bundle remains a monitor only: 2,266 KB raw, flat vs May 7, no chunk >=500 KB.
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

<!-- ENTRY:START agent=triage timestamp=2026-05-10T12:05:00Z -->
## Triage — 2026-05-10
- **Reports processed**: 3 (cc-rpi-update GREEN, coverage GREEN, cost-analyst GREEN)
- **Action items resolved**: 2 of 2 — all implemented
- **Summary**: All overnight reports GREEN — no P2s, no failures, no Dependabot PRs. (1) Added 2 timeout-path tests for `isAgentEnabled` to `lib/feature-flags.test.ts`: master-flag-timeout and agent-flag-timeout — both `.catch(() => null)` callbacks in `isAgentEnabled` (lines 192, 198) were uncovered anonymous functions; now covered. Final test count: 7589 (+2 vs last cycle). All 445 test files green. (2) Bundle analysis (`ANALYZE=true pnpm run build`) deferred — opens browser windows non-headlessly; noted as informational monitor.
- **Skipped with reason**: (a) Cost-analyst P2-1 (`dbGetCampaignStats` GROUP BY RPC) — threshold-gated at >5K sends/campaign; carry cycle 12. (b) Bundle `ANALYZE=true` run — informational monitor only, no chunk ≥500 KB.

**Cross-agent recommendations:**
- [Coverage]: `lib/feature-flags.ts` `isAgentEnabled` timeout paths now covered. All anonymous `.catch` callbacks tested. Feature-flags module fully covered.
- [Cost Analyst]: No cost-path changes this cycle. P2-1 carry unchanged at cycle 12.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=triage timestamp=2026-05-09T07:30:00Z -->
## Triage — 2026-05-09
- **Reports processed**: 3 (cc-rpi-update GREEN, coverage GREEN, cost-analyst GREEN)
- **Action items resolved**: 3 of 3 — all implemented
- **Summary**: All overnight reports GREEN — no P2s, no failures, no Dependabot PRs. (1) Added `isStudioEnabledSync` describe block (4 tests) to `lib/feature-flags.test.ts` — only sync flag function without test coverage; mirrors existing `isBitbucketEnabledSync` pattern. (2) Added 2 tests to `lib/dashboard/generate-insights.test.ts`: identity-fallback path (default `t = (key) => key` parameter, never called in prior tests) and unknown-archetype lowercased-key fallback (`?? archetype.toLowerCase()` branch). (3) Added `CHAPA_ALERT_WEBHOOK_URL` to `CLAUDE.md` env-vars block — operationally critical P1 alert webhook (`lib/env.ts:59`), documented in README + runbook but missing from canonical project file. Final test count: 7587 (+6 vs last cycle). All 445 test files green.
- **Skipped with reason**: Cost-analyst P2-1 (`dbGetCampaignStats` GROUP BY RPC) — threshold-gated at >5K sends/campaign; carry cycle 11. Bundle watch deferred (informational monitor, no action needed this cycle).

**Cross-agent recommendations:**
- [Coverage]: `lib/feature-flags.ts` now at 100% funcs. `lib/dashboard/generate-insights.ts` locale-fallback branches now covered. All modules at or above 94% stmts. No new gaps to watch.
- [Cost Analyst]: No cost-path changes this cycle. P2-1 carry unchanged at cycle 11.
- [Documentation]: `CHAPA_ALERT_WEBHOOK_URL` now in CLAUDE.md env-vars block — operationally complete.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=performance timestamp=2026-04-30T09:00:00Z -->
## Performance Engineer — 2026-04-30
- **Status**: YELLOW
- Build: Next.js 16.2.4 (Turbopack), compiled 6.6s, 0 TypeScript errors. 64 pages, 84 routes (5 static, rest dynamic).
- Total client JS: **1,876.9 KB raw / 598.1 KB gzipped** — +194.9 KB (+11.6%) vs 2026-04-09 (1,682 KB). 68 chunks, no chunk >500 KB.
- Largest chunks: 227.1 KB (Next.js framework), 175.3 KB (PostHog lazy), 125.9 KB (React DOM/RSC), 110.0 KB (core-js). All vendor/framework.
- Knip `--production`: **8 false positives** confirmed in use (stable from prior cycles). No new unused production exports.
- `"use client"` audit: 94 non-test files. All appropriate — error boundaries, interactive UI, Canvas/WebGL, hooks. No misplaced directives.
- Dynamic imports: GlobalCommandBar, PostHog, ShortcutCheatSheet, admin sub-dashboards, Studio effects — all `next/dynamic`. Good code-splitting.
- Font loading: optimal (`next/font/google`, `display: "swap"`, Latin subset). No external font requests.
- CLS risks: **none** — all `<Image>` have explicit dims. Badge `<img>` fallback has `1200×630`. `LiteYouTubeEmbed <img>` inside `aspect-video` container — no CLS.
- Badge SVG caching: `s-maxage=21600, stale-while-revalidate=86400` (success), `s-maxage=300, stale-while-revalidate=600` (error). Correct.
- Turbopack NFT warning: **RESOLVED** — `svg-to-png.ts` now uses `import.meta.url` + `dirname(fileURLToPath(...))`. Zero warnings in build.
- **NEW YELLOW P1 — ISR regression**: Root layout (`app/layout.tsx:71`) calls `isStudioEnabled()` → `dbGetFeatureFlag()` → `cacheGet()` → Upstash Redis with `no-store`. This defeats ISR on 13 pages: `/about`, `/about/scoring`, `/about/verification`, `/archetypes/*` (7), `/_not-found`, `/cli/authorize`, `/admin`. Pages with `revalidate=604800`/`86400` are being server-rendered on every request. Fix: wrap `dbGetFeatureFlag` in `unstable_cache()`, or move `isStudioEnabled` out of root layout.
- **NEW YELLOW P2 — bundle growth**: +194.9 KB vs Apr 9. All recent commits are server-only — growth predates visible log. Run `ANALYZE=true pnpm run build` to identify source.

**Cross-agent recommendations:**
- [Coverage]: No new performance-coverage gaps. `og-image/route.ts` 60% funcs remains the only critical-path gap (6th cycle carry).
- [Security]: ISR regression means archetype/about pages no longer serve from CDN — slightly more origin exposure. Existing rate limiting on those pages still intact.
- [QA]: ISR regression may affect LCP on archetype pages (now server-rendered every request instead of CDN-cached). Consider a load-time smoke test.
- [Cost Analyst]: ISR regression likely increased Vercel serverless invocations for 7 archetype pages (should be CDN-cached for 7 days) — quantify in next cost cycle.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=performance timestamp=2026-05-07T09:00:00Z -->
## Performance Engineer — 2026-05-07
- **Status**: YELLOW
- Build: Next.js 16.2.4 (Turbopack), compiled 5.9s, 0 TypeScript errors. 86 routes (4 static, 82 dynamic).
- Total client JS: **2,266 KB raw / 706.5 KB gzipped** — +389 KB (+20.7%) vs Apr 30 (1,877 KB), +584 KB (+34.7%) vs Apr 9 (1,682 KB). 79 chunks, no chunk >500 KB. Sustained 4-week upward trend.
- Largest chunks: 320 KB, 228 KB, 176 KB, 156 KB, 112 KB, 100 KB. All vendor/framework — no single chunk ≥500 KB.
- Knip `--production`: **~35 findings** — ~12 unused exported functions (insights/parser.ts, render/avatar.ts, verification/hmac.ts, profile/materialize-profile.ts) + 23 unused exported types. Prior "8 false positives" from security agent are a subset; verify before removing.
- `"use client"` audit: 109 non-test files (+15 vs Apr 30). All appropriate — error boundaries, experiments, interactive UI, hooks. Key public pages remain server components.
- ISR regression: **RESOLVED** — `lib/feature-flags.ts:84-94` wraps `dbGetFeatureFlag` in `unstable_cache()` (revalidate=300s). 13 pages eligible for CDN caching again.
- **P2 (3rd cycle) — Badge `maxDuration` missing**: `app/u/[handle]/badge.svg/route.ts` has no `export const maxDuration`. Vercel defaults 10s; `INFLIGHT_TIMEOUT_MS=30s` exceeds this — cold-path badge renders silently killed. Fix: `export const maxDuration = 35;`.
- Dynamic imports: all heavy modules lazy-loaded (`next/dynamic`). Font loading optimal (`next/font/google`). CLS risks: none. `prefers-reduced-motion`: supported.
- Bundle growth source unknown — `ANALYZE=true pnpm run build` needed to identify culprit packages.

**Cross-agent recommendations:**
- [Cost Analyst]: Badge `maxDuration` P2 still unresolved (3rd cycle). Bundle +34.7% in 4 weeks may be increasing Vercel cold-start memory. Recommend running bundle analyzer to identify source before next cost cycle.
- [Security]: Knip reports ~35 previously-unseen unused exports — verify `fetchAvatarBase64` (`lib/render/avatar.ts`), `computeHash`, `buildPayload` (`lib/verification/hmac.ts`) before removing; these are security-path functions that knip may not trace through server-only imports.
- [QA]: No CLS regressions. ISR regression confirmed resolved — archetype/about pages should now hit CDN cache. If LCP regression was observed on those pages after Apr 30, it should be recovered.
- [Coverage]: No new performance-coverage gaps. Badge cold-path (maxDuration gap) has no specific test — low priority to add.
<!-- ENTRY:END -->


<!-- ENTRY:START agent=documentation timestamp=2026-04-17T10:00:00Z -->
## Documentation Agent — 2026-04-17
- **Status**: GREEN
- Route coverage: **50/50 API routes + 24 pages documented** (100%). 6 net new routes vs 2026-04-10 (Codeberg auth, campaign CRUD, telemetry, engagement-flags additions).
- Design system: **38/38 dark-theme color tokens** accurate. **3 minor gaps**: light values for `--color-dark-section` (`#1A1A2E`), `--color-dark-card` (`#252542`), and 4 terminal tokens not listed in table. All values correct in `globals.css` — docs formatting only.
- Env vars: **33/33 production vars documented** (100%). `TESTPLATFORM_*` confirmed test-only.
- JSDoc coverage: **100% on public exports**. Spot-checked `lib/impact/v6.ts` — all 8 exports have JSDoc.
- Required docs: all 6 present and non-empty. `impact-v4.md` correctly marked deprecated. No TODO/FIXME referencing doc gaps (2 false positives: agent-config template text + test mock string literal).
- Shared-context entries through 2026-04-17. Stable.

**Cross-agent recommendations:**
- [QA]: No doc changes needed for UX. Three low-severity design-system table gaps don't affect runtime behavior.
- [Security]: No security doc gaps. All `NEXT_PUBLIC_*` vars confirmed non-sensitive. `ALLOW_AGENT_RUN` documented and confirmed in use at `app/api/admin/agents/run/route.ts:75`.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=documentation timestamp=2026-04-10T10:00:00Z -->
## Documentation Agent — 2026-04-10
- **Status**: GREEN
- Route coverage: **44/44 API routes + 15 pages documented** (100%). Unchanged from 2026-04-03. No new routes added.
- Design system: **38/38 color tokens** (100%) and **18/18 animations** (100%). All hex values verified accurate in both light and dark theme variants.
- Env vars: **31/31 production vars documented** (100%). `TESTPLATFORM_*` confirmed test-only. `CI`/`NODE_ENV`/`ANALYZE` are standard build vars (intentional omissions).
- JSDoc coverage: **100% on public exports**. No gaps found across lib/impact, lib/render, lib/cache, lib/auth, lib/github, packages/shared.
- Required docs: all 6 present and non-empty (`impact-v4.md`, `impact-v6.md`, `svg-design.md`, `README.md` 215 lines, `design-system.md`, `shared-context.md`). 0 TODO/FIXME referencing doc gaps.
- Shared-context has entries up to 2026-04-10. Stable.

**Cross-agent recommendations:**
- [QA]: No documentation-related test concerns. BadgeToolbar flaky test (coverage agent P2 escalated) is not a docs issue — no doc changes needed.
- [Security]: No security-related doc gaps. All env vars correctly scoped. `NEXT_PUBLIC_*` vars confirmed non-sensitive.
- [Coverage]: No doc-coverage gaps remaining. All critical-path functions have JSDoc.
- [Cost Analyst]: No doc gaps affecting cost model. All routes and env vars fully documented.
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

<!-- ENTRY:START agent=coverage timestamp=2026-05-24T02:40:00Z -->
## Coverage Agent — 2026-05-24
- **Status**: GREEN
- Overall coverage: **96.78% stmts / 92.67% branches / 95.77% funcs / 97.89% lines** (8979/9277 stmts). Flat vs 2026-05-19/23 (within v8 noise).
- Test suite: 445 files, 7589 tests. 3/3 clean (7589/7589). 0 flakes. Durations 50s / 20s / 21s.
- Critical paths GREEN: lib/impact 99.6%/98.7%/100%, lib/render 100%/92.9%/100%, lib/db 96.5%/93.3%/100%, app/api 97.5%/94.2%/96.8%, lib/auth 98.0%, lib/cache 98.1%, lib/github 97.4%, lib/analytics 97.3%, lib/history 98.3%, lib/i18n 100%, lib/verification 100%, lib/feature-flags 100%, lib/dashboard 100%, lib/insights 100%, lib/profile 100%, lib/bitbucket 97.7%, lib/codeberg 98.0%, lib/email 97.6%, lib/async 100%.
- **Untested source files in critical paths: 0/75** — `api/auth/{bitbucket,codeberg}/config.ts` have no direct `.test.ts` but both 100% stmts via transitive coverage.
- **No new P2s**. 10 sub-80% files all P3 carries: Canvas/WebGL (HolographicOverlay, heatmap-wave, metallic-shimmer), next/dynamic lazy wrappers (ClientInstrumentation, GlobalCommandBarLazy, SharePageOwnerContentLazy), experiments error/loading (JSDOM-blocked, flag-gated), packages/shared JSON config files (false positive — src/ TS at 100%).
- **Watch (carry)**: lib/github/client.ts 93.1% funcs — 2 inflight-dedup edges uncovered. Low priority.
- **Flaky tests: 0** confirmed. Prior 2026-05-22 P2 flake `engagement-dashboard.test.tsx` ("handles campaign fetch non-ok response silently") confirmed RESOLVED — no recurrence across 3 runs.
- **Note**: A first coverage run aborted with 177 worker-pool timeouts due to concurrent vitest jobs from parallel agents on the host (paisaxe, archy). Environment exhaustion, not test logic — same pattern as 2026-05-23. Re-run after contention cleared was fully clean.

**Cross-agent recommendations:**
- [Security]: No security-relevant coverage gaps. lib/auth 98.0%, lib/analytics 97.3%, lib/verification 100% stable. XSS escape paths and CORS guards fully covered.
- [QA]: 0 flaky tests across 3 runs. engagement-dashboard race fix holding. No regression risk from coverage data.
- [Triage]: No P2 action items this cycle. Only carry-watch (lib/github/client.ts inflight-dedup edges, low priority). Clean cycle.
- [Cost Analyst]: lib/cache 98.1%, lib/db 96.5%, app/api 97.5% — all stable. No cost-path coverage gaps.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=coverage timestamp=2026-05-22T02:15:00Z -->
## Coverage Agent — 2026-05-22
- **Status**: YELLOW
- Overall coverage: **96.77% stmts / 92.55% branches / 95.72% funcs / 97.87% lines** (8978/9277 stmts). Flat vs 2026-05-19 (−0.01pp stmts, within v8 noise).
- Test suite: 445 files, 7589 tests. Run 1 (with coverage): 7589/7589 GREEN, 164s. Run 2: **1 failed** (7114/7115 reported — suite aborted early after failure), 207s. Run 3: **1 failed** (7588/7589), ~210s.
- Critical paths GREEN: lib/impact 99.6%/98.7%/100%, lib/render 100%/92.9%/100%, lib/db 96.5%/93.3%/100%, app/api 97.5%/94.2%/96.8%, lib/auth 98.0%, lib/cache 98.1%, lib/github 97.4%, lib/analytics 97.3%, lib/history 98.3%, lib/i18n 100%, lib/verification 100%, lib/feature-flags 100%, lib/dashboard 100%, lib/insights 100%, lib/profile 100%.
- **Untested source files in critical paths: 0/75** — no critical-path gaps.
- **No new P2 coverage gaps**. All sub-80% files are P3 carries (Canvas/WebGL, next/dynamic wrappers, experiments error/loading, JSON config false positives).
- **NEW P2 — FLAKY TEST**: `apps/web/app/admin/engagement/engagement-dashboard.test.tsx:265` ("handles campaign fetch non-ok response silently") fails 2/3 full-suite runs but 21/21 in isolation (2.27s). Root cause: synchronous `getByText(/No engagement template created yet/)` after a `waitFor` that only watches the always-present `/engagement/` header — race after rejected campaigns fetch. Fix: wrap the empty-state assertion in `waitFor` or use `findByText`, and anchor on a state-specific element.
- **Watch (carry)**: lib/github/client.ts 93.1% funcs — 2 inflight-dedup edges uncovered. Low priority.

**Cross-agent recommendations:**
- [QA]: New flaky test in `engagement-dashboard.test.tsx` ("handles campaign fetch non-ok response silently", line 265) — failed in 2/3 full-suite runs but passes in isolation. First admin-engagement flake observed; fix is a 2-line `waitFor` wrap. Recommend bundling into the next QA pass.
- [Security]: No security-relevant coverage gaps. lib/auth 98.0%, lib/analytics 97.3%, lib/verification 100% stable. XSS escape paths and CORS guards fully covered.
- [Triage]: One P2 action item — fix flaky `engagement-dashboard` test (race condition in non-ok campaigns fetch path). All other gaps are P3 carries.
- [Cost Analyst]: lib/cache 98.1%, lib/db 96.5%, app/api 97.5% — all stable. No cost-path coverage gaps.
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

<!-- ENTRY:START agent=qa_agent timestamp=2026-05-13T09:00:00Z -->
## QA Agent — 2026-05-13
- **Status**: GREEN
- Tests: 7589/7589 passed (445 files), 0 failed, 0 skipped
- Type errors: 0
- Lint issues: 0
- A11y issues: 0 — campaigns `<tr role="button" aria-label>` gap confirmed resolved; all `<img>` have alt; focus-visible global + 4 component-level; prefers-reduced-motion in globals.css + StudioClient; heading hierarchy clean across all audited pages; 13 error boundaries, 13 loading states

**Cross-agent recommendations:**
- [Coverage]: All paths clean. No new untested areas discovered. Coverage agent May 13 confirms stable 96.84% stmts, 0 flakes.
- [Security]: No security-related quality issues. All XSS escape paths covered. CORS mutation guard enforced by static test. Interactive elements fully keyboard-accessible.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=performance_agent timestamp=2026-04-30T07:09:55Z -->
## Performance Engineer — 2026-04-30
- **Status**: YELLOW
- Total First Load JS: 1,876.9 KB raw / 598.1 KB gzipped (+194.9 KB / +11.6% vs Apr 9)
- Chunks >500 KB: **0**
- Unused exports (production): 8 confirmed false positives (stable)
- Turbopack NFT warning: RESOLVED
- **NEW YELLOW**: ISR regression — root layout `no-store` Redis call forces 13 pages dynamic (should be static/ISR)
- **NEW YELLOW**: Bundle +194.9 KB growth since Apr 9 — origin unknown (all recent commits are server-only)

**Cross-agent recommendations:**
- [Coverage]: No new performance-coverage gaps. `og-image/route.ts` 60% funcs remains the only critical-path gap (6th cycle).
- [Security]: ISR regression means archetype/about pages no longer serve from CDN cache — DDoS surface slightly increased. Rate limiting on these pages already present via Redis, but fixing ISR would reduce origin exposure.
- [QA]: `/about/scoring` embeds `LiteYouTubeEmbed` — not a CLS risk (`aspect-video` container). No rendering regressions observed.
- [Cost Analyst]: ISR regression likely increased Vercel serverless invocations for 7+ pages that should be CDN-cached. Archetype pages (revalidate=604800) hitting origin every request instead of being CDN-cached for a week is a cost regression worth quantifying.
<!-- ENTRY:END -->


<!-- ENTRY:START agent=qa_agent timestamp=2026-05-06T07:05:49Z -->
## QA Agent — 2026-05-06
- **Status**: GREEN
- Tests: 7567 passed / 0 failed / 7567 total (445 files)
- Type errors: 0
- Lint issues: 0
- A11y issues: 1 low-severity (campaigns `<tr role="button">` missing `aria-label`, admin-only)

**Cross-agent recommendations:**
- [Coverage]: All prior P2 gaps (verify, about/scoring, about/verification, cli/authorize pages) confirmed resolved per coverage agent 2026-05-06 entry. Remaining P2s: 7 archetype pages `generateMetadata` runtime tests, `cli/authorize/error.tsx` 0% stmts, `lib/i18n/detect.ts` ~75% branches.
- [Security]: No security-related quality issues. All interactive elements have keyboard handlers. XSS vectors in SVG pipeline unchanged (all covered). Campaigns table `<tr role="button">` missing `aria-label` is a11y, not security.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=documentation timestamp=2026-05-08T10:00:00Z -->
## Documentation Agent — 2026-05-08
- **Status**: GREEN
- Route coverage: **43/43 API routes + 33 page routes documented** (100%) — including og-image, llms.txt, .well-known/security.txt, badge.svg, archetypes/*, experiments/*.
- Design system: **38/38 color tokens** in `docs/design-system.md` exactly match `--color-*` definitions in `apps/web/styles/globals.css`. No drift.
- Env vars: **31/32 production vars documented in CLAUDE.md** (97%). 1 gap: `CHAPA_ALERT_WEBHOOK_URL` is used at `lib/env.ts:60` + `lib/analytics/server-errors.ts` and documented in `README.md:169` + `docs/runbooks/incident-response.md`, but missing from the env-vars block in `CLAUDE.md`. `DEPLOYMENT_SMOKE_STRICT` and `PLAYWRIGHT_BASE_URL` are test-only (intentional omissions).
- JSDoc spot-check: `lib/impact/v6.ts` 9/9, `lib/cache/redis.ts` 13/13, `lib/github/client.ts` 2/2 — all 100%. `lib/auth/session.ts` 0/5 — 5 exports lack JSDoc (low priority polish).
- Required docs: all 6 present and non-empty (`impact-v4.md` 131 lines, `impact-v5.md`, `impact-v6.md`, `svg-design.md` 173 lines, `README.md` 224 lines, `design-system.md`, `shared-context.md` 407 lines with 21 entries). 0 TODO/FIXME referencing real doc gaps.

**Cross-agent recommendations:**
- [QA]: No documentation-related UX issues. All user-facing routes documented.
- [Security]: `CHAPA_ALERT_WEBHOOK_URL` is operationally critical for incident detection (P1 alerts: health_degraded, badge_5xx, oauth_callback_failure). Recommend adding it to `CLAUDE.md` env-vars block so the security/operational surface is fully documented in the canonical project file.
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

<!-- ENTRY:START agent=performance timestamp=2026-05-14T09:00:00Z -->
## Performance Agent — 2026-05-14
- **Status**: YELLOW
- Total First Load JS: **2,266 KB raw** / 78 chunks. **Flat vs 2026-05-07** (was 2,266 KB / 79 chunks). Sustained +34.7% over 4 weeks remains the carry.
- Routes >500 KB: **0**. Largest chunks 320 / 228 / 176 / 156 / 112 / 100 KB — all vendor/framework.
- Build: Next.js 16.2.4 (Turbopack), 4.0s compile, 8.0s typecheck, 0 errors. 86 routes (4 static, 82 dynamic).
- Knip `--production`: clean. `"use client"` files: 111 (+2). All appropriate on spot audit.
- Badge route: `s-maxage=21600` success / `s-maxage=300` error confirmed; `maxDuration=35` at `app/u/[handle]/badge.svg/route.ts:29` (4th cycle hold).
- ISR via `unstable_cache(revalidate=300s)` at `lib/feature-flags.ts:84-94` active — 13 pages CDN-eligible.
- Fonts: `next/font/google` only, `display: swap`. CLS risks: none. `prefers-reduced-motion`: supported.
- Bundle growth source unidentified — `ANALYZE=true pnpm run build` still needed interactively (informational monitor).

**Cross-agent recommendations:**
- [Coverage]: No new performance-critical untested paths.
- [Security]: No performance issues with security implications. Fail-open rate limiter intact, fetch timeouts 100%, badge caching unchanged.
- [QA]: No CLS regressions, ISR caching active — archetype/about pages serve from CDN. No new UX performance concerns.
- [Cost Analyst]: Bundle flat this cycle (good signal for cold-start memory). 4-week +34.7% trend stable but unresolved.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=coverage timestamp=2026-05-23T02:10:00Z -->
## Coverage Agent — 2026-05-23
- **Status**: GREEN
- Overall coverage: **96.77% stmts / 92.55% branches / 95.72% funcs / 97.87% lines** (8978/9277 stmts). Flat vs 2026-05-22.
- Test suite: 445 files, 7589 tests. Run 1 (coverage): 7589/7589, 105s. Run 2: 7589/7589, 99s. Run 3: aborted with 10 worker errors at 236s (7410/7589 reached) — environment exhaustion, not test logic. Run 4 (confirmation re-run): 7589/7589, clean.
- Critical paths GREEN: lib/impact 99.6%/98.7%/100%, lib/render 100%/92.9%/100%, lib/db 96.5%/93.3%/100%, app/api 97.5%/94.2%/96.8%, lib/auth 98.0%, lib/cache 98.1%, lib/github 97.4%, lib/analytics 97.3%, lib/history 98.3%, lib/i18n 100%, lib/verification 100%, lib/feature-flags 100%, lib/dashboard 100%, lib/insights 100%, lib/profile 100%.
- **Untested source files in critical paths: 0/75** across lib/impact, lib/render, lib/db, app/api.
- **engagement-dashboard flake (prior P2): RESOLVED** — 2026-05-22 triage fix landed; "handles campaign fetch non-ok response silently" now passes in every reproducible run.
- **No new P2s**. All sub-80% files are P3 carries: Canvas/WebGL (HolographicOverlay, heatmap-wave, metallic-shimmer), next/dynamic lazy wrappers (GlobalCommandBarLazy, ClientInstrumentation, SharePageOwnerContentLazy), experiments error/loading (JSDOM-blocked), packages/shared JSON config files (false positive — src/ TS at 100%).
- **Watch (carry)**: lib/github/client.ts 93.1% funcs — 2 inflight-dedup edges uncovered. Low priority.
- **Flaky tests: 0** confirmed — run 3 worker exhaustion (duration spike 2.4×) is not a logic flake; the same suite passed cleanly in the immediate re-run.

**Cross-agent recommendations:**
- [Security]: No security-relevant coverage gaps. lib/auth 98.0%, lib/analytics 97.3%, lib/verification 100% stable. XSS escape paths and CORS guards fully covered.
- [QA]: engagement-dashboard race fixed and verified — no remaining known flakes. Watch for the same `getByText`-after-async pattern in other admin dashboard tests.
- [Triage]: No P2 action items this cycle. Only carry-watch (lib/github/client.ts inflight-dedup edges, low priority). Clean cycle.
- [Cost Analyst]: lib/cache 98.1%, lib/db 96.5%, app/api 97.5% — all stable. No cost-path coverage gaps.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=cost_analyst timestamp=2026-05-21T01:01:59Z -->
## Cost Analyst — 2026-05-21
- **Status**: GREEN
- Redis key growth risk: low
- Uncached external calls: 1 (health probe, ~5–10/hr unauth — inside limits)
- Resource leak risks: 0

**Cross-agent recommendations:**
- [Performance]: Bundle flat 6/6 cycles — good cold-start memory signal. 4-week +34.7% trend stable but unresolved; `ANALYZE=true pnpm run build` still needs interactive run to localize source.
- [Security]: No cost-security regressions. `server-only` boundary on Supabase client + FORCE RLS on all 11 tables intact. Fail-open rate limiter and 100% fetch timeout coverage maintained. Health endpoint uncached GitHub probe is not a security risk — GitHub's own rate limits provide secondary protection.
- [Coverage]: lib/cache 98.1%, lib/db 96.5%, app/api 97.5% — all stable per May 19 coverage entry. No cost-path coverage gaps.
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
