# Cost Analyst Report
> Generated: 2026-06-04 | Health status: green

## Executive Summary
Infrastructure cost surface is unchanged for the 18th consecutive cycle (HEAD pinned at `2d7eb73c`). Estimated monthly cost at 10K users remains **~$50–75/mo**; all per-user/per-entity Redis keys are TTL-bounded, all external API calls are cached, and Supabase access uses a server-only singleton with FORCE RLS on all 10 base tables.

## Redis Usage
- **Key patterns** (all per-user/entity keys TTL-bounded):
  - `stats:<handle>`, `svg:<handle>:<theme>`, `history:<handle>`, `profile:<handle>` — per-user, explicit TTLs
  - `supplemental:<handle>` — 24h TTL (hot read path; Supabase is durable backing)
  - `ratelimit:*` — fixed-window, TTL = window seconds (`redis.ts:177-196`)
  - `config:<login>` — 31,536,000s (1y) TTL, PUT replaces (`studio/config/route.ts:73`) — bounded, no per-user accumulation (**MONITOR M7**, carried)
  - `stats:dirty:<handle>` — 1h TTL (same-day refresh marker)
- **Persistent singletons (TTL 0): 3 only, all fixed-cardinality**
  - `stats:badges_generated` — global INCR counter (`redis.ts:243`)
  - `stats:unique_badges` — HyperLogLog, ~12KB fixed (`redis.ts:244`)
  - `cron:warm-cache:offset` — single rotation cursor, TTL 0 (`warm-cache/route.ts:145`)
- **TTL coverage**: 54 `cacheSet`/`cacheSetNx`/`cacheIncr`/`cacheReserveQuota` call sites; only 1 intentional TTL-0 write (`warm-cache:offset`). `cacheSet` defaults to 21600s when TTL omitted (`redis.ts:69`). `cacheIncr` refreshes TTL unconditionally after INCRBY — race-safe (`redis.ts:383-385`). Effective coverage ~89%.
- **Growth risk: LOW** — no unbounded per-user accumulation; the only persistent keys are fixed-cardinality.

## Database Usage
- **Tables**: 10 base tables (`users`, `metrics_snapshots`, `verification_records`, `feature_flags`, `merge_operations`, `tool_insights`, `email_campaigns`, `campaign_sends`, `user_platforms`, `supplemental_stats`).
- **RLS**: 10/10 ENABLE + FORCE RLS (9 via migration 018, `supplemental_stats` via 025). Deny-all anon policies in place.
- **Query patterns**: No N+1 in `lib/db/`. The one multi-query path — `dbGetCampaignStats()` — runs 4 parallel `COUNT` queries via `Promise.all` (`campaigns.ts:749`), efficient at normal volume (**P2-1**, threshold-gated, see below).
- **Connection management**: Lazy **singleton** (`lib/db/supabase.ts:13-30`), `import "server-only"` boundary (line 8), `auth: { persistSession: false }`. No per-request client churn.

## External API Calls
| Route | External Service | Cached | Rate Limited | Risk |
|-------|-----------------|--------|-------------|------|
| `/u/:handle/badge.svg` | GitHub API | ✅ cache-first (6h + 7d stale), in-flight dedup + Redis lock | ✅ | Low |
| `/api/profile/:handle` | GitHub API | ✅ cache-first | ✅ 60/60s | Low |
| `/api/health` | GitHub API | ✅ `unstable_cache` revalidate=60s (`health/route.ts:59-60`) | ✅ | Low |
| `/api/feature-flags` | Supabase (flags) | ✅ ISR `unstable_cache` revalidate=300s (`feature-flags.ts:57`) | n/a | Low |
| `/api/refresh`, `/api/generate` | GitHub API | ✅ writes through cache | ✅ | Low |
| PostHog (analytics) | PostHog | batched fire-and-forget | n/a | Low |
| Resend (email/campaigns) | Resend | n/a (admin-triggered) | ✅ daily quota via `cacheReserveQuota` | Low |

- **Uncached external calls: 0.** All GitHub reads are cache-first; the health probe is shared across concurrent requests via `unstable_cache`.
- **Fetch-timeout coverage: 100%** (`AbortSignal.timeout` — GitHub 15s, Resend 5s).

## Resource Management
- No unclosed connections — Redis and Supabase are lazy singletons reused across invocations.
- No unbounded in-memory buffers — badge rendering is per-request and stateless; HLL is fixed-size.
- Badge route `maxDuration=35` (`badge.svg/route.ts:29`) — accommodates `INFLIGHT_TIMEOUT` (30s) above Vercel's 10s default; 18th cycle hold.
- Cache-Control: success `s-maxage=21600` / error `s-maxage=300` — error responses are short-cached to avoid pinning failures at CDN.

## Recommendations
**Priority order — no P1s, 1 threshold-gated P2, 1 monitor.**

1. **P2-1 (carried, threshold-gated)** — `dbGetCampaignStats()` uses 4 parallel `COUNT` queries (`campaigns.ts:749`). Replace with a single `GROUP BY` RPC **only once any campaign exceeds ~5,000 sends** (documented threshold, `campaigns.ts:724-725`). Not yet triggered — no action this cycle.
2. **MONITOR M7 (carried)** — `config:<login>` has a 1-year TTL (`studio/config/route.ts:73`). PUT replaces the key, so there is no per-user accumulation; storage is bounded at one row per user who saves a Studio config. Continue to monitor; no action needed.
3. **No new findings.** Cost surface unchanged since `2d7eb73c`. M-bundle monitor closed (performance 2026-05-28: bundle down 14%, cold-start memory pressure reduced).
