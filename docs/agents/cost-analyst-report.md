# Cost Analyst Report
> Generated: 2026-03-27 | Health status: GREEN

## Executive Summary

Infrastructure costs remain stable and well-optimized. All previous gaps resolved: Resend email timeouts now at 100% via `withTimeout` wrapper (triage 2026-03-26). Estimated monthly cost at 10K users: **~$40-60**. No new cost risks introduced. Two monitor items carried forward (OG image Redis memory, sync-audience pagination).

## Redis Usage

### Key Pattern Inventory (24 families)

| # | Key Pattern | TTL | Type | Growth |
|---|-------------|-----|------|--------|
| 1 | `stats:v2:merged:{handle}` | 6h | String (JSON) | Per-user |
| 2 | `stats:stale:{handle}` | 7d | String (JSON) | Per-user (failover) |
| 3 | `stats:v2:bitbucket:{handle}` | 6h | String (JSON) | Per-linked-user |
| 4 | `stats:v2:codeberg:{handle}` | 6h | String (JSON) | Per-linked-user |
| 5 | `snapshot:latest:{handle}` | 24h | String (JSON) | Per-user |
| 6 | `craft:{handle}` | 1h | String (JSON) | Per-user w/insights |
| 7 | `avatar:{handle}` | 6h | String (base64) | Per-user |
| 8 | `config:{handle}` | 365d | String (JSON) | Per-customized-user |
| 9 | `supplemental:{handle}` | 24h | String (JSON) | Per-EMU-user |
| 10 | `og-image:v1:{handle}:{date}` | 48h | String (PNG base64) | Per-user-per-day |
| 11 | `ff:all` | 1h | String (JSON array) | Singleton |
| 12 | `ff:key:{key}` | 1h | String (JSON) | Per-flag (~10-20) |
| 13 | `campaign:daily-sends:{date}` | 24h | Integer (counter) | 1/day |
| 14 | `cli:device:{sessionId}` | 5m | String (JSON) | Per-auth-session |
| 15 | `ratelimit:{prefix}:{identifier}` | 60s-24h | Integer (counter) | Per-IP/handle, ephemeral |
| 16 | `stats:badges_generated` | **None** | Integer (INCR) | Singleton, monotonic |
| 17 | `stats:unique_badges` | **None** | HyperLogLog | Singleton, ~16 KB fixed |
| 18 | `cron:warm-cache:offset` | **None** | Integer | Singleton, rotates |

- **TTL coverage**: 100% per-user keys. 3 global singletons without TTL (intentional, combined <16 KB).
- **Growth risk**: LOW. OG image cache is largest consumer (~62% of Redis at 10K users) but bounded by 48h TTL + date bucketing.

### Memory Estimate @10K Users: ~243 MB

| Category | Size | Share |
|----------|------|-------|
| User data keys (stats, stale, snapshot, craft, supplemental) | ~78 MB | 32% |
| Avatars (base64, 15 KB avg) | ~15 MB | 6% |
| OG images (PNG base64, ~100 KB, 48h window) | ~150 MB | 62% |
| Config, flags, rate limits, misc | <1 MB | <1% |

Well within Upstash Pro 10 GB limit (97.6% headroom).

## Database Usage

- **Tables**: 9 + 2 views (`latest_snapshots`, `admin_users`)
- **RLS**: All 9 tables RLS-enabled with FORCE (migration 018). Explicit deny-all for `anon`. Views use `security_invoker = true`.
- **Connection management**: Lazy singleton (`getSupabase()` in `lib/db/supabase.ts`). `persistSession: false`. Health check with 5s timeout.
- **Query efficiency**: 0 N+1 patterns. Batch fetching in warm-cache (`dbGetLatestSnapshotBatch`). Bulk upsert for campaign sends. 11 well-placed indexes.
- **JS aggregation**: 1 instance (`dbGetCampaignStats` — PostgREST GROUP BY limitation, <1K rows per campaign). Accepted.
- **Grants**: All tables have explicit grants for `anon`/`authenticated` roles.

## External API Calls

| Route | External Service | Cached | Rate Limited | Timeout | Risk |
|-------|-----------------|--------|-------------|---------|------|
| `/api/auth/callback` | GitHub OAuth | 6h | 10/900s IP | 10s | LOW |
| `/api/auth/login` | None (URL gen) | N/A | 20/900s IP | N/A | NONE |
| `/api/auth/{platform}/callback` | Bitbucket/Codeberg OAuth | N/A | 10/900s IP | 10s | LOW |
| `/api/auth/{platform}/connect` | Bitbucket/Codeberg OAuth | N/A | 10/900s IP | 10s | LOW |
| `/api/generate` | GitHub API | 6h + 7d stale | 10/3600s | 15s | LOW |
| `/api/refresh` | GitHub API | Cache invalidation | 5/3600s | 15s | LOW |
| `/api/recalculate` | GitHub API | Cache invalidation | 20/3600s | 15s | LOW |
| `/api/cron/warm-cache` | GitHub API (batch) | 6h + 7d stale | Bearer auth | 15s | LOW |
| `/api/cron/sync-audience` | Resend (batch ops) | N/A | Bearer auth | 30s | LOW |
| `/api/cron/process-campaigns` | Resend (email batch) | N/A | Bearer auth | 10s | LOW |
| `/api/admin/campaigns/[id]/send` | Resend (email) | N/A | Admin auth | 10s | LOW |
| `/api/admin/campaigns/[id]/test` | Resend (test email) | N/A | Admin auth | 10s | LOW |
| `/api/webhooks/resend` | Resend (forward) | N/A | 20/60s IP | 10s | LOW |
| `/api/notifications/unsubscribe` | Resend (audience) | N/A | 10/60s IP | 10s | LOW |
| `/u/[handle]/badge.svg` | GitHub (via getStats) | 6h + 7d stale | 100/60s IP | 15s | LOW |
| `/u/[handle]/og-image` | None (local render) | Redis 48h | N/A | 10s | LOW |

### GitHub API Budget

- **Cache-first**: 6h primary TTL, 7d stale fallback, in-flight request deduplication
- **Estimated calls @10K users**: ~57/hr (1.1% of 5K/hr authenticated limit)
- **Safe until**: 500K+ users

### Fetch Timeout Coverage: 100%

All external calls now have timeout protection:
- GitHub API: `AbortSignal.timeout(15s)` in `queries.ts`
- OAuth callbacks: `AbortSignal.timeout(10s)`
- Resend emails: `withTimeout(EMAIL_SEND_TIMEOUT_MS=10s)` — **RESOLVED** (was 2/5 missing, triage 2026-03-26 fixed all 4 email modules: `resend.ts`, `notifications.ts`, `score-bump.ts`, `campaigns.ts`)
- Supabase: `dbTimeoutOr504(10s)` on admin/feature routes
- PostHog `captureServerError`: Fire-and-forget (accepted, non-critical)

### Rate Limiting Coverage

- **30/42 routes** have explicit `rateLimit()` calls (31 source files, 41 call sites including tests)
- **12 routes** rely on alternative protection: admin auth (session + handle check), bearer token (cron), or are internal
- **Fail-open**: All rate limiters allow requests when Redis is unavailable (availability-first design)
- **Campaign email quota**: 95/day via Redis counter

## Resource Management

- **Resource leaks**: 0 critical, 0 warnings
- **Timer cleanup**: All `setTimeout`/`setInterval` properly cleared via `.finally()` or explicit cleanup
- **Promise patterns**: `Promise.allSettled` for non-critical ops (badge.svg, insights, warm-cache); `Promise.all` for critical dependencies (health, auth)
- **after() callbacks**: 1 usage (`/api/insights`) — properly uses `Promise.allSettled` for non-blocking cache updates
- **Connection management**: Redis (Upstash REST, no persistent connections), Supabase (lazy singleton, no pool exhaustion)
- **Stream/buffer**: SVG-to-PNG via `@resvg/resvg-js` WASM with 10s timeout. Child process streams destroyed in `cleanupProcess()`. No unbounded buffers.
- **Bounded batch processing**: `processInBatches` with configurable batch size throughout (warm-cache: 50, campaigns: 50)

## Vercel Cost Factors

### Cron Jobs (3 daily)

| Job | Schedule | Max Duration | Monthly Invocations |
|-----|----------|-------------|-------------------|
| `warm-cache` | 6:00 AM UTC | 300s | ~30 |
| `sync-audience` | 3:30 AM UTC | 300s | ~30 |
| `process-campaigns` | 8:00 AM UTC | 300s | ~30 |

**Total**: ~90 invocations/mo, <0.01% of free tier compute.

### ISR/SSG Strategy (Optimal)

| Route | Strategy | Revalidate | Assessment |
|-------|----------|-----------|------------|
| `/` | ISR | 3600s (1h) | Correct |
| `/u/[handle]` | ISR | 3600s (1h) | Correct (dynamic per-user) |
| `/about/*` | ISR | 3600s (1h) | Correct |
| `/privacy`, `/terms` | ISR | 86400s (24h) | Correct (rarely changes) |
| `/archetypes/*` | SSG | 604800s (7d) | Excellent (near-static) |
| `/studio` | Force-dynamic | N/A | Correct (real-time UI) |

### Build Health

- **No routes exceed 500KB** First Load JS
- **Total client JS**: 1,800 KB across 71 chunks (performance agent 2026-03-26)
- **Largest**: 228 KB (Next.js framework), 176 KB (PostHog, lazy-loaded)
- **Supabase SDK**: 2 chunks at 160 KB each (minor duplication, optimization target)
- **No edge runtime routes** (all routes need DB access)

### Response Caching Headers

| Route | Cache-Control | CDN Benefit |
|-------|--------------|-------------|
| `/u/[handle]/badge.svg` | `s-maxage=21600, swr=604800` | 6h CDN, 7d stale |
| `/u/[handle]/og-image` | `s-maxage=21600, swr=604800` | 6h CDN, 7d stale |
| `/api/feature-flags` | `s-maxage=60, swr=300` | 1m CDN, 5m stale |
| `/api/verify/[hash]` | `s-maxage=3600, swr=86400` | 1h CDN, 24h stale |
| `/api/history/[handle]` | `s-maxage=3600, swr=86400` | 1h CDN, 24h stale |

## Cost Estimates

### Monthly Cost by Tier

| Service | @1K users | @10K users | @50K users |
|---------|-----------|------------|------------|
| **Vercel** (Pro) | $20 | $20 | $20-40 |
| **Upstash Redis** (Pro) | $5 | $10-20 | $30-50 |
| **Supabase** (Free) | $0 | $0 | $0-25 |
| **Resend** (Free→Pro) | $0 | $0-20 | $20-50 |
| **PostHog** (Free) | $0 | $0 | $0-10 |
| **Total** | **~$25** | **~$40-60** | **~$70-175** |

## Recommendations

### Priority 1 (Monitor)

1. **OG image Redis memory** (CARRIED) — Remains #1 Redis consumer (62% at 10K users). At 50K+ users, consider migrating to Vercel Blob Storage or R2. Current 48h TTL keeps it manageable.

2. **`sync-audience` pagination** (CARRIED) — Currently handles full user list in single batch. Coverage improved to 98.1%. Add pagination cursor when user count exceeds 10K.

### Priority 2 (Minor Optimization)

3. **Supabase SDK chunk duplication** — Two 160KB chunks from Supabase SDK. Tree-shaking or barrel import optimization could reduce by ~100KB total. Low priority (no route exceeds 500KB).

4. **`config:{handle}` TTL** — 365-day TTL is extreme for Redis. Consider moving badge configs to Supabase for persistence, using Redis only as a short-lived cache (6h). Low risk at current scale (2 KB per customized user, ~10% adoption).

### No Action Needed

- Redis TTL coverage: 100% on per-user keys
- GitHub API budget: 1.1% of limit at 10K users
- Fetch timeout coverage: 100% (Resend gap fully resolved)
- Rate limiting: 30/42 routes (remaining 12 use admin/bearer auth)
- Resource leaks: 0
- Build size: Healthy, no oversized routes
- Cron costs: Negligible (~90 invocations/mo)

## Delta vs Previous Report (2026-03-26)

| Metric | Previous | Current | Change |
|--------|----------|---------|--------|
| Resend timeout coverage | 2/4 modules missing | 4/4 with `withTimeout` | **RESOLVED** |
| Rate limit routes | 28/30 | 30/42 (recount) | Refined count |
| Test coverage (stmts) | ~91.5% | 92.17% | +0.7% |
| Tests passing | 6,032 | 6,129 | +97 |
| Redis key families | 24 | 24 | Stable |
| Resource leaks | 0 | 0 | Stable |
| New risks | 0 | 0 | Stable |
