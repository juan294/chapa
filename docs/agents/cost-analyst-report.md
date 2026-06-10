# Cost Analyst Report
> Generated: 2026-06-10 | Health status: green

## Executive Summary
Infrastructure cost surface is unchanged from the prior cycle — estimated **~$50–75/mo at 10K users** holds. Code HEAD is `48206b13` (a triage agent-report markdown commit); the last executable cost-relevant change was `8e00aa18`, so this is the 25th consecutive carry/audit cycle with zero new cost risk. All Redis keys are bounded, all 10 base tables enforce RLS, and there are zero uncached external API calls.

## Redis Usage
- **Key patterns** (per-entity, all TTL'd unless noted):
  - `stats:<handle>`, `svg:<handle>:<theme>`, `history:<handle>`, `supplemental:<handle>`, `craft:*`, `snapshot:*`, `avatar:*` — all written via `cacheSet` with explicit positive TTL constants.
  - `ratelimit:*` — INCR + EXPIRE fixed-window; EXPIRE set on first increment (`redis.ts:188-189`).
  - `config:<login>` — TTL 31,536,000s (1y), PUT overwrites (`studio/config/route.ts:73`); fixed cardinality.
  - `badge:notified:<handle>` — TTL 1y, overwrite semantics (`lib/email/notifications.ts:106`); fixed cardinality.
  - **Persistent (TTL-0) singletons — 3 only, all fixed-cardinality:** `stats:badges_generated` (counter), `stats:unique_badges` (HyperLogLog, ~12KB fixed), `cron:warm-cache:offset` (rotation cursor).
- **TTL coverage**: 24 non-test `cacheSet` call sites; **23/24 carry an explicit positive TTL**. The single TTL-0 write is the bounded warm-cache rotation cursor (`warm-cache/route.ts:145`, `cacheSet(ROTATION_KEY, nextOffset, 0)`) — intentional and fixed-cardinality. `cacheIncr` refreshes TTL unconditionally after INCRBY (race-safe, `redis.ts:382-386`). `cacheReserveQuota` refreshes TTL in-pipeline (`redis.ts:221`). Effective TTL coverage on growth-bearing keys: **100%**.
- **Growth risk**: **LOW**. No per-user/per-entity key can accumulate unbounded — every variable-cardinality key has a TTL; the only persistent keys are fixed-cardinality singletons.

## Database Usage
- **Tables**: **10 base tables** (`users`, `metrics_snapshots`, `verification_records`, `feature_flags`, `merge_operations`, `tool_insights`, `email_campaigns`, `campaign_sends`, `user_platforms`, `supplemental_stats`). 25 migrations, latest `025_force_supplemental_stats_rls.sql`.
- **RLS**: **10/10 ENABLE + 10/10 FORCE** row-level security (raw grep: 12 ENABLE = 10 tables + 2 view/re-enable lines; 10 FORCE). Deny-all-anon policies intact.
- **Query patterns**: No N+1 in `lib/db/`. The one fan-out is `dbGetCampaignStats()` — 4 parallel COUNT queries (sent/pending/processing/failed, `campaigns.ts:805-818`), bounded and threshold-gated (P2-1 below).
- **Connection management**: **Lazy singleton** service-role client (`lib/db/supabase.ts:13-34`), `import "server-only"` (line 8), `auth.persistSession: false`. One client reused across all server invocations.

## External API Calls
| Route | External Service | Cached | Rate Limited | Risk |
|-------|-----------------|--------|-------------|------|
| `/u/[handle]/badge.svg` | GitHub | Yes — cache-first, 6h s-maxage + 7d stale; in-flight dedup + Redis lock | Yes | Low |
| `/api/profile/[handle]` | GitHub | Yes — same cache-first path | Yes (60/60s) | Low |
| `/api/refresh` | GitHub | Yes — writes through cache | Yes | Low |
| `/api/health` | GitHub probe | Yes — `unstable_cache` 60s | Yes | Low |
| `/api/feature-flags` | Supabase | Yes — ISR `unstable_cache` 300s | n/a | Low |
| `/api/cron/sync-audience`, campaigns | Resend | n/a (cron, batched) | n/a | Low |
| telemetry / events | PostHog | Batched fire-and-forget | n/a | Low |

- **Uncached external calls: 0.** Every GitHub-touching route reads cache first. Server fetches carry `AbortSignal.timeout` (GitHub 15s, Resend 5s, OAuth providers) — 100% timeout coverage. PostHog is batched/non-blocking.

## Resource Management
- No unclosed connections — Redis and Supabase are lazy singletons reused across invocations; no per-request client construction.
- No unbounded in-memory buffers. Badge SVG / OG-image generation is bounded per-request and cached to Redis.
- Badge route `maxDuration=35` (`badge.svg/route.ts:29`); success `s-maxage=21600 / SWR=86400`, error `s-maxage=300 / SWR=600` — caps serverless execution and shields origin via CDN.
- HyperLogLog for unique counts (fixed ~12KB) instead of a growing set — bounded by design.

## Recommendations
- **P2-1 (carried, threshold-gated)**: `dbGetCampaignStats()` issues 4 parallel COUNT round-trips. Replace with a single `GROUP BY` RPC if any campaign exceeds ~5,000 sends (`campaigns.ts:790-792`). Not yet triggered — no action this cycle.
- **MONITOR M7/M8 (carried, informational)**: `config:<login>` and `badge:notified:<handle>` carry 1-year TTLs. Both use overwrite semantics with fixed cardinality (one key per handle), so no per-user accumulation. No action.
- **No P1s. 1 P2 (threshold-gated). 0 P3s.** Cost posture: **GREEN**.
