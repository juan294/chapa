# Cost Analyst Report
> Generated: 2026-06-16 | Health status: green

## Executive Summary
Cost surface is unchanged from the prior 31 cycles — estimated **~$50–75/mo at 10K users**. HEAD advanced `5ef06c09 → 2665ab9c` but only via cc-rpi blueprint sync v1.20.0, deps bumps (#852 production×4, #853 dev-and-types×2), dependabot-config alignment, and agent-tooling permission/script fixes — none touch app runtime. All key claims re-verified in source this cycle (not blind-carried).

## Redis Usage
- **Key patterns** (all per-user/per-entity keys TTL'd):
  - `stats:<handle>` (6h `CACHE_TTL`) + `stats:stale:<handle>` (7d `STALE_TTL`) — `github/client.ts:212-213`
  - `svg`/badge cache (`badge-svg-cache.ts:43`), `snapshot:` (`snapshot-cache.ts`), `craft:` (`craft-cache.ts`), `history:` (`history.ts:61`), `avatar:` (`avatar.ts:71`), `og:` (`og-image/route.ts:96`), `supplemental:<handle>` (24h), `dirty-stats` (1h), platform stats `bitbucket`/`codeberg` (`client.ts`)
  - `rateLimit:*` — fail-open limiter (documented accepted risk)
- **TTL coverage**: 24 non-test `cacheSet` call sites; **23/24 carry an explicit positive TTL**. The 1 exception is the bounded rotation cursor `cron:warm-cache:offset` (`warm-cache/route.ts:145`, TTL 0 — intentional). `cacheSet` default 21600s with `ttlSeconds>0` guard (`redis.ts:69,75-76`); `cacheIncr` refreshes TTL after INCRBY; `cacheReserveQuota` refreshes TTL in-pipeline. Client `retry:{retries:0}` (`redis.ts:36`).
- **Growth risk: LOW.** Only 3 persistent (TTL-0) singletons, all fixed-cardinality: `stats:badges_generated` (INCR counter), `stats:unique_badges` (HLL, ~12 KB fixed), `cron:warm-cache:offset` (rotation cursor). Two 1-year keys (`config:<login>` `studio/config/route.ts:73`, `badge:notified:<handle>` `notifications.ts:106`) are overwrite-semantics with fixed cardinality — no per-user accumulation.

## Database Usage
- **Tables**: 10 base tables, **10/10 ENABLE + 10/10 FORCE RLS** (verified: 10 FORCE statements across migrations 018 + 025; 25 total migrations, latest `025_force_supplemental_stats_rls.sql`).
- **Query patterns**: No N+1 in `lib/db/`. One bounded multi-query pattern carried as P2-1 (see below) — not an N+1, just 4 parallel COUNTs.
- **Connection management**: Singleton lazy service-role client (`supabase.ts:13-34`), `import "server-only"` boundary, `persistSession:false`, 5s `withTimeout` health probe.

## External API Calls
| Route | External Service | Cached | Rate Limited | Risk |
|-------|-----------------|--------|-------------|------|
| `/u/:handle/badge.svg` | GitHub | ✅ cache-first (6h + 7d SWR), in-flight dedup + Redis lock | ✅ (fail-open) | Low |
| `/api/profile/:handle` | GitHub | ✅ cache-first | ✅ 60/60s | Low |
| `/api/refresh` | GitHub | ✅ writes cache | ✅ | Low |
| `/api/health` | GitHub | ✅ `unstable_cache` 60s (`health/route.ts:59`) | ✅ | Low |
| `/api/feature-flags` | Supabase | ✅ ISR 300s | ✅ | Low |
| Email (Resend) | Resend | event-driven, daily quota via `cacheReserveQuota` | quota-gated | Low |
| Analytics (PostHog) | PostHog | batched fire-and-forget | n/a | Low |
| Bitbucket/Codeberg stats | platform APIs | ✅ `CACHE_TTL` | ✅ | Low |

**0 uncached external calls.** Server fetch-timeout coverage: 8 non-test server modules carry `AbortSignal.timeout` (GitHub queries, Resend, GitHub/Bitbucket/Codeberg OAuth, health probe, avatar, server-errors) = 100% of outbound server fetches.

## Resource Management
- No unclosed connections — Supabase singleton, Redis singleton with `retries:0` (fast-fail, no socket pile-up).
- No unbounded in-memory buffers. HLL for unique-badge counting is fixed ~12 KB. Avatar/OG buffers are per-request and GC'd.
- Badge route `maxDuration=35` (`badge.svg/route.ts:29`). Success `s-maxage=21600 / SWR=86400`, error `s-maxage=300 / SWR=600`.
- **Resource leak risks: 0.**

## Recommendations
1. **P2-1 (threshold-gated, carried)**: `dbGetCampaignStats()` runs 4 parallel COUNT queries (`campaigns.ts:806-820`). Efficient at normal volume; replace with a single GROUP BY RPC if any campaign exceeds ~5,000 sends. Threshold comment in place at `campaigns.ts:790-792`. Not yet triggered.
2. **MONITOR M7/M8 (carried)**: `config:<login>` and `badge:notified:<handle>` 1-year TTL keys — overwrite semantics, fixed cardinality, no per-user accumulation. No action needed.
3. **No P1s. 1 active P2 (threshold-gated). No P3s.**
