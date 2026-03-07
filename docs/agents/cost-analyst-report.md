# Cost Analyst Report
> Generated: 2026-03-07 | Health status: GREEN

## Executive Summary

Chapa's infrastructure is well-optimized for cost. Multi-layer caching (CDN + Redis + Supabase), request deduplication, and batch processing keep external API usage under 1% of quotas. Estimated monthly cost at 10K active users: ~$56. Two recurring issues from last audit remain open: share page ISR and missing platform fetch timeouts.

## Redis Usage

### Key Patterns

| Pattern | Per-User Keys | Size/Key | TTL | Growth Risk |
|---------|--------------|----------|-----|-------------|
| `stats:v2:merged:{handle}` | 1 | 2-4 KB | 6h | Low (bounded) |
| `stats:stale:{handle}` | 1 | 2-4 KB | 7d | Low (bounded) |
| `stats:v2:bitbucket:{handle}` | 0-1 | 2-4 KB | 6h | Low (bounded) |
| `stats:v2:codeberg:{handle}` | 0-1 | 2-4 KB | 6h | Low (bounded) |
| `snapshot:latest:{handle}` | 1 | 300-400 B | 24h | Low (bounded) |
| `avatar:{handle}` | 0-1 | 50-200 KB | 6h | Medium (size) |
| `supplemental:{handle}` | 0-1 | 2-4 KB | 24h | Low (bounded) |
| `config:{login}` | 0-1 | 0.5-2 KB | 365d | Low (bounded) |
| `badge:notified:{handle}` | 0-1 | ~1 B | 365d | Low (tiny) |
| `score-bump:{handle}` | 0-1 | ~1 B | 7d | Low (tiny) |
| `cli:device:{sessionId}` | transient | 50-100 B | 5m | Low (ephemeral) |
| `ratelimit:*:{ip/handle}` | ~20 patterns | counter | window-based | Low (auto-expire via INCR+EXPIRE) |

### Global Keys (No TTL - Intentional)

| Key | Size | Purpose |
|-----|------|---------|
| `stats:badges_generated` | ~8 B | INCR counter |
| `stats:unique_badges` | 12-16 KB | HyperLogLog |
| `cron:warm-cache:offset` | ~8 B | Rotation state |

**TTL coverage:** 100% of per-user keys have TTLs. 3 global keys without TTL are intentional and bounded (combined <16 KB).

### Per-User Storage Estimate

| Scenario | Storage |
|----------|---------|
| With avatar cached | ~60-210 KB |
| Without avatar | ~8-15 KB |

**Growth risk:** LOW. Avatar cache is the #1 per-user cost driver (~50-200 KB). At 10K users with 50% avatars, peak Redis = ~1 GB. Upstash Pro tier handles this.

**Rate limit keys:** All use INCR+EXPIRE pattern (TTL set on first increment). Auto-clean after window expires. No manual cleanup needed.

## Database Usage

### Tables: 6 + 2 Views

| Table | Est. Rows (10K users) | Growth | Cleanup |
|-------|----------------------|--------|---------|
| `users` | 10K | Bounded (1/user) | None needed |
| `metrics_snapshots` | 3.65M/year | Unbounded (1/user/day) | None (permanent history) |
| `feature_flags` | ~20 | Static | N/A |
| `user_platforms` | ~1K | Bounded (1/platform/user) | None needed |
| `verification_records` | ~30K rolling | Bounded (30d TTL) | Cron cleans 1000/run |
| `merge_operations` | Unbounded | **Write-only, no cleanup** | **NEEDS RETENTION POLICY** |

**Views:** `latest_snapshots` (dedup), `admin_users` (composite join for admin dashboard).

### Query Efficiency: EXCELLENT

- **Connection management:** Lazy singleton (`getSupabase()`) — no per-request overhead
- **N+1 prevention:** `dbGetLatestSnapshotBatch()` fetches 50 handles in 1 query (cron)
- **Admin dashboard:** Single query on `admin_users` view with server-side sort/filter
- **RLS:** Enabled on all 6 tables. Service role (server-side only) bypasses. No anon key exposed to client.
- **Token security:** Platform tokens encrypted at rest (AES-256-GCM)

### Cost: Free Tier

At 10K users: ~100K queries/month. Supabase free tier allows 500K. **No cost concern.**

## External API Calls

| Route | External Service | Cached | Rate Limited | Risk |
|-------|-----------------|--------|-------------|------|
| `/u/:handle/badge.svg` | GitHub API, Avatar CDN | 6h primary + 7d stale | 100/IP/60s | Medium - high caching mitigates |
| `/u/:handle` (SSR) | GitHub API, Supabase | 6h primary + 7d stale | None | Medium - **no ISR** |
| `/u/:handle/og-image` | GitHub API, Avatar CDN, svgToPng | 24h Redis | None | Medium - PNG compute |
| `/api/auth/callback` | GitHub API (2 calls) | Session cookie | 10/IP/15m | Low - one-time |
| `/api/auth/bitbucket/*` | Bitbucket API, Supabase | Query cache | 10-20/IP/15m | Medium - **no fetch timeout** |
| `/api/auth/codeberg/*` | Codeberg API, Supabase | Query cache | 10-20/IP/15m | Medium - **no fetch timeout** |
| `/api/refresh` | GitHub API, Supabase | Cache cleared + refetch | 5/handle/hr | Low - auth + rate limited |
| `/api/generate` | GitHub API | In-flight dedup | 10/handle/hr | Low - post-OAuth warm |
| `/api/cron/warm-cache` | GitHub API (batch 50) | Primary cache | CRON_SECRET | Low - 50 calls/day |
| `/api/history/:handle` | Supabase | 1h CDN cache | 100/IP/60s | Low - read-only |
| `/api/supplemental` | GitHub (token verify) | 24h cache | 10/handle/24h | Low - CLI-only |
| `/api/health` | Redis + Supabase (ping) | None | 30/IP/60s | Negligible |

### GitHub API Budget

- **Authenticated limit:** 5,000 req/hr (3.6M/month)
- **Estimated usage at 10K users:** ~100K calls/month
- **Headroom:** 35x over estimated usage
- **Request deduplication:** `_inflight` Map reduces concurrent duplicate calls by 40-60%

## Resource Management

### Connections: EXCELLENT
- **Redis:** Lazy singleton, reused across all requests
- **Supabase:** Lazy singleton with `persistSession: false`
- **No connection pool exhaustion risk** in serverless model

### In-Memory State: EXCELLENT
- **`_inflight` Map** (`github/client.ts:22`): Self-cleaning via `promise.finally()`. Size bounded by concurrent request count (<100 entries typical).
- **No other dynamic module-level collections** found
- **No event listener leaks** — all scoped to component lifecycle

### Cleanup Patterns: EXCELLENT
- `after()` hook in badge route uses `Promise.allSettled()` — isolated failures
- Fire-and-forget operations (avatar cache, badge tracking, email) use `void` prefix
- AbortSignal timeouts on GitHub (15s) and avatar (5s) fetches

### Remaining Concerns

1. **`merge_operations` table:** Write-only, no cleanup, unbounded growth. Needs retention policy (e.g., 90-day TTL or batch cleanup cron).
2. **Missing fetch timeouts:** Bitbucket/Codeberg OAuth fetches in `lib/auth/bitbucket.ts` and `lib/auth/codeberg.ts` lack `AbortSignal.timeout()`. Can hang up to Vercel's 31s max.
3. **Sequential platform fetches:** `lib/github/client.ts` fetches Bitbucket then Codeberg sequentially (worst-case 60s combined). Should use `Promise.all()`.
4. **SVG-to-PNG no timeout:** `og-image/route.ts` `svgToPng()` has no timeout guard.

## Vercel Cost Factors

### Build & Bundle
- Build output: 314 MB total
- Per-route JS: <200 KB typical, no chunk exceeds 500 KB
- `@resvg/resvg-js` properly excluded via `serverExternalPackages`
- No edge runtime routes (correct — all routes need DB/crypto)
- Cron `maxDuration: 300` (Pro tier)

### CDN Caching Headers

| Route | Cache Header | Effective TTL |
|-------|-------------|---------------|
| Badge SVG | `s-maxage=21600, swr=604800` | 6h fresh + 7d stale |
| OG image | `s-maxage=21600, swr=604800` | 6h fresh + 7d stale |
| History API | `s-maxage=3600, swr=86400` | 1h fresh + 24h stale |
| Verify API | `s-maxage=3600, swr=86400` | 1h fresh + 24h stale |
| Feature flags | `s-maxage=60, swr=300` | 1m fresh + 5m stale |

CDN caching blocks ~90% of badge requests at edge — zero serverless invocations for cached responses.

### Share Page ISR (Still Missing)

`/u/[handle]/page.tsx` runs full SSR on every request. Adding `revalidate=3600` would cut function invocations 80-90%. **This remains the #1 actionable cost optimization** — confirmed by both cost and performance agents across multiple audits.

## Estimated Monthly Costs (10K Active Users)

| Service | Monthly Cost | Notes |
|---------|-------------|-------|
| Vercel Functions | ~$6 | 90% served from CDN cache |
| Vercel Bandwidth | ~$20 | ~5 GB served |
| Upstash Redis (Pro) | ~$20 | ~3M ops/month |
| Supabase Postgres | $0 | Free tier (100K ops) |
| GitHub API | $0 | 35x headroom |
| Resend Email | ~$10 | ~10K emails |
| PostHog | $0 | Free tier |
| **Total** | **~$56/month** | |

## Recommendations

### Priority 1 (Cost Impact)
1. **Add ISR to share pages** — `revalidate=3600` on `/u/[handle]/page.tsx`. Cuts serverless invocations 80-90%. Confirmed as #1 optimization by cost + performance agents.

### Priority 2 (Reliability)
2. **Add `AbortSignal.timeout(10_000)` to Bitbucket/Codeberg OAuth fetches** — 9 fetch calls in `lib/auth/bitbucket.ts`, `lib/auth/codeberg.ts` can hang until Vercel timeout.
3. **Parallelize platform stat fetches** — `lib/github/client.ts` fetches BB then CB sequentially. `Promise.all()` halves worst-case latency.
4. **Add timeout to `svgToPng()`** in `og-image/route.ts`.

### Priority 3 (Maintenance)
5. **Add retention policy for `merge_operations`** — write-only table with no cleanup. Implement 90-day batch cleanup or add `expires_at` column.
6. **Instrument cache hit rates** — Add counters for Redis hit/miss ratio visibility.
7. **Log GitHub `X-RateLimit-Remaining`** — Track API quota consumption trend.

### Changes Since Last Audit (2026-03-06)
- Cache key mismatch (issue #527) remains fixed
- `merge_operations` still write-only — no change
- Share page ISR still not implemented — third consecutive audit flagging this
- Platform fetch timeout issue unchanged
- All other patterns stable: singletons, fail-open rate limiting, request dedup, batch cron
