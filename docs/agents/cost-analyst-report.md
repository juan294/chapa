# Cost Analyst Report
> Generated: 2026-06-25 | Health status: green

## Executive Summary
First cost cycle on **v2.14.0** (HEAD `f9d30758`). The only cost-surface change since the 2026-06-21 cycle is the share-page score-transparency panel (#932) and locale-aware static pages — both pure client/server computation over already-fetched data with zero new external calls and zero new cache keys. Estimated monthly cost at 10K users holds at **~$50–75/mo**.

## Redis Usage
- **Key patterns** (per-user/entity, all TTL'd):
  - `stats:v2:<platform>:<handle>` (GitHub + linked platforms) — 6h (`CACHE_TTL=21600`), `:neg` negative-cache 1h (`NEG_CACHE_TTL=3600`)
  - `stats:stale:<handle>` — 7d SWR (`STALE_TTL=604800`)
  - `svg:<handle>:<theme>` badge output — 24h base + 0–2h jitter (`badge-svg-cache.ts:25-26`)
  - `og:<handle>` OG image — TTL'd (`og-image/route.ts`)
  - `history:<handle>` — 1h (`HISTORY_CACHE_TTL=3600`)
  - `snapshot:<handle>` — 24h (`SNAPSHOT_TTL=86400`)
  - `craft:<handle>` — 1h (`CRAFT_CACHE_TTL=3600`)
  - `avatar:<url>` — 6h (`AVATAR_CACHE_TTL=21600`)
  - `supplemental:<handle>` — 24h (`SUPPLEMENTAL_TTL=86400`)
  - `stats:dirty:<handle>` — 1h (`DIRTY_STATS_TTL=3600`)
  - `ratelimit:*` — short fixed-window via INCR+EXPIRE
  - `oauth-state:<state>` — 10m (`TTL_SECONDS=600`)
- **TTL coverage**: **23/24 non-test `cacheSet` sites carry an explicit positive TTL** (~96%). `cacheSet` default is 21600s with a `ttlSeconds > 0` guard (`redis.ts:75-76`); client is `retry:{retries:0}` (`redis.ts:36`).
- **Growth risk: LOW.** Only 3 persistent (TTL-0) keys, all fixed cardinality:
  - `cron:warm-cache:offset` — single rotation cursor (`warm-cache/route.ts:146`)
  - `stats:badges_generated` — single INCR counter (`redis.ts:244`)
  - `stats:unique_badges` — single HyperLogLog (~12 KB fixed, `redis.ts:245`)
  - Two 365-day overwrite keys (bounded cardinality, overwrite-in-place, no accumulation): `config:<login>` (`studio/config/route.ts`) and `badge:notified:<handle>` (`MARKER_TTL=31_536_000`, `notifications.ts:18`) — **MONITOR M7/M8**, carried, no action.

## Database Usage
- **Tables**: 10 base tables, **26 migrations** (latest `026_seed_integration_flags.sql`). RLS: ENABLE + FORCE on all 10 (FORCE applied via migrations 018 + 025; deny-all-anon policies in 008/018).
- **Query patterns**: efficient. No N+1 — `dbGetCampaignStats` uses 4 parallel `count:"exact", head:true` COUNTs (`sends.ts:243,251`) → zero row transfer; warm-cache cron batch-prefetches snapshots in one query. New #932 panel does **no** DB I/O.
- **Connection management**: lazy service-role **singleton** (`supabase.ts:13-34`), `import "server-only"` guard, `persistSession:false`. Reused across invocations; no per-request client churn.

## External API Calls
| Route | External Service | Cached | Rate Limited | Risk |
|-------|-----------------|--------|-------------|------|
| `/u/[handle]/badge.svg` | GitHub | Yes — 6h + 7d SWR + in-flight dedup + Redis render lock | Yes | Low |
| `/api/profile/[handle]` | GitHub | Yes — same cache-first path | Yes (60/60s) | Low |
| `/api/history/[handle]` | (Redis/Supabase only) | Yes — 1h | Yes | Low |
| `/u/[handle]/og-image` | GitHub (via stats) | Yes — TTL'd | Yes | Low |
| platform stats (BB/CB/GitLab) | Bitbucket/Codeberg/GitLab | Yes — 6h pos + 1h neg | n/a (auth) | Low |
| `/api/health` | GitHub probe | Yes — `unstable_cache` 60s | Yes | Low |
| `/api/feature-flags` | (Supabase) | Yes — ISR s-maxage 60 / SWR 300 | n/a | Low |
| email (campaigns/notifications) | Resend | event-driven + daily quota (`cacheReserveQuota`) | quota-gated | Low |
| analytics | PostHog | batched fire-and-forget | n/a | Low |
- **Uncached external calls: 0.** All outbound GitHub reads are cache-first with in-flight de-duplication and a Redis render lock to collapse thundering-herd on cold keys. **Fetch-timeout coverage: 100%** (`AbortSignal.timeout` / `withTimeout`).

## Resource Management
- No unclosed connections: Redis + Supabase are lazy singletons; no per-request client allocation.
- No unbounded in-memory buffers: `_inflight` map (`github/client.ts`) and `inflightBadgeRenders` map (`badge.svg/route.ts`) self-evict on settle; `flagCache` is a small TTL'd in-process map (5m). HyperLogLog for unique badges is fixed ~12 KB.
- All `cacheSet` writes route through the `ttlSeconds > 0` guard — no accidental persistent keys from the default path.
- New #932 code holds no module-level mutable state — no leak surface.

## Recommendations
- **P1: none.**
- **P2-1 (carried, threshold-gated, monitor-only):** `dbGetCampaignStats` runs 4 parallel COUNTs per call (`sends.ts:251`). Zero row transfer; only worth collapsing into a single grouped query if a campaign exceeds ~5K sends. No action below that threshold.
- **Monitor M7/M8 (carried):** 365-day overwrite keys `config:<login>` and `badge:notified:<handle>` — overwrite-in-place, fixed cardinality, no accumulation. No action.
- **P3: none new.** Vercel posture unchanged: badge `maxDuration=35`; crons + bulk-recalc `=300`; badge success `s-maxage=21600 / SWR=86400`, error `300/600`; ISR `force-static revalidate=3600` on archetypes/about/privacy/verify. Bundle flat at ~1,950 KB raw / 623 KB gzipped.
