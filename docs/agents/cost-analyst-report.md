# Cost Analyst Report
> Generated: 2026-06-06 | Health status: green

## Executive Summary
Cost surface is unchanged since the 2026-06-05 cycle — HEAD still pinned at `e275ae6c` with zero new commits, making this a pure carry/audit cycle. All Redis keys are TTL-bounded (3 fixed-cardinality singletons aside), all 10 base tables have FORCE RLS, and there are zero uncached external API calls. Estimated monthly cost at 10K users holds at **~$50–75/mo**.

## Redis Usage
- **Key patterns** (all per-user/per-entity keys carry explicit TTLs):
  - `stats:<handle>`, `svg:<handle>:<theme>`, `history:<handle>`, `config:<login>`, `supplemental:<handle>`, `craft:<handle>`, `snapshot:<handle>` — per-entity, bounded by user count, all TTL'd
  - `ratelimit:*` — short-window (60s) counters, self-expiring
  - `stats:dirty:<handle>` — 1h TTL same-day refresh marker
  - **3 persistent singletons (fixed cardinality, intentional)**: `stats:badges_generated` (counter), `stats:unique_badges` (HyperLogLog, ~12 KB fixed), `cron:warm-cache:offset` (rotation cursor, `warm-cache/route.ts:145`, TTL 0)
- **TTL coverage**: `cacheSet` default TTL 21,600s (`redis.ts:69`). 40 cache-write call sites across 24 files; the **only** intentional TTL-0 write is the warm-cache rotation offset (`warm-cache/route.ts:145`). `cacheIncr` refreshes TTL unconditionally after INCRBY (race-safe, `redis.ts:382-386`). `config:<login>` uses a 1-year TTL (31,536,000s) but PUT replaces the key (`studio/config/route.ts:73`) — no per-user accumulation.
- **Growth risk**: **LOW**. Every unbounded-cardinality key is TTL'd; the 3 TTL-0 singletons are all fixed-size.

## Database Usage
- **Tables**: 10 base tables (`users`, `metrics_snapshots`, `verification_records`, `feature_flags`, `merge_operations`, `tool_insights`, `email_campaigns`, `campaign_sends`, `user_platforms`, `supplemental_stats`). 25 migrations, latest `025_force_supplemental_stats_rls.sql`.
- **RLS**: 10/10 ENABLE + FORCE RLS (raw grep: 12 ENABLE = 10 tables + 2 view re-enables; 10 FORCE). Deny-all-anon policies intact.
- **Query patterns**: No N+1 in `lib/db/`. One bounded-fan-out: `dbGetCampaignStats()` runs 4 parallel COUNT queries (`campaigns.ts:790`) — efficient at normal volumes, flagged to convert to a single GROUP BY RPC above ~5,000 sends/campaign (cost **P2-1**, not yet triggered).
- **Connection management**: Lazy singleton client (`lib/db/supabase.ts:13`), `import "server-only"` guard (line 8), `persistSession: false`. One client per server instance, reused across requests.

## External API Calls
| Route | External Service | Cached | Rate Limited | Risk |
|-------|-----------------|--------|-------------|------|
| `/u/[handle]/badge.svg` | GitHub | ✅ cache-first (6h + 7d stale), in-flight dedup + Redis lock | ✅ | Low |
| `/api/profile/[handle]` | GitHub | ✅ cache-first | ✅ 60/60s | Low |
| `/api/refresh` | GitHub | ✅ writes cache | ✅ | Low |
| `/api/generate` | GitHub | ✅ writes cache | ✅ | Low |
| `/api/health` | GitHub (probe) | ✅ `unstable_cache` 60s | ✅ | Low |
| `/api/feature-flags` | Supabase | ✅ ISR 300s | ✅ | Low |
| `/api/cron/warm-cache` | GitHub | ✅ writes cache | n/a (CRON_SECRET) | Low |
| `/api/telemetry`, analytics | PostHog | ✅ batched fire-and-forget | n/a | Low |
| `/api/cron/sync-audience`, campaigns | Resend | n/a (admin/cron) | n/a (auth) | Low |

- **Uncached external calls: 0.** All GitHub reads are cache-first with in-flight dedup. 100% fetch-timeout coverage (`AbortSignal.timeout` — GitHub 15s, Resend 5s).

## Resource Management
- No unclosed connections — Redis and Supabase are lazy singletons reused across invocations; HTTP-based clients (no socket pooling needed).
- No unbounded in-memory buffers. The badge SVG in-flight dedup map is keyed by handle and cleared on resolution.
- All `fetch` calls bounded by `AbortSignal.timeout`. PostHog events are batched fire-and-forget (no accumulation).
- **Resource leak risks: 0.**

## Vercel Cost Factors
- **Function sizing**: Badge route `maxDuration=35` (`badge.svg/route.ts:29`) — 19th-cycle hold, justified by GitHub fetch + SVG render worst case. No oversized routes; per-route First Load JS omitted by Turbopack (bundle flat at 1,943 KB raw / 620 KB gzipped per performance 2026-06-04).
- **Edge vs serverless**: Serverless correct for all GitHub/Supabase/Redis-touching routes. Static pages (privacy, terms, archetypes, about) serve from CDN; feature-flags ISR (300s) and archetype pages CDN-cacheable.
- **Cache headers**: Badge success `s-maxage=21600 / stale-while-revalidate=86400`; error `s-maxage=300 / SWR=600` — minimizes origin invocations.

## Recommendations
1. **(P2-1, threshold-gated, carry)** Convert `dbGetCampaignStats()` 4-query COUNT fan-out to a single GROUP BY RPC once any campaign exceeds ~5,000 sends. Not yet triggered — no action needed now. Threshold comment in place (`campaigns.ts:790-792`).
2. **(Monitor M7, carry)** `config:<login>` 1-year TTL — confirmed safe (PUT replaces, no accumulation). Continue to monitor only if a config-versioning feature is added.
3. **No P1s. No new P2s/P3s.** Cost surface clean; revisit on next code change to a cost-bearing path.
