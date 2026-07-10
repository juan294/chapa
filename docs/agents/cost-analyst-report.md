# Cost Analyst Report
> Generated: 2026-07-10 | Health status: green

## Executive Summary
Infrastructure cost surface is unchanged and healthy: the delta since the 2026-07-09 cycle (`3a619e26 → 3c335b6e`, 4 commits) is test-only + docs + one cost-*reducing* refactor. Estimated steady-state cost at 10K users remains **~$50–75/mo**, with 0 uncached external calls and 0 unbounded-storage patterns.

## Redis Usage
- **Key patterns** (all TTL-bounded unless noted):
  - `stats:<handle>` / `stats:stale:<handle>` — GitHub-derived StatsData, `CACHE_TTL` primary + `STALE_TTL` 7d fallback (`github/client.ts:356,364`)
  - `stats:dirty:<handle>` — same-day refresh marker, `DIRTY_STATS_TTL` 1h (`cache/dirty-stats.ts:22`)
  - `svg:<handle>:<theme>` — rendered badge, per-handle-jittered TTL (`render/badge-svg-cache.ts:87`); render lock `cacheSetNx` `BADGE_RENDER_LOCK_TTL` (`badge.svg/route.ts:102`)
  - `history:<handle>` — snapshot list, `HISTORY_CACHE_TTL` (`history/history.ts:61`)
  - `supplemental:<handle>` — EMU merge payload, `SUPPLEMENTAL_TTL`/`CACHE_TTL` 24h (`client.ts:247`, `supplemental/route.ts:103`)
  - `ratelimit:*` — INCR + EXPIRE fixed-window, always TTL'd on first increment (`redis.ts:202,240`)
  - Cron heartbeats (`cron:lastrun:*`, warm-cache/sync-audience/process-campaigns) — `HEARTBEAT_TTL_SECONDS`
  - Bounded singletons: `stats:badges_generated` (INCR counter) + `stats:unique_badges` (HyperLogLog, ~12 KB fixed) — self-bounding, not per-user growth
  - Misc TTL'd: platform stats + neg-cache (`fetch-linked-platform.ts`), avatar data-URI, snapshot/craft caches, feature-flags, studio config, OG image, CLI device sessions, email dedup markers
- **TTL coverage**: **34/35 non-module `cacheSet`/`cacheIncr`/`cacheReserveQuota` call sites (97%) carry an explicit positive TTL.** Default `cacheSet` TTL = 21,600s / 6h (`redis.ts:82`). The lone TTL-0 (persistent) write is the warm-cache rotation cursor `cron:warm-cache:offset` (`warm-cache/route.ts:148`) — a single fixed key, intentional, not user-scoped.
- **Growth risk: LOW.** Every per-user key pattern is TTL-bounded (≤7d). No unbounded set/list accumulation. The two persistent keys are fixed-cardinality counters.

## Database Usage
- **Tables**: 11 tables + 2 views across **28 migrations** (028 = service-role grants; no new tables this cycle). RLS ENABLE + FORCE on all 11 tables per the 2026-07-06 security cycle; views are `SECURITY INVOKER` (014).
- **Query patterns**: No N+1. Data access goes through `lib/db/*` with parallelized COUNTs where needed. `dbGetCampaignStats` runs 4 parallel COUNT queries (P2-1, monitor-only, admin-only + threshold-gated — not a hot path). `statsComplete` gate (#1003) skips snapshot writes for poisoned stats, a small write reduction.
- **Connection management**: **lazy singleton** (`lib/db/supabase.ts`), `server-only`, `persistSession:false`, `withTimeout`-wrapped. One client instance per serverless container — no per-request connection churn.

## External API Calls
| Route / path | External Service | Cached | Rate Limited | Risk |
|-------|-----------------|--------|-------------|------|
| `getStats()` (badge, profile, refresh) | GitHub GraphQL | Yes — `stats:*` 6h + 7d SWR + in-flight dedup + Redis render lock | Yes (`rateLimit`) | Low |
| `fetch-linked-platform` (Bitbucket/Codeberg/GitLab) | Platform REST/GraphQL | Yes — 6h + neg-cache | via caller | Low |
| `/api/challenge` | Resend (email) | n/a (write) | Yes — `rateLimitStrict` IP 5/hr + handle 3/day | Low |
| `/api/cron/sync-audience` | Resend (audience) | Yes — `CONTACTS_CACHE_TTL` | CRON_SECRET | Low |
| `/api/admin/campaigns/[id]/test` | Resend (test email) | n/a | admin auth | Low |
| `/api/health` | GitHub API probe | 60s | Yes | Low |
| `/api/cron/latency-check` | own badge endpoint (synthetic) | read-only `__chapa_smoke=1` | CRON_SECRET, `maxDuration=60` | Low |
| PostHog (server events) | PostHog | fire-and-forget, incident-bounded | n/a | Low |

- **Uncached external calls: 0.** Every GitHub-hitting path passes through `getStats()` (cached + in-flight-deduped + Redis-locked). No route can trigger unbounded GitHub usage — cron/bulk use the server token and CDN `s-maxage=21600` fronts the badge route.

## Resource Management
- No unclosed connections: Supabase + Redis are lazy singletons; GitHub/platform fetches are `withTimeout`-wrapped across 23 lib files.
- `inflightBadgeRenders` Map is self-clearing (documented accepted risk).
- All `setInterval` usages are client components with cleanup refs — no serverless timers leak.
- No large in-memory buffers without limits: OG-image PNG is base64'd and cached, not retained; HLL is fixed ~12 KB.
- **`client.ts` P3-1 refactor (this cycle)**: the total-fetch-failure stale-serve path now mirrors the #1002 degraded-fetch anti-thrash pattern via a shared `_serveStaleAndReCache()` helper (`client.ts:168-177`) — re-caches stale into the primary key (6h TTL, guarded by `readOnly`). **Cost-reducing**: bounds GitHub refetch churn during a sustained upstream outage. Closes the P3-1 carried 5+ cycles.

## Vercel Cost Factors
- **Serverless sizing**: badge route `maxDuration=35`; 3 heavy crons `=300`; `latency-check` correctly scoped `=60` (good hygiene). No oversized routes.
- **Edge vs serverless**: appropriate — data-heavy routes stay serverless (Node runtime for Redis/Supabase/Sharp).
- **ISR/SSG**: landing `/` is `force-static` + `revalidate:3600` (#982) — the highest-traffic route is CDN/ISR-served, the biggest invocation-count win. Badge route CDN-fronted at `s-maxage=21600 / SWR=86400`. Bundle carried at 2,128 KB raw / 672 KB gzipped (per 2026-07-09 performance re-baseline) — no client-bundle delta this cycle (test/docs only), below the 2,300 KB `ANALYZE` trigger.

## Recommendations
- **P1s: NONE. P2s: 1 (carried). P3s: 1 (carried).**
- **P2-1 (carried, monitor-only)**: `dbGetCampaignStats` fires 4 parallel COUNT queries. Admin-only + threshold-gated, so not a live cost driver — revisit only if `campaigns/sends.ts` changes or campaign volume grows materially.
- **P3-2 (carried, monitor-only)**: `reconcileSnapshotWrite` alert fires per divergent write; add a per-incident dedup marker only if it gets noisy during a sustained Redis outage. Agent's own prior guidance: not worth building preemptively.
- **Closed this cycle**: P3-1 (`client.ts` stale-serve refetch churn) — resolved by the `_serveStaleAndReCache()` refactor; drop from carry lists.
- No new cost surface introduced. Steady-state estimate holds at ~$50–75/mo at 10K users.
