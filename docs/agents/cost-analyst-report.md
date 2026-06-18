# Cost Analyst Report
> Generated: 2026-06-18 | Health status: green | HEAD: `63b18ac1`

## Executive Summary

No cost-surface change for the 33rd consecutive cycle. HEAD `63b18ac1` is a CI-only upgrade (pnpm/action-setup@v4→@v5); zero executable app-code changed. All prior findings carry unchanged: 0 uncached external calls, 23/24 cacheSet sites TTL'd, 10/10 Supabase tables FORCE RLS, 100% server fetch-timeout coverage, and P2-1 campaign stats query threshold guard still in place.

---

## Redis Usage

**Key patterns and TTLs** (all non-test cacheSet call sites — 24 total, 23/24 positive TTL):

| Key pattern | TTL | Source |
|-------------|-----|--------|
| `stats:<handle>` | 21 600s (6h) | `github/client.ts:212` |
| `stats:stale:<handle>` | 604 800s (7d) | `github/client.ts:213` |
| `supplemental:<handle>` | 86 400s (24h) | `github/client.ts:169` |
| `svg:<handle>:<theme>` | 86 400s (24h) | `badge-svg-cache.ts:43` |
| `craft:<handle>` | 3 600s (1h) | `craft-cache.ts:54,72` |
| `snapshot:<handle>` | 86 400s (24h) | `snapshot-cache.ts:52,70` |
| `avatar:<url-hash>` | 21 600s (6h) | `avatar.ts:71` |
| `history:<handle>` | 3 600s (1h) | `history.ts:61` |
| `dirty-stats:<handle>` | 3 600s (1h) | `dirty-stats.ts:22` |
| `feature-flags:all` | 3 600s (1h) | `db/feature-flags.ts:98` |
| `feature-flags:<key>` | 3 600s (1h) | `db/feature-flags.ts:140` |
| `engagement-campaign` | 3 600s (1h) | `db/campaigns.ts:542` |
| `config:<login>` | 31 536 000s (1y, overwrite) | `studio/config/route.ts:73` |
| `badge:notified:<handle>` | 31 536 000s (1y, overwrite) | `notifications.ts:106` |
| `events:dedup:<webhook-id>` | 604 800s (7d) | `webhooks/resend/route.ts:98` |
| `email:dedup:<hash>` | 604 800s (7d) | `email/score-bump.ts:160` |
| `og:<handle>` | 172 800s (48h) | `og-image/route.ts:96` |
| `supplemental:<handle>` (API) | 86 400s (24h) | `api/supplemental/route.ts:76` |
| `resend-contacts` | 3 600s (1h) | `cron/sync-audience/route.ts:48` |
| `cli:device:<code>` | 300s (5 min) | `cli/auth/approve/route.ts:44` |
| `bb:<handle>` | 21 600s (6h) | `bitbucket/client.ts:68` |
| `cb:<handle>` | 21 600s (6h) | `codeberg/client.ts:80` |
| `rateLimit:*` | window-scoped (INCR+EXPIRE) | `redis.ts:177–195` |
| `cron:warm-cache:offset` | **0 (persistent)** — bounded cursor | `warm-cache/route.ts:145` |

**Persistent TTL-0 singletons (3):** `cron:warm-cache:offset` (bounded rotation cursor), `stats:badges_generated` (INCR counter, `redis.ts:259`), `stats:unique_badges` (HyperLogLog ~12KB fixed, `redis.ts:260`).

- **TTL coverage:** 23/24 call sites carry explicit positive TTL. The 1 exception is the bounded rotation cursor — intentional.
- **1-year keys (M7/M8):** `config:` and `badge:notified:` use 1y TTL with overwrite semantics (not per-user accumulation). Fixed cardinality — no growth risk.
- **Default guard:** `cacheSet` defaults to 21 600s with a `ttlSeconds > 0` guard (`redis.ts:69,75–76`) preventing accidental persistent keys.
- **Growth risk:** LOW. No unbounded accumulation patterns. HLL caps at ~12KB regardless of developer count.

---

## Database Usage

- **Tables:** 10 base tables — `users`, `metrics_snapshots`, `verification_records`, `feature_flags`, `merge_operations`, `tool_insights`, `email_campaigns`, `campaign_sends`, `user_platforms`, `supplemental_stats`
- **Migrations:** 25 total (`supabase/migrations/`); latest `025_force_supplemental_stats_rls.sql`
- **RLS:** 10/10 ENABLE + FORCE RLS. Migration 018 forces 9 tables; migration 025 forces `supplemental_stats`. Deny-all-anon policies in 008 + 018.
- **Connection management:** Lazy singleton (`supabase.ts:13–34`), `import "server-only"` line 8, `persistSession: false`, 5s `withTimeout` health probe. No per-request client creation.
- **Query patterns:** No N+1 detected in `lib/db/`. Warm-cache cron explicitly batches snapshot pre-fetches in one query (`warm-cache/route.ts:113`).

**P2-1 (carried):** `dbGetCampaignStats()` issues 4 parallel COUNT queries (`campaigns.ts:790–820`). Threshold comment documents this is acceptable at <5K sends/campaign. Not triggered in current usage.

---

## External API Calls

| Route / Module | External Service | Cached | Rate Limited | Risk |
|----------------|-----------------|--------|-------------|------|
| `lib/github/client.ts` | GitHub API (GraphQL + REST) | ✅ 6h + 7d stale | ✅ Redis sliding window + in-flight dedup lock | LOW |
| `app/api/health/route.ts` | GitHub rate_limit probe | ✅ `unstable_cache` 60s | ✅ cron/admin only | LOW |
| `lib/codeberg/client.ts` | Codeberg API | ✅ 6h Redis | ✅ Redis sliding window | LOW |
| `lib/bitbucket/client.ts` | Bitbucket API | ✅ 6h Redis | ✅ Redis sliding window | LOW |
| `lib/email/notifications.ts` | Resend (email send) | ✅ `cacheSetNx` dedup 7d | ✅ Daily quota via `cacheReserveQuota` | LOW |
| `lib/email/audience.ts` | Resend (audience sync) | ✅ contacts cache 1h | ✅ cron-only | LOW |
| `lib/email/resend.ts` / `campaigns.ts` | Resend (bulk sends) | ✅ `cacheReserveQuota` daily limit | ✅ lease-token claim pattern | LOW |
| `lib/analytics/server-errors.ts` | PostHog ingestion | ❌ fire-and-forget | N/A (batched, not user-triggered) | LOW |
| `lib/render/avatar.ts` | User avatar URL (external) | ✅ 6h Redis (`avatar:<hash>`) | N/A | LOW |
| `app/u/[handle]/og-image/route.ts` | Avatar + Satori render | ✅ 48h Redis | ✅ rate limit 30/60s | LOW |
| `app/api/feature-flags/route.ts` | n/a (Supabase internal) | ✅ ISR 60s / SWR 300s | N/A | LOW |

**Uncached external calls:** 0. Every user-triggered path is cache-first before hitting external services.

**Fetch-timeout coverage:** 100% of outbound server fetches carry `AbortSignal.timeout()` or `withTimeout()`. Verified across: `lib/auth/github.ts`, `lib/auth/bitbucket.ts`, `lib/auth/codeberg.ts`, `lib/github/queries.ts`, `lib/render/avatar.ts`, `lib/email/*`, `lib/analytics/server-errors.ts`, `app/api/health/route.ts`, `app/u/[handle]/badge.svg/route.ts`, `app/u/[handle]/og-image/route.ts`.

---

## Resource Management

- **Redis client:** Lazy singleton with `retry: { retries: 0 }` (`redis.ts:36`). No connection pool exhaustion risk on serverless (each invocation reuses or creates one connection).
- **Supabase client:** Lazy singleton, `persistSession: false`. No resource leak.
- **In-flight badge dedup:** Redis lock TTL 30s (`badge.svg/route.ts:31`) prevents concurrent serverless invocations from hammering GitHub for the same handle.
- **No unbounded in-memory caches.** No LRU or memoization structures without a bound.
- **Campaign lease tokens:** `dbClaimPendingSends` uses Postgres-level claim with expiry to prevent double-send. No resource leak.
- **`fail-open` rate limiter** (accepted risk, documented): Redis unavailability passes all requests. GitHub's own limits + CDN `s-maxage` provide secondary protection.

---

## Vercel Cost Factors

**Serverless function `maxDuration` overrides:**

| Route | maxDuration | Reason |
|-------|-------------|--------|
| `badge.svg/route.ts` | 35s | GitHub fetch + render pipeline |
| `bulk-recalculate/route.ts` | 300s | Admin batch operation |
| `cron/sync-audience/route.ts` | 300s | Resend audience sync |
| `cron/process-campaigns/route.ts` | 300s | Campaign batch processor |
| `cron/warm-cache/route.ts` | 300s | Daily cache warming |

All other routes: default (unset — inherits plan limit). The 300s routes are cron/admin and do not run on user requests.

**Caching strategy:**
- Badge SVG: `s-maxage=21600 / SWR=86400` (success), `s-maxage=300 / SWR=600` (error) — CDN absorbs the vast majority of badge hits
- OG image: `s-maxage=21600 / SWR=86400`
- `/u/[handle]` share page: ISR `revalidate=3600` (1h) — reduces serverless invocations for popular profiles
- `/api/feature-flags`: `s-maxage=60 / SWR=300` — serves most flag reads from CDN edge
- Static files (`/llms.txt`, `/security.txt`, `/og-image`): `s-maxage=86400 / SWR=86400`
- `/api/verify/[hash]`: `s-maxage=3600 / SWR=86400`

**ISR/SSG opportunities:** Share page already ISR (1h). Archetype/About pages served as static routes (`generateStaticParams` pattern). No obvious remaining SSG opportunities — remaining dynamic routes require auth or user-specific data.

**Bundle size (from performance agent 2026-06-11):** 1,949 KB raw / 622.6 KB gzipped (77 chunks). 0 routes >500KB. Cold-start memory pressure: LOW.

---

## Recommendations

| Priority | Item | Action |
|----------|------|--------|
| P2 | **Campaign stats N+1 threshold** (`campaigns.ts:790–820`) | Monitor if campaign volume exceeds 5K sends/campaign. At that point, replace 4-query parallel COUNT with a single aggregated query using `GROUP BY status`. Threshold comment is in place. |
| MONITOR | **1-year TTL keys** (`config:`, `badge:notified:`) | Overwrite semantics + fixed cardinality = no growth. Continue monitoring; no action needed. |

**P1s: NONE. P2s: 1 active (threshold-gated, not currently triggered). P3s: 0.**

**Estimated monthly cost at 10K users:** ~$50–75/mo (unchanged from prior cycles). Breakdown: Upstash Redis (free tier covers most; ~$10/mo if KV ops spike), Supabase (free tier), Vercel serverless (dominated by badge route invocations absorbed by CDN), Resend (usage-based, daily quota protected).
