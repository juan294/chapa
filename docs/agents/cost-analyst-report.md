# Cost Analyst Report
> Generated: 2026-03-31 | Branch: `develop` | Health status: **GREEN**

## Executive Summary

Infrastructure costs and resource usage remain stable and well-optimized. Estimated monthly cost at 10K users: **~$40-60** (Vercel $20, Redis $10-20, Resend $0-20, Supabase free tier). No new cost risks since last report (2026-03-30). All external calls have timeouts, caching is comprehensive, and zero resource leaks detected. No code changes since last run — this is a confirmation report.

## Redis Usage

### Key Pattern Families: 26

| Key Pattern | TTL | Avg Size | Purpose |
|-------------|-----|----------|---------|
| `stats:v2:merged:{handle}` | 6h | 10 KB | Merged platform stats |
| `stats:v2:github:{handle}` | 6h | 10 KB | GitHub-only stats |
| `stats:v2:bitbucket:{handle}` | 6h | 10 KB | Bitbucket stats |
| `stats:v2:codeberg:{handle}` | 6h | 10 KB | Codeberg stats |
| `avatar:{handle}` | 6h | 30 KB | Base64 avatar data URIs |
| `snapshot:latest:{handle}` | 24h | 2 KB | Latest MetricsSnapshot |
| `craft:{handle}` | 1h | 1 KB | Tool insights / craft score |
| `history:{handle}[:{from}[:{to}]]` | 1h | 5 KB | Snapshot history range |
| `ff:all` | 1h | 0.5 KB | All feature flags |
| `ff:key:{key}` | 1h | 0.1 KB | Individual feature flag |
| `campaign:active-engagement` | 1h | 3 KB | Active engagement template |
| `campaign:daily-sends:{date}` | 24h | 0.05 KB | Daily email quota counter |
| `supplemental:{handle}` | 24h | 5 KB | EMU supplemental stats |
| `score-bump:{handle}` | 7d | 0.02 KB | Score-bump dedup marker |
| `badge:notified:{handle}` | 365d | 0.02 KB | First-badge notification dedup |
| `cli:device:{sessionId}` | 5m | 0.5 KB | CLI device auth session |
| `ratelimit:{prefix}:{id}` | 60s-3600s | 0.05 KB | Rate limit counters |
| `stats:badges_generated` | **NONE** | 0.05 KB | Total badge count (persistent) |
| `stats:unique_badges` | **NONE** | 16 KB | HyperLogLog unique badges |
| `cron:warm-cache:offset` | **NONE** | 0.05 KB | Round-robin rotation offset |

### TTL Coverage

- **Per-user keys**: 100% TTL coverage (6h-365d depending on key type)
- **Global singletons without TTL**: 3 (`badges_generated` counter, `unique_badges` HyperLogLog, `warm-cache:offset`) — intentional, combined <16 KB
- **Growth risk**: LOW. All user-scoped keys auto-expire. The `badge:notified:{handle}` keys (365d TTL) grow linearly with total unique users but at ~20 bytes each — negligible.

### Estimated Memory at Scale

| Users | Stats | Avatars | OG Images | Snapshots | Overhead | Total | Headroom (10 GB) |
|-------|-------|---------|-----------|-----------|----------|-------|-------------------|
| 1K | 8 MB | 15 MB | 15 MB | 1 MB | 5 MB | ~44 MB | 99.6% |
| 10K | 78 MB | 15 MB | 150 MB | 10 MB | 10 MB | ~253 MB | 97.5% |
| 50K | 390 MB | 75 MB | 750 MB | 50 MB | 35 MB | ~1.3 GB | 87% |

**Primary memory consumer**: OG images cached in Redis (59% at 10K users). At 50K+ users, consider migrating OG images to Vercel Blob Storage.

### Rate Limiting Coverage

- **31/44 routes** rate-limited (70%)
- Remaining 13 use admin auth (`ADMIN_SECRET`), bearer tokens, cron secrets, or are internal
- All rate limiters **fail-open** (availability-first design)
- Campaign email quota: 95/day enforced via Redis daily counter

## Database Usage

### Tables: 9 + 2 Views

| Table | Purpose | RLS | Key Index |
|-------|---------|-----|-----------|
| `users` | Registration | FORCE + deny anon | `idx_users_registered_at` |
| `metrics_snapshots` | Daily metrics history | FORCE + deny anon | `idx_snapshots_handle_date` |
| `verification_records` | Badge verification (30d TTL) | FORCE + deny anon | `idx_verification_expires` |
| `feature_flags` | Feature toggles | FORCE + deny anon + SELECT permit | — |
| `merge_operations` | CLI telemetry | FORCE + deny anon | `idx_merge_ops_handle_created` |
| `user_platforms` | Linked accounts | FORCE + deny anon | `idx_user_platforms_handle` |
| `email_campaigns` | Campaign metadata | FORCE + deny anon | `idx_email_campaigns_status` |
| `campaign_sends` | Per-recipient tracking | FORCE + deny anon | `idx_campaign_sends_campaign_status` |
| `tool_insights` | Craft dimension scores | FORCE + deny anon | `idx_tool_insights_handle` |

**Views**: `latest_snapshots` (DISTINCT ON optimization), `admin_users` (LEFT JOIN for admin dashboard).

### Query Patterns: Efficient

- **Connection**: Lazy singleton via `getSupabase()` — single client reused per process
- **N+1 patterns**: 0 — all batch operations use `dbGetLatestSnapshotBatch()`, `dbCreateCampaignSends()`, `dbMarkSendsSent()` (batch IN queries)
- **Transactions**: None (acceptable — no complex multi-table atomicity requirements at current scale)
- **Data access isolation**: 100% — zero direct Supabase calls outside `lib/db/`
- **Fail-open**: All DB functions catch errors and return safe defaults
- **`dbGetCampaignStats()` JS aggregation**: ACCEPTED (PostgREST lacks GROUP BY; <1K sends/campaign)

## External API Calls

| Route | External Service | Cached | Rate Limited | Timeout | Risk |
|-------|-----------------|--------|-------------|---------|------|
| `/api/refresh` | GitHub GraphQL | 6h + 7d stale | 5/h per handle | 15s | LOW |
| `/api/recalculate` | GitHub GraphQL | 6h + 7d stale | 20/h per handle | 15s | LOW |
| `/api/generate` | GitHub GraphQL | 6h + 7d stale | 10/h per handle | 15s | LOW |
| `/u/[handle]/badge.svg` | GitHub GraphQL | 6h + 7d stale | 100/min per IP | 15s | LOW |
| `/api/auth/callback` | GitHub OAuth | N/A | 10/15min per IP | 10s | LOW |
| `/api/cron/warm-cache` | GitHub GraphQL | 6h + 7d stale | Cron secret | 15s (300s max) | LOW |
| `/api/cron/sync-audience` | Resend contacts | N/A | Cron secret | 30s (300s max) | LOW |
| `/api/cron/process-campaigns` | Resend batch send | N/A | 95/day quota | 10s (300s max) | LOW |
| `/api/webhooks/resend` | Resend email fetch | N/A | 20/min per IP | 5s | LOW |
| `/api/admin/campaigns/*/send` | Resend batch send | N/A | Admin auth | 10s | LOW |
| `/api/admin/campaigns/*/test` | Resend single send | N/A | Admin auth | 10s | LOW |

### GitHub API Budget

- **Authenticated rate limit**: 5,000 requests/hr
- **Estimated usage at 10K users**: ~57 calls/hr (warm-cache cron + on-demand)
- **Budget consumption**: 1.1% — safe until 500K+ users
- **Protection layers**: 6h Redis cache → 7d stale fallback → in-flight deduplication

### PostHog

- **Client-side only** — `typeof window === "undefined"` guard prevents server-side calls
- **Zero backend cost** — no API calls, no timeouts needed, no caching overhead

## Resource Management

### Resource Leaks: 0 Critical, 0 Minor

| Category | Status | Evidence |
|----------|--------|---------|
| In-flight dedup map | CLEAN | `.finally()` cleanup on every promise (`client.ts:60-62`) |
| Event listeners | CLEAN | All keyboard/canvas listeners removed in cleanup functions |
| Timers | CLEAN | All `setTimeout`/`setInterval` cleared in `finally` blocks |
| Database connections | CLEAN | Lazy singleton, `persistSession: false` |
| Redis connections | CLEAN | Lazy singleton, Upstash REST (no persistent TCP) |
| Fire-and-forget ops | CLEAN | All use `.catch(() => {})`, `Promise.allSettled()` in `after()` callbacks |
| Fetch timeouts | 100% | All raw `fetch()` calls use `AbortSignal.timeout()` |
| Resend SDK timeouts | 57% (4/7) | 3 gaps in fire-and-forget/admin-gated contexts — practical risk LOW |

### Unbounded Growth Risk

| Key/Resource | Growth Pattern | Risk | Notes |
|-------------|----------------|------|-------|
| `badge:notified:*` | +1 per unique user (365d) | LOW | ~20 bytes/key, linear growth |
| `stats:badges_generated` | Monotonic counter (no TTL) | LOW | Single integer, ~50 bytes |
| `stats:unique_badges` | HyperLogLog (no TTL) | LOW | Fixed ~16 KB regardless of cardinality |
| `campaign:daily-sends:*` | +1 key/day (24h TTL) | LOW | Auto-expires, ~365 keys/year max |

## Vercel-Specific Cost Factors

### Build Output

- **Routes**: 84 dynamic + 7 static = 91 total
- **Client JS**: 1.8 MB across 69 chunks — no chunk exceeds 500 KB
- **Largest chunks**: 227 KB (Next.js framework), 175 KB (PostHog, lazy-loaded), 133 KB (React DOM), 110 KB (polyfills)
- **Heavy deps**: `@resvg/resvg-js` correctly in `serverExternalPackages` (excluded from function bundles)
- **Edge runtime**: Not used (correct — requires Node.js for Supabase/Redis)

### ISR/SSG Strategy: Optimal

| Page Type | Strategy | Revalidation | Status |
|-----------|----------|-------------|--------|
| Archetype pages (7) | SSG | 7 days | OPTIMAL |
| Legal pages (privacy, terms) | ISR | 24 hours | OPTIMAL |
| About pages | ISR | 1 hour | GOOD |
| Share pages (`/u/[handle]`) | ISR | 1 hour | GOOD |
| Studio | force-dynamic | N/A | CORRECT (user-specific) |
| Experiments | force-dynamic | N/A | CORRECT (dev/demo) |
| Badge SVG | Dynamic + CDN | 6h s-maxage | OPTIMAL |

### Cron Jobs: 3 Daily

| Job | Schedule | Max Duration | Estimated Cost |
|-----|----------|-------------|----------------|
| `warm-cache` | Daily 6:00 UTC | 300s | ~250s compute |
| `sync-audience` | Daily 3:30 UTC | 300s | ~30s compute |
| `process-campaigns` | Daily 8:00 UTC | 300s | ~10s compute |

**Total**: ~90 executions/mo, <0.01% of free tier compute.

### Test Suite

- **382 files**, **6,655 tests**, 100% pass rate, 0 flaky
- Duration: ~15s (fast feedback loop)
- Coverage: 92.72% stmts

## Cost Projections

| Users | Vercel | Redis (Upstash) | Supabase | Resend | Total/mo |
|-------|--------|----------------|----------|--------|----------|
| 1K | $0 (free) | $0 (free) | $0 (free) | $0 (free) | **~$0** |
| 10K | $20 (Pro) | $10-20 | $0 (free) | $0-20 | **~$40-60** |
| 50K | $20-40 | $30-50 | $25 (Pro) | $20-50 | **~$95-195** |
| 100K | $40-80 | $50-100 | $25 | $50-75 | **~$165-280** |

## Recommendations

### Priority: MONITOR (Carried from previous reports)

1. **OG image Redis memory** — 59% of Redis at 10K users, 58% at 50K. Consider migrating to Vercel Blob Storage if approaching 50K users. No action needed now.

2. **`sync-audience` pagination** — Current implementation fetches all Resend contacts in one paginated call (30s timeout). At scale (50K+ contacts), may need cursor-based pagination with checkpointing. Future concern only.

3. **Resend SDK timeout gaps** — 3 `audience.ts` SDK calls + 1 admin test route lack `withTimeout()` wrapper. All are fire-and-forget or admin-gated. Practical risk LOW — defense-in-depth improvement only.

### Priority: LOW (Informational)

4. **About pages ISR** — Currently `revalidate=3600` (1h). Could increase to `revalidate=86400` (24h) since content rarely changes. Saves ~20 ISR builds/day — negligible cost impact.

5. **Campaign stats JS aggregation** — `dbGetCampaignStats()` does client-side GROUP BY (PostgREST limitation). Acceptable at <1K sends/campaign. Add RPC function if campaigns scale to 10K+ sends.

### No New Findings

No code changes since 2026-03-30. All metrics stable. All previously identified items carried with unchanged risk assessments.

---

## Delta vs Previous Report (2026-03-30)

| Metric | 2026-03-30 | 2026-03-31 | Change |
|--------|-----------|-----------|--------|
| Redis key families | 26 | 26 | +0 |
| Rate-limited routes | 31/44 (70%) | 31/44 (70%) | +0 |
| Fetch timeout coverage | 100% raw | 100% raw | +0 |
| Resend SDK timeouts | 57% (4/7) | 57% (4/7) | +0 |
| Resource leaks | 0 | 0 | +0 |
| Supabase tables | 9 + 2 views | 9 + 2 views | +0 |
| Build routes | 84 dyn + 7 static | 84 dyn + 7 static | +0 |
| Client JS | 1,800 KB / 71 chunks | 1,800 KB / 69 chunks | -2 chunks |
| Tests | 6,655 passing | 6,655 passing | +0 |
| Coverage | 92.72% stmts | 92.72% stmts | +0.00% |
