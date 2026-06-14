# Cost Analyst Report
> Generated: 2026-06-14 | Health status: green

## Executive Summary
Infrastructure cost surface is unchanged for the 29th consecutive cycle — HEAD pinned at `5ef06c09` with no executable app-code change since the 2026-06-10 dependency bumps. Estimated monthly cost at 10K users remains **~$50–75/mo**; all per-user/per-entity Redis keys are TTL-bounded, all 10 Supabase base tables enforce FORCE RLS, and there are zero uncached external API calls.

## Redis Usage
- **Key patterns** (all bounded except fixed-cardinality singletons):
  - `stats:<handle>`, `svg:<handle>:<theme>`, `history:<handle>`, `supplemental:<handle>`, `config:<login>`, `badge:notified:<handle>`, `craft:*`, `avatar:*`, `og:*`, `stale:*`, `ratelimit:*`, `stats:dirty:<handle>` — all per-user/per-entity with explicit positive TTLs.
  - **3 persistent TTL-0 singletons only** (fixed cardinality, no per-user accumulation): `stats:badges_generated` (counter, `redis.ts:259`), `stats:unique_badges` (HyperLogLog ~12 KB fixed, `redis.ts:260`), `cron:warm-cache:offset` (rotation cursor, `warm-cache/route.ts:145` — the only intentional TTL-0 `cacheSet`).
- **TTL coverage**: `cacheSet` default TTL 21,600s with `ttlSeconds > 0` guard (`redis.ts:69,75-76`). **24 non-test `cacheSet` call sites; 23/24 carry an explicit positive TTL** — the lone exception is the bounded rotation cursor. `cacheIncr` refreshes TTL unconditionally after `INCRBY` (`redis.ts:382-386`); `cacheReserveQuota` refreshes TTL in-pipeline (`redis.ts:221`). Effective TTL coverage of growth-prone keys: **100%**.
- **Growth risk: LOW.** Two 1-year-TTL keys exist — `config:<login>` (31,536,000s, `studio/config/route.ts:73`) and `badge:notified:<handle>` (`MARKER_TTL = 31_536_000`, `notifications.ts:18,106`) — both overwrite-in-place with fixed cardinality (one row per user), so no unbounded accumulation. Redis client configured `retry: { retries: 0 }` (`redis.ts:36`) — no retry storms inflating command counts.

## Database Usage
- **Tables**: **10 base tables** — `users`, `metrics_snapshots`, `verification_records`, `feature_flags`, `merge_operations`, `tool_insights`, `email_campaigns`, `campaign_sends`, `user_platforms`, `supplemental_stats` (25 migrations, latest `025_force_supplemental_stats_rls.sql`).
- **RLS**: **10/10 ENABLE + FORCE** (raw grep: 12 ENABLE = 10 tables + 2 re-enables; 10 FORCE). Deny-all-anon policies in migrations 008 + 018.
- **Query patterns**: No N+1 in `lib/db/`. The only multi-round-trip path is `dbGetCampaignStats()` (4 parallel COUNT queries, `campaigns.ts:815-820`) — efficient at normal volumes, threshold-gated (see P2-1).
- **Connection management**: Lazy service-role **singleton** (`lib/db/supabase.ts:14-34`), `import "server-only"` boundary at line 8, `auth.persistSession: false`. Supabase-js is an HTTP REST client (no socket pool to leak). Health ping wrapped in `withTimeout`.

## External API Calls
| Route / Module | External Service | Cached | Rate Limited | Risk |
|----------------|-----------------|--------|-------------|------|
| `/u/[handle]/badge.svg` | GitHub GraphQL | Yes — Redis cache-first (6h + 7d SWR), in-flight dedup + Redis lock | Yes | Low |
| `/api/profile/[handle]` | GitHub (cache read) | Yes — serves cached stats | Yes (60/60s) | Low |
| `/api/health` | GitHub probe | Yes — `unstable_cache` 60s (`health/route.ts:59`) | Yes | Low |
| `/api/feature-flags` | Supabase | Yes — ISR `unstable_cache` 300s | n/a | Low |
| Resend (email send/webhook) | Resend API | n/a (transactional) | Daily send quota via `cacheReserveQuota` | Low |
| PostHog (telemetry) | PostHog | Batched fire-and-forget | n/a | Low |
| OAuth callbacks (GitHub/Bitbucket/Codeberg) | Provider token endpoints | n/a (auth flow) | Yes (login limiter) | Low |

- **Uncached external calls: 0.** Every server-side `fetch` to an external service carries an `AbortSignal.timeout` (8 modules: GitHub queries, Resend, GitHub/Bitbucket/Codeberg OAuth, health probe, avatar, server-error reporter) — no hung sockets billing serverless wall-time.

## Resource Management
- No unclosed connections: Redis and Supabase are both lazy singletons reused across invocations; neither holds a persistent socket pool.
- No unbounded in-memory buffers: badge/OG rendering produces a single SVG/PNG per request; the HyperLogLog unique-badge structure is fixed at ~12 KB regardless of user count.
- Badge route `maxDuration = 35` (`badge.svg/route.ts:29`) caps worst-case serverless execution; success responses `s-maxage=21600 / SWR=86400`, error responses `s-maxage=300 / SWR=600` keep CDN absorbing repeat traffic.
- **Resource leak risks: 0.**

## Recommendations
1. **P2-1 (carried, threshold-gated — no action yet):** Replace the 4-query parallel COUNT in `dbGetCampaignStats()` (`campaigns.ts:797-835`) with a single `GROUP BY` RPC if any campaign exceeds ~5,000 sends. Documented inline at `campaigns.ts:790-792`. Not triggered at current volume.
2. **MONITOR M7/M8 (carried — no action):** `config:<login>` and `badge:notified:<handle>` 1-year TTL keys — overwrite semantics, fixed cardinality. Continue to treat as no-growth; revisit only if key semantics change to append.
3. **No new P1/P2/P3 items.** Cost posture is optimal and stable.
