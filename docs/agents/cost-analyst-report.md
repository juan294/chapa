# Cost Analyst Report
> Generated: 2026-07-18 | Health status: green

## Executive Summary
Zero production delta since the 2026-07-17 cycle — HEAD is still `74bbcff0` (committed 2026-07-16 20:56 CEST); the working tree holds only `docs/agents/*.md` report edits and an untracked local `.codex/` tool-config dir (24 KB, gitignored territory, no cost surface). All cost surfaces were re-measured against live source this cycle rather than carried, and every figure held: 0 uncached external calls, 3 intentional no-TTL Redis keys (all fixed-cardinality singletons), 11/11 tables under ENABLE+FORCE RLS, and cron spend within the standing ~$50–75/mo estimate at 10K users. Both carried findings (P2 priority-handle ceiling bypass, P3 "~4%" comment) re-verified as still present and unfixed.

## Redis Usage
- Key patterns (from production write-site inventory, ~27 distinct patterns):
  - `stats:<handle>` / `stats:stale:<handle>` — 6h primary / 7d stale tier (`client.ts:19-20`)
  - `svg:<handle>:<theme>` — 24h + 0–2h per-handle jitter (badge SVG cache)
  - `history:*` / snapshot mirror keys — bounded TTLs via `snapshot-cache.ts`
  - `rateLimit:*` — short windows via `rateLimit()`/`rateLimitStrict()`
  - `supplemental:<handle>` (24h), `stats:dirty:<handle>` (1h), OAuth state nonces (TTL'd, `oauth-state.ts:68`), cron heartbeats, CLI device-auth keys
- Write sites: **42 production cache-write call sites** (`cacheSet`/`cacheIncr`/`cacheReserveQuota`/`cacheSetNx`) across **24 files** (tests and the cache module itself excluded). Prior cycle reported "44" — the small gap is counting methodology (this cycle's grep excludes `lib/cache/redis.ts` module-internal writes), not a code change; zero commits landed between the two measurements.
- TTL coverage: **100% of per-handle/per-user keys carry TTLs ≤7d.** Default TTL 21,600s (`redis.ts:82`). Exactly **3 no-TTL keys**, all intentional fixed-cardinality singletons with no per-handle fanout:
  1. `cron:warm-cache:offset` — rotation cursor (`warm-cache/route.ts:169`, explicit TTL 0)
  2. `stats:badges_generated` — O(1) INCR counter (`redis.ts:295`)
  3. `stats:unique_badges` — HyperLogLog, ~12 KB fixed (`redis.ts:296`)
- Growth risk: **low.** No unbounded key patterns.

## Database Usage
- Tables: **11** (+2 views), 28 migrations (latest `028_grant_service_role_access.sql`). **11/11 tables have both ENABLE and FORCE ROW LEVEL SECURITY** — re-verified this cycle with a schema-qualified grep (users, user_platforms, metrics_snapshots, verification_records, tool_insights, merge_operations, feature_flags, studio_configs, supplemental_stats, email_campaigns, campaign_sends).
- Query patterns: no N+1 patterns in `apps/web/lib/db/`. `reconcileSnapshotWrite` remains 1 DB round trip per call. Carried P2: `dbGetCampaignStats` issues 4 parallel COUNTs per call from the `process-campaigns` cron batch path (`campaigns.ts:164,188,280`) — bounded/O(1) per invocation, and per the 2026-07-17 correction it is **not** admin-only or threshold-gated in code (the ~5,000-send threshold exists only in a docstring, `sends.ts:224-226`).
- Connection management: lazy singleton (`lib/db/supabase.ts:13` `let _client`), `server-only` guard, `persistSession: false`, `withTimeout` wrapper. Upstash Redis is likewise a lazy singleton with retries disabled (`redis.ts:36`).

## External API Calls
| Route | External Service | Cached | Rate Limited | Risk |
|-------|-----------------|--------|-------------|------|
| `/u/:handle/badge.svg` | GitHub GraphQL | Yes - 6h/7d SWR + SVG cache + in-process inflight dedup | CDN `s-maxage=21600` | Low |
| `/api/refresh` | GitHub GraphQL | Yes - cache-first pipeline | Yes - `rateLimitStrict` | Low |
| `/api/cron/warm-cache` | GitHub GraphQL | Yes - only fetches on stats-cache miss | CRON_SECRET; 50/run ceiling (**but see P2**) | Low-Med |
| `/api/cron/latency-check` | Own badge endpoint + webhook | n/a (synthetic probe, 1/day) | CRON_SECRET | Low |
| `/api/cron/sync-audience` | Resend | Yes - daily batch, quota-budgeted | CRON_SECRET | Low |
| `/api/cron/process-campaigns` | Resend | Yes - daily batch, time/quota budget (`TIME_BUDGET_MS = maxDuration−30s`) | CRON_SECRET | Low |
| `/api/challenge` | Resend | n/a (transactional) | Yes - `rateLimitStrict` IP 5/hr + handle 3/day | Low |
| `/api/admin/bulk-recalculate` | GitHub GraphQL | Yes - cache pipeline | `ADMIN_SECRET` bearer | Low |
| Client analytics | PostHog | fire-and-forget | n/a | Low |

- **Uncached external calls: 0.** GitHub always flows through `getStats()` (6h `CACHE_TTL` + 7d `STALE_TTL`, `client.ts:19-20`) with in-process `_inflight` Map dedup (`client.ts:33`). Note the 2026-07-17 correction stands: there is **no cross-instance Redis lock on the GitHub fetch path** — the Redis lock is only in the badge render path.
- GitHub budget: warm-cache worst case 50 handles/hr = 50 of 5,000/hr ≈ **1%** of the authenticated budget (1 GraphQL call per handle). The in-code comment claiming "~4%" (`warm-cache/route.ts:45`) is still unfixed — it divides a daily total by an hourly budget.

## Resource Management
- No leaks found. Redis and Supabase clients are lazy module singletons (correct for serverless — no per-request connections to close). `_inflight` Map self-cleans via `finally` and is size-bounded by concurrent-handle count. Durable snapshot persist runs in `after()` off the response path (#1013). Avatar fetch is deadline-raced (`AVATAR_RACE_DEADLINE_MS=1000`) with a hard 2000ms abort underneath — two intentional layers, not a mismatch (per triage 2026-07-16; this flag is formally dropped).
- No unbounded in-memory buffers. The only unbounded-by-config input to a live job remains `WARM_CACHE_PRIORITY_HANDLES` (see P2 below).

## Recommendations
1. **P2 (carried, still open): cap `WARM_CACHE_PRIORITY_HANDLES` within the ceiling.** Priority handles are merged *after* the `MAX_HANDLES` slice (`warm-cache/route.ts:119-128`), so per-run work is `min(N,50) + |priority handles|`. Env-controlled and now live hourly. One-line fix: slice `toWarm` back to `MAX_HANDLES` after the merge, or reserve priority slots inside the ceiling.
2. **P2 (carried): `dbGetCampaignStats` 4-parallel-COUNT** — convert to a single `GROUP BY status` aggregate when convenient; not urgent (bounded, cron-only), but the docstring's phantom threshold should either be implemented or deleted.
3. **P3 (carried): fix the "~4%" comment** at `warm-cache/route.ts:45` to "~1% of the hourly budget (50/hr of 5,000/hr)". Documentation agent has independently confirmed this figure.
4. **P3 (carried): bundle-baseline sync with performance agent.** No rebuild this cycle (zero client-surface commits); the standing figure is 2026-07-17's measured **1,993 KB raw / 580 KB gzipped, 73 chunks, largest 227 KB** (CI gate 350 KB). The 638→580 KB gzip discrepancy vs performance's 2026-07-16 number remains a methodology question, not a real shrink — one joint measurement would settle the baseline.

**Estimated monthly cost at 10K users: ~$50–75/mo — unchanged.** Cron spend (~810 invocations/mo) is real since 2026-07-16 (#1052) and within estimate.
