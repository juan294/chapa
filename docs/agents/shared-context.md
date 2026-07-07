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

<!-- ENTRY:START agent=cost-analyst timestamp=2026-07-07T03:00:00Z -->
## Cost Analyst — 2026-07-07
- **Status**: GREEN
- Estimated monthly cost at 10K users: **~$50–75/mo**. Unchanged.
- Redis key growth risk: LOW | Uncached external calls: 0 | Resource leak risks: 0
- **Cost-surface delta since 2026-07-06 cycle**: HEAD `09666b59 → 29d2b524` (v2.16.0) — 3 commits. The delta is **cost-reducing**: admin users tab #993 swaps `useDeferredValue` for a 400 ms debounce (`hooks/useDebouncedValue.ts`, new) so search no longer fires a Supabase view query per keystroke, and `/api/admin/users` `adminAuth` raised 10→30 req/60s (`route.ts:35`, explicit params, still bounded + session + admin-handle gated). `snapshots.ts` change is comment-only. **Zero new cache keys, Supabase queries, or external API calls.**
- Redis: **34 non-redis-module `cacheSet()` call sites, 33/34 (97%) explicit positive TTL**, re-verified. Default TTL 21,600s (`redis.ts:68`). 1 intentional TTL-0: `cron:warm-cache:offset` rotation cursor (`warm-cache/route.ts:148`). 2 bounded direct-redis singletons (INCR counter + HLL ~12 KB). Growth risk: LOW.
- Supabase: **11 tables + 2 views, 28 migrations** (unchanged). Lazy singleton `lib/db/supabase.ts:15-34`, `server-only`, `persistSession:false`, `withTimeout`. No N+1. `dbGetCampaignStats` 4-parallel-COUNT P2-1 carried (threshold-gated, admin-only).
- External calls: **0 uncached** (non fire-and-forget). GitHub 6h + 7d SWR + in-flight dedup + Redis lock; platforms 6h/1h; health probe 60s; `/api/challenge` `rateLimitStrict` IP 5/hr + handle 3/day re-confirmed (`route.ts:24,81`). Fetch-timeout coverage: 23 lib files.
- Resource management: `inflightBadgeRenders` Map self-clearing (documented accepted risk); all `setInterval` hits are client components with cleanup refs — no serverless leaks.
- Vercel: badge `maxDuration=35`; 4 routes `=300`. Badge `s-maxage=21600/SWR=86400` (`badge.svg/route.ts:55`), error `300/600` (`:246`). Bundle carried at 2,079 KB raw / 659 KB gzipped (delta adds one 14-line hook — no re-measure needed), below 2,300 KB trigger.
- **P1s: NONE. P2s: 1 (P2-1, monitor-only, unchanged). P3s: 0.**

**Cross-agent recommendations:**
- [Performance]: v2.16.0 delta adds only `useDebouncedValue` (14 lines, client hook) — bundle figure 2,079 KB raw / 659 KB gzipped still current, no `ANALYZE=true` run needed. The debounce also removes per-keystroke request churn on the admin dashboard.
- [Security]: Admin users limiter loosened 10→30/60s but remains fail-open `rateLimit()` behind session + admin-handle checks — consistent with the documented fail-open design, no new gap. `/api/challenge` strict limiters re-confirmed.
- [Coverage]: New `useDebouncedValue.ts` and the `adminAuth(30, 60)` param path both shipped with sibling tests in v2.16.0 — no cost-critical path lacks coverage. `dbGetCampaignStats` remains the one path to re-check if `campaigns/sends.ts` changes.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=cost-analyst timestamp=2026-07-06T03:00:00Z -->
## Cost Analyst — 2026-07-06
- **Status**: GREEN
- Estimated monthly cost at 10K users: **~$50–75/mo**. Unchanged.
- **Cost-surface delta since 2026-07-05 cycle**: HEAD unchanged at `09666b59` — no new commits landed. **Zero app-code delta**; re-verified all figures directly from source rather than carrying blind.
- Redis: **34 non-redis-module `cacheSet()` call sites, 33/34 (97%) explicit positive TTL**, re-verified by source scan. Default TTL 21,600s (`redis.ts:69`). 1 intentional TTL-0: `cron:warm-cache:offset` rotation cursor (`warm-cache/route.ts:148`, overwrite-in-place, not additive). 2 direct-redis singletons (`stats:badges_generated` INCR, `stats:unique_badges` HLL ~12 KB fixed). Growth risk: LOW.
- Supabase: **11 tables + 2 views, 28 migrations** confirmed via `supabase/migrations/*.sql` listing. Lazy singleton `lib/db/supabase.ts:13-34`, `server-only`, `persistSession:false`, `withTimeout`. No N+1. `dbGetCampaignStats` 4-parallel-COUNT (`campaigns/sends.ts:238-256`) P2-1 carried (threshold-gated, admin-only surface).
- External calls: **0 uncached** (non fire-and-forget). GitHub 6h + 7d SWR + in-flight dedup + Redis lock; platforms 6h/1h; health probe 60s; PostHog/Resend fire-and-forget/dedup-marker guarded. Fetch-timeout coverage: 23 lib files use `AbortSignal.timeout`/`AbortController`/`withTimeout`.
- Resource management: `inflightBadgeRenders` Map (`badge.svg/route.ts:51`) confirmed still self-clearing per request, documented accepted risk. No dangling `setInterval`/unclosed connections found in a fresh grep pass.
- Vercel: badge `maxDuration=35`; 4 routes `=300` (`admin/bulk-recalculate`, 3 cron routes). Badge `s-maxage=21600/SWR=86400` confirmed at `badge.svg/route.ts:55`. Bundle carried at 2,079 KB raw / 659 KB gzipped, 77 chunks (no app-code change to re-measure).
- **P1s: NONE. P2s: 1 (P2-1, monitor-only, unchanged). P3s: 0.**

**Cross-agent recommendations:**
- [Performance]: No app-code delta — HEAD unchanged at `09666b59` since 2026-07-05. Bundle figure (2,079 KB raw / 659 KB gzipped) still current.
- [Security]: `/api/challenge` strict limiters (IP + handle) re-confirmed present. No new rate-limit cost gaps.
- [Coverage]: `dbGetCampaignStats` and the badge in-flight dedup Map remain the two cost-sensitive code paths worth re-checking coverage on if either file changes.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=cost-analyst timestamp=2026-07-05T03:00:00Z -->
## Cost Analyst — 2026-07-05
- **Status**: GREEN
- Estimated monthly cost at 10K users: **~$50–75/mo**. Unchanged.
- **Cost-surface delta since 2026-07-04 cycle**: HEAD `8516b06b → 09666b59` — 3 reliability commits (harden reliability seams, stabilize reliability CI, contract CI on Node 24). App-code touches are durable-write observability in route handlers (`public-profile.ts`, `snapshots.ts`, `tool-insights.ts`, `health/route.ts`, `telemetry/route.ts`, cron routes) + a contract test suite (`test/contract/*`). **Zero new cache keys, Supabase queries, or external API calls.**
- Redis: `cacheSet` default TTL 21,600s (`redis.ts:69`). 1 intentional TTL-0 (`cron:warm-cache:offset`, `warm-cache/route.ts:148`). Persistent keys bounded (HLL ~12 KB + INCR counter + 365d overwrite cursors). `cron:lastrun:<name>` heartbeat written with TTL. Growth risk: LOW.
- Supabase: **11 tables + 2 views, 28 migrations** (+`028_grant_service_role_access.sql`). Lazy singleton `supabase.ts:13`, `server-only`, `persistSession:false`, `withTimeout`. No N+1. `dbReplaceSnapshot`/`dbUpsertToolInsights` upserts add `.select("id").maybeSingle()` RETURNING for durable-write failure detection — same round-trip. `dbGetCampaignStats` 4-parallel-COUNT P2-1 carried (threshold-gated).
- External calls: **0 uncached** (non-auth). GitHub 6h + 7d SWR + in-flight dedup + Redis lock; platforms 6h/1h; health probe 60s + batched heartbeat GETs; PostHog/Resend fire-and-forget. Fetch-timeout coverage 100%.
- Vercel: badge `maxDuration=35`; 4 routes `=300`. Badge `s-maxage=21600/SWR=86400`. Bundle carried 2,079 KB raw / 659 KB gzipped (no app-code bundle delta), below 2,300 KB trigger.
- **P1s: NONE. P2s: 1 (P2-1, monitor-only). P3s: 0.**

**Cross-agent recommendations:**
- [Performance]: No app-code bundle delta — reliability commits touch route handlers + tests only. Bundle carried at 2,079 KB raw / 659 KB gzipped. M-bundle stays closed; no `ANALYZE=true` run needed.
- [Security]: No cost-related rate-limit gaps. `/api/challenge` strict limiters remain; `/api/health` cron-heartbeat reads are rate-limited GETs. Durable-write observability additions do not widen attack surface.
- [Coverage]: The contract suite (`test/contract/payload-matrix.ts`, `redis-fake.ts`, `invoke.ts`) strengthens cost-critical write-path coverage; no cost path lacks tests.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=triage timestamp=2026-07-01T07:20:00Z -->
## Triage -- 2026-07-01
- **Reports processed**: 8 (cost-analyst GREEN, performance GREEN, coverage GREEN, documentation YELLOW, security GREEN, cc-rpi-update GREEN no-op, update-docs COMPLETE, pre-launch — confirmed STALE against current HEAD)
- **Action items resolved**: 10 — (1) `/api/challenge` IP + handle rate limiters swapped `rateLimit()` → `rateLimitStrict()` (carried 5+ cycles); (2) `/api/challenge` added to CLAUDE.md route table; (3) JSDoc added to remaining undocumented exports in `lib/db/campaigns/types.ts`; (4) `LiteYouTubeEmbed` thumbnail given explicit `width`/`height` (CLS); (5) `dbCleanOldSnapshots` now loops until caught up (capped 20 iterations) instead of a single 1000-row/day cap (BE-L1); (6) stale `escapeXml` doc-comment pointer fixed (AR-L1); (7) `inflightBadgeRenders` Map documented in `accepted-risks.md` (PE-L3); (8-10) coverage added for `svg-to-png.ts` font-fallback branch, `campaigns/types.ts` direct boundary tests (new file), and `lib/gitlab/queries.ts` OAuth/GraphQL error branches (24 missed branches → 0, the largest single coverage gap in the repo). 8,164/8,164 tests, typecheck + lint clean, CI to be monitored post-push.
- **Pre-launch audit reconciliation**: `pre-launch-report.md` (dated 2026-06-25 18:11, CONDITIONAL verdict) was spot-verified against current `develop` HEAD — ~33 of its 39 findings (including both "high" data-durability findings BE-H1/BE-H2 and both "high" i18n findings UX-H1/UX-H2) are already resolved by intervening commits; the file itself is a stale artifact. 4 genuinely-still-open small findings were fixed directly (items 5-7 above + AR-L1); 5 larger findings were filed as GitHub issues (#982-986: FE-M1 landing-page force-dynamic, AR-M1 platform-aggregator duplication, BE-M1 supplemental magnitude caps, FE-L2 i18n casts, FE-S1 middleware ADR) rather than blind-fixed. Separately, 7 GitHub issues (#960, #966, #967, #968, #969, #970, #977) from an *even earlier* pre-launch cycle were found to exhibit the known finding-ID-collision problem and were confirmed independently resolved in current code — closed with evidence.
- **GitHub alerts**: Code scanning + secret scanning both disabled/unavailable on this repo's tier (unchanged, accepted permanent limitation). Dependabot security alerts: 0 open (vulnerability-alerts confirmed enabled via 204 response). GREEN.
- **Dependabot**: PR #924 (actions/checkout 6→7, major) remains deferred — unchanged from prior cycles, comments already explain why.
- **Summary**: Heaviest triage cycle in recent history — closed out a 5+-cycle-carried security P3, closed the largest coverage gap in the repo, and did a full stale-audit reconciliation across two generations of pre-launch findings/issues.

**Cross-agent recommendations:**
- [Security]: `/api/challenge` fail-open P3 is now closed — both IP and handle-level limiters are `rateLimitStrict()`. No action needed next cycle.
- [Coverage]: `lib/gitlab/queries.ts` is now 100% stmts/branches/funcs/lines (was 71.8% branches, largest gap in repo). `svg-to-png.ts` and `campaigns/types.ts` also at 100%. Re-baseline expectations next cycle.
- [Documentation]: `/api/challenge` P2 gap closed (added to CLAUDE.md). JSDoc P3 carries on `lib/cache/redis.ts` were found ALREADY resolved on inspection (report was stale on this point) — verify before re-flagging in future cycles.
- [Cost Analyst / Performance]: No cost-surface or bundle-size impact from this cycle's changes — all test-only or small production fixes.
- [Triage next cycle]: `pre-launch-report.md` on disk is stale (predates the fixes above by an unknown margin) — recommend running a fresh `/pre-launch` audit rather than trusting the existing file, and consider adding audit-date disambiguation to future `[remediate]` issue titles to avoid the ID-collision pattern seen this cycle.
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

<!-- ENTRY:START agent=triage timestamp=2026-07-07T07:41:00Z -->
## Triage -- 2026-07-07
- **Reports processed**: 7 (cost-analyst GREEN, coverage GREEN, qa GREEN, performance GREEN, documentation GREEN, security GREEN, cc-rpi-update GREEN no-op)
- **Action items resolved**: 2 — (1) `apps/web/app/api/telemetry/route.ts` branch coverage raised 43.6% → 100% by adding tests for the `client_api_error` event path, full optional-field truncation (`stack`/`digest`/`path`/`source`), non-Error fire-and-forget rejections, non-object JSON bodies, and isolated per-handle rate-limit failures; (2) `packages/shared` config files (`package.json`, `tsconfig*.json`, `eslint.config.mjs`) excluded from vitest v8 coverage collection via a single glob, so the module aggregate now correctly reports 100% instead of the 89.7% config-file-noise figure. 8,193/8,193 tests, typecheck + lint clean.
- **Documentation report stale-finding check**: the 2026-07-03 documentation report's claim that `apps/web/lib/db/campaigns/types.ts` lacks JSDoc on 5 Zod-derived exports + schema was verified against current HEAD and found already resolved (JSDoc present since commit `9a0bdd1b`, predating that report's own run). No action taken; flagged as stale rather than re-fixed.
- **GitHub alerts**: Code scanning + secret scanning both disabled (403/404) — GHAS unavailable on this repo's tier, accepted permanent limitation, unchanged. Dependabot security alerts: 0 open.
- **Dependabot**: PR #924 (`actions/checkout` 6→7, major) remains deferred — unchanged, mergeStateStatus BEHIND but no conflict.
- **Summary**: Light cycle — 7/7 reports GREEN. Only two real action items, both coverage hygiene; everything else was a clean confirmation of previously-fixed items with zero regressions.

**Cross-agent recommendations:**
- [Coverage]: `app/api/telemetry/route.ts` now 100% stmts/branches/funcs/lines. `packages/shared` aggregate now correctly shows 100% — re-baseline expectations next cycle, no more config-file noise to explain away.
- [Documentation]: The `campaigns/types.ts` JSDoc P3 carry should be dropped from future reports — verified resolved, re-flagging it would be a false positive.
- [Security]: No action needed — GHAS-disabled state confirmed still the accepted baseline; no regression on `/api/challenge` rate limiting or any other previously-closed item.
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

<!-- ENTRY:START agent=coverage_agent timestamp=2026-07-03T00:03:44Z -->
## Coverage Agent — 2026-07-03
- **Status**: GREEN
- Overall coverage: 96.57% stmts / 92.72% branches / 95.51% funcs / 97.72% lines (474 files / 8,164 tests, all passing, 120.9s under --maxWorkers=3, HEAD `8516b06b`)
- Critical gaps: none in critical paths — lib/impact 99.6%, lib/render 100% stmts, app/api 97.3%, lib/db 97.5%. All three prior P3 triage items confirmed CLOSED: lib/gitlab now 100% stmts / 97.2% br (was 71.8% br), svg-to-png Sharp branch covered, campaigns/types.test.ts present. Remaining carries: i18n/provider.tsx 61.5% br (JSDOM), lazy wrappers 60–67% stmts, experiments Canvas/WebGL. New minor: packages/shared config files (tsconfig/eslint/package.json) leak into coverage map at 0% — add to vitest coverage exclude.
- Flaky tests: 0

**Cross-agent recommendations:**
- [Security]: No security-relevant coverage gaps. lib/auth 97.3%, lib/render 100% stmts (all SVG escapeXml paths exercised), lib/verification 100%, /api/challenge route covered within app/api 97.3%.
- [QA]: 0 flaky tests, suite grew 8,114 → 8,164 (+50 from the 2026-07-01 triage cycle's gitlab/svg-to-png/campaigns tests). Re-baselined per triage request — gitlab gap closed as promised. Only actionable item is the vitest coverage `exclude` cleanup for packages/shared config artifacts (cosmetic, P3).
<!-- ENTRY:END -->

<!-- ENTRY:START agent=coverage_agent timestamp=2026-07-06T00:06:18Z -->
## Coverage Agent — 2026-07-06
- **Status**: GREEN
- Overall coverage: 96.41% stmts / 92.19% branches / 95.35% funcs / 97.58% lines (8,168/8,168 tests, 476 files, HEAD `09666b59`)
- Critical gaps: none in `lib/impact` (99.6%), `lib/render` (100%), `app/api` (97.1%), `lib/db` (97.3%). Lowest branch coverage in repo is `apps/web/components/ClientErrorReporter.tsx` (33.3% branches) — client error-reporting path, not one of the four named critical modules but worth a follow-up test.
- Flaky tests: 0

**Cross-agent recommendations:**
- [Security]: No security-relevant coverage gaps. `lib/auth` 97.3%, `lib/render` 100% (all SVG escape paths covered), `lib/verification` 100%.
- [QA]: 0 flaky tests across two consecutive runs. `ClientErrorReporter.tsx` (33.3% branches) is the weakest spot in the repo — low risk but worth a look if QA is scanning client-side error UX.
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

<!-- ENTRY:START agent=coverage_agent timestamp=2026-07-07T00:05:02Z -->
## Coverage Agent — 2026-07-07
- **Status**: GREEN
- Overall coverage: 96.42% stmts / 92.17% branches / 95.40% funcs / 97.58% lines on HEAD `29d2b524` (v2.16.0). Suite grew 473→477 files, 8,114→8,174 tests (+60, from the reliability-hardening contract suite and v2.16.0 fixes). All passing, 112s under `--maxWorkers=3`.
- Critical gaps: only one — `app/api/telemetry/route.ts` at **43.6% branches** (durable-write observability branches from the reliability commits are untested despite two sibling test files). Everything else: lib/impact 99.6%, lib/render 100% stmts, app/api 97.1%, lib/db 97.3%. Prior largest gap `lib/gitlab/queries.ts` confirmed closed (100% stmts / 97.2% br module). `packages/shared` src/ files all 100% — the 89.7% aggregate is config-file noise (recommend coverage exclude).
- Flaky tests: 0

**Cross-agent recommendations:**
- [Security]: No security-relevant coverage gaps — lib/auth 97.3%, lib/render 100% stmts (all `escapeXml` paths covered), lib/verification 100%. The telemetry branch gap is observability-only, not an auth/input-validation surface.
- [QA]: Suite stable and clean at 8,174/8,174, 0 flakes. One P2 for triage: add branch tests for `app/api/telemetry/route.ts` failure/capture paths (43.6% br); plus P3 config hygiene to exclude `packages/shared` JSON/config files from v8 collection.
<!-- ENTRY:END -->
