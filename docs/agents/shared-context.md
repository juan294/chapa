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

<!-- ENTRY:START agent=documentation timestamp=2026-07-03T10:00:00Z -->
## Documentation Agent — 2026-07-03
- **Status**: GREEN
- Stale docs: 0 | Missing docs: 0 | Env var mismatches: 0
- Route coverage: **88 filesystem routes (34 `page.tsx` + 54 `route.ts`) — 100% documented in CLAUDE.md**. HEAD `8516b06b` (v1.25.0 sync). Experiment pages covered by documented `GET /experiments/*` wildcard. `POST /api/challenge` (added #933) confirmed present in CLAUDE.md — the 2026-06-26 gap is CLOSED. No undocumented routes, no documented-but-missing routes.
- Design system: **38/38 `--color-*` tokens** in `docs/design-system.md` match `apps/web/styles/globals.css` bidirectionally (comm-verified). Zero drift, zero orphans.
- Env vars: **26 server vars via `lib/env.ts` + 10 `NEXT_PUBLIC_*` + `ANALYZE` all documented** (100%). Every documented var maps to real usage; every `lib/env.ts` var is documented. `NODE_ENV`/`CI`/`VERCEL_*`/`TESTPLATFORM_*`/`PLAYWRIGHT_BASE_URL`/`DEPLOYMENT_SMOKE_STRICT` intentionally omitted (standard/test-only). `X`/`UPPERCASE`/`NEXT_PUBLIC_X` in raw grep are ESLint-literal examples in `env.ts` doc-comments — not real vars. `PostHogProvider.tsx` direct `NEXT_PUBLIC_POSTHOG_*` reads acceptable (client, build-time inlining).
- JSDoc: complex-module functions all documented — `lib/impact/v6.ts` 9/9, `lib/cache/redis.ts` 14/14, `lib/render/BadgeSvg.tsx` full. **P3 carry**: `lib/db/campaigns/types.ts` 5 Zod type exports + schema lack JSDoc (self-explanatory; sibling `types.test.ts` added 2026-07-01).
- Required docs present/non-empty: `impact-v4.md` (131), `impact-v5.md` (152), `impact-v6.md` (289, current truth), `svg-design.md` (173), `design-system.md` (236), `README.md` (228, Quick Start L75).
- `shared-context.md` fresh through 2026-07-03. TODO/FIXME doc-gap scan: 1 false positive (`agent-config.ts:283`, own prompt template). No real gaps.
- Report at `docs/agents/documentation-report.md`.

**Cross-agent recommendations:**
- [QA]: No documentation-related UX issues. All 88 routes documented; no doc changes affect runtime behavior.
- [Security]: No security doc gaps. All `NEXT_PUBLIC_*` vars non-sensitive; server secrets flow through `lib/env.ts`; admin-auth and CORS-scoped routes documented in CLAUDE.md. No undocumented export with security surface.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=documentation timestamp=2026-06-26T10:00:00Z -->
## Documentation Agent — 2026-06-26
- **Status**: YELLOW
- Stale docs: 0 | Missing docs: 1 | Env var mismatches: 0
- Route coverage: **85/86 filesystem routes (85 documented, 1 missing)**. HEAD `1bfc75df` (v2.15.0). Delta since 2026-06-19 cycle: `POST /api/challenge` added by #933 (`app/api/challenge/route.ts`) — **not in CLAUDE.md**. All other routes verified present. Flagged previously by performance (2026-06-25) and coverage (2026-06-26) agents.
- Design system: **38/38 `--color-*` tokens** in `docs/design-system.md` match `apps/web/styles/globals.css` exactly. Zero drift, zero orphans.
- Env vars: **all 35+ production vars documented** (100%). `PostHogProvider.tsx:8-9` direct `NEXT_PUBLIC_*` reads — acceptable (client component, build-time inlining). `CI`/`PLAYWRIGHT_BASE_URL`/`DEPLOYMENT_SMOKE_STRICT` test-only (intentional omissions). All server-side vars flow through `lib/env.ts`.
- JSDoc: P3 carries unchanged — `lib/cache/redis.ts` (`RateLimitResult`, `CacheSetNxStatus` types), `lib/db/campaigns/types.ts` (Zod schema + 5 type exports). All functions documented.
- Required docs all present/non-empty: `impact-v4.md` (131), `impact-v5.md` (152), `impact-v6.md` (289, current truth), `svg-design.md` (173), `README.md` (228).
- TODO/FIXME doc-gap scan: 1 false positive (`lib/agents/agent-config.ts:283`). No real gaps.
- Report at `docs/agents/documentation-report.md`.

**Cross-agent recommendations:**
- [QA]: No documentation-related UX issues. The missing `/api/challenge` entry does not affect runtime behavior.
- [Security]: `/api/challenge` route is authenticated + IP rate-limited (server-side only). No security doc gap; no `NEXT_PUBLIC_*` leak. Verify rate-limit guard in route handler before next security scan.
<!-- ENTRY:END -->

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

<!-- ENTRY:START agent=cost-analyst timestamp=2026-07-15T03:00:00Z -->
## Cost Analyst — 2026-07-15
- **Status**: GREEN
- Estimated monthly cost at 10K users: **~$50–75/mo**. Unchanged.
- Redis key growth risk: low | Uncached external calls: 0 | Resource leak risks: 0
- **Cost-surface delta since 2026-07-13 cycle**: **NONE — fourth consecutive zero-delta cycle.** HEAD is still `9bfb9a6c`; `git log 9bfb9a6c..HEAD` is empty; only uncommitted `docs/agents/*.md` report edits in the tree. Zero production code, zero commits. Every fact below re-verified against live source this cycle.
- Redis: **38 non-test, non-module cache-write call sites** (`cacheSet`/`cacheIncr`/`cacheReserveQuota`/`cacheSetNx`) across 22 files (78 total occurrences incl. tests + module) — identical to 2026-07-13. Default TTL 21,600s (`redis.ts:82`). Exactly **1 intentional TTL-0**: `cron:warm-cache:offset` rotation cursor (`warm-cache/route.ts:148`, re-confirmed). 2 O(1) direct-redis singletons (`stats:badges_generated` INCR + `stats:unique_badges` HLL ~12 KB). Every per-handle key ≤7d TTL. Growth risk: LOW.
- Supabase: **11 tables + 2 views, 28 migrations** (latest `028_grant_service_role_access.sql`, no new tables). Lazy singleton `lib/db/supabase.ts:14` (`let _client`), `server-only`, `persistSession:false`, `withTimeout` (5s). No N+1. `dbGetCampaignStats` (`campaigns/sends.ts`) 4-parallel-COUNT P2-1 carried — bounded, admin-only, threshold-gated.
- External calls: **0 uncached**. GitHub via `getStats()` 6h `CACHE_TTL` + 7d `STALE_TTL` SWR (`client.ts:17-18`) + in-flight dedup + Redis lock; `_serveStaleAndReCache()` (`client.ts:168`, `readOnly`-guarded) anti-thrash intact on both total-failure (`:197`) and #1002 degraded-fetch (`:328`) paths. `/api/challenge` IP 5/hr + handle 3/day both `rateLimitStrict()` (`route.ts:24,81`); 4 crons CRON_SECRET-gated; PostHog fire-and-forget.
- Vercel: badge `maxDuration=35` (`route.ts:34`); warm-cache/sync-audience/process-campaigns `=300`, `latency-check`=60, bulk-recalculate `=300` (source + vercel.json cross-checked). Landing `/` `force-static`+`revalidate:3600` (`page.tsx:10-11`) CDN/ISR-served. Bundle 2,128 KB raw / 672 KB gzipped (2026-07-09 baseline); **zero client-bundle delta**, below 2,300 KB trigger.
- **P1s: NONE. P2s: 1 (P2-1 carried). P3s: 1 (P3-2 carried, monitor-only).**

**Cross-agent recommendations:**
- [Performance]: No bundle delta — zero production JS changed since 2026-07-10. The 2,128 KB raw / 672 KB gzipped baseline stays current; no `ANALYZE=true` run needed.
- [Security]: No new cache-poisoning or rate-limit surface — zero production code touched. Fail-closed limiters on challenge (both re-verified at `route.ts:24,81`) and the `readOnly`-guarded `_serveStaleAndReCache()` all unchanged.
- [Coverage]: No cost-sensitive path changed, so no new coverage gap. Standing note: if `dbGetCampaignStats` ever converts to a single `GROUP BY status` aggregate, add a sibling test for the aggregate shape.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=cost-analyst timestamp=2026-07-13T03:00:00Z -->
## Cost Analyst — 2026-07-13
- **Status**: GREEN
- Estimated monthly cost at 10K users: **~$50–75/mo**. Unchanged.
- Redis key growth risk: low | Uncached external calls: 0 | Resource leak risks: 0
- **Cost-surface delta since 2026-07-12 cycle**: **NONE.** HEAD is still `9bfb9a6c` — identical to the last two cost-analyst runs. `git log 9bfb9a6c..HEAD` is empty; only uncommitted `docs/agents/*.md` report edits in the tree. **Zero production code, zero commits.** Every fact below re-verified against live source rather than assumed.
- Redis: **38 non-module, non-test cache-write call sites** (`cacheSet`/`cacheIncr`/`cacheReserveQuota`/`cacheSetNx`) across 22 files (78 total occurrences incl. tests + module). Default TTL 21,600s (`redis.ts:82`). Exactly **1 intentional TTL-0**: `cron:warm-cache:offset` rotation cursor (`warm-cache/route.ts:148`, confirmed `cacheSet(ROTATION_KEY, nextOffset, 0)`). 2 O(1) direct-redis singletons (`stats:badges_generated` INCR + `stats:unique_badges` HLL ~12 KB). Every per-handle key ≤7d TTL. Growth risk: LOW.
- Supabase: **11 tables + 2 views, 28 migrations** (latest `028_grant_service_role_access.sql`, no new tables). Lazy singleton `lib/db/supabase.ts:13` (`let _client`), `server-only`, `persistSession:false`, `withTimeout` (5s). No N+1. `dbGetCampaignStats` (`campaigns/sends.ts:243-251`) 4-parallel-COUNT P2-1 carried — bounded, admin-only, threshold-gated.
- External calls: **0 uncached**. GitHub via `getStats()` 6h + 7d SWR + in-flight dedup + Redis lock; `_serveStaleAndReCache()` (`client.ts:168`, `readOnly`-guarded) anti-thrash intact; degraded-fetch guard #1002 preserves last-known-good. `/api/challenge` IP 5/hr + handle 3/day both `rateLimitStrict()`; crons CRON_SECRET-gated; PostHog fire-and-forget.
- Vercel: badge `maxDuration=35` (`route.ts:34`); 3 batch crons `=300`; `latency-check`=60 (vercel.json confirmed). Landing `/` `force-static`+`revalidate:3600` (#982) CDN/ISR-served. Bundle 2,128 KB raw / 672 KB gzipped (2026-07-09 baseline); **zero client-bundle delta** (no production code), below 2,300 KB trigger.
- **P1s: NONE. P2s: 1 (P2-1 carried). P3s: 1 (P3-2 carried, monitor-only).**

**Cross-agent recommendations:**
- [Performance]: No bundle delta — zero production JS changed since 2026-07-11. The 2,128 KB raw / 672 KB gzipped baseline stays current; no `ANALYZE=true` run needed.
- [Security]: No new cache-poisoning or rate-limit surface — zero production code touched. Fail-closed limiters on session/refresh/challenge and the `readOnly`-guarded `_serveStaleAndReCache()` all unchanged.
- [Coverage]: No cost-sensitive path changed, so no new coverage gap. If `dbGetCampaignStats` ever converts to a single `GROUP BY status` aggregate, add a sibling test for the aggregate shape.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=cost-analyst timestamp=2026-07-12T03:00:00Z -->
## Cost Analyst — 2026-07-12
- **Status**: GREEN
- Estimated monthly cost at 10K users: **~$50–75/mo**. Unchanged.
- Redis key growth risk: low | Uncached external calls: 0 | Resource leak risks: 0
- **Cost-surface delta since 2026-07-11 cycle**: **NONE.** HEAD is still `9bfb9a6c` — identical to the last cost-analyst run. `git log 9bfb9a6c..HEAD` is empty; the only working-tree changes are uncommitted `docs/agents/*.md` report edits (this report + shared-context). **Zero production code, zero commits.** Every cost-surface fact re-verified against live source rather than assumed.
- Redis: **40 non-redis-module cache-write call sites** (`cacheSet`/`cacheIncr`/`cacheReserveQuota`/`cacheSetNx`, re-grepped — count higher than prior cycles' 25/35 due to broader pattern; not a real growth). Default TTL 21,600s (`redis.ts:82`). Exactly **1 intentional TTL-0**: `cron:warm-cache:offset` rotation cursor (`warm-cache/route.ts:148`). 2 bounded direct-redis singletons (`stats:badges_generated` INCR + `stats:unique_badges` HLL ~12 KB). Growth risk: LOW.
- Supabase: **11 tables + 2 views, 28 migrations** (latest `028_grant_service_role_access.sql`, no new tables). Lazy singleton `lib/db/supabase.ts:13`, `server-only`, `persistSession:false`, `withTimeout`(5s). No N+1. `dbGetCampaignStats` (`campaigns/sends.ts:231-271`) 4-parallel-COUNT P2-1 carried — bounded, admin-only, threshold-gated.
- External calls: **0 uncached**. GitHub via `getStats()` 6h `CACHE_TTL` + 7d `STALE_TTL` SWR + in-flight dedup + Redis lock; `_serveStaleAndReCache()` anti-thrash (`client.ts:168`, `readOnly`-guarded) intact; degraded-fetch guard #1002 preserves last-known-good. `/api/challenge` IP 5/hr + handle 3/day both `rateLimitStrict()`; session/refresh fail-closed; latency-check cron CRON_SECRET-gated. PostHog server events fire-and-forget.
- Vercel: badge `maxDuration=35`; 3 batch crons `=300`; `latency-check`=60 (confirmed in vercel.json). Landing `/` `force-static`+`revalidate:3600` (#982) CDN/ISR-served. Bundle 2,128 KB raw / 672 KB gzipped (2026-07-09 perf baseline); **zero client-bundle delta** (no production code), below 2,300 KB trigger.
- **P1s: NONE. P2s: 1 (P2-1 carried). P3s: 1 (P3-2 carried, monitor-only).**

**Cross-agent recommendations:**
- [Performance]: No bundle delta — no production JS changed since 2026-07-11. The 2,128 KB raw / 672 KB gzipped baseline stays current; no `ANALYZE=true` run needed.
- [Security]: No new cache-poisoning or rate-limit surface — zero production code touched. Fail-closed limiters on session/refresh/challenge and the `readOnly`-guarded `_serveStaleAndReCache()` all unchanged.
- [Coverage]: No cost-sensitive path changed, so no new coverage gap. `dbGetCampaignStats` P2-1 remains bounded/admin-only; if it ever converts to a single `GROUP BY status` aggregate, add a sibling test for the aggregate shape.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=triage timestamp=2026-07-15T04:30:00Z -->
## Triage -- 2026-07-15
- **Environment fix**: `gh` CLI was broken at session start — a stale x86_64 binary at `/usr/local/bin/gh` shadowed a missing arm64 Homebrew install, failing with "bad CPU type in executable" (exit 127). Reinstalled/relinked via `brew install gh`; now resolves correctly at `/opt/homebrew/bin/gh`, authenticated as `juan294`.
- **Reports processed**: 5 modified this cycle (coverage GREEN, security GREEN, cost-analyst GREEN — 4th consecutive zero-delta cycle, documentation GREEN, cc-rpi-update no-op). All GREEN, no blocking items.
- **Action items resolved**: 1 genuine coverage gap, verified by direct measurement before fixing (coverage-report.md's "0% stmts" claim on `apps/web/app/experiments/error.tsx` + `loading.tsx` was accurate this time — existing sibling `*.test.tsx` files only did `fs.readFileSync` + `.toContain()` string assertions, never actually rendering the component, hence genuine 0% statement coverage despite "having a test"). Added real `@testing-library/react` render tests; confirmed 100% stmts via targeted coverage run.
- **`/simplify` (4 parallel agents)**: reuse + efficiency agents independently found the same issue — the codebase has an established `*.render.test.tsx` split convention (`apps/web/app/error.render.test.tsx`, `loading.render.test.tsx`, `cli/authorize/error.render.test.tsx`, `admin/loading.render.test.tsx`) that keeps jsdom render tests in a sibling file, separate from the plain source-string `.test.tsx` files, so the `jsdom` environment pragma doesn't tax the string-only tests. Split `error.test.tsx`/`loading.test.tsx` back to their original form and added `error.render.test.tsx`/`loading.render.test.tsx` matching the root precedent exactly. Simplification agent's "extract a helper for the duplicated `vi.fn()+render()` setup" suggestion was rejected — the established root `error.render.test.tsx` precedent repeats that same two-line setup per test with no helper, so matching convention took priority over introducing a new local abstraction. Altitude agent's "delete the now-superseded string-assertion tests" suggestion was also rejected — verified the root `error.test.tsx`/`error.render.test.tsx` pair keeps overlapping assertions in both files by design (established, repeated 4x), so trimming would have broken precedent. 8,339/8,339 tests, typecheck + lint clean.
- **Housekeeping**: formally documented two long-standing "accepted permanent limitation" items in `docs/accepted-risks.md` that had been re-verified as unchanged across 7+ prior triage cycles but never actually written down — `axe-core`'s MPL-2.0 license (dev-only) and the GHAS code-scanning/secret-scanning-disabled state (private-repo tier limitation, equivalent coverage via CI Gitleaks + `pnpm audit` + weekly security-agent cycles).
- **GitHub alerts**: Code scanning (403) + secret scanning (404) both disabled — GHAS unavailable on this repo's tier, now formally documented in `docs/accepted-risks.md` (see Housekeeping). Dependabot security alerts: query succeeded, 0 open.
- **Dependabot**: PR #924 (`actions/checkout` 6→7, major) — attempted `gh pr update-branch` to clear the `CONFLICTING`/`DIRTY` merge state; rebase failed with an unresolved conflict. Left commented and deferred (major-bump policy). Now stale across 8+ consecutive cycles with all CI checks green — flagged directly to the user as a candidate for manual merge.
- **Summary**: Fixed a broken `gh` CLI, closed a real (verified, not stale) coverage gap while following the `/simplify` panel's convergent recommendation to match an existing test-file-split convention, and converted two repeatedly-reconfirmed "accepted permanent limitation" verbal notes into actual `accepted-risks.md` entries.

**Cross-agent recommendations:**
- [Coverage]: `apps/web/app/experiments/error.tsx` + `loading.tsx` now both 100% stmts via new `*.render.test.tsx` siblings — drop from future carry lists. Issue #1006 (`KeyboardShortcutsListener.test.tsx` loader gap) remains open, untouched by this cycle.
- [Cost Analyst / Performance]: No cost-surface or bundle-size impact — test-only + two doc-only accepted-risk entries, zero production code changed.
- [Security]: GHAS-disabled state and axe-core MPL-2.0 are now formally documented in `docs/accepted-risks.md` — no more need to re-verify/re-mention as a verbal "accepted permanent limitation" each cycle; just confirm the doc entry is unchanged.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=triage timestamp=2026-07-10T07:20:00Z -->
## Triage -- 2026-07-10
- **Reports processed**: 4 new this cycle (cost-analyst GREEN, performance GREEN, coverage GREEN, cc-rpi-update no-op). All four confirmed GREEN with no blocking action items — carried P2/P3 items are all agent-justified monitor-only or next-cycle deferrals.
- **Stale-claim check**: coverage-report.md claimed `apps/web/app/admin/agents/agents-dashboard.tsx` is at 0% coverage. Verified directly with a targeted `vitest --coverage` run: actual is **98.24% stmts / 90.47% branches** (two sibling test files have existed since Feb/Mar 2026). The claim was false/stale — no action taken, consistent with the "verify before re-flagging" precedent from 2026-07-09.
- **Action items resolved**: 2 genuine gaps in the same coverage-report recommendation, confirmed by direct measurement — `apps/web/components/GlobalCommandBarLazy.tsx` (60%→100% stmts) and `apps/web/components/SharePageOwnerContentLazy.tsx` (66.66%→100% stmts), both missing coverage on the `next/dynamic` loader's `.then()` mapper, closed by adding a loader-resolution test to each following the `ClientInstrumentation.render.test.tsx` (#9386cf65) precedent.
- **`/simplify` (4 parallel agents)**: reuse agent found the loader-resolution assertion block now duplicated 3x (ClientInstrumentation, GlobalCommandBarLazy, SharePageOwnerContentLazy) — extracted a shared `resolveDynamicLoader()` helper into `apps/web/lib/test-helpers/dynamic-mock.ts` and refactored all 3 call sites onto it. Reuse agent also found a 4th, pre-existing instance of the same coverage gap in `KeyboardShortcutsListener.test.tsx` (out of scope for this diff) — filed as issue #1006. Simplification agent's "redundant import" finding in `SharePageOwnerContentLazy.render.test.tsx` was rejected as a false positive — it matches the established `ClientInstrumentation` precedent exactly (defensive re-import for test-order independence). Efficiency and altitude agents found nothing actionable. 8,335/8,335 tests, typecheck + lint clean.
- **GitHub alerts**: Code scanning (403) + secret scanning (404) both disabled — GHAS unavailable on this repo's tier, re-confirmed unchanged accepted permanent limitation. Dependabot security alerts: query succeeded, 0 open.
- **Dependabot**: PR #924 (`actions/checkout` 6→7, major) remains deferred — unchanged across 7+ cycles.
- **Summary**: Light cycle on report volume but the `/simplify` pass surfaced and fixed real duplication plus a previously-undiscovered 4th coverage gap, filed separately rather than blind-fixed outside the diff scope.

**Cross-agent recommendations:**
- [Coverage]: `GlobalCommandBarLazy.tsx` + `SharePageOwnerContentLazy.tsx` now both 100% stmts — drop from future carry lists. `agents-dashboard.tsx`'s "0%" claim in coverage-report.md is stale/false (actual 98.24%) — do not re-flag without a fresh measurement. Issue #1006 tracks the same loader-coverage gap in `KeyboardShortcutsListener.test.tsx` for a future cycle.
- [Cost Analyst / Performance]: No cost-surface or bundle-size impact — test-only + one new small test-helper file, zero production code changed.
- [Security]: No regressions — GHAS-disabled state confirmed still the accepted baseline.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=triage timestamp=2026-07-09T08:30:00Z -->
## Triage -- 2026-07-09
- **Reports processed**: 4 new this cycle (cost-analyst GREEN, coverage GREEN, qa GREEN, cc-rpi-update no-op). Performance/documentation/security/update-docs reports matched the `-newer` mtime scan but were confirmed unchanged in content since the 2026-07-07 cycle already processed them (git-checkout mtime false positive) — not re-processed.
- **Action items resolved**: 2 — (1) closed the coverage/QA-flagged branch-coverage gap on `ClientErrorReporter.tsx` + `ClientInstrumentation.tsx` (61%/33% br → verified 100%/100% combined after fix); note the "no sibling test" claim for `ClientInstrumentation.tsx` was stale — `ClientInstrumentation.render.test.tsx` already existed, the real gap was one uncovered line (the `next/dynamic` loader's `.then()` mapper, never invoked because the render test fully mocks `next/dynamic`); (2) closed cost-analyst's P3-1 carried 5+ cycles — `apps/web/lib/github/client.ts`'s total-fetch-failure stale-serve path now mirrors the #1002 degraded-fetch anti-thrash pattern (re-caches stale into the primary key, 6h TTL, guarded by `readOnly`) to bound GitHub refetch churn during a sustained outage. Ran `/simplify` (4 parallel agents) on the diff: extracted both call sites into a shared `_serveStaleAndReCache()` helper (reuse + altitude findings), collapsed 3 homogeneous `ClientErrorReporter` reason-formatting tests into `it.each` (simplification finding). Rejected the efficiency agent's fireAndForget suggestion — verified against the actual sibling precedent (`isDegradedPrFetch` block) which already uses a direct blocking `await`, not fireAndForget; matching existing behavior took priority over changing it as a drive-by. 8,333/8,333 tests, typecheck + lint clean.
- **GitHub alerts**: Code scanning (403) + secret scanning (404) both disabled — GHAS unavailable on this repo's tier, re-confirmed unchanged accepted permanent limitation. Dependabot security alerts: query succeeded, 0 open.
- **Dependabot**: PR #924 (`actions/checkout` 6→7, major) remains deferred — unchanged across 5+ cycles.
- **Skipped with justification**: cost-analyst P2-1 (`dbGetCampaignStats`, monitor-only, no trigger this cycle); cost-analyst P3-2 (`reconcileSnapshotWrite` dedup marker, agent's own recommendation is "not worth building preemptively"); coverage's `useTrendData.test.ts` flake (single host-load occurrence, self-resolved, explicitly conditioned on recurrence); documentation's `campaigns/types.ts` JSDoc P3 (already verified resolved in the 2026-07-07 cycle, the 07-03 report mention is stale).
- **Summary**: Verified two agent claims against live code/coverage before acting rather than taking report text at face value — one was accurate (cost-analyst P3-1), one was partially stale (QA/coverage's ClientInstrumentation "no test" claim).

**Cross-agent recommendations:**
- [Coverage]: `ClientErrorReporter.tsx` + `ClientInstrumentation.tsx` now both 100% stmts/branches/funcs/lines — drop from future carry lists. When re-checking "no sibling test" claims, verify with an actual coverage run first — file-naming conventions (`.render.test.tsx` vs `.test.tsx`) can make a real test file look absent to a naive glob.
- [Cost Analyst]: P3-1 (`client.ts:174-181`, now refactored into `_serveStaleAndReCache()`) is closed — drop from future carry lists. The mechanism is now shared with the #1002 degraded-fetch path, so any future TTL/key-shape change only needs to happen once.
- [Security]: No regressions — GHAS-disabled state confirmed still the accepted baseline.
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

<!-- ENTRY:START agent=security timestamp=2026-06-29T09:00:00Z -->
## Security Scanner — 2026-06-29
- **Status**: GREEN
- Vulnerabilities: **0 critical / 0 high / 0 moderate / 0 low** — `pnpm audit` clean across 628 dependencies. Prior esbuild HIGH (GHSA-gv7w-rqvm-qjhr) resolved via `pnpm.overrides` pinning.
- Secret leaks: **none** — no `SUPABASE_SERVICE_ROLE_KEY`/`NEXTAUTH_SECRET`/`ADMIN_SECRET` in any `NEXT_PUBLIC_*` binding. All server secrets through `lib/env.ts`. Only publishable vars public: `NEXT_PUBLIC_POSTHOG_KEY`, feature-flag booleans. No literal API keys/tokens in source.
- License issues: **none** — no GPL/AGPL. MPL-2.0 (`@resvg/resvg-js`, `lightningcss`, `dompurify`) + LGPL-3.0 (`@img/sharp-libvips-darwin-arm64`) all formally accepted in `docs/accepted-risks.md`.
- RLS: **11/11 tables ENABLE + FORCE RLS** (studio_configs added in migration 027). Deny-all-anon policies. Views: SECURITY INVOKER (014).
- CORS: wildcard `*` scoped to 2 read-only rate-limited GETs (`/api/verify/[hash]`, `/api/profile/[handle]`). `cors-mutation-guard.test.ts` CI guard in place.
- XSS: all 7 SVG user-input fields escaped via `escapeXml()` — `handle`/`displayName` (`BadgeSvg.tsx:49,51`), `avatarDataUri` (`:164`), `archetypeText` (`:188`), `tier` (`:245`), `hash`/`date` (`VerificationStrip.ts:13-14`).
- Knip `--production`: 1 finding (`vitest.setup.ts` — false positive). 0 real unused production dependencies.
- **P3-1 CARRY**: `/api/challenge` handle-level rate limit (3/day) uses fail-open `rateLimit()` at `route.ts:81`; fix is one-line swap to `rateLimitStrict()`. Compensating controls: session auth required + Resend limits.

**Cross-agent recommendations:**
- [Coverage]: No security-relevant coverage gaps. lib/auth 97.3%, lib/render 99.6% (all SVG escape paths covered), lib/verification 100%.
- [QA]: No security UX issues. CORS wildcard scoped; mutation guard invariant test active. All interactive SVG/markup fields escaped.
- [Triage]: P3 only — swap `rateLimit()` to `rateLimitStrict()` in `apps/web/app/api/challenge/route.ts:81`. No P1/P2 action required.
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
- Fonts: `next/font/google` (JetBrains Mono + Plus Jakarta Sans), `display: swap`, 0 external font requests. CLS: badge fallback `<img>` has explicit `width=1200 height=630` (ok); `LiteYouTubeEmbed` thumbnail `<img>` in fixed container, no explicit attrs (P3). `prefers-reduced-motion` respected.
- New route `/api/challenge` (#933) not yet in CLAUDE.md route table (P3 doc gap for documentation agent).

**Cross-agent recommendations:**
- [Coverage]: `ChallengeForm.tsx` (173 lines) and `lib/email/challenge.ts` (101 lines) ship with sibling test files per #933 diff — no coverage gap from bundle growth.
- [Security]: `/api/challenge` new route is server-side only, no client bundle contribution. Verify rate-limiting and auth guard are in place.
- [QA]: No CLS regressions. Bundle growth is in owner-only lazy chunk; no TTI/LCP impact on visitor pages.
- [Cost Analyst]: Bundle grew to 2,074 KB raw / 657 KB gzipped (+124 KB). Growth in lazy-loaded chunk only — no cold-start memory regression on public pages. If next cycle exceeds 2,300 KB raw, trigger `ANALYZE=true` run.
- [Documentation]: `/api/challenge` route added by #933 is missing from CLAUDE.md route table. Add in next doc cycle.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=performance timestamp=2026-07-02T09:00:00Z -->
## Performance Agent — 2026-07-02
- **Status**: GREEN
- Total First Load JS: **2,079 KB raw / 659 KB gzipped** (76 chunks). **+5 KB raw (+0.2%) / +2 KB gzipped vs 2026-06-25** (2,074 / 657 / 77) — flat, within noise. HEAD `8516b06b` (cc-rpi blueprint v1.25.0 sync + Sonnet 5 CI migration + triage fixes since #933); no meaningful app-code bundle delta despite ~19 intervening commits (#935-#962 fix/feat batch).
- Routes >500 KB: **0**. Routes >300 KB: **0**. Largest chunks 227 / 190 / 110 / 107 / 89 KB raw — all framework/vendor.
- Build: Next 16.2.9 Turbopack, 3.9s compile, 8.8s TypeScript, 0 errors. `pnpm install --frozen-lockfile` clean (lockfile up to date). 89 routes (13 static, 76 dynamic), 67 static pages generated.
- Knip `--production`: **1 finding** — `vitest.setup.ts` (same false positive, test infrastructure). 0 real unused production exports.
- `"use client"` (non-test, anchored): **117** (+4 vs 2026-06-25) — growth spread across the #935-#962 i18n/UX/backend fix batch (aria-label localization, InfoTooltip portal audit, studio config backing store), no single new large client bundle. Key public pages (`/`, `/about`, `/u/[handle]`, archetypes) confirmed server components (0 "use client" in first 3 lines). 7 `next/dynamic` files (Studio, admin, command bar, analytics, instrumentation, share-page owner content).
- Badge route: `maxDuration=35`; success `s-maxage=21600 / SWR=86400`, error `s-maxage=300 / SWR=600`; in-flight dedup (`inflightBadgeRenders` Map, now documented per #946) + Redis lock. 0 uncached external calls.
- Fonts: `next/font/google` (JetBrains Mono + Plus Jakarta Sans), 0 external font requests. CLS: badge fallback `<img>` explicit `width=1200 height=630`; **`LiteYouTubeEmbed` P3 from 2026-06-25 now RESOLVED** — thumbnail `<img>` has explicit `width={480} height={270}` (fixed in 2026-07-01 triage cycle, item 4). `prefers-reduced-motion` present in globals.css.
- `/api/challenge` route doc gap (P3 from 2026-06-25) also RESOLVED — now in CLAUDE.md route table.

**Cross-agent recommendations:**
- [Coverage]: No new performance-critical untested paths. Bundle flat; the #935-#962 fix batch shipped with its own test coverage per coverage agent's stable 96.31% stmts across the same period.
- [Security]: No performance issues with security implications. Badge in-flight dedup + rate limit unchanged. `/api/challenge` fail-open P3 was closed in the 2026-07-01 triage cycle (both IP and handle limiters now `rateLimitStrict()`) — no performance-adjacent security gap remains.
- [QA]: No CLS regressions — the last open CLS item (LiteYouTubeEmbed thumbnail) is now fixed. Bundle flat, no TTI/LCP impact expected.
- [Cost Analyst]: Bundle flat at 2,079 KB raw / 659 KB gzipped (+5 KB noise). M-bundle monitor stays closed — no `ANALYZE=true` run needed this cycle.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=coverage timestamp=2026-06-30T02:00:16Z -->
## Coverage Agent — 2026-06-30
- **Status**: GREEN
- Overall coverage: **96.31% stmts / 92.15% branches / 95.32% funcs / 97.52% lines** on HEAD `e54c7a6b` (cc-rpi blueprint v1.25.0 sync). Test suite **473 files / 8,114 tests**, all passing. Numbers fully stable vs 2026-06-28 and 2026-06-29 — zero regressions, third consecutive identical cycle.
- Critical paths all GREEN: lib/impact 99.6% (98.7% br / 100% fn), lib/render 99.6% (92.3% br / 100% fn), app/api 97.3% (93.5% br / 96.1% fn), lib/db 96.5% (93.3% br / 100% fn), lib/history 98.3%, lib/dashboard 99.2%.
- Only YELLOW module: `lib/gitlab` 75.2% branches — `lib/gitlab/queries.ts` at 71.8% br (24 missed branches). All stmts ≥87.7% throughout.
- Sub-80% stmts: 9 unchanged P3 carries (experiments JSDOM/Canvas/WebGL, next/dynamic lazy wrappers, HolographicOverlay).
- Flaky tests: **0 detected** (clean single run, 8114/8114, 83.88s under --maxWorkers=3).
- Branch gaps to watch: `lib/render/svg-to-png.ts` 66.7% br (Sharp error path, 1 branch), `lib/i18n/provider.tsx` 61.5% br (JSDOM locale-switch, 5 branches), `lib/gitlab/queries.ts` 71.8% br (24 missed — largest single gap).
- Report at `docs/agents/coverage-report.md`.

**Cross-agent recommendations:**
- [Security]: No security-relevant coverage gaps. lib/auth 97.3%, lib/render 99.6% (all SVG escape paths covered), lib/verification 100%. OAuth token-refresh error paths (83–85% br) are integration limitations, not security holes.
- [QA]: 0 flaky tests. Suite stable at 8,114/8,114 across 473 files. No new gaps introduced.
- [Triage]: No P1/P2 items. Three P3 actions carried: (1) `lib/db/campaigns/types.ts` — add `types.test.ts` with Zod `.safeParse()` tests (88.7% stmts, no sibling test); (2) `lib/render/svg-to-png.ts` Sharp error path test (66.7% br, 1 branch); (3) `lib/gitlab/queries.ts` mock-network tests for OAuth error branches (71.8% br, 24 missed).
- [Cost Analyst]: All cost-path modules ≥96% stmts. lib/cache 98.2%, lib/db 96.5%, app/api 97.3% — stable for 3 cycles.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=coverage timestamp=2026-06-29T02:10:00Z -->
## Coverage Agent — 2026-06-29
- **Status**: GREEN
- Overall coverage: **96.31% stmts / 92.15% branches / 95.32% funcs / 97.51% lines** on HEAD `e54c7a6b` (cc-rpi blueprint v1.25.0 sync). Test suite **473 files / 8,114 tests**, all passing. Numbers stable vs 2026-06-28 cycle — no regressions.
- Critical paths all GREEN: lib/impact 99.6% (98.7% br / 100% fn), lib/render 99.6% (92.3% br / 100% fn), app/api 97.3% (93.5% br / 96.1% fn), lib/db 96.5% (93.3% br / 100% fn), lib/platform 100%, lib/dashboard 99.2%.
- Only YELLOW module: `lib/gitlab` 75.2% branches — `lib/gitlab/queries.ts` at 71.8% br (24 missed branches) pulls the module below 80%. All stmts ≥87.7% throughout.
- Sub-80% stmts: 9 unchanged P3 carries (experiments JSDOM/Canvas/WebGL, next/dynamic lazy wrappers, HolographicOverlay).
- Flaky tests: **0 detected** (clean single run, 8114/8114, 92s under --maxWorkers=3).
- Branch gaps to watch: `lib/render/svg-to-png.ts` 66.7% br (Sharp error path, 1 branch), `lib/i18n/provider.tsx` 61.5% br (JSDOM locale-switch, 5 branches), `lib/gitlab/queries.ts` 71.8% br (24 missed — largest single gap).
- Report at `docs/agents/coverage-report.md`.

**Cross-agent recommendations:**
- [Security]: No security-relevant coverage gaps. lib/auth 97.3%, lib/render 99.6% (all SVG escape paths covered), lib/verification 100%. OAuth token-refresh error paths (83–85% br) are integration limitations, not security holes.
- [QA]: 0 flaky tests. Suite stable at 8,114/8,114 across 473 files.
- [Triage]: No P1/P2 items. P3 actions: (1) `lib/db/campaigns/types.ts` — add `types.test.ts` with Zod `.safeParse()` tests (88.7% stmts, no sibling test); (2) `lib/render/svg-to-png.ts` Sharp error path test (66.7% br, 1 branch); (3) `lib/gitlab/queries.ts` mock-network tests for OAuth error branches (71.8% br, 24 missed).
- [Cost Analyst]: All cost-path modules ≥96% stmts. lib/cache 98.2%, lib/db 96.5%, app/api 97.3% — stable.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=security timestamp=2026-07-06T09:00:00Z -->
## Security Scanner — 2026-07-06
- **Status**: GREEN
- Vulnerabilities: **0 critical / 0 high / 0 moderate / 0 low** — `pnpm audit` clean across 1,087 dependencies. Prior dev-only esbuild HIGH/LOW (2026-06-15) remains resolved.
- Secret leaks: **none** — no hardcoded API keys/tokens/passwords in source (grepped `app`/`lib`/`components`/`packages`, only test fixtures matched). No `SUPABASE_SERVICE_ROLE_KEY`/`NEXTAUTH_SECRET`/`ADMIN_SECRET`/`CRON_SECRET`/`CHAPA_VERIFICATION_SECRET`/`RESEND_API_KEY`/`RESEND_WEBHOOK_SECRET`/`CLIENT_SECRET` in any `NEXT_PUBLIC_*` binding.
- License issues: **none** — 0 GPL/AGPL across full dependency tree. Same accepted weak-copyleft set unchanged (MPL-2.0: `@resvg/resvg-js`, `lightningcss`, `dompurify`; LGPL-3.0: `@img/sharp-libvips-darwin-arm64`), all documented in `docs/accepted-risks.md`.
- RLS: **11/11 tables ENABLE + FORCE RLS** confirmed via migration grep (002, 003, 007, 010, 015, 016, 018, 024, 025, 027). Deny-all-anon policies; views `SECURITY INVOKER` (014).
- CORS: wildcard `*` scoped to 2 read-only rate-limited GETs (`/api/verify/[hash]`, `/api/profile/[handle]`); `cors-mutation-guard.test.ts` guard in place, unchanged.
- XSS: all SVG user-input fields escaped via `escapeXml()` — `handle`/`headerName` (`BadgeSvg.tsx:49-52`, both branches escaped), `avatarDataUri` (`:164`), `archetypeText` (`:188`), `tier` (`:245`), `hash`/`date` (`VerificationStrip.ts:13-14`).
- `/api/challenge` rate limiting: **both IP (5/hr) and handle (3/day) limiters confirmed on `rateLimitStrict()`** (`route.ts:24,81`) — the fail-open P3 closed 2026-07-01 has not regressed.
- `server-only` guards: present on all 7 auth/verification modules — unchanged since 2026-06-22 fix.
- Knip `--production`: 2 false positives (`vitest.setup.ts`, `vitest.contract-setup.ts`, test infra). 0 real unused production deps.
- GitHub: Dependabot vulnerability alerts enabled (204 response), 0 open security PRs. #924 (`actions/checkout` 6→7, major, non-security) remains deferred, unchanged.

**Cross-agent recommendations:**
- [Coverage]: No security-relevant coverage gaps. lib/auth 97.3%, lib/render 100% stmts (all escapeXml paths covered), lib/verification 100% per 2026-07-06 coverage cycle.
- [QA]: No security UX issues. CORS wildcard scoped; mutation guard test active; all SVG/markup fields escaped.
- [Triage]: No action items this cycle — everything is a confirmation of previously-closed items with zero regressions.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=security timestamp=2026-07-13T09:00:00Z -->
## Security Scanner — 2026-07-13
- **Status**: GREEN
- Vulnerabilities: **0 critical / 0 high / 0 moderate / 0 low** — `pnpm audit` clean across 628 dependencies. HEAD `9bfb9a6c` (unchanged since 2026-07-10; only uncommitted `docs/agents/*.md` edits in tree — zero production code delta).
- Secret leaks: **none** — no hardcoded API keys/tokens/passwords in `apps/web` (only `lib/test-helpers/platform-auth-fixtures.ts` `test-*` fixtures matched). No `SUPABASE_SERVICE_ROLE_KEY`/`NEXTAUTH_SECRET`/`ADMIN_SECRET`/`CRON_SECRET`/`*_CLIENT_SECRET` in any `NEXT_PUBLIC_*` binding. Only public var: `NEXT_PUBLIC_POSTHOG_KEY` (publishable, `env.ts:84`).
- License issues: **none** — scanned 373 pkgs in pnpm store, **0 GPL/AGPL/SSPL/EUPL/CDDL/OSL**. Weak-copyleft (MPL/LGPL: `dompurify` dual-Apache, `lightningcss`, `axe-core` dev-only, `@resvg/resvg-js`, `@img/sharp-libvips-*`) all documented in `docs/accepted-risks.md`.
- RLS: **11/11 tables ENABLE + FORCE RLS** (users, user_platforms, metrics_snapshots, verification_records, tool_insights, merge_operations, feature_flags, studio_configs, supplemental_stats, email_campaigns, campaign_sends).
- CORS: wildcard `*` scoped to 2 read-only rate-limited GETs (`/api/profile/[handle]`, `/api/verify/[hash]`); `cors-mutation-guard.test.ts` guard active.
- XSS: all SVG user-input fields escaped via `escapeXml()` — `handle` (`BadgeSvg.tsx:49`), `displayName` (`:51`), `avatarDataUri` (`:164`), `archetypeText` (`:188`), `tier` (`:245`), `hash`/`date` (`VerificationStrip.ts:13-14`).
- Knip `--production`: 2 false positives (`vitest.setup.ts`, `vitest.contract-setup.ts`). 0 real unused production deps.

**Cross-agent recommendations:**
- [Coverage]: No security-relevant coverage gaps — lib/auth 97.3%, lib/render 100% stmts (all escapeXml paths), lib/verification 100% per latest coverage cycle.
- [QA]: No security UX issues. CORS wildcard scoped; mutation guard test active; all SVG/markup fields escaped.
- [Triage]: No P1/P2/P3 action items — a clean confirmation cycle. Optional housekeeping: add `axe-core` MPL-2.0 (dev-only) to `docs/accepted-risks.md` for completeness.
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

<!-- ENTRY:START agent=cost_analyst timestamp=2026-07-06T01:03:24Z -->
## Cost Analyst — 2026-07-06
- **Status**: GREEN
- Redis key growth risk: low
- Uncached external calls: 0
- Resource leak risks: 0 (1 documented accepted-risk: bounded in-flight badge-render Map)

**Cross-agent recommendations:**
- [Performance]: No app-code delta since 2026-07-05 (HEAD unchanged at `09666b59`) — bundle figure (2,079 KB raw / 659 KB gzipped, 77 chunks) still current, no re-measurement needed until new commits land.
- [Security]: No new rate-limit gaps. `/api/challenge` strict limiters (IP + handle) confirmed still in place at `sends.ts`/`route.ts` level checked this cycle.
- [Coverage]: `dbGetCampaignStats` (`lib/db/campaigns/sends.ts:231-271`) and the badge in-flight dedup Map are both cost-sensitive paths — confirm they remain covered if either file is touched in a future change.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=qa_agent timestamp=2026-07-08T07:04:26Z -->
## QA Agent — 2026-07-08
- **Status**: GREEN
- Tests: 8326/8326 passed across 485 files, 0 failed, 0 skipped, 0 flakes (66.9s, --maxWorkers=3)
- Type errors: 0
- Lint issues: 0
- A11y issues: 0 — all `<img>` have alt; both `role="button"` usages (`campaigns-dashboard.tsx:903`, `ActivityHeatmap.tsx:567`) carry aria-labels + keyboard handlers; focus-visible global + 8 production components; verify/[hash] h1 rendered via `StatusCallout titleAs="h1"` (heuristic false positive, do not re-flag); 13 error boundaries + global-error + 13 loading states + not-found

**Cross-agent recommendations:**
- [Coverage]: Confirms your 2026-07-08 findings from the QA angle — `ClientErrorReporter.tsx` (~61% br) and `ClientInstrumentation.tsx` (no sibling test) are the only weak spots in the client error/telemetry UX surface; both JSDOM-testable. Suite grew 8,251 → 8,326 (+75) since your run, still 0 flakes.
- [Security]: No security-related quality issues. All interactive elements accessible, no hardcoded hex/secrets in production JSX, design-system exceptions unchanged (global-error/icons/experiments). Nothing new for your next scan.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=performance timestamp=2026-07-09T09:00:00Z -->
## Performance Agent — 2026-07-09
- **Status**: GREEN
- Total First Load JS: **2,128 KB raw / 672 KB gzipped** (77 chunks). **+49 KB raw (+2.4%) / +13 KB gzipped vs 2026-07-02** (2,079 / 659 / 76) — re-baseline after the #982 landing refactor + v2.17.0 observability batch (#974/#975/#976), as cost-analyst requested. Below the 2,300 KB `ANALYZE=true` trigger. HEAD `b16274ba`.
- **Landing `/` confirmed static**: builds as `○` with `force-static` + `revalidate 3600` — the highest-traffic route is now CDN/ISR-served. The #982 pattern is sound: `app/page.tsx` stays a server component, renders the demo badge SVG at build time and passes the string prop, so `renderBadgeSvg`/`demoData` never enter the client bundle; `LandingPageClient.tsx` (501 lines) imports only lightweight i18n/nav/CTA components.
- Routes >500 KB: **0**. Routes/chunks >350 KB (CI budget): **0**. Largest chunks 227 / 190 / 109 / 107 / 88 KB raw — all framework/vendor.
- Build: Next 16.2.9 Turbopack, 4.6s compile, 8.7s TypeScript, 0 errors; `pnpm install --frozen-lockfile` clean. 90 routes, 68 static pages in 848ms.
- Unused exports: **0** — knip `--production` shows only the 2 known test-infra false positives (`vitest.setup.ts`, `vitest.contract-setup.ts`).
- `"use client"` (non-test): **125** (+8) — from the #982 split + error/telemetry client-surface tests. Key public pages all server components. 11 `next/dynamic`/`import()` files; no sync imports of heavy libs anywhere.
- Badge route: `maxDuration=35`; success `s-maxage=21600/SWR=86400`, error `300/600`; **new #974 `Server-Timing` header** on every response + daily `/api/cron/latency-check` synthetic enforcing p95 800ms hit / 3000ms miss — badge latency is now continuously observable.
- Fonts: `next/font/google`, `display:swap`, 0 external requests. CLS: badge fallback `<img>` 1200×630 + skeleton; LiteYouTubeEmbed 480×270 fix holding; `prefers-reduced-motion` present. #982 locale flash is a content-swap, not a layout shift (same-layout Spanish shell) — accepted per documented i18n architecture.

**Cross-agent recommendations:**
- [Coverage]: No new performance-critical untested paths — #974/#975/#976 all shipped with sibling tests per your 2026-07-09 run. Nothing bundle-driven to cover.
- [Security]: No performance issues with security implications. Badge dedup + rate limiting unchanged; `latency-check` cron is CRON_SECRET-gated; `Server-Timing` exposes only duration metrics, no internals worth redacting.
- [QA]: No CLS regressions. Only new user-visible timing artifact is the #982 landing locale flash for non-`es` users (documented tradeoff, content-swap only) — worth an eyeball if you smoke-test the landing page, but no action expected.
- [Cost Analyst]: Re-baseline delivered per your 2026-07-09 ask: **2,128 KB raw / 672 KB gzipped**, and `/` confirmed static in build output — the invocation-count win is real. New baseline supersedes 2,079/659; trigger stays 2,300 KB raw.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=coverage_agent timestamp=2026-07-12T01:02:50Z -->
## Coverage Agent — 2026-07-12
- **Status**: GREEN
- Overall coverage: 96.71% stmts / 92.76% branches / 95.61% funcs / 97.89% lines (8,335 tests, 485 files, 0 failures)
- Critical gaps: none — lib/impact 99.6%, lib/render 100%, app/api 97.5%, lib/db 97.3% all GREEN; only sub-80% files are experiments/effects (P3 carries). Lowest platform module: lib/codeberg 86.8% br.
- Flaky tests: 0 (single clean run, --maxWorkers=3, 269s)

**Cross-agent recommendations:**
- [Security]: No security-relevant coverage gaps — lib/auth 97.3%, lib/render 100% stmts (all escapeXml SVG paths covered), lib/verification/HMAC paths fully exercised. Codeberg OAuth error branches (86.8% br) are integration-mock gaps, not security holes.
- [QA]: Suite stable at 8,335/8,335, 0 flakes. Six critical-path files lack sibling tests but all measure 98.6–100% via shared test files — not real gaps; do not re-flag.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=coverage_agent timestamp=2026-07-14T00:04:57Z -->
## Coverage Agent — 2026-07-14
- **Status**: GREEN
- Overall coverage: 96.70% stmts / 92.76% branches / 95.57% funcs / 97.89% lines on HEAD `9bfb9a6c` (8,335/8,335 tests, 485 files, 84.9s)
- Critical gaps: none in critical paths — lib/impact 99.6%, lib/render 100% stmts, app/api 97.5%, lib/db 97.3%. Sub-80% files are the unchanged experiments/Canvas/WebGL P3 carries plus HolographicOverlay (50%). Largest branch gaps: `lib/i18n/provider.tsx` 61.5% br (JSDOM carry), `lib/effects/backgrounds/ParticleBackground.tsx` 68% br. `lib/gitlab` branch gap from June cycles is RESOLVED (now 97.2% br). Verified `lib/db/campaigns/{crud,sends}.ts` and `app/api/auth/*/config.ts` are covered indirectly (98.6–100%) despite no sibling test file — not real gaps.
- Flaky tests: 0

**Cross-agent recommendations:**
- [Security]: No security-relevant coverage gaps — lib/auth 97.3%, lib/render 100% stmts (all `escapeXml` paths covered), lib/verification 100%, `app/api/challenge/route.ts` 94.9% with both rate limiters exercised.
- [QA]: Suite grew to 8,335 tests / 485 files, 0 flakes, single clean run. Two one-branch quick wins if desired: `lib/render/demoData.ts` + `archetypeDemoData.ts` (50% br each). Issue #1006 (KeyboardShortcutsListener loader gap) still open; the related `dynamic-mock.ts` helper branch (66.7% br) would close with it.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=coverage_agent timestamp=2026-07-15T00:03:52Z -->
## Coverage Agent — 2026-07-15
- **Status**: GREEN
- Overall coverage: 96.70% stmts / 92.78% branches / 95.57% funcs / 97.89% lines (8,335 tests / 485 files, all passing, 77.1s under --maxWorkers=3)
- Critical gaps: none on critical paths — lib/impact 99.6%, lib/render 100% stmts, app/api 97.5%, lib/db 97.3%. Sub-80% files are all flag-gated experiments/JSDOM-limited P3 carries plus two trivial 0% files (`app/experiments/error.tsx`, `app/experiments/loading.tsx`). Notable: `lib/gitlab` branch gap from June cycles (71.8% br in queries.ts) is RESOLVED — module now 100% stmts / 97.2% br; drop from carry lists.
- Flaky tests: 0

**Cross-agent recommendations:**
- [Security]: No security-relevant coverage gaps — lib/auth 97.3%, lib/render 100% stmts (all `escapeXml()` paths covered), lib/verification 100%, lib/cache 97.1%. The `/api/challenge` route and rate-limiter paths remain fully covered under app/api's 97.5%.
- [QA]: Suite grew 8,326 → 8,335 (+9) since your 2026-07-08 run, still 0 flakes and 0 failures. `dynamic-mock.ts` helper (66.7% br) is test infra only; issue #1006 still tracks the `KeyboardShortcutsListener.test.tsx` loader gap. The two 0% experiments files (`error.tsx`/`loading.tsx`) are one-line render tests if you want the pages module fully green.
- [Triage]: gitlab/queries.ts branch carry and the GlobalCommandBarLazy/SharePageOwnerContentLazy items are all confirmed closed — no P1/P2 items this cycle.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=qa_agent timestamp=2026-07-15T07:04:43Z -->
## QA Agent — 2026-07-15
- **Status**: GREEN
- Tests: 8450/8450 passed across 495 files (0 failed, 0 skipped, 63s)
- Type errors: 0
- Lint issues: 0
- A11y issues: 1 low-severity — `app/verify/[hash]/page.tsx` has no `<h1>` (title at line 107 is a styled `<p>`; section headings start at `<h2>` lines 155/177). All `<img>` tags have alt; both `role="button"` sites have aria-labels; focus-visible global + 6 components; 14 error boundaries + 13 loading states + not-found.
- Design system: 0 violations — hex colors confined to accepted exceptions (icon.tsx, apple-icon.tsx, global-error.tsx, experiments/**, badge renderer).

**Cross-agent recommendations:**
- [Coverage]: Suite grew 8,335 → 8,450 (+115 tests, +10 files) since your 2026-07-15 run — likely post-triage additions; re-baseline counts next cycle. No new failing or flaky tests observed.
- [Security]: No security-related quality issues. No hardcoded hex/secrets in production JSX, no onClick-on-div patterns, CORS/XSS surfaces untouched this cycle (verified zero production-code delta vs cost-analyst's report).
<!-- ENTRY:END -->
