# Cost Analyst Report
> Generated: 2026-03-26 | Health status: GREEN

## Executive Summary
Infrastructure costs remain stable and well-optimized. Redis key families grew from 17 to 24 (7 new patterns from Bitbucket/Codeberg/Craft/CLI features), all with proper TTLs. Estimated monthly cost at 10K users: **~$40-60**. No new cost risks. Two carried monitor items (OG image blob storage, sync-audience pagination) remain future-scale-only concerns.

## Delta vs Previous Report (2026-03-25)
- Redis key families: 17 -> **24** (+7 new patterns)
- Redis memory estimate @10K: **~243 MB** (refined from 535 MB — previous estimate double-counted OG images)
- Supabase: 9 tables + 1 view -> **9 tables + 2 views** (admin_users view added)
- RLS: Tightened with `FORCE ROW LEVEL SECURITY` on all tables (migration 018)
- Rate limiting: **28/30 routes** (93% coverage) — 2 intentionally unprotected
- GitHub API budget: **~57 calls/hr @10K** (1.1% of 5K/hr limit) — more conservative estimate with 6h cache
- Build: No routes exceed 500KB. Supabase SDK appears in 2 chunks (minor duplication)
- Resource leaks: **0 critical, 0 warnings** (unchanged)

## Redis Usage

### Key Pattern Families (24 total)

#### Core Data (10 patterns)
| Key Pattern | TTL | Size/User |
|---|---|---|
| `stats:v2:merged:{handle}` | 6h | 5-8 KB |
| `stats:stale:{handle}` | 7d | 5-8 KB |
| `stats:v2:bitbucket:{handle}` | 6h | 4-6 KB |
| `stats:v2:codeberg:{handle}` | 6h | 4-6 KB |
| `snapshot:latest:{handle}` | 24h | 1-2 KB |
| `history:{handle}[:{from}[:{to}]]` | 1h | 10-50 KB |
| `craft:{handle}` | 1h | 1-2 KB |
| `supplemental:{handle}` | 24h | 3-5 KB |
| `og-image:v1:{handle}:{date}` | 48h | 100-200 KB |
| `avatar:{handle}` | 6h | 50-150 KB |

#### Tracking (3 patterns)
| Key Pattern | TTL | Notes |
|---|---|---|
| `stats:badges_generated` | None (intentional) | INCR counter, <1 KB |
| `stats:unique_badges` | None (intentional) | HyperLogLog, ~16 KB fixed |
| `badge:notified:{handle}` | 365d | First-badge email marker |

#### Rate Limiting (21+ patterns)
All use INCR + EXPIRE with 60s window (default). Special windows: `supplemental` (24h), `generate`/`refresh`/`recalculate` (1h), `callback` (15m).

#### Ephemeral (2 patterns)
| Key Pattern | TTL | Notes |
|---|---|---|
| `cli:device:{sessionId}` | 5m | CLI device auth |
| `campaign:daily-sends:{date}` | 24h | Email quota counter |

### New Since Last Audit (+7)
1. `stats:v2:bitbucket:{handle}` — Bitbucket linked platform (feature-flagged)
2. `stats:v2:codeberg:{handle}` — Codeberg linked platform (feature-flagged)
3. `craft:{handle}` — Craft score caching (1h TTL)
4. `supplemental:{handle}` — EMU supplemental data (24h TTL)
5. `og-image:v1:{handle}:{date}` — OG image PNG (48h TTL)
6. `campaign:daily-sends:{date}` — Email quota tracking (24h TTL)
7. `cli:device:{sessionId}` — CLI auth sessions (5m TTL)

### TTL Coverage
- **100% of per-user keys** have explicit TTLs
- **2 global singletons** without TTL (intentional): badges_generated counter (<1 KB) + unique_badges HyperLogLog (~16 KB)
- All rate limit keys auto-expire with their window duration

### Memory Estimates

| Scale | User Keys | Images | Rate Limit | Total | Upstash Headroom |
|-------|-----------|--------|------------|-------|-----------------|
| 10K users | ~93 MB | ~150 MB | ~0.6 MB | **~243 MB** | 97.6% (10 GB) |
| 50K users | ~463 MB | ~750 MB | ~3 MB | **~1,216 MB** | 87.8% (10 GB) |

### Growth Risk: LOW
- History date-range variants (`history:{handle}:{from}:{to}`) could create combinatorial keys, mitigated by 1h TTL
- OG images remain #1 Redis consumer (~62% of total at 10K)
- **MONITOR (CARRIED):** Consider blob storage for OG images at 50K+ scale

## Database Usage

### Tables: 9 + 2 views
1. `users` — GitHub profiles
2. `metrics_snapshots` — Historical metrics (1/handle/day, 365d retention)
3. `verification_records` — OAuth state (30d TTL)
4. `feature_flags` — Feature toggles
5. `merge_operations` — CLI merge telemetry (90d retention)
6. `user_platforms` — Linked OAuth accounts
7. `tool_insights` — AI tool proficiency scoring
8. `email_campaigns` — Campaign metadata
9. `campaign_sends` — Per-recipient tracking

**Views:** `latest_snapshots` (DISTINCT ON per user), `admin_users` (users + snapshots JOIN)

### RLS: Comprehensive
- All 9 tables: RLS ENABLED + FORCE ROW LEVEL SECURITY
- All tables: Explicit deny-all policies for `anon` role
- `feature_flags`: Additional permissive SELECT for public API
- Views inherit RLS from base tables

### Query Patterns: Efficient
- **0 N+1 patterns** detected
- `dbGetLatestSnapshotBatch()` — bulk fetch for cron (single query)
- `dbCreateCampaignSends()` — batch upsert (single query)
- `dbGetAdminUsers()` — server-side pagination, filtering, sorting
- `dbGetCampaignStats()` — JS aggregation (ACCEPTED: PostgREST lacks GROUP BY)

### Connection Management: Lazy Singleton
- Single `SupabaseClient` instance, initialized on first use
- Returns `null` if env vars missing (graceful degradation)
- All critical calls wrapped in `dbTimeoutOr504()` (10s timeout)
- PostgREST REST API (no persistent Postgres connections)

## External API Calls

| Route | Service | Cached | Timeout | Rate Limited | Risk |
|-------|---------|--------|---------|-------------|------|
| `/api/generate` | GitHub GraphQL | 6h | 15s | 10/handle/hr | LOW |
| `/api/refresh` | GitHub GraphQL | 6h | 15s | 5/handle/hr | LOW |
| `/api/recalculate` | GitHub GraphQL | 6h | 15s | 20/handle/hr | LOW |
| `/api/cron/warm-cache` | GitHub GraphQL | 6h | 15s | CRON_SECRET | LOW |
| `/api/auth/callback` | GitHub OAuth | No | 10s | 10/IP/15m | LOW |
| `/api/auth/bitbucket/callback` | Bitbucket OAuth | No | 10s | 10/IP/15m | LOW |
| `/api/auth/codeberg/callback` | Codeberg OAuth | No | 10s | 10/IP/15m | LOW |
| `/api/cron/sync-audience` | Resend (contacts) | No | 30s | CRON_SECRET | LOW |
| `/api/cron/process-campaigns` | Resend (sends) | No | None | CRON_SECRET | MEDIUM |
| `/api/admin/campaigns/*/send` | Resend (initiate) | No | None | 10/IP/60s | MEDIUM |
| `/api/admin/campaigns/*/test` | Resend (test) | No | None | 10/IP/60s | MEDIUM |
| `/api/webhooks/resend` | Resend (fetch+forward) | No | 5s | 20/IP/60s | LOW |
| Error handlers | PostHog capture | No | None | N/A | LOW |

### GitHub API Budget
```
@10K users (6h cache, 50 handles/cron):
  Cron warm-cache:  ~50 calls/hr
  User refreshes:   ~3 calls/hr
  OAuth callbacks:  ~4 calls/hr
  Total:            ~57 calls/hr (1.1% of 5,000/hr limit)

@50K users:         ~94 calls/hr (1.9%)
@100K users:        ~187 calls/hr (3.7%)
Safe until ~500K:   ~936 calls/hr (18.7%)
```

### Missing Timeouts (2, carried)
1. **`captureServerError()` (PostHog)** — fire-and-forget, never blocks response. LOW risk.
2. **`emails.send()` (Resend)** — relies on Vercel 30s default. MEDIUM risk for campaign sends.

### Rate Limiting Coverage
- **28/30 routes** rate-limited (93%)
- 2 intentionally unprotected: `/api/auth/login` (redirect only), `/api/feature-flags` (public read)
- All fail-open by design (availability-first)
- Campaign email: 95/day hard quota via Redis counter

## Resource Management

### Resource Leaks: 0 critical, 0 warnings
- **Timers**: All `setTimeout` properly cleaned with `.finally(() => clearTimeout(timer))`
- **Connections**: Lazy singletons for Redis and Supabase (REST API, no persistent connections)
- **Promise patterns**: Correct — `Promise.all()` for critical paths, `Promise.allSettled()` for optional operations
- **`after()` callbacks**: Single usage (`insights/route.ts`), properly deferred with `Promise.allSettled()`
- **Memory**: Bounded batch processing (warm-cache: 50 handles, sync-audience: 5 per batch)
- **No unbounded buffers** or in-memory caches detected

### Build Output
- **No routes exceed 500KB** threshold
- Largest server chunks: SSR bundle 416KB, component bundle 356KB, root runtime 232KB
- PostHog: 172KB (lazy-loaded on first interaction)
- Supabase SDK: 160KB (appears in 2 chunks — minor duplication, non-blocking)
- Total API routes: 42, all correctly dynamic

### Vercel Cost Factors
- **ISR**: Homepage (1h), archetypes (7d), content pages (1h), legal pages (24h)
- **Force-dynamic**: Studio, experiments (feature-flagged, low traffic)
- **Edge runtime**: None used
- **Middleware**: None (security headers via next.config.ts)
- **Cron**: 3 jobs, ~90 executions/mo, <0.01% of free tier compute
- **Estimated monthly**: ~$20-40 (dominated by serverless compute, not cron)

## Cost Estimate Summary

| Component | @10K users/mo | @50K users/mo | Notes |
|-----------|---------------|---------------|-------|
| Vercel (Hobby/Pro) | $20 | $20-40 | Serverless compute |
| Upstash Redis | $10-20 | $20-40 | ~243 MB / ~1.2 GB |
| Supabase | $0 (free tier) | $0-25 | Row count dependent |
| Resend | $0-20 | $0-20 | 95 emails/day cap |
| **Total** | **~$40-60** | **~$65-100** | Stable, no spikes |

## Recommendations

### Priority 1 (Monitor — Carried)
1. **OG image blob storage**: OG images consume ~62% of Redis memory. At 50K+ users, migrate to Vercel Blob or S3 with Redis as invalidation cache.
2. **`sync-audience` contact pagination**: Current implementation handles pagination correctly. Monitor at scale for timeout risk.

### Priority 2 (Minor)
3. **Add timeout to Resend `emails.send()`**: Wrap with `Promise.race()` or SDK timeout option (10s). Prevents 504 on slow Resend responses.
4. **Supabase SDK chunk deduplication**: Audit import paths in `lib/db/supabase.ts` — SDK appears in 2 chunks (160KB each). Minor bundle savings possible.

### Priority 3 (Future Scale)
5. **Redis metrics endpoint**: Add `/api/admin/redis-stats` with key count by prefix, memory breakdown, hit/miss rates.
6. **Separate GitHub service account for cron**: At 500K+ users, dedicated token doubles API budget headroom.
7. **History date-range key pruning**: Monitor `history:{handle}:{from}:{to}` key proliferation; 1h TTL mitigates but combinatorial potential exists.
