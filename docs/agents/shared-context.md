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

<!-- ENTRY:START agent=documentation timestamp=2026-06-19T10:00:00Z -->
## Documentation Agent — 2026-06-19
- **Status**: GREEN
- Stale docs: 0 | Missing docs: 0 | Env var mismatches: 0
- Route coverage: **84 filesystem files (34 page.tsx + 50 route.ts) — 100% documented in CLAUDE.md**. No undocumented routes, no documented-but-missing routes. HEAD advanced `5ef06c09 → b6cb414d` since last cycle via dependency bumps, triage fixes, and agent report chores only — no route/API/env changes.
- Design system: **38/38 `--color-*` tokens** in `docs/design-system.md` match `apps/web/styles/globals.css` exactly. Zero drift, zero orphans.
- Env vars: **all 32 production vars documented** (100%). All app config flows through `lib/env.ts`. `ANALYZE` correctly absent from env.ts (consumed by next.config.ts). Zero undocumented vars, zero documented-but-unused vars.
- JSDoc: `lib/impact/v6.ts` 9/9, `lib/cache/redis.ts` 15/17 (gaps on `RateLimitResult` interface and `CacheSetNxStatus` type — self-explanatory, P3), `lib/db/campaigns.ts` 16/22 (gaps on 6 type/interface exports + CampaignRowSchema — all functions fully documented, P3), `lib/auth/session.ts` 7/7, `lib/github/client.ts` 2/2.
- Required docs all present/non-empty: `impact-v4.md` (131, deprecated), `impact-v5.md` (152), `impact-v6.md` (287, current truth), `svg-design.md` (173).
- TODO/FIXME doc-gap scan: 1 false positive (`lib/agents/agent-config.ts:8` = this prompt's own template text). No real gaps.

**Cross-agent recommendations:**
- [QA]: No documentation-related UX issues. All user-facing routes documented; no doc changes affect runtime behavior. 84 routes fully covered.
- [Security]: No security doc gaps. All `NEXT_PUBLIC_*` vars confirmed non-sensitive; `server-only` Supabase boundary and admin-auth routes documented in CLAUDE.md. No undocumented exports with security surface.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=cost-analyst timestamp=2026-06-25T03:00:00Z -->
## Cost Analyst — 2026-06-25
- **Status**: GREEN
- Estimated monthly cost at 10K users: **~$50–75/mo**. Unchanged.
- **Cost-surface diff since 2026-06-21 cycle**: first cost cycle on **v2.14.0** (HEAD `f9d30758`). Only change = share-page score-transparency panel (#932, `ScoreExplanationPanel.tsx` + `lib/dashboard/{score-explanation,dimension-sub-metrics}.ts`) + locale-aware static pages. Both pure compute over already-fetched `StatsData`/`DimensionScores` — verified imports only from `@chapa/shared` + `lib/impact` pure fns, **0 `fetch`/`cacheSet`/`cacheGet`/`supabase` calls**, no module-level state. Wired into owner-only `SharePageOwnerContent.tsx` (+7 lines). **Cost-neutral.**
- Redis: **24 non-test `cacheSet` sites, 23/24 explicit positive TTL**. 3 persistent TTL-0 singletons (fixed cardinality): `cron:warm-cache:offset` cursor (`warm-cache/route.ts:146`), `stats:badges_generated` INCR (`redis.ts:244`), `stats:unique_badges` HLL ~12KB (`redis.ts:245`). Two 365d overwrite keys: `config:<login>` (`studio/config/route.ts`), `badge:notified:<handle>` (`MARKER_TTL=31_536_000`, `notifications.ts:18`). `cacheSet` default 21600s w/ `ttlSeconds>0` guard (`redis.ts:75–76`); client `retry:{retries:0}` (`redis.ts:36`). Growth risk: LOW.
- Supabase: **10 base tables, ENABLE + FORCE RLS** (26 migrations, latest `026_seed_integration_flags.sql`). Lazy service-role singleton `supabase.ts:13–34`, `import "server-only"` :8, `persistSession:false`. No N+1 — `dbGetCampaignStats` 4 parallel `count:exact,head:true` COUNTs (`sends.ts:243,251`), zero row transfer; warm-cache cron batch-prefetches snapshots.
- External calls: **0 uncached**. GitHub badge/profile cache-first 6h + 7d SWR + in-flight dedup + Redis render lock; platform stats 6h pos / 1h neg; health probe `unstable_cache` 60s; feature-flags ISR s-maxage 60/SWR 300; Resend daily quota `cacheReserveQuota`; PostHog batched. Fetch-timeout coverage: **100%**.
- Vercel: badge `maxDuration=35`; crons + bulk-recalc `=300`. Badge success `s-maxage=21600/SWR=86400`, error `300/600`. ISR `force-static revalidate=3600` on archetypes/about/privacy/verify. Bundle flat ~1,950 KB raw / 623 KB gzipped.
- **P2-1 CARRIED** (threshold-gated): `dbGetCampaignStats` 4-query parallel COUNT; only matters >5K sends/campaign. **MONITOR M7/M8 CARRIED**: 365d overwrite keys, no accumulation.
- **P1s: NONE. P2s: 1 (P2-1, threshold-gated). P3s: 0.**

**Cross-agent recommendations:**
- [Performance]: Bundle flat ~1,950 KB raw / 623 KB gzipped. #932 score-transparency panel adds only client compute + dictionary keys — no new dynamic imports or vendor deps on public pages. M-bundle stays closed.
- [Security]: #932 panel reads no secrets and makes no external/DB calls; owner-gated render path unchanged. 10/10 FORCE RLS intact; `server-only` Supabase boundary holds. Fail-open rate limiter (accepted risk) + 100% fetch-timeout coverage maintained.
- [Coverage]: New `lib/dashboard/{score-explanation,dimension-sub-metrics}.ts` ship with sibling test files (`*.test.ts`, 158 + 120 lines per #932 diff). No cost-path coverage gaps.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=cost-analyst timestamp=2026-06-21T03:00:00Z -->
## Cost Analyst — 2026-06-21
- **Status**: GREEN
- Estimated monthly cost at 10K users: **~$50–75/mo**. Unchanged.
- **Cost-surface diff since 2026-06-20 cycle**: HEAD `226e5528 → f83d346f` via 4 commits — progressive-disclosure (UI-only `CommandBarHint`, zero cost), platform-fetcher refactor `924f6f1a` (unified `fetchLinkedPlatformStats` in `lib/platform/fetch-linked-platform.ts`, cost-neutral consolidation), NEXT_PUBLIC env fix (build-time only), back-merge chore. All prior claims re-verified in source this cycle.
- **Platform fetcher refactor (#744)**: `lib/platform/fetch-linked-platform.ts` is the new shared skeleton for bitbucket/codeberg/gitlab fetch stacks. Pos cache 6h (`CACHE_TTL=21600`, `:86`), neg-cache 1h (`NEG_CACHE_TTL=3600`, `:13`). `cacheSet` calls at `:96,102,112`. Zero new call sites — same 24 non-test total. No module-level state; no leak surface. **Cost-neutral.**
- Redis: **24 non-test `cacheSet` sites, 23/24 explicit positive TTL**. 3 persistent TTL-0 singletons (fixed cardinality): `cron:warm-cache:offset` cursor, `stats:badges_generated` INCR, `stats:unique_badges` HLL ~12KB. Two 365d overwrite keys: `config:<login>` (`studio/config/route.ts:73`), `badge:notified:<handle>` (`notifications.ts:18`). `cacheSet` default 21600s w/ `ttlSeconds>0` guard (`redis.ts:75–76`). Growth risk: LOW.
- Supabase: **10 base tables, 10/10 ENABLE + 10/10 FORCE RLS**; 26 migrations. Lazy singleton `supabase.ts:13–34`, `import "server-only"` :8, `persistSession:false`. No N+1 (warm-cache cron batches with `dbGetLatestSnapshotBatch`). `_enrichWithLogins` bounded to 3 DB reads max per enrichment path.
- External calls: **0 uncached**. GitHub badge/profile 6h + 7d SWR + in-flight dedup + Redis lock; platforms 6h + 1h neg; health probe `unstable_cache` 60s; Resend daily quota `cacheReserveQuota`; PostHog batched. Fetch-timeout coverage: **100%**.
- Vercel: badge `maxDuration=35`; crons + bulk-recalc `=300`. Badge success `s-maxage=21600/SWR=86400`, error `300/600`. ISR `force-static revalidate=3600` on archetypes/about/privacy/verify. Bundle 1,950 KB raw / 623 KB gzipped (flat, 3rd consecutive cycle).
- **P2-1 CARRIED**: `dbGetCampaignStats` 4-query parallel COUNT (`campaigns/sends.ts:251`); threshold-gated. **MONITOR M7/M8 CARRIED**: 365d overwrite keys, no accumulation.
- **P1s: NONE. P2s: 1 (P2-1, threshold-gated). P3s: 0.**

**Cross-agent recommendations:**
- [Performance]: Bundle flat 3 consecutive cycles at 1,950 KB raw / 623 KB gzipped. Progressive-disclosure adds only `CommandBarHint.tsx` (~80 lines), no new dynamic imports or vendor deps. M-bundle stays closed.
- [Security]: Platform-fetcher refactor moves neg-cache logic from 3 client files into `fetch-linked-platform.ts` — same behavior, same TTLs, no new surface. 10/10 FORCE RLS intact. 100% fetch-timeout coverage maintained.
- [Coverage]: No cost-path coverage gaps. `lib/platform/fetch-linked-platform.ts` covered by 143-line test file (`fetch-linked-platform.test.ts`) per `924f6f1a` diff.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=cost-analyst timestamp=2026-06-20T03:00:00Z -->
## Cost Analyst — 2026-06-20
- **Status**: GREEN
- Estimated monthly cost at 10K users: **~$50–75/mo**. Unchanged.
- **Cost-surface diff since 2026-06-19 cycle**: REAL change — first cost cycle on **v2.11.0** (`b4f4130a`). HEAD `b6cb414d → 226e5528` via GitLab integration + 60-finding pre-launch remediation + landing-nav E2E fix. Re-audited from source, not carried.
- **GitLab integration (NEW)**: `lib/gitlab/client.ts` reuses the Bitbucket/Codeberg shape — cache-first (`stats:v2:gitlab:<handle>`, 6h TTL `client.ts:14`), returns early on `cacheGet` hit before any live call, short-circuits when OAuth creds unset (`client.ts:50`). Auth/query fetchers all carry `AbortSignal.timeout` (`auth/gitlab.ts:149,189,222`; `gitlab/queries.ts` 8 signal refs). 0 new uncached external calls.
- Redis: **24 non-test `cacheSet` sites, 23/24 explicit positive TTL**. 3 persistent TTL-0 singletons only (all fixed cardinality): `cron:warm-cache:offset` cursor (`warm-cache/route.ts:146`), `stats:badges_generated` INCR (`redis.ts:259`), `stats:unique_badges` HLL ~12KB (`redis.ts:260`). Two 365d overwrite keys: `config:<login>` (`studio/config/route.ts:73`), `badge:notified:<handle>` (`notifications.ts:18`). `cacheSet` default 21600s w/ `ttlSeconds>0` guard (`redis.ts:75–76`); client `retry:{retries:0}` (`redis.ts:36`). Growth risk: LOW.
- Supabase: **10 base tables, 10/10 ENABLE + 10/10 FORCE RLS**; **26 migrations**, latest `026_seed_integration_flags.sql` (seeds bitbucket/codeberg/gitlab_integration flag rows via `ON CONFLICT DO NOTHING` — kills per-request null-row log + env fallback, small DB-read win). Lazy singleton service-role client `supabase.ts:13–34`, `import "server-only"` line 8, `persistSession:false`. No N+1 in `lib/db/` (loops at `parse-row.ts:35`/`snapshots.ts:353` iterate in-memory rows).
- External calls: **0 uncached**. GitHub badge/profile cache-first (6h + 7d SWR) + in-flight dedup + Redis lock; GitLab/BB/CB 6h; health GitHub probe `unstable_cache` 60s; feature-flags ISR s-maxage 60/SWR 300; Resend event-driven + daily quota (`cacheReserveQuota`); PostHog batched. Fetch-timeout coverage: **100%** of outbound server fetches.
- Vercel: badge `maxDuration=35`; crons + bulk-recalc `=300` (batch jobs). Badge success `s-maxage=21600/SWR=86400`, error `300/600`. ISR `force-static revalidate=3600` on archetypes/about/privacy/verify. Bundle 1,950 KB raw / 623 KB gzipped (flat).
- **P2-1 CARRIED**: `getCampaignStats` 4-query parallel COUNT `head:true` (`campaigns/sends.ts:243,251`); zero row transfer, only matters >5K sends/campaign. **MONITOR M7/M8 CARRIED**: 365d overwrite keys, no accumulation.
- **NEW P3 (optional)**: GitLab (and BB/CB) clients don't cache the "not-linked/disabled" negative result → each cache-miss for a non-linked user = 1 flag read + 1 `dbGetLinkedPlatform`. Bounded by the 6h badge cache; a 1h negative short-cache could trim DB reads if platform adoption grows. Not cost-material today.
- **P1s: NONE. P2s: 1 (P2-1, threshold-gated). P3s: 1 (new, optional).**

**Cross-agent recommendations:**
- [Performance]: Bundle flat at 1,950 KB raw / 623 KB gzipped. GitLab integration adds no client bundle weight to public pages and no cold-start memory regression. M-bundle stays closed.
- [Security]: GitLab OAuth client follows the same token-refresh + RLS-backed `user_platforms` pattern; migration 026 only seeds flag rows (no new table, no RLS gap). 10/10 FORCE RLS intact. Fail-open rate limiter (accepted risk) + 100% fetch-timeout coverage maintained.
- [Coverage]: lib/cache 98.1%, lib/db 96.5%, app/api 97.4% per coverage 2026-06-20. No cost-path coverage gaps; GitLab client paths covered in the 7875-test suite.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=triage timestamp=2026-06-25T05:05:00Z -->
## Triage -- 2026-06-25
- **Reports processed**: 6 (qa GREEN, pre-launch COMPLETE, remediation COMPLETE, cc-rpi-update GREEN no-op, cost-analyst GREEN, update-docs COMPLETE)
- **Action items resolved**: 1 — pinned `--maxWorkers=3` in QA + coverage agent prompts (`agent-config.ts`) to prevent false-red runs under heavy host load. 8002/8002 tests, typecheck + lint clean.
- **GitHub alerts**: Code scanning + secret scanning both require GitHub Advanced Security (GHAS) — not available on this repo's tier (confirmed via Settings UI). Both accepted as permanent limitations. Gitleaks + pnpm audit + license compliance in CI are compensating controls. No Dependabot security alerts.
- **Dependabot**: PR #924 (actions/checkout 6→7, major) deferred — commented with explanation.
- **Summary**: Light housekeeping cycle. All reports GREEN/COMPLETE. CodeQL scanning activated; agent vitest worker cap applied.

**Cross-agent recommendations:**
- [QA]: vitest runs in agent prompts now capped at `--maxWorkers=3` — false-red runs under heavy host load should stop.
- [Security]: Code scanning (CodeQL) + secret scanning both require GHAS — not available on this tier (confirmed). Gitleaks + pnpm audit + license compliance in CI are compensating controls. No action needed unless upgrading to GHAS.
- [Coverage]: Suite grew from 7986 → 8002 (+16 tests, from #932 score-transparency panel). All critical-path modules remain ≥96% stmts.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=triage timestamp=2026-06-24T07:50:00Z -->
## Triage -- 2026-06-24
- **Reports processed**: 7 (coverage GREEN, security GREEN, cc-rpi-update GREEN, pre-launch INFO, remediation COMPLETE, update-docs COMPLETE, cost-analyst FAILED — auth expired)
- **Action items resolved**: 3 — (1) `SharePageH2.test.tsx` added (33.3% → 100% coverage); (2) `import "server-only"` added to 7 auth/verification files; (3) 9 knip false-positive deps added to `ignoreDependencies` in `knip.json`. 7977/7977 tests, typecheck + lint clean, CI green.
- **Dependabot**: 3 open PRs — #926 (dev-and-types group) + #925 (production group) auto-merged; #924 (actions/checkout 6→7, major) deferred.
- **Agent failure**: cost-analyst Jun 24 run failed with "Not logged in" — auth token expired overnight. Jun 21 shared-context entry (GREEN) remains valid. No code action needed.
- **Summary**: Clean P3 triage cycle. Security posture and coverage both strengthened with defense-in-depth guards and knip noise elimination.

**Cross-agent recommendations:**
- [Cost Analyst]: Jun 24 run failed (CLI auth). Re-run with fresh auth. Jun 21 GREEN assessment still valid; no cost-surface changes since then.
- [Coverage]: Suite at 7977 (+1 test). SharePageH2 at 100%. All critical-path modules remain ≥96% stmts.
- [Security]: `server-only` guards now in place on all 7 auth/verification modules. Knip false positives eliminated — future `knip --production` runs should be clean with 0 findings.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=triage timestamp=2026-06-24T07:50:00Z -->
## Triage -- 2026-06-24
- **Reports processed**: 7 (coverage GREEN, security GREEN, cc-rpi-update GREEN, pre-launch INFO, remediation COMPLETE, update-docs COMPLETE, cost-analyst FAILED — auth expired)
- **Action items resolved**: 3 — (1) `SharePageH2.test.tsx` added (33.3% → 100% coverage); (2) `import "server-only"` added to 7 auth/verification files; (3) 9 knip false-positive deps added to `ignoreDependencies` in `knip.json`. 7977/7977 tests, typecheck + lint clean, CI green.
- **Dependabot**: 3 open PRs — #926 (dev-and-types group) + #925 (production group) auto-merged; #924 (actions/checkout 6→7, major) deferred.
- **Agent failure**: cost-analyst Jun 24 run failed with "Not logged in" — auth token expired overnight. Jun 21 shared-context entry (GREEN) remains valid. No code action needed.
- **Summary**: Clean P3 triage cycle. Security posture and coverage both strengthened with defense-in-depth guards and knip noise elimination.

**Cross-agent recommendations:**
- [Cost Analyst]: Jun 24 run failed (CLI auth). Re-run with fresh auth. Jun 21 GREEN assessment still valid; no cost-surface changes since then.
- [Coverage]: Suite at 7977 (+1 test). SharePageH2 at 100%. All critical-path modules remain ≥96% stmts.
- [Security]: `server-only` guards now in place on all 7 auth/verification modules. Knip false positives eliminated — future `knip --production` runs should be clean with 0 findings.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=triage timestamp=2026-06-21T06:55:24Z -->
## Triage -- 2026-06-21
- **Reports processed**: 4 (cc-rpi-update GREEN, cost-analyst GREEN, coverage GREEN, prior triage GREEN)
- **Action items resolved**: 0 -- no implementation required. Cost posture remains flat, critical-path coverage remains above threshold, cc-rpi is already synced, and no Dependabot PRs or recent agent failures were found.
- **Dependabot**: 0 open PRs.
- **Summary**: Clean GREEN no-op triage cycle. Local verification passed: 7,944/7,944 tests, typecheck clean, lint clean.

**Cross-agent recommendations:**
- [Cost Analyst]: Continue carrying P2-1 as monitor-only until campaign volume exceeds ~5K sends/campaign. M7/M8 365d overwrite keys remain monitor-only.
- [Coverage]: No action needed. `lib/impact/` remains strong at 99.6% statements / 98.7% branches / 100% functions per the latest coverage report.
- [QA]: No flaky tests reported this cycle; local test run passed 7,944/7,944 with only known Node localStorage warning noise.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=triage timestamp=2026-06-20T06:48:00Z -->
## Triage — 2026-06-20
- **Reports processed**: 6 (cc-rpi-update GREEN, cost-analyst GREEN, coverage GREEN, documentation GREEN, pre-launch NOT READY → remediated, remediation COMPLETE)
- **Action items resolved**: 4 — (1) JSDoc on 7 exports in `lib/db/campaigns/types.ts`; (2) JSDoc on `RateLimitResult` + `CacheSetNxStatus` in `lib/cache/redis.ts`; (3) 1h negative-result cache in `lib/gitlab/client.ts`, `lib/bitbucket/client.ts`, `lib/codeberg/client.ts` (9 new tests); (4) `develop` branch protection updated to match `main` (all 6 required checks + strict=true). `main` branch protection was already corrected (DO-B1/M3/M4 done in prior session).
- **Dependabot**: 0 open PRs.
- **Summary**: All P3 items from documentation + cost-analyst reports implemented. 7,884/7,884 tests, typecheck + lint clean.

**Cross-agent recommendations:**
- [Coverage]: Suite grew to 7,884 (was 7,875). Negative-result caching in platform clients now covered by 9 new tests. All critical paths remain GREEN.
- [Cost Analyst]: Platform clients (GitLab/Bitbucket/Codeberg) now cache "not linked/disabled" negative results for 1h under `stats:v2:<platform>:<handle>:neg`. DB reads for non-linked users on each badge computation cycle are eliminated. Monitor M7/M8 (365d keys) unchanged.
- [Security]: Develop branch now fully protected matching main: all 6 check contexts, strict=true, enforce_admins=false. Branch protection gap DO-H1 closed.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=triage timestamp=2026-06-19T05:56:54Z -->
## Triage -- 2026-06-19
- **Reports processed**: 5 (cost-analyst GREEN, performance GREEN, coverage GREEN, cc-rpi-update GREEN, qa GREEN)
- **Action items resolved**: 1 -- updated `knip.json` to the knip v6 schema and ignored test files for production unused-file detection, clearing the performance P3 presentation noise.
- **Dependabot**: 0 open PRs.
- **Summary**: Clean GREEN triage cycle. `pnpm dlx knip --production` clean; 7,594/7,594 tests, typecheck clean, lint clean before and after `codex-simplify`.

**Cross-agent recommendations:**
- [Performance]: `knip.json` now matches knip v6 and no longer reports the test suite as production unused files. Keep bundle monitoring flat at 1,950 KB raw / 623 KB gzipped.
- [Coverage]: No coverage changes. All critical paths remain GREEN and the full suite passed twice locally.
- [QA]: Expected JSDOM/navigation and agent-fixture console noise remained non-failing; no accessibility or design-system follow-up needed.
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

<!-- ENTRY:START agent=qa timestamp=2026-06-24T09:00:00Z -->
## QA Agent — 2026-06-24
- **Status**: GREEN
- Tests: 7986/7986 passed across 464 files, 0 failed, 0 skipped
- Type errors: 0
- Lint issues: 0
- A11y issues: 0 — all `<img>` tags have alt; focus-visible global (`globals.css:455`) + 5 production components; campaigns `<tr role="button">` aria-label gap from May 6 now resolved (`campaigns-dashboard.tsx:908`); heading hierarchy correct across all sampled pages; 13 error boundaries + 13 loading states
- Design system: 0 violations. Accepted exceptions unchanged: global-error.tsx, apple-icon.tsx, icon.tsx (static assets), experiments/** (Canvas/WebGL).

**Cross-agent recommendations:**
- [Coverage]: `SharePageH2.test.tsx` exists and covers the i18n H2 wrapper. All critical paths remain ≥96% stmts.
- [Security]: No security-related quality issues. All XSS vectors covered. No hardcoded secrets in production JSX. All interactive elements accessible.
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

<!-- ENTRY:START agent=security timestamp=2026-06-22T00:00:00Z -->
## Security Scanner — 2026-06-22
- **Status**: GREEN
- Vulnerabilities: 0 critical / 0 high / 0 moderate / 0 low (pnpm audit clean; all prior overrides effective)
- Secret leaks: none (no NEXT_PUBLIC_* carries server secrets; no hardcoded keys in production source)
- License issues: none (no GPL/AGPL; MPL-2.0 + LGPL-3.0 documented in accepted-risks.md)
- RLS: 10/10 ENABLE + FORCE RLS on all Supabase tables
- CORS: wildcard scoped to 2 read-only rate-limited GETs only; mutation guard test in place
- XSS: all 7 SVG user-input fields escaped via escapeXml(); timing-safe HMAC comparisons throughout
- Knip --production: 9 false positives (all deps in active use via next/dynamic); 0 real unused deps
- One INFO finding: `server-only` guard missing on 7 auth/verification files (defense-in-depth only, no current exposure)

**Cross-agent recommendations:**
- [Coverage]: No security-critical coverage gaps. lib/auth 97.4%, lib/verification 100%, all XSS paths exercised.
- [QA]: No security UX issues. CORS wildcard scoped; mutation guard invariant test active.
- [Triage]: P3 only — add `server-only` to 7 auth/verification files and add knip ignoreDependencies entries. No P1/P2 action required.
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

<!-- ENTRY:START agent=performance timestamp=2026-06-18T09:00:00Z -->
## Performance Agent — 2026-06-18
- **Status**: GREEN
- Total First Load JS: **1,950 KB raw / 623 KB gzipped** (77 chunks). **+0.7 KB raw / +0.04% vs 2026-06-11** — flat. HEAD `63b18ac1` (CI-only change, pnpm/action-setup@v4→@v5); no app-code change. M-bundle monitor stays closed (11th consecutive flat cycle).
- Routes >500 KB: **0**. Largest chunks 228 / 192 / 156 / 112 / 108 KB raw — all framework/vendor, none >300 KB.
- Build: Next 16.2.9 Turbopack, 4.4s compile, 8.7s typecheck, 0 errors. 89 routes (4 static, 85 dynamic), 48 static pages. Per-route First Load JS omitted by Turbopack.
- Knip `--production`: no unused dependencies or actionable bundle bloat. 440 "unused files" = all test files (false positive with knip v6.17.1 + v5 schema ref in knip.json); 91 exports + 21 types = private helpers and DX types (same pattern, all P3 carries). **Low-priority**: update `knip.json "$schema"` to v6.
- `"use client"` (non-test, anchored): **105**. Key public pages (`/`, `/about`, `/u/[handle]`, archetypes) confirmed server components. 17 `next/dynamic` / `import()` usages covering PostHog, GlobalCommandBar, SharePageOwnerContent, admin sub-dashboards, Studio effects, canvas-confetti.
- Badge route: `maxDuration=35` (8th cycle hold); success `s-maxage=21600 / SWR=86400`, error `s-maxage=300 / SWR=600`; in-flight dedup + Redis lock. Feature-flags ISR `unstable_cache(300)` active; `/api/health` GitHub probe cached 60s; 0 uncached external calls.
- Fonts: `next/font/google` (JetBrains Mono + Plus Jakarta Sans), `display: swap`, 0 external font requests. CLS risks: none — badge fallback `<img>` has explicit 1200×630 + skeleton; LiteYouTubeEmbed uses `h-full w-full` in fixed container. `prefers-reduced-motion` respected.

**Cross-agent recommendations:**
- [Coverage]: No new performance-critical untested paths. Bundle flat; no new routes added.
- [Security]: No performance issues with security implications. Badge in-flight dedup + rate limit unchanged; fail-open Redis rate limiter intact; fetch timeouts 100%.
- [QA]: No CLS regressions; bundle flat — no TTI/LCP change. ISR caching active on archetype/about pages.
- [Cost Analyst]: Bundle flat at 1,950 KB raw / 623 KB gzipped — no cold-start memory regression. M-bundle stays closed. `ANALYZE=true` run not urgent.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=performance timestamp=2026-06-25T09:00:00Z -->
## Performance Agent — 2026-06-25
- **Status**: GREEN
- Total First Load JS: **2,074 KB raw / 657 KB gzipped** (77 chunks). **+124 KB raw (+6.4%) / +34 KB gzipped (+5.5%) vs 2026-06-18** — first non-flat cycle in 12 cycles. Growth fully attributed to feat(score): add score challenge flow (#933, 887 insertions: `ChallengeForm.tsx` 173 lines, `lib/email/challenge.ts` 101 lines, i18n keys). `ChallengeForm` → `ScoreExplanationPanel` → `SharePageOwnerContent` → **`next/dynamic` in `SharePageOwnerContentLazy`** — correctly code-split, visitor First Load JS unaffected.
- Routes >500 KB: **0**. Routes >350 KB: **0**. Largest chunks 228 / 192 / 110 / 107 / 88 KB raw — all framework/vendor, none >300 KB.
- Build: Next 16.2.9 Turbopack, 6.8s compile, 10.0s TypeScript, 0 errors. 89 routes (5 static, 84 dynamic), 48 static pages. Per-route First Load JS omitted by Turbopack — sized from `.next/static/chunks`.
- Knip `--production`: **1 finding** — `vitest.setup.ts` (false positive, test infrastructure). 0 real unused production exports.
- `"use client"` (non-test): **113**. Key public pages (`/`, `/about`, `/u/[handle]`, archetypes) confirmed server components. 22 `next/dynamic`/`import()` usages.
- Badge route: `maxDuration=35`; success `s-maxage=21600 / SWR=86400`, error `s-maxage=300 / SWR=600`; in-flight dedup + Redis lock. 0 uncached external calls.
- Fonts: `next/font/google` (JetBrains Mono + Plus Jakarta Sans), `display: swap`, 0 external font requests. CLS: badge fallback `<img>` has explicit `width=1200 height=630` ✓; `LiteYouTubeEmbed` thumbnail `<img>` in fixed container, no explicit attrs (P3). `prefers-reduced-motion` respected.
- New route `/api/challenge` (#933) not yet in CLAUDE.md route table (P3 doc gap for documentation agent).

**Cross-agent recommendations:**
- [Coverage]: `ChallengeForm.tsx` (173 lines) and `lib/email/challenge.ts` (101 lines) ship with sibling test files per #933 diff — no coverage gap from bundle growth.
- [Security]: `/api/challenge` new route is server-side only, no client bundle contribution. Verify rate-limiting and auth guard are in place.
- [QA]: No CLS regressions. Bundle growth is in owner-only lazy chunk; no TTI/LCP impact on visitor pages.
- [Cost Analyst]: Bundle grew to 2,074 KB raw / 657 KB gzipped (+124 KB). Growth in lazy-loaded chunk only — no cold-start memory regression on public pages. If next cycle exceeds 2,300 KB raw, trigger `ANALYZE=true` run.
- [Documentation]: `/api/challenge` route added by #933 is missing from CLAUDE.md route table. Add in next doc cycle.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=coverage timestamp=2026-06-24T03:15:00Z -->
## Coverage Agent — 2026-06-24
- **Status**: GREEN
- Overall coverage: **96.32% stmts / 92.06% branches / 95.32% funcs / 97.53% lines** on HEAD `be655b39`. Test suite **463 files / 7976 tests**, all passing on the clean run. Flat vs 2026-06-20 (v8 noise).
- Critical paths all GREEN, **no critical file <80% stmts**: lib/impact 99.6% (98.7% br / 100% fn), lib/render 99.6% (92.3% br / 100% fn), app/api 97.4% (93.9% br / 96.7% fn), lib/db 96.5% (93.3% br / 100% fn). Also lib/cache 98.1%, lib/auth 97.3%, lib/github 97.1%, components 96.4%.
- **Untested-without-sibling files in critical paths: 7** — `api/auth/{gitlab,codeberg,bitbucket}/config.ts` (100% transitive), `lib/db/campaigns/{crud 99.1%, sends 98.6%, index 100%, types 88.7%}`. No real gaps.
- **Resolved coverage note**: `app/u/[handle]/SharePageH2.tsx` now has `SharePageH2.test.tsx`; the prior 33.3% optional gap is closed. Other sub-80 files unchanged P3 carries (experiments error/loading 0% JSDOM-nav, HolographicOverlay 50%, Canvas/WebGL experiment pages 70–77%, next/dynamic lazy wrappers 60–66.7%, packages/shared config/JSON 0% false positive).
- **Flaky check (3 runs)**: NO test-level flakiness. Runs 1 & 2 at default parallelism failed *different* sets (run1: scripts/agent-utils + generate-badge-reference + NavLink worker-startup; run2: experiments pages + SharePageOwnerContent + scripts) — all `Timeout waiting for worker to respond`. Run 3 with `--maxWorkers=3` = **7976/7976 pass, 0 fail**. Root cause: host load avg **120–260 on 12 CPUs** (71 sessions) → vitest fork worker-pool exhaustion. Same environmental pattern QA flagged 2026-05-22/23/24/27.
- Report at `docs/agents/coverage-report.md`.

**Cross-agent recommendations:**
- [Security]: No security-relevant coverage gaps. lib/auth 97.3%, all SVG user-input escape paths in lib/render (99.6%) and CORS/verification guards exercised.
- [QA]: 0 test-level flaky tests. Earlier "failures" are environmental worker-pool exhaustion under load 120+, not code — constrained `--maxWorkers=3` run is fully green. Recommend pinning agent vitest runs to `--maxWorkers=3` on shared hosts to stop colliding jobs from producing false reds.
- [Triage]: Prior optional `SharePageH2.test.tsx` action is resolved. No P2 action items; coverage clean and flat.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=coverage timestamp=2026-06-24T03:15:00Z -->
## Coverage Agent — 2026-06-24
- **Status**: GREEN
- Overall coverage: **96.32% stmts / 92.06% branches / 95.32% funcs / 97.53% lines** on HEAD `be655b39`. Test suite **463 files / 7976 tests**, all passing on the clean run. Flat vs 2026-06-20 (v8 noise).
- Critical paths all GREEN, **no critical file <80% stmts**: lib/impact 99.6% (98.7% br / 100% fn), lib/render 99.6% (92.3% br / 100% fn), app/api 97.4% (93.9% br / 96.7% fn), lib/db 96.5% (93.3% br / 100% fn). Also lib/cache 98.1%, lib/auth 97.3%, lib/github 97.1%, components 96.4%.
- **Untested-without-sibling files in critical paths: 7** — `api/auth/{gitlab,codeberg,bitbucket}/config.ts` (100% transitive), `lib/db/campaigns/{crud 99.1%, sends 98.6%, index 100%, types 88.7%}`. No real gaps.
- **Resolved coverage note**: `app/u/[handle]/SharePageH2.tsx` now has `SharePageH2.test.tsx`; the prior 33.3% optional gap is closed. Other sub-80 files unchanged P3 carries (experiments error/loading 0% JSDOM-nav, HolographicOverlay 50%, Canvas/WebGL experiment pages 70–77%, next/dynamic lazy wrappers 60–66.7%, packages/shared config/JSON 0% false positive).
- **Flaky check (3 runs)**: NO test-level flakiness. Runs 1 & 2 at default parallelism failed *different* sets (run1: scripts/agent-utils + generate-badge-reference + NavLink worker-startup; run2: experiments pages + SharePageOwnerContent + scripts) — all `Timeout waiting for worker to respond`. Run 3 with `--maxWorkers=3` = **7976/7976 pass, 0 fail**. Root cause: host load avg **120–260 on 12 CPUs** (71 sessions) → vitest fork worker-pool exhaustion. Same environmental pattern QA flagged 2026-05-22/23/24/27.
- Report at `docs/agents/coverage-report.md`.

**Cross-agent recommendations:**
- [Security]: No security-relevant coverage gaps. lib/auth 97.3%, all SVG user-input escape paths in lib/render (99.6%) and CORS/verification guards exercised.
- [QA]: 0 test-level flaky tests. Earlier "failures" are environmental worker-pool exhaustion under load 120+, not code — constrained `--maxWorkers=3` run is fully green. Recommend pinning agent vitest runs to `--maxWorkers=3` on shared hosts to stop colliding jobs from producing false reds.
- [Triage]: Prior optional `SharePageH2.test.tsx` action is resolved. No P2 action items; coverage clean and flat.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=coverage timestamp=2026-06-20T02:05:00Z -->
## Coverage Agent — 2026-06-20
- **Status**: GREEN
- Overall coverage: **96.49% stmts / 92.0% branches / 95.03% funcs / 97.62% lines** (9331/9670 stmts). Test suite grew to 456 files / **7875 tests** (was 445/7594 on 2026-06-19) — net new tests, no regressions.
- Flaky check: **3 consecutive full-suite runs identical — 7875/7875 × 456/456 files each. 0 flaky tests.** `[ERROR] test-agent` + `Not implemented: navigation to another Document` lines are non-failing fixture/JSDOM console noise.
- Critical paths all GREEN, **no critical file <80% stmts**: lib/impact 99.6% (98.7% br / 100% fn), lib/render 99.6% (91.9% br / 100% fn), app/api 97.4% (93.9% br / 96.7% fn), lib/db 96.5% (93.3% br / 100% fn). Also lib/cache 98.1%, lib/auth 97.4%, lib/github 97.0%.
- **Untested source files in critical paths: 7** — `api/auth/{gitlab,codeberg,bitbucket}/config.ts` (100% transitive), `lib/db/campaigns/{crud,sends,index,types}.ts` (88.7–100% transitive). No real gaps.
- Sub-80% files (P3 carries, unchanged): experiments error/loading 0% (JSDOM nav limitation, flag-gated), HolographicOverlay 50%, heatmap-wave 73.3%, metallic-shimmer 77.4% (Canvas/WebGL), lazy wrappers (ClientInstrumentation 60%, GlobalCommandBarLazy 60%, SharePageOwnerContentLazy 66.7%), packages/shared JSON/config 0% (false positive — src/ TS 100%).
- Report at `docs/agents/coverage-report.md`.

**Cross-agent recommendations:**
- [Security]: No security-relevant coverage gaps. lib/auth 97.4%, lib/verification/escape paths and CORS guards covered. All SVG user-input escape paths in lib/render exercised.
- [QA]: 0 flaky tests across 3 clean full-suite runs (7875/7875 each, identical). Suite grew by ~281 tests since 2026-06-19 with no flakiness introduced.
- [Triage]: No P2 action items. Coverage clean and flat. Optional polish only: studio/config edge branches and lib/render branch paths (91.9% br) are the lowest critical-path branch numbers.
- [Cost Analyst]: lib/cache 98.1%, lib/db 96.5%, app/api 97.4% — all stable. No cost-path coverage gaps.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=coverage timestamp=2026-06-19T02:14:00Z -->
## Coverage Agent — 2026-06-19
- **Status**: GREEN
- Overall coverage: **96.78% stmts / 92.65% branches / 95.77% funcs / 97.89% lines** (8980/9278 stmts). Flat vs 2026-06-18 (v8 noise ≤0.02pp). HEAD `b6cb414d` — agent report chore; no app-code change. 34th consecutive carry/audit cycle.
- Test suite: 445 files, **7594 tests**. 3 full consecutive runs, all identical: 7594/7594 × 445 files. **0 flaky tests.** ~24s each, no worker-pool contention.
- Critical paths GREEN, **no files <80% stmts**: lib/impact 99.6% (98.0% br / 100% fn), lib/render 100% (90.3% br / 100% fn), app/api 98.6% (96.9% br / 99.3% fn; lowest `/api/studio/config` 92.3% st / 85.7% br), lib/db 97.1% (93.4% br / 100% fn). Also lib/cache 99.5%, lib/auth 98.7%, lib/github 97.8%, lib/analytics 98.5%, lib/history 99.1%, lib/email 98.1%, lib/verification 100%, lib/i18n 100%, components 96.0%, packages/shared/src 100%.
- **Untested source files in critical paths: 4** — `lib/render/{BadgeBranding,BadgeSvg}.tsx` + `api/auth/{bitbucket,codeberg}/config.ts` lack direct `.test.ts` but all 4 confirmed at **100% stmts** via transitive coverage. No real gaps.
- **No new P2s**. Sub-80% files (10) all P3 carries: experiments error/loading 0% (JSDOM limitation, flag-gated), HolographicOverlay 50%, heatmap-wave 73.3%, metallic-shimmer 77.4% (Canvas/WebGL), lazy wrappers (ClientInstrumentation 60%, GlobalCommandBarLazy 60%, SharePageOwnerContentLazy 66.7%), packages/shared JSON config 0% (false positive — src/ TS 100%).
- **Branch-gap monitors (stmts ≥80%, branches <80%)**: AuthorTypewriter 67.5% br (visual-only, P3), lang-sync 50% br (100% stmts), archetypeDemoData/demoData 50% br (data-only objects, v8 ternary false positives). All acceptable P3.
- Report at `docs/agents/coverage-report.md`.

**Cross-agent recommendations:**
- [Security]: No security-relevant coverage gaps. lib/auth 98.7%, lib/analytics 98.5%, lib/verification 100% — XSS escape paths and CORS guards fully covered.
- [QA]: 0 flaky tests across 3 clean full-suite runs (7594/7594 each, identical), no worker-pool contention this cycle.
- [Triage]: No P2 action items. Coverage clean and flat. Optional polish only: studio/config edge branches (85.7% br), AuthorTypewriter branch paths (67.5% br).
- [Cost Analyst]: lib/cache 99.5%, lib/db 97.1%, app/api 98.6% — all stable. No cost-path coverage gaps.
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

<!-- ENTRY:START agent=security timestamp=2026-06-15T09:00:00Z -->
## Security Scanner — 2026-06-15
- **Status**: YELLOW
- Vulnerabilities: **0 critical / 1 high / 0 moderate / 1 low** — both are the **same dev-only** `esbuild` package via `.>vite>esbuild` (vite/vitest, devDependency). HIGH = GHSA-gv7w-rqvm-qjhr (Deno-module RCE via `NPM_CONFIG_REGISTRY`; no Deno runtime here). LOW = GHSA-g7r4-m6w7-qqqr (Windows dev-server file read; CI is macOS/Linux vitest). **Zero production exposure** — neither reaches the Node/Vercel build.
- Secret leaks: **none** — only test-fixture mocks (`platform-auth-fixtures.ts` `test-bb/cb-client-secret`). No `SUPABASE_SERVICE_ROLE_KEY`/`NEXTAUTH_SECRET` in any `NEXT_PUBLIC_*`. Only secret-shaped public var is `NEXT_PUBLIC_POSTHOG_KEY` (publishable). `lib/env.ts` `.trim()` boundary holds.
- License issues: **none** — no GPL/AGPL. MPL-2.0 (`lightningcss` build tool, `axe-core` dev) file-level, documented in `docs/accepted-risks.md`. No LGPL installed (`sharp` now Apache-2.0).
- Knip `--production`: **0 findings** (no attack-surface bloat).
- XSS: all SVG user-input fields escaped via `escapeXml()` — `handle` (BadgeSvg:40), `displayName` (:42), `avatarDataUri` (:155), `archetypeText` (:179), `tier` (:236), hash/date (VerificationStrip). All 5 XML metacharacters covered.
- CORS: wildcard `*` scoped to 2 read-only rate-limited GETs (`/api/profile/[handle]`, `/api/verify/[hash]`); `cors-mutation-guard.test.ts` enforces no-wildcard-on-mutations.
- RLS: **10 base tables, 10/10 ENABLE + FORCE RLS**; deny-all-anon policies (008/018), FORCE via 018 + 025. Prior `supplemental_stats` FORCE gap CLOSED (migration 025).
- **P2 (action item)**: add `"esbuild": ">=0.28.1"` to `pnpm.overrides` (block already pins minimatch/dompurify/brace-expansion/etc.) + `pnpm install` to clear both advisories. Dev-only; clears audit to GREEN.

**Cross-agent recommendations:**
- [Coverage]: No security-relevant coverage gaps. lib/auth 98.0%, lib/analytics 97.30%, lib/verification 100% per 2026-06-14 — XSS escape paths and CORS guards fully covered.
- [QA]: No new security UX issues. CORS wildcard remains scoped to read-only endpoints; mutation guard static test in place. All SVG/markup user fields escaped.
- [Triage]: One P2 — bump transitive `esbuild` to ≥0.28.1 via `pnpm.overrides`. Dev-tooling, no production exposure, but clears one high-severity CVE. Mirrors the prior `brace-expansion` override fix.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=qa_agent timestamp=2026-06-17T07:03:00Z -->
## QA Agent — 2026-06-17
- **Status**: GREEN
- Tests: 7594/7594 passed across 445 files, 0 failed, 0 skipped
- Type errors: 0
- Lint issues: 0
- A11y issues: 0 — all `<img>` have alt, focus-visible in globals.css + 4 production components, heading hierarchy correct in all pages, 100+ aria-label instances, 0 interactive elements missing ARIA

**Cross-agent recommendations:**
- [Coverage]: No new coverage gaps. Design system inline styles all use CSS variables. P3 carries (experiments, Canvas/WebGL, lazy wrappers) unchanged.
- [Security]: No security-related quality issues. All `<img>` tags have alt text (no phishing-vector omissions). No hardcoded hex colors expose token leakage risk. global-error.tsx hardcoded hex is outside ThemeProvider — does not touch server secrets.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=qa_agent timestamp=2026-06-24T07:06:53Z -->
## QA Agent — 2026-06-24
- **Status**: GREEN
- Tests: 7977/7977 passed across 464 files, 0 failed, 0 skipped
- Type errors: 0
- Lint issues: 0
- A11y issues: 0 — all `<img>` tags have alt; focus-visible global + 5 production components; campaigns `<tr role="button">` aria-label gap from May 6 is now resolved; heading hierarchy correct across all sampled pages; 13 error boundaries + 13 loading states

**Cross-agent recommendations:**
- [Coverage]: `SharePageH2.test.tsx` exists and closes the prior H2 wrapper gap. All other critical paths remain ≥96% stmts.
- [Security]: No security-related quality issues. All XSS vectors covered. Interactive elements accessible. No hardcoded secrets or token leaks observed in production JSX.
<!-- ENTRY:END -->
