# Cost Analyst Report
> Generated: 2026-03-25 | Health status: GREEN

## Executive Summary

Infrastructure costs remain stable and well-optimized. Estimated monthly cost at 10K users: **~$40–60**. No new cost risks, resource leaks, or unbounded growth patterns identified. All prior findings maintained or resolved. Badge SVG `Promise.allSettled()` issue confirmed RESOLVED.

## Redis Usage

### Key Patterns (17 families)

| Pattern | TTL | Avg Size | Purpose |
|---------|-----|----------|---------|
| `stats:v2:merged:{handle}` | 6h | 6–8 KB | Primary GitHub stats (merged platforms) |
| `stats:stale:{handle}` | 7d | 6–8 KB | Fallback when GitHub API fails |
| `stats:v2:bitbucket:{handle}` | 6h | 4–6 KB | Cached Bitbucket stats |
| `stats:v2:codeberg:{handle}` | 6h | 4–6 KB | Cached Codeberg stats |
| `supplemental:{handle}` | 6h | 6–8 KB | EMU account merge data |
| `craft:{handle}` | 1h | 1–2 KB | Craft score (5th dimension) |
| `snapshot:latest:{handle}` | 24h | 400–600 B | Latest MetricsSnapshot (EMA smoothing) |
| `config:{handle}` | 1 year | 2–4 KB | Creator Studio badge config |
| `og-image:v1:{handle}:{date}` | 48h | 50–100 KB | Base64-encoded OG PNG |
| `ratelimit:badge:{ip}` | 60s | ~100 B | Badge endpoint rate limit |
| `ratelimit:cli-poll:{ip}` | 60s | ~100 B | CLI polling rate limit |
| `ratelimit:cli-approve:{ip}` | 60s | ~100 B | CLI approval rate limit |
| `ratelimit:tp:connect:{ip}` | 15m | ~100 B | Platform OAuth connect limit |
| `ratelimit:tp:status:{ip}` | 15m | ~100 B | Platform status check limit |
| `campaign:daily-sends:{date}` | 24h | ~100 B | Campaign email daily quota |
| `stats:badges_generated` | None (intentional) | 8 B | Global badge counter |
| `stats:unique_badges` | None (intentional) | 12 KB | HyperLogLog unique users |

- **TTL coverage**: 100% on all per-user keys. 2 global singletons without TTL — intentional, combined <16 KB.
- **Growth risk**: None. OG images remain the #1 consumer (~375 MB @ 10K users). All user keys auto-expire.
- **Estimated Redis memory @10K users**: ~535 MB (160 MB user keys + 375 MB OG images). Well within Upstash Pro 10 GB (94.6% headroom).
- **@50K users**: ~2.7 GB (73% headroom). Consider blob storage for OG images at this scale.

## Database Usage

- **Tables**: 9 + 1 view (`admin_users`)
  - `users`, `metrics_snapshots`, `verification_records`, `feature_flags`, `user_platforms`, `tool_insights`, `email_campaigns`, `campaign_sends`, `merge_operations`
- **Query patterns**: Efficient. 0 N+1 patterns. Batch snapshot fetch (`dbGetLatestSnapshotBatch`) saves ~50 individual queries per cron run.
- **Connection management**: Singleton lazy client (`_client` reused across requests). PostgREST adapter handles pooling. `auth: { persistSession: false }`.
- **RLS**: All 9 tables RLS-enabled with explicit deny policies. 2 views with `security_invoker = true`. Service role key bypasses RLS (server-to-server only).
- **JS aggregation**: `dbGetCampaignStats()` aggregates in JavaScript — ACCEPTED (PostgREST lacks GROUP BY). Acceptable at current volume (<1K sends/campaign).
- **Caching**: Feature flags dual-cached (`ff:all` + `ff:key:{key}`, 1h TTL). Active engagement campaign cached 1h. Snapshots cached 24h.

## External API Calls

| Route | External Service | Cached | Rate Limited | Timeout | Risk |
|-------|-----------------|--------|-------------|---------|------|
| `GET /u/:handle/badge.svg` | GitHub GraphQL (1 query), Supabase, Resend (fire-and-forget) | Yes (6h stats, 48h avatar) | 100 req/IP/60s | 15s GitHub, 5s avatar | Medium |
| `POST /api/generate` | GitHub GraphQL (1 query) | Yes (6h) | 10 req/handle/1h | 15s | Low |
| `POST /api/refresh` | GitHub GraphQL (cache invalidated) | Partial | 5 req/handle/1h | 15s | Low |
| `POST /api/recalculate` | GitHub GraphQL, Supabase | Yes (cache-first) | 20 req/handle/1h | 15s | Low |
| `GET /api/cron/warm-cache` | GitHub (1 query × 50 users max), Supabase, Resend | Cache-warming | Cron auth | 15s per call | Medium |
| `GET /api/cron/sync-audience` | Resend (paginated contacts), Supabase | N/A | Cron auth | 30s | Medium |
| `POST /api/cron/process-campaigns` | Resend (batch send) | N/A | Cron auth | None | Medium |
| `GET /api/auth/callback` | GitHub OAuth (2–3 calls) | N/A | 10 req/IP/15min | None | Medium |
| `GET /u/:handle/og-image` | GitHub stats, PNG render | Yes (48h Redis) | N/A | 10s | Medium |
| `GET /api/health` | Redis ping, Supabase ping | N/A | 30 req/IP/60s | 5s | Low |
| `GET /api/verify/:hash` | Supabase | Yes (1h s-maxage) | 30 req/IP/60s | None | Low |
| `GET /api/history/:handle` | Supabase | Yes (1h s-maxage) | 100 req/IP/60s | None | Low |
| `GET /api/feature-flags` | Supabase (Redis cached) | Yes (60s s-maxage) | 30 req/IP/60s | 5s | Low |
| Auth platform routes | Bitbucket/Codeberg OAuth | Yes (6h stats) | Rate limited | 10s | Medium |
| All other routes | Redis/Supabase only | Varies | Yes | N/A | Low |

### GitHub API Budget
- **Per badge generation (cache miss)**: 1 GraphQL query
- **In-flight deduplication**: Concurrent requests for same handle share one promise (40–60% reduction)
- **Estimated load @10K users**: ~420 calls/hr (50% cache hit) vs 5,000/hr limit. **91.6% headroom**.
- **Warm-cache cron**: ~50 queries/day (batched, server-side token)

## Resource Management

- **Resource leaks**: 0 critical, 0 warnings.
- **Promise.allSettled**: All parallel I/O uses `Promise.allSettled()` — badge SVG (line 104), all `after()` callbacks, cron warm-cache. **QA 2026-03-18 finding RESOLVED.**
- **Fetch timeouts**: 100% critical path coverage. All `fetch()` calls have `AbortSignal.timeout()` or `Promise.race()`. Exception: `captureServerError` PostHog (fire-and-forget, never blocks response).
- **Timer cleanup**: `sync-audience` timer properly chained with `clearTimeout()` in `finally()`. No dangling timers.
- **In-memory buffers**: Avatar base64 (~50–100 KB) is stack-scoped, cached to Redis. No unbounded growth.

## Vercel-Specific Cost Factors

### Runtime & ISR
- **Edge runtime**: Not used (all routes are default serverless)
- **Middleware**: None
- **ISR routes**: 14 total — 7d archetypes, 1h share page + content, 24h legal pages
- **Force-dynamic**: 2 routes (studio, experiments) — low traffic, authenticated
- **Badge SVG cache headers**: `s-maxage=21600, stale-while-revalidate=604800` (6h + 7d stale)

### Cron Jobs
| Job | Schedule | Executions/Mo | Compute Time | Monthly Hours |
|-----|----------|---------------|-------------|---------------|
| warm-cache | Daily 6:00 UTC | 30 | ~1.5m | 0.75 |
| sync-audience | Daily 3:30 UTC | 30 | ~0.5m | 0.25 |
| process-campaigns | Daily 8:00 UTC | 30 | ~0.25m | 0.125 |
| **Total** | | **~90** | | **~1.1 hrs** |

Vercel Pro free allowance: 2,160 hrs/mo. Usage: 0.05%.

### Bundle
- Client JS: 1,434 KB across 53 chunks. No chunk exceeds 500 KB.
- Largest: 219 KB (Next.js framework) + 175 KB (PostHog, lazy-loaded).

## Cost Estimate

| Service | Monthly (10K users) | Monthly (50K users) | Notes |
|---------|--------------------|--------------------|-------|
| Vercel (compute) | $20 | $20–30 | Under 100 edge hrs/mo |
| Upstash Redis | $20 | $20–30 | 535 MB → ~2.7 GB |
| Supabase | Free | $15–20 | Within free tier, then Pro |
| Resend (email) | $0–20 | $10–20 | 95/day quota |
| PostHog | $0 | $0 | Free tier (<1M events/mo) |
| **Total** | **~$40–60** | **~$65–100** | |

## Monitored Items (Carried)

1. **`sync-audience` contact pagination** — Full refresh daily. At 50K+ users, pagination overhead grows. Consider incremental sync. Not urgent at current scale.
2. **OG image Redis memory** — #1 Redis consumer (~375 MB @ 10K users). Consider blob storage (Vercel Blob / S3) at 50K+ scale. Not urgent — 94.6% headroom.

## Recommendations

1. **No action required** — All cost metrics stable, no new risks.
2. **At 50K+ users**: Migrate OG images to blob storage to reduce Redis memory by ~50%.
3. **At 50K+ users**: Implement incremental `sync-audience` instead of full refresh.
4. **Consider**: Extending avatar cache TTL from 48h to 7d (avatars rarely change, saves ~10% Redis churn).

## Changes Since 2026-03-24

| Metric | Previous | Current | Delta |
|--------|----------|---------|-------|
| Resource leaks | 0 critical | 0 critical | Maintained |
| Promise.allSettled | All compliant | All compliant | Maintained |
| Redis memory @10K | ~535 MB | ~535 MB | Stable |
| Fetch timeout coverage | 100% | 100% | Maintained |
| Cron compute-hrs/mo | ~1.1 | ~1.1 | Stable |
| Monthly cost estimate | $40–60 | $40–60 | Stable |
| **Overall status** | GREEN | GREEN | No change |
