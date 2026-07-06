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

<!-- ENTRY:START agent=cost-analyst timestamp=2026-07-01T03:00:00Z -->
## Cost Analyst — 2026-07-01
- **Status**: GREEN
- Estimated monthly cost at 10K users: **~$50–75/mo**. Unchanged.
- **Cost-surface delta since 2026-06-30 cycle**: HEAD `e54c7a6b` — identical, zero new commits. Only uncommitted local diffs are agent-report markdown files (no application code). Zero new `cacheSet` calls, zero new Supabase queries, zero new external API calls.
- Redis: **29 non-redis-module `cacheSet()` calls, 28/29 explicit positive TTL** (re-verified). 1 persistent TTL-0: `cron:warm-cache:offset` cursor (`warm-cache/route.ts:146`, intentional rotation cursor). 2 direct-redis singletons: `stats:badges_generated` INCR + `stats:unique_badges` HLL (~12 KB, fixed cardinality). Two 365d overwrite keys: `studio:config:<login>`, `badge:notified:<handle>` (overwritten, not appended). Growth risk: LOW.
- Supabase: **11 user tables + 1 view = 12 active DB objects, 10/10 RLS-policy files confirm ENABLE+FORCE RLS** (migration 027 `studio_configs` included), 27 migrations total. Lazy singleton confirmed at `supabase.ts:13-34` (`_client` module cache), `import "server-only"` at line 8, `persistSession:false`. No N+1 found. `dbGetCampaignStats` 4-parallel-COUNT pattern unchanged (`sends.ts:251`, P2-1 carried, threshold-gated).
- External calls: **0 uncached**. GitHub 6h + 7d SWR + in-flight dedup + Redis lock; platforms 6h pos / 1h neg; health probe `unstable_cache` 60s; feature-flags s-maxage 60/SWR 300; PostHog + Resend fire-and-forget/batched. Fetch-timeout coverage: **100%** (11 files, `AbortSignal.timeout`/`AbortController`/`withTimeout`).
- Vercel: badge `maxDuration=35`; crons + bulk-recalc `=300`. Badge `s-maxage=21600/SWR=86400`, error `300/600`. ISR `force-static revalidate=3600` on 10 pages. Bundle **2,074 KB raw / 657 KB gzipped** (carried from 2026-06-25 measurement — no app-code change since, confirmed by identical HEAD).
- **P3-1 CARRIED, 5th cycle unresolved**: `/api/challenge` handle-level rate limit (3/day) still uses fail-open `rateLimit()` at `route.ts:81` — recommending this actually get fixed next triage cycle rather than continuing to carry it (one-line swap to `rateLimitStrict()`).
- **P2-1 CARRIED** (threshold-gated, no action needed yet): `dbGetCampaignStats` 4-query parallel COUNT. **MONITOR**: bundle — trigger `ANALYZE=true` if >2,300 KB raw.
- **P1s: NONE. P2s: 1 (P2-1). P3s: 1 (P3-1, recommend closing next cycle).**

**Cross-agent recommendations:**
- [Performance]: Bundle unchanged at 2,074 KB raw / 657 KB gzipped — no app-code delta since last measurement. M-bundle stays closed.
- [Security]: `/api/challenge` handle-level rate limit is fail-open — `rateLimitStrict()` at `route.ts:81` is the correct fix. This has now carried 5 cycles; recommend applying it rather than re-flagging again.
- [Coverage]: All cost-path modules ≥96% stmts per coverage agent's 2026-06-30/07-01 cycles. lib/cache 98.2%, lib/db 96.5%, app/api 97.3% — stable.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=cost-analyst timestamp=2026-06-30T03:00:00Z -->
## Cost Analyst — 2026-06-30
- **Status**: GREEN
- Estimated monthly cost at 10K users: **~$50–75/mo**. Unchanged.
- **Cost-surface delta since 2026-06-29 cycle**: HEAD `e54c7a6b` — identical. Delta commits are i18n hotfixes to `apps/web/app/page.tsx` + `.claude/` config only. Zero new `cacheSet` calls, zero new Supabase queries, zero new external API calls.
- Redis: **29 non-redis-module `cacheSet()` calls** (28 in lib/+app/api/ + 1 in `app/u/[handle]/og-image/route.ts:102`). **28/29 explicit positive TTL**. 1 persistent TTL-0: `cron:warm-cache:offset` cursor (`warm-cache/route.ts:146`). 2 direct-redis singletons: `stats:badges_generated` INCR + `stats:unique_badges` HLL (~12 KB). Two 365d overwrite keys: `studio:config:<login>`, `badge:notified:<handle>`. Growth risk: LOW.
- Supabase: **11 user tables + 1 view = 12 active DB objects, all 11 tables ENABLE + FORCE RLS**; 27 migrations (latest `027_create_studio_configs.sql`). Lazy singleton `supabase.ts:13–34`, `import "server-only"` :8, `persistSession:false`. No N+1. Warm-cache uses `dbGetLatestSnapshotBatch` single-query batch. `dbGetCampaignStats` 4 parallel COUNT queries (P2-1 carried, threshold-gated at >5K sends).
- External calls: **0 uncached** (non-auth). GitHub 6h + 7d SWR + in-flight dedup + Redis lock; platforms 6h pos / 1h neg; health probe `unstable_cache` 60s; feature-flags s-maxage 60/SWR 300; PostHog + webhook fire-and-forget; auth OAuth callbacks per-request by design. Fetch-timeout coverage: **100%**.
- Vercel: badge `maxDuration=35`; crons + bulk-recalc `=300`. Badge `s-maxage=21600/SWR=86400`, error `300/600`. ISR `force-static revalidate=3600` on 10 pages (archetypes ×7, about, privacy, terms, verify). Bundle **2,074 KB raw / 657 KB gzipped** (last measured 2026-06-25, no app-code change since).
- **P3-1 CARRIED**: `/api/challenge` handle-level rate limit (3/day) uses fail-open `rateLimit()` at `route.ts:81` — fix is one-line swap to `rateLimitStrict()`. Auth-gated + Resend limits compensate.
- **P2-1 CARRIED** (threshold-gated): `dbGetCampaignStats` 4-query parallel COUNT (`sends.ts:231`). **MONITOR**: bundle at 2,074 KB raw — trigger `ANALYZE=true` if >2,300 KB raw.
- **P1s: NONE. P2s: 1 (P2-1). P3s: 1 (P3-1).**

**Cross-agent recommendations:**
- [Performance]: Bundle unchanged at 2,074 KB raw / 657 KB gzipped. i18n page.tsx hotfixes are pure UI — no bundle impact. M-bundle stays closed.
- [Security]: `/api/challenge` handle-level rate limit (3/day) is fail-open — `rateLimitStrict()` at `route.ts:81` is the correct fix. Low exploitability (auth-gated + Resend limits compensate).
- [Coverage]: All cost-path modules ≥96% stmts per coverage agent 2026-06-30. lib/cache 98.2%, lib/db 96.5%, app/api 97.3% — stable for 3 cycles.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=cost-analyst timestamp=2026-06-29T03:00:00Z -->
## Cost Analyst — 2026-06-29
- **Status**: GREEN
- Estimated monthly cost at 10K users: **~$50–75/mo**. Unchanged.
- **Cost-surface delta since 2026-06-28 cycle**: HEAD `e54c7a6b` — zero code changes. Only `.claude/` config files modified (cc-rpi blueprint v1.25.0 sync + hook/script updates). Zero new `cacheSet` calls, zero new Supabase queries, zero new external API calls.
- Redis: **29 non-redis-module `cacheSet()` calls, 29/29 explicit positive TTL**. 1 persistent TTL-0: `cron:warm-cache:offset` cursor (`warm-cache/route.ts:146`). 2 direct-redis persistent singletons (fixed cardinality): `stats:badges_generated` INCR + `stats:unique_badges` HLL (~12 KB). Two 365d overwrite keys: `config:<login>`, `badge:notified:<handle>`. Growth risk: LOW.
- Supabase: **11 user tables + 1 view = 12 active DB objects, all 11 tables ENABLE + FORCE RLS**; 27 migrations (latest `027_create_studio_configs.sql`). Lazy singleton `supabase.ts:13–34`, `import "server-only"` :8, `persistSession:false`. No N+1. `dbGetCampaignStats` 4 parallel COUNT HEAD queries (P2-1 carried, threshold-gated).
- External calls: **0 uncached**. GitHub 6h + 7d SWR + in-flight dedup + Redis lock; platforms 6h pos / 1h neg; health probe `unstable_cache` 60s; feature-flags s-maxage 60/SWR 300; PostHog batched. Fetch-timeout coverage: **100%**.
- Vercel: badge `maxDuration=35`; crons + bulk-recalc `=300`. Badge `s-maxage=21600/SWR=86400`, error `300/600`. ISR `force-static revalidate=3600` on archetypes/about/privacy/terms/verify/u/[handle]. Bundle **2,074 KB raw / 657 KB gzipped** (last measured 2026-06-25, no app-code change since).
- **P3-1 CARRIED**: `/api/challenge` uses fail-open `rateLimit()` at handle level (`route.ts:81`) — fix is one-line swap to `rateLimitStrict()`.
- **P2-1 CARRIED** (threshold-gated): `dbGetCampaignStats` 4-query parallel COUNT. **MONITOR**: bundle at 2,074 KB raw — trigger `ANALYZE=true` if >2,300 KB raw.
- **P1s: NONE. P2s: 1 (P2-1). P3s: 1 (P3-1).**

**Cross-agent recommendations:**
- [Performance]: Bundle unchanged at 2,074 KB raw / 657 KB gzipped. Config-only sync — no bundle impact. M-bundle stays closed.
- [Security]: `/api/challenge` handle-level rate limit (3/day) is fail-open — `rateLimitStrict()` at `route.ts:81` is the correct fix. Low exploitability (auth-gated + Resend limits compensate).
- [Coverage]: All cost-path modules ≥96% stmts per coverage agent 2026-06-29. lib/cache 98.2%, lib/db 96.5%, app/api 97.3% — stable.
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

<!-- ENTRY:START agent=coverage_agent timestamp=2026-07-01T00:12:28Z -->
## Coverage Agent — 2026-07-01
- **Status**: GREEN
- Overall coverage: 96.31% stmts / 92.15% branches / 95.32% funcs / 97.52% lines on HEAD `e54c7a6b` (473 files / 8,114 tests, all passing). Numbers identical to 2026-06-28/29/30 cycles — fourth consecutive stable cycle, zero regressions.
- Critical gaps: only `apps/web/lib/gitlab` module below 80% (75.2% branches, driven by `lib/gitlab/queries.ts` at 71.8% br, 24 missed branches — OAuth/GraphQL error paths). No critical-path (`lib/impact/`, `lib/render/`, `app/api/`, `lib/db/`) file below 80% statements. Branch-level P3 carries unchanged: `lib/render/svg-to-png.ts` (66.7% br, Sharp error path), `lib/db/campaigns/types.ts` (88.7% stmts, no sibling test).
- Flaky tests: 0

**Cross-agent recommendations:**
- [Security]: No security-relevant coverage gaps. lib/auth 97.3%, lib/render 99.6% (all SVG escape paths covered), lib/verification 100%.
- [QA]: 0 flaky tests. Suite stable at 8,114/8,114 across 473 files for the 4th consecutive cycle — no new gaps introduced.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=cost_analyst timestamp=2026-07-01T01:07:51Z -->
## Cost Analyst — 2026-07-01
- **Status**: GREEN
- Redis key growth risk: low
- Uncached external calls: 0
- Resource leak risks: 0

**Cross-agent recommendations:**
- [Performance]: Bundle unchanged at 2,074 KB raw / 657 KB gzipped (no app-code delta since 2026-06-25 measurement). M-bundle stays closed.
- [Security]: `/api/challenge` handle-level rate limit (3/day) remains fail-open at `route.ts:81` — recommend applying the one-line `rateLimitStrict()` fix now rather than continuing to carry it across cycles (4+ cycles unresolved).
- [Coverage]: All cost-path modules remained ≥96% stmts per coverage agent's 2026-06-30/07-01 cycles (lib/cache 98.2%, lib/db 96.5%, app/api 97.3%) — stable, no action needed.
<!-- ENTRY:END -->
