# Cost Analyst Report
> Generated: 2026-06-19 | Health status: green

## Executive Summary

Infrastructure cost posture remains GREEN at an estimated **~$50–75/mo at 10K users**. HEAD advanced `63b18ac1 → b6cb414d` via a js-yaml CVE override (`b7b33ace`, build-tool only) and an agent report chore — zero app runtime change. **35th consecutive carry/audit cycle.** All key claims re-verified in source this cycle.

## Redis Usage

**Key patterns and TTLs (all 24 non-test `cacheSet` call sites verified):**

| Key pattern | TTL | Location |
|---|---|---|
| `stats:<handle>` | 6h (21600s) | `lib/github/client.ts:212` |
| `stats:stale:<handle>` | 7d (604800s) | `lib/github/client.ts:213` |
| `supplemental:<handle>` | 24h (86400s) | `app/api/supplemental/route.ts:76` |
| `svg:<handle>:<theme>` | 24h (86400s) | `lib/render/badge-svg-cache.ts:43` |
| `snapshot:<handle>` | 24h (86400s) | `lib/cache/snapshot-cache.ts:52,70` |
| `craft:<handle>` | 1h (3600s) | `lib/cache/craft-cache.ts:54,72` |
| `history:<handle>` | 1h (3600s) | `lib/history/history.ts:61` |
| `avatar:<url-hash>` | 6h (21600s) | `lib/render/avatar.ts:71` |
| `og:<handle>` | 48h (172800s) | `app/u/[handle]/og-image/route.ts:96` |
| `config:<login>` | 365d (31536000s) | `app/api/studio/config/route.ts:73` — overwrite, fixed cardinality |
| `badge:notified:<handle>` | 365d (31536000s) | `lib/email/notifications.ts:106` — overwrite, fixed cardinality |
| `stats:dirty:<handle>` | 1h (3600s) | `lib/cache/dirty-stats.ts:22` |
| `feature-flags:all` / `feature-flag:<key>` | 1h (3600s) | `lib/db/feature-flags.ts:98,140` |
| `engagement:current-campaign` | 1h (3600s) | `lib/db/campaigns.ts:542` |
| `resend:contacts` | 1h (3600s) | `app/api/cron/sync-audience/route.ts:48` |
| `score-bump:dedup:<handle>` | 7d (604800s) | `lib/email/score-bump.ts:160` |
| `events:dedup:*` | 7d | `app/api/webhooks/resend/route.ts` |
| `bb:<handle>` | 6h (21600s) | `lib/bitbucket/client.ts:68` |
| `cb:<handle>` | 6h (21600s) | `lib/codeberg/client.ts:80` |
| `cli:auth:<code>` | short-lived | `app/api/cli/auth/approve/route.ts:44` |
| `cron:warm-cache:offset` | **0 (persistent)** | `app/api/cron/warm-cache/route.ts:145` — bounded single rotation cursor |
| `stats:badges_generated` | **0 (persistent)** | `lib/cache/redis.ts:259` — INCR counter, single key |
| `stats:unique_badges` | **0 (persistent)** | `lib/cache/redis.ts:260` — HLL ~12KB fixed, single key |
| `rateLimit:*` | window-bounded | `lib/cache/redis.ts:177–195` — auto-expires with window |

- **TTL coverage**: 23/24 call sites carry explicit positive TTL. 1 exception = bounded warm-cache rotation cursor (single key, intentional).
- **3 persistent TTL-0 singletons**: rotation cursor + INCR total counter + HLL unique counter. None accumulate per-user — all bounded single-key globals.
- **Two 1-year keys**: `config:` and `badge:notified:` — both are overwrite patterns with fixed cardinality per user, no unbounded accumulation.
- `cacheSet` default TTL = 21600s; `ttlSeconds > 0` guard at `redis.ts:75–76` prevents accidental zero-TTL writes.
- Client config: `retry: { retries: 0 }` (`redis.ts:36`) — no retry storm risk.
- **Growth risk: LOW**

## Database Usage

- **Tables**: 10 base tables (`users`, `metrics_snapshots`, `verification_records`, `feature_flags`, `merge_operations`, `tool_insights`, `email_campaigns`, `campaign_sends`, `user_platforms`, `supplemental_stats`)
- **Migrations**: 25 total, latest `025_force_supplemental_stats_rls.sql`
- **RLS**: 10/10 ENABLE + 10/10 FORCE RLS across all tables; deny-all-anon policies in migrations 008 + 018
- **Query patterns**: No N+1 patterns detected in `lib/db/`. Warm-cache cron batches snapshot pre-fetches in one query. `dbGetCampaignStats()` uses 4 parallel COUNTs — threshold-gated, only materializes at >5K sends/campaign (P2-1, carried)
- **Connection management**: Singleton lazy service-role client (`supabase.ts:13–34`), `import "server-only"` at line 8, `persistSession: false` — no session storage overhead, single connection reused across requests in the same serverless instance lifetime

## External API Calls

| Route | External Service | Cached | Rate Limited | Risk |
|---|---|---|---|---|
| `GET /u/[handle]/badge.svg` | GitHub GraphQL | Yes — 6h primary + 7d stale SWR | Yes — Redis sliding window + in-flight dedup lock | LOW |
| `GET /api/profile/[handle]` | GitHub (via shared stats fetch) | Yes — same 6h + 7d SWR | Yes — 60 req/60s | LOW |
| `GET /api/health` | GitHub probe | Yes — `unstable_cache` 60s | Yes — 5 req/60s | LOW |
| `GET /api/feature-flags` | (none — Supabase only) | Yes — ISR `s-maxage=60/SWR=300` | N/A | LOW |
| `POST /api/generate` | GitHub GraphQL | Yes — cache-first, writes on miss | Yes | LOW |
| `POST /api/refresh` | GitHub GraphQL | Bypasses cache intentionally | Yes — rate limited | LOW |
| Resend (email) | Resend API | N/A (event-driven sends) | Yes — `cacheReserveQuota` daily quota | LOW |
| PostHog (analytics) | PostHog | N/A (batched fire-and-forget) | N/A | LOW |

- **Uncached external calls**: 0
- **Fetch timeout coverage**: 100% of outbound server fetches carry `AbortSignal.timeout` or `withTimeout` across 23 server modules

## Resource Management

- **Redis client**: Lazy singleton with fail-open on unavailability — no connection leak risk. `retry: {retries: 0}` prevents hanging retries.
- **Supabase client**: Lazy singleton, `persistSession: false`, `server-only` boundary enforced — no session state accumulated.
- **In-flight dedup**: Badge route uses Redis lock to prevent concurrent GitHub fetches for the same handle — no thundering herd on cold start.
- **Serverless function limit**: Badge route `maxDuration=35` (`badge.svg/route.ts:29`) — bounded execution time.
- **Response caching**: Badge success `s-maxage=21600 / SWR=86400`; badge error `s-maxage=300 / SWR=600`; share page ISR `revalidate=3600` — CDN absorbs the majority of badge traffic.
- **No unbounded in-memory buffers**: `lib/feature-flags.ts` uses a module-level `Map` with 5-minute TTL check (`FLAG_CACHE_TTL_MS = 5 * 60 * 1000`, line 39) — bounded to the number of feature flag keys (small, finite set).
- **No resource leak risks identified.**

## Vercel Cost Factors

- **Bundle**: 1,950 KB raw / 623 KB gzipped (77 chunks, performance 2026-06-18). Flat for 11 consecutive cycles. No route exceeds 500 KB First Load JS.
- **Edge vs serverless**: Badge route runs as serverless (Node.js runtime, `maxDuration=35`). Static pages (4) and ISR pages (48) minimize serverless invocations.
- **ISR/SSG opportunities**: Archetype pages, about pages, feature-flags endpoint all use ISR — already optimized. No static-ish pages running as pure dynamic routes.
- **Cold start memory**: No oversized routes; largest chunks are framework/vendor (228/192/156 KB raw). No cold-start memory pressure.
- **`"use client"` count**: 105 (non-test) — appropriate level; key public pages (`/`, `/about`, `/u/[handle]`, archetypes) confirmed as server components.

## Recommendations

**P1 — None.**

**P2 (active, threshold-gated):**
- **P2-1**: `dbGetCampaignStats()` executes 4 parallel `COUNT` queries (`lib/db/campaigns.ts:790–820`). Not a current concern (threshold requires >5K campaign sends), but a future optimization for high-volume campaign use would be a single aggregation query or materialized stats column. Threshold comment in place.

**Monitors (no action):**
- **M7**: `config:<login>` 1-year TTL — overwrite pattern, fixed cardinality. No accumulation risk.
- **M8**: `badge:notified:<handle>` 1-year TTL — overwrite pattern, fixed cardinality. No accumulation risk.

**P3 — None.**

**New this cycle:**
- `b7b33ace` adds `"js-yaml": ">=4.2.0"` pnpm override for CVE-2026-53550. js-yaml is a build/dev dependency (js-yaml → yaml-loader → webpack) — zero production runtime or cost-surface impact.
