# Cost Analyst Report
> Generated: 2026-03-15 | Health status: GREEN

## Executive Summary

Infrastructure costs remain well-controlled with strong caching discipline across all layers. Estimated monthly cost at 10K users: **~$56** (Vercel $26, Redis $20, Resend $10, Supabase free tier). At 50K users: ~$190/mo. Two previously carried issues are now **RESOLVED** (`dbCleanOldSnapshots()` wired to cron, OG image TTL reduced to 48h). One **new concern** identified: Bitbucket/Codeberg per-user API call volume during fetch could saturate platform rate limits for power users with many repos/PRs — bounded by 30s timeout but still cost-intensive.

## Redis Usage

### Key Patterns (20 families)

| Pattern | TTL | Est. Size/Key | Purpose |
|---------|-----|---------------|---------|
| `stats:v2:merged:<handle>` | 6h | ~5 KB | Primary GitHub stats cache |
| `stats:stale:<handle>` | 7d | ~5 KB | Stale fallback when API fails |
| `stats:v2:bitbucket:<handle>` | 6h | ~3 KB | Bitbucket stats cache |
| `stats:v2:codeberg:<handle>` | 6h | ~3 KB | Codeberg stats cache |
| `snapshot:latest:<handle>` | 24h | ~500 B | Latest daily metrics snapshot |
| `history:<handle>[:<from>[:<to>]]` | 1h | ~2 KB | Snapshot history (3 variants) |
| `supplemental:<handle>` | 24h | ~5 KB | EMU supplemental stats |
| `og-image:v1:<handle>:<date>` | 48h | ~200 KB | OG image PNG (base64) |
| `config:<handle>` | 365d | ~2 KB | Creator Studio badge config |
| `badge:notified:<handle>` | 365d | 1 B | First-badge email dedup |
| `score-bump:<handle>` | 7d | 1 B | Score-bump email dedup |
| `ff:all` | 1h | ~1 KB | Feature flags (all) |
| `ff:key:<key>` | 1h | ~200 B | Feature flag (single) |
| `ratelimit:badge:<ip>` | 60s | 8 B | Badge rate limit counter |
| `ratelimit:refresh:<handle>` | 1h | 8 B | Refresh rate limit |
| `ratelimit:supplemental:<handle>` | 24h | 8 B | EMU upload rate limit |
| `ratelimit:config:<handle>` | 1h | 8 B | Studio config rate limit |
| `stats:badges_generated` | **none** | 8 B | Total badge counter (global) |
| `stats:unique_badges` | **none** | ~16 KB | HyperLogLog unique count |
| `cron:warm-cache:offset` | **none** | 8 B | Cron rotation offset |

### TTL Coverage
- **Per-user keys**: 100% have TTLs (6h–365d)
- **Global keys without TTL**: 3 (intentional singletons, combined <16 KB)
- **Growth risk**: LOW — all large entries (OG images ~200 KB, stats ~5 KB) expire automatically

### Redis Memory Estimate @10K users

| Category | Formula | Est. Memory |
|----------|---------|-------------|
| Stats (merged+stale+BB+CB) | 10K × 4 × ~4 KB avg | ~160 MB |
| OG images (48h TTL) | ~2K active × ~200 KB | ~400 MB |
| Snapshots + history | 10K × ~2.5 KB | ~25 MB |
| Config (365d) | ~2K × ~2 KB | ~4 MB |
| Rate-limit counters | transient, negligible | <1 MB |
| Feature flags + globals | fixed | <1 MB |
| **Total estimate** | | **~590 MB** |

**Previous concern resolved**: OG image TTL reduced from 7d → 48h (previously ~3-5 GB, now ~400 MB). Redis memory is now well within Upstash Pro 10 GB limit at 10K users.

## Database Usage

### Tables: 7 + 2 views

| Table | Purpose | Retention | Cleanup |
|-------|---------|-----------|---------|
| `users` | Registration, profile | Permanent | — |
| `metrics_snapshots` | Daily metric history | 365 days | `dbCleanOldSnapshots()` via cron |
| `verification_records` | Badge HMAC verification | 30 days (expires_at) | `dbCleanExpiredVerifications()` via cron |
| `feature_flags` | Feature toggles | Permanent (small) | — |
| `merge_operations` | CLI telemetry | 90 days | `dbCleanExpiredMergeOperations()` via cron |
| `user_platforms` | Bitbucket/Codeberg links | Permanent | — |
| `tool_insights` | AI tool craft scores | Permanent | — |
| `latest_snapshots` (view) | Latest snapshot per user | — | — |
| `admin_users` (view) | Admin dashboard (users + snapshots) | — | — |

### Query Patterns: EXCELLENT
- **Connection**: Lazy singleton via `getSupabase()` — no connection leak risk
- **N+1 patterns**: NONE. Batch fetch via `dbGetLatestSnapshotBatch()` for cron. Admin dashboard uses `admin_users` view (single query replaces N+1)
- **Pagination**: Implemented on `dbGetUsers()` and `dbGetAdminUsers()`
- **Runtime validation**: All query results pass through `parseRow()`/`parseRows()` — no unsafe casts
- **Error handling**: Consistent fail-open with sensible defaults across all modules
- **RLS**: All 7 tables have RLS + `deny_anon_all` policies. Views use `security_invoker = true`
- **Cleanup batching**: All cleanup operations use LIMIT 1000 to avoid table locks

### Row Growth Estimate @10K users/year

| Table | Growth/year | Est. Size/year |
|-------|-------------|----------------|
| `metrics_snapshots` | 3.65M rows | ~1.5 GB |
| `verification_records` | ~100K rows (30d retention) | ~50 MB steady-state |
| `merge_operations` | ~10K rows (90d retention) | ~5 MB steady-state |
| `users` | 10K rows | ~2 MB |
| `user_platforms` | ~5K rows | ~1 MB |
| `tool_insights` | ~2K rows | ~1 MB |

**Note**: `metrics_snapshots` is the only significant growth table. Retention cleanup (`dbCleanOldSnapshots()`) is now wired to cron — steady-state ~3.65M rows max.

## External API Calls

| Route | External Service | Cached | Rate Limited | Timeout | Risk |
|-------|-----------------|--------|-------------|---------|------|
| `/u/[handle]/badge.svg` | GitHub GraphQL | 6h + 7d stale | 100/IP/60s | 15s | LOW |
| `/u/[handle]` (share page) | GitHub GraphQL | ISR 1h + 6h Redis | ISR (1h) | 15s | LOW |
| `/u/[handle]/og-image` | GitHub (avatar) | 48h Redis PNG | CDN 6h | 5s avatar, 10s SVG→PNG | LOW |
| `/api/generate` | GitHub GraphQL | 6h Redis | 10/handle/1h | 15s | LOW |
| `/api/refresh` | GitHub GraphQL (fresh) | Invalidates then recaches | 5/handle/1h | 15s | LOW |
| `/api/recalculate` | GitHub (cached) | 6h Redis | 20/handle/1h | 15s | LOW |
| `/api/cron/warm-cache` | GitHub (50 handles/run) | 6h Redis per handle | Bearer token | 15s per call | MED |
| `/api/auth/callback` | GitHub token + user + email | None (one-time) | 10/IP/15m | 10s | LOW |
| `/api/auth/bitbucket/callback` | Bitbucket token + user + stats | 6h Redis | 10/IP/15m | 30s total | MED |
| `/api/auth/codeberg/callback` | Codeberg token + user + stats | 6h Redis | 10/IP/15m | 30s total | MED |
| `/api/webhooks/resend` | Resend API + Gmail forward | None (webhook) | 20/IP/60s | SDK-managed | LOW |
| `/api/insights` | Supabase only | None | 10/handle/24h | None | LOW |
| `/api/admin/*` (5 routes) | Supabase | None | 10/IP/60s | **None** | MED |
| `/api/feature-flags` | Supabase | 1h Redis | 30/IP/60s | **None** | LOW |

### GitHub API Budget

| Source | Est. Calls/hour | Notes |
|--------|----------------|-------|
| Badge requests (cache miss) | ~250 | 6h cache = 4 fetches/day/user |
| Cron warm-cache | ~300 | 50 users × 6 runs/hour |
| Share page (ISR miss) | ~40 | 1h revalidation |
| Manual refresh | ~100 peak | 5/handle/1h cap |
| **Total** | **~690/hr** | |
| **GitHub limit** | **5,000/hr** | |
| **Headroom** | **~86%** | Comfortable |

### Bitbucket/Codeberg API Volume per User Fetch

**Concern (NEW)**: Each Bitbucket/Codeberg user fetch involves per-repo API calls:

| Call Type | Per-repo | Max repos | Max calls |
|-----------|----------|-----------|-----------|
| Commits (paginated, 5 pages) | 1-5 | 50 | 250 |
| Merged PRs (paginated, 5 pages) | 1-5 | 50 | 250 |
| PR diffstat | 1 per PR | 100 (global cap) | 100 |
| Review activities (paginated) | 1-5 | 50 | 250 |
| Closed issues (if has_issues) | 1-5 | ~30 | 150 |
| Fork count (if owned) | 1 | ~25 | 25 |
| **Worst case per user** | | | **~1,025** |

**Mitigations in place**:
- 30s `AbortController` timeout caps total fetch time
- MAX_REPOS=50, MAX_PRS=100, MAX_PAGES=5 per endpoint
- 6h cache means only 4 fetches/day/user
- Stats cached in Redis (`stats:v2:bitbucket:<handle>`, `stats:v2:codeberg:<handle>`)

**Bitbucket limit**: 1,000 calls/hr (authenticated). A single power user could consume 100% of the hourly budget in one fetch.

**Current risk**: LOW (few Bitbucket/Codeberg users). **Scaling risk**: HIGH if 10+ linked users refresh simultaneously during cron warm-cache.

## Resource Management

### Strengths (No Leaks Found)
- **Redis**: Lazy singleton, no connection leak risk (`redis.ts:20-35`)
- **Supabase**: Lazy singleton, no pooling issues (`supabase.ts:12-30`)
- **In-flight dedup**: `_inflight` Map cleans up on promise settlement (`client.ts:60-62`)
- **after() hooks**: Use `Promise.allSettled()` with per-operation `.catch()` — no unhandled rejections (`badge.svg/route.ts:122-167`)
- **OG image generation**: `Promise.race()` with 10s timeout prevents resvg hangs
- **Avatar fetch**: `AbortSignal.timeout(5000)` prevents hanging (`avatar.ts:30`)
- **Cron batch processing**: `processInBatches()` uses `Promise.allSettled()` — one failure doesn't cascade
- **Admin agent process**: 120s timeout, stream `.destroy()`, `SIGTERM` all in place

### Fetch Timeout Coverage: 100%
All external HTTP calls have explicit timeouts:
- GitHub GraphQL: `AbortSignal.timeout(15_000)` (`queries.ts:37`)
- GitHub OAuth (3 calls): `AbortSignal.timeout(10_000)` (`auth/github.ts:118,142,180`)
- Bitbucket full fetch: `AbortController` 30s (`bitbucket/queries.ts:34`)
- Codeberg full fetch: `AbortController` 30s (`codeberg/queries.ts:33`)
- Avatar fetch: `AbortSignal.timeout(5_000)` (`avatar.ts:30`)
- Resend email fetch: `AbortSignal.timeout(5_000)` (`resend.ts`)
- OG image SVG→PNG: `Promise.race()` 10s (`og-image/route.ts:81-86`)

### Supabase Call Timeout Gap (LOW)
Admin routes and `/api/feature-flags` call Supabase without explicit timeouts. Since Supabase uses HTTP/REST (PostgREST), Vercel's 300s function timeout is the only guard. These are low-traffic admin/config routes — not a cost concern, but a resilience gap.

## Vercel Configuration

| Category | Count | Details |
|----------|-------|---------|
| Static pages | ~5 | Landing (ISR 1h), legal (ISR 1d) |
| ISR pages | 12 | Share page (1h), about (1h), archetypes (7d), privacy/terms (1d) |
| Dynamic API routes | ~30 | All API handlers |
| Force-dynamic | 1 | Experiments layout only |
| Edge runtime | 0 | All routes on standard serverless |
| Cron jobs | 1 | `warm-cache` daily 6 AM UTC, maxDuration=300s |
| Heavy deps | 1 | `@resvg/resvg-js` (external package, not bundled) |
| Bundle analyzer | Conditional | `ANALYZE=true` only |

### ISR Coverage: GOOD

| Route | TTL | Previous Status |
|-------|-----|-----------------|
| `/` | 1h | Unchanged |
| `/about/*` (3 pages) | 1h | Unchanged |
| `/archetypes/*` (6 pages) | 7d | Previously RESOLVED |
| `/u/[handle]` | 1h | Previously RESOLVED |
| `/privacy` | 1d | Previously RESOLVED |
| `/terms` | 1d | Previously RESOLVED |

## Resolution Tracking

### RESOLVED This Cycle
- **`dbCleanOldSnapshots()` not wired to cron** — Now called at `warm-cache/route.ts:174`. Retention is 365 days, batch size 1000. Snapshot table growth is bounded.
- **OG image TTL 7d → 48h** — `OG_CACHE_TTL=172800` (48h) confirmed at `og-image/route.ts:42`. Redis memory estimate drops from ~3-5 GB to ~400 MB @10K users.
- **`/privacy` and `/terms` missing ISR** — Both now have `revalidate=86400` (1d).

### Previously RESOLVED (Confirmed Still Good)
- Admin agent process management: 120s timeout, stream `.destroy()`, `SIGTERM`
- Resend API timeouts: `AbortSignal.timeout(5000)`
- 6 archetype pages ISR: All have `revalidate=604800`
- `/api/insights` after() hook: Uses `Promise.allSettled()`

### CARRIED (No Change)
- ~~**`tool_insights` table missing from migration system**~~ — **RESOLVED**: Migration `015_create_tool_insights.sql` exists and is complete (table + index + RLS + deny policy).

### NEW This Cycle
- **Bitbucket/Codeberg per-user API volume**: Up to ~1,025 API calls per user per fetch (bounded by 30s timeout and pagination caps). Low risk at current scale, high risk if 10+ users link platforms simultaneously.
- **Admin routes missing Supabase timeout**: 5 admin routes + `/api/feature-flags` call Supabase without explicit fetch timeout. Resilience gap, not cost concern (low traffic).

## Recommendations

### Priority 1 — Monitor (no code change needed yet)
1. **Bitbucket/Codeberg API volume**: Track per-user call counts in warm-cache cron. Add structured logging when a single user exceeds 500 calls. No cap change needed until >10 linked platform users.
2. **Snapshot table size**: With retention cleanup now wired, monitor steady-state row count. Expected ~3.65M rows max at 10K users.

### Priority 2 — Resilience (backlog)
3. **Add Supabase timeout to admin routes**: Wrap `dbGet*` calls with `Promise.race()` + 10s timeout in admin API handlers. Prevents hanging if Supabase is slow. Low urgency (admin-only, rate-limited).
4. **Avatar caching**: Avatar base64 conversions happen on every badge request. Add Redis cache (`avatar:<handle>`, 24h TTL, ~10 KB/key). Saves ~1 fetch per badge request for users with avatars.

### Priority 3 — Future scaling
5. **Bitbucket/Codeberg warm-cache throttling**: If platform-linked users exceed 10, add per-platform concurrency limit (max 2 Bitbucket users per cron batch). Prevents saturating Bitbucket's 1,000 calls/hr limit.
6. **OG image blob storage**: If Redis memory exceeds 5 GB, migrate OG images to Vercel Blob or R2. Current 48h TTL keeps memory at ~400 MB @10K users — not urgent.

## Cost Projections

| Scale | Vercel | Redis (Upstash) | Supabase | Resend | Total |
|-------|--------|-----------------|----------|--------|-------|
| 1K users | $20 | $10 | Free | Free | ~$30/mo |
| 10K users | $26 | $20 | Free | $10 | ~$56/mo |
| 50K users | $76 | $50 | $25 | $25 | ~$176/mo |
| 100K users | $150 | $100 | $25 | $50 | ~$325/mo |

**Primary cost driver at scale**: Vercel serverless function invocations (badge route). CDN caching (6h s-maxage) keeps this manageable.
