# Cost Analyst Report
> Generated: 2026-07-15 | Health status: green

## Executive Summary
Zero cost-surface delta for the fourth consecutive cycle — HEAD remains `9bfb9a6c` with no commits since 2026-07-10 and only uncommitted `docs/agents/*.md` report edits in the working tree. All cost guardrails (TTL coverage, SWR caching, fail-closed rate limiters, cron time budgets, landing-page ISR) re-verified against live source and intact; estimated cost at 10K users holds at ~$50–75/mo.

## Redis Usage
- Key patterns: `stats:<handle>` + `stats:stale:<handle>` (GitHub stats, 6h/7d), `svg:*` badge cache (24h + 0–2h jitter), `history:*` (24h), `rateLimit:*`/`ratelimit:*` (window-scoped, 1h–24h), `supplemental:<handle>` (24h), `stats:dirty:<handle>` (1h), `cron:warm-cache:offset` (persistent cursor), `stats:badges_generated` (INCR counter) + `stats:unique_badges` (HLL, ~12 KB cap)
- Cache-write call sites: **38 non-test, non-module** (`cacheSet`/`cacheIncr`/`cacheReserveQuota`/`cacheSetNx`) across 22 files — 78 total occurrences including tests and the redis module itself. Identical to the 2026-07-13 count.
- TTL coverage: default TTL 21,600s enforced in `cacheSet()` signature (`apps/web/lib/cache/redis.ts:82`). Exactly **1 intentional TTL-0** key: `cron:warm-cache:offset` rotation cursor (`apps/web/app/api/cron/warm-cache/route.ts:148`) — a single O(1) integer, by design. Warm-cache heartbeat carries its own TTL (`route.ts:231`).
- Growth risk: **LOW** — every per-user key expires within 7 days; the two persistent singletons are O(1)-bounded.

## Database Usage
- Tables: **11 tables + 2 views**, 28 migrations (latest `028_grant_service_role_access.sql`; no new tables this cycle)
- Query patterns: no N+1 patterns. The one known parallel-COUNT hotspot, `dbGetCampaignStats` (4 parallel COUNTs in `lib/db/campaigns/sends.ts`), remains bounded, admin-only, and threshold-gated — carried as P2-1, monitor-only.
- Connection management: **lazy singleton** (`apps/web/lib/db/supabase.ts:14`, `let _client` + `getSupabase()`), `server-only` import guard, `persistSession:false`, all queries wrapped in `withTimeout` (5s). Graceful null degradation when env vars absent.

## External API Calls
| Route | External Service | Cached | Rate Limited | Risk |
|-------|-----------------|--------|-------------|------|
| `/u/:handle/badge.svg` | GitHub GraphQL | 6h `CACHE_TTL` + 7d `STALE_TTL` SWR + in-flight dedup + Redis lock | CDN `s-maxage=21600` | Low |
| `/api/refresh` | GitHub GraphQL | Same `getStats()` path | Per-handle rate limit | Low |
| `/api/cron/warm-cache` | GitHub GraphQL | Rotation cursor bounds batch size | `CRON_SECRET` bearer | Low |
| `/api/cron/latency-check` | Own badge endpoint | n/a (synthetic probe) | `CRON_SECRET` bearer, 60s budget | Low |
| `/api/challenge` | Resend | n/a (transactional email) | IP 5/hr + handle 3/day, both `rateLimitStrict()` (`route.ts:24,81`) | Low |
| `/api/cron/sync-audience`, `/api/cron/process-campaigns` | Resend | Batch processors | `CRON_SECRET` bearer, 300s budget | Low |
| PostHog server events | PostHog | Fire-and-forget | Incident-bounded | Low |

- Uncached external calls: **0**. `_serveStaleAndReCache()` (`lib/github/client.ts:168`, `readOnly`-guarded) anti-thrash intact for both total-failure and degraded-fetch (#1002, `client.ts:311`) stale-serve paths — a sustained GitHub outage cannot cause refetch churn.

## Resource Management
- No resource leaks found. Supabase client is a module-level singleton (no per-request connections); Redis is Upstash REST (stateless HTTP, nothing to close); in-flight badge render dedup uses a Map that deletes entries on settle.
- No unbounded in-memory buffers. The HLL unique-badges structure is capped ~12 KB by algorithm.

## Vercel Cost Factors
- Function budgets verified in source + `vercel.json`: badge route `maxDuration=35`; `warm-cache`/`sync-audience`/`process-campaigns` = 300; `latency-check` = 60; `bulk-recalculate` = 300 (admin-only). 4 daily crons scheduled.
- Landing `/` is `force-static` + `revalidate: 3600` (`app/page.tsx:10-11`) — the highest-traffic route is CDN/ISR-served, so it contributes zero function invocations (#982 win holding).
- Badge responses ride `s-maxage=21600 / stale-while-revalidate=86400` — the majority of embed traffic never reaches a function.
- Bundle: 2,128 KB raw / 672 KB gzipped (2026-07-09 performance baseline). **Zero client-bundle delta** this cycle (no production code changed); below the 2,300 KB `ANALYZE=true` trigger.

## Recommendations
1. **(P2-1, carried — monitor only)** `dbGetCampaignStats` 4-parallel-COUNT: convert to a single `GROUP BY status` aggregate only if campaign volume grows; bounded and admin-only today, no action trigger this cycle.
2. **(P3-2, carried — monitor only)** `reconcileSnapshotWrite` dedup marker: not worth building preemptively per prior triage decision; re-evaluate only if duplicate snapshot writes appear in telemetry.
3. No new items. Four consecutive zero-delta cycles — if the codebase stays frozen, the next cycle can remain a fast verification pass.
