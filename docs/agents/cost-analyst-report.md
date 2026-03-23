# Cost Analyst Report
> Generated: 2026-03-23 | Health status: GREEN

## Executive Summary

Infrastructure costs remain stable and well-optimized. All cache keys have TTLs (except 3 intentional singletons totaling <16 KB). Zero resource leaks, 100% fetch timeout coverage, comprehensive rate limiting on 14+ routes. Estimated monthly cost at 10K users: **~$40–60**. No new cost risks since last report.

## Redis Usage

### Key Patterns (16 families)

| Pattern | TTL | Size/Entry | Purpose |
|---------|-----|-----------|---------|
| `stats:v2:merged:{handle}` | 6h | ~2 KB | Primary GitHub stats cache |
| `stats:stale:{handle}` | 7d | ~2 KB | Stale fallback for API failures |
| `stats:v2:bitbucket:{handle}` | 6h | ~2 KB | Bitbucket linked platform stats |
| `stats:v2:codeberg:{handle}` | 6h | ~2 KB | Codeberg linked platform stats |
| `supplemental:{handle}` | 24h | ~1 KB | EMU supplemental stats |
| `snapshot:latest:{handle}` | 24h | ~300 B | Latest MetricsSnapshot |
| `history:{handle}[:{from}][:{to}]` | 1h | ~2 KB | Historical snapshots (date-filtered) |
| `og-image:v1:{handle}:{date}` | 48h | ~50–100 KB | OG image PNG (base64) |
| `config:{handle}` | 365d | ~1 KB | Creator Studio customization |
| `score-bump:{handle}` | 7d | ~50 B | Email dedup marker |
| `campaign:daily-sends:{date}` | 24h | ~10 B | Resend daily quota counter |
| `campaign:active-engagement` | 1h | ~500 B | Active engagement campaign cache |
| `ff:all` / `ff:key:{key}` | 1h | ~500 B | Feature flags (from Supabase) |
| `cli:device:{sessionId}` | 5m | ~100 B | CLI device auth status |
| `ratelimit:{resource}:{id}` | 60–86400s | ~10 B | Rate limit counters (self-expiring) |
| `cron:warm-cache:offset` | **none** | ~10 B | Round-robin rotation offset |

### Keys Without TTL (Intentional Singletons)

| Key | Type | Size | Risk |
|-----|------|------|------|
| `stats:badges_generated` | INCR counter | ~50 B | None — single integer |
| `stats:unique_badges` | HyperLogLog | ~12 KB | None — O(1) memory per HLL |
| `cron:warm-cache:offset` | Integer | ~10 B | None — single value |

**TTL coverage**: 100% for per-user keys. 3 global singletons intentionally persistent, combined <16 KB.

### Growth Risk: LOW

- Per-user keys self-expire (max 7d for stale stats).
- OG images (~50–100 KB each, 48h TTL) remain the #1 Redis memory consumer.
- **Estimated Redis memory @10K users**: ~535 MB (160 MB user keys + 375 MB OG images). Well within Upstash Pro 10 GB limit.
- **At 50K users**: ~2.5 GB — still within limits but approaching consideration for blob storage for OG images.

## Database Usage

### Tables: 9 + 2 views

| Table | Est. Rows @10K | RLS | Retention | Indexes |
|-------|---------------|-----|-----------|---------|
| `users` | 10K | DENY anon | Permanent | `idx_users_registered_at` |
| `metrics_snapshots` | 365K | DENY anon | 365 days (auto-cleanup) | `idx_snapshots_handle_date` |
| `verification_records` | 10K | DENY anon | 30 days (auto-cleanup) | `idx_verification_handle`, `idx_verification_expires` |
| `feature_flags` | ~20 | Public SELECT | Permanent | — (small table) |
| `merge_operations` | 10K | DENY anon | 90 days (auto-cleanup) | `idx_merge_ops_handle_created`, `idx_merge_ops_failed` |
| `user_platforms` | 1K | DENY anon | Permanent | `idx_user_platforms_handle` |
| `tool_insights` | 1K | DENY anon | Permanent | `idx_tool_insights_handle` |
| `email_campaigns` | 50 | DENY anon | Permanent | `idx_email_campaigns_status` |
| `campaign_sends` | 50K | DENY anon | Permanent | `idx_campaign_sends_campaign_status` |

**Views**: `latest_snapshots` (DISTINCT ON), `admin_users` (users LEFT JOIN snapshots). Both use `security_invoker = true`.

### Query Patterns: EXCELLENT

- **Connection management**: Lazy singleton client (`lib/db/supabase.ts:12–31`). PostgREST REST API — no connection pooling needed.
- **N+1 queries**: 0 found. Batch queries used for snapshots (`dbGetLatestSnapshotBatch()`), admin dashboard (`dbGetAdminUsers()` via view).
- **Bulk mutations**: Campaign sends use single upsert (`dbCreateCampaignSends()`), bulk status updates via `.in()`.
- **Runtime validation**: All queries use `parseRow()`/`parseRows()` — defense-in-depth against schema mismatches.
- **Auto-cleanup**: Snapshots (365d), verifications (30d), merge ops (90d) — batched to 1000 rows/run via cron.
- **`dbGetCampaignStats()` JS aggregation** (`campaigns.ts:395–433`): Documented intentional trade-off — PostgREST lacks GROUP BY. Fetches single `status` column, O(n) count in JS. Negligible at current scale (<1K sends/campaign). Confirmed correct approach by triage agent.

## External API Calls

| Route | External Service | Cached | Rate Limited | Timeout | Risk |
|-------|-----------------|--------|-------------|---------|------|
| `/u/[handle]/badge.svg` | GitHub, Bitbucket, Codeberg, Avatar CDN | YES (6h + 7d stale) | 100/IP/60s | 15s, 10s, 5s | LOW |
| `/api/generate` | GitHub | YES (6h) | 10/handle/1h | 15s | LOW |
| `/api/refresh` | GitHub | NO (explicit bypass) | 5/handle/1h | 15s | LOW |
| `/api/recalculate` | GitHub | YES (6h) | 20/handle/1h | 15s | LOW |
| `/api/cron/warm-cache` | GitHub (50 handles/run) | YES (batch prefetch) | N/A (cron) | 15s + 300s max | LOW |
| `/api/cron/sync-audience` | Resend (paginated) | N/A | N/A (cron) | 30s | LOW |
| `/api/cron/process-campaigns` | Resend (batch 50) | N/A | Daily quota (95) | 300s max | LOW |
| `/api/auth/callback` | GitHub (token + user + email) | N/A | 10/IP/15m | 10s | LOW |
| `/api/auth/bitbucket/callback` | Bitbucket (token + user) | N/A | 10/IP/15m | 10s | LOW |
| `/api/auth/codeberg/callback` | Codeberg (token + user) | N/A | 10/IP/15m | 10s | LOW |
| `/u/[handle]/og-image` | None (renders from cache) | YES (48h Redis) | CDN s-maxage=21600 | 10s PNG | LOW |

### GitHub API Budget

- **Per-user**: 1 GraphQL query per 6 hours (cache hit rate >50% expected)
- **@10K users**: ~420 calls/hr (50% cache hit) vs 5,000/hr limit. **91.6% headroom**.
- **In-flight deduplication** (`lib/github/client.ts:20–27`): concurrent requests for same handle share one promise, reducing concurrent calls 40–60%.
- **Warm-cache cron**: processes 50 handles/run in batches of 5 concurrent. Rotation ensures all users warmed within days.

### Rate Limiting Coverage

14+ routes with rate limiting. All use fail-open design (Redis outage allows requests rather than blocking). Badge endpoint: 100 req/IP/60s. Generate: 10/handle/1h. Refresh: 5/handle/1h. All admin routes protected via `adminAuth()`.

## Resource Management

### Resource Leaks: 0 CRITICAL

- **Timers**: All `setTimeout`/`setInterval` properly cleaned up. `listAllContacts()` timer cleared via `.finally()`. Agent route uses `clearTimeout()`/`clearInterval()` + stream `.destroy()` in `cleanupProcess()`.
- **Connections**: Lazy singleton Supabase client (never recreated). Upstash Redis uses REST API (stateless — no persistent connections).
- **Buffers**: OG image PNG buffer is 50–100 KB, cached in Redis with 48h TTL. Avatar base64 strings ~1–133 KB, cached 6h. No unbounded in-memory caches.
- **In-flight map**: Module-level `Map` for GitHub request dedup — entries cleaned via `.finally()`. Risk of orphaned entries near-zero (15s fetch timeout guarantees settlement).
- **Agent state**: Module-level `currentRun` stores up to 500 log lines. 5-minute hard timeout ensures cleanup. Risk: LOW.
- **Badge SVG route**: Uses `Promise.allSettled()` at line 104 — confirmed. Craft DB errors don't crash badge rendering.

### Fetch Timeout Coverage: 100%

| External Call | Timeout | Mechanism |
|--------------|---------|-----------|
| GitHub GraphQL | 15s | `AbortSignal.timeout()` |
| Avatar CDN | 5s | `AbortSignal.timeout()` |
| Bitbucket OAuth | 10s | `AbortSignal.timeout()` |
| Codeberg OAuth | 10s | `AbortSignal.timeout()` |
| Resend sync | 30s | `Promise.race()` |
| Redis ping | 5s | `Promise.race()` |
| Supabase ping | 5s | `Promise.race()` |

## Vercel Cost Factors

### Serverless Functions

- **No edge runtime** — all routes are serverless (no cold-start premium).
- **No middleware** — no per-request overhead.
- **3 cron jobs**: warm-cache (6 AM), sync-audience (3:30 AM), process-campaigns (8 AM). ~90 executions/month, ~0.25 compute-hours/month vs 2,160 free on Pro.
- **maxDuration**: 300s on cron routes (Vercel Pro max). All other routes use default timeout.

### ISR Strategy: EXCELLENT

| Route Pattern | Revalidation | Strategy |
|--------------|-------------|----------|
| `/archetypes/*` | 7 days | ISR — static marketing |
| `/about/*` | 1 hour | ISR — light content |
| `/` (landing) | 1 hour | ISR |
| `/privacy`, `/terms` | 24 hours | ISR — legal pages |
| `/u/[handle]` | 1 hour | ISR with fallback fetch |
| `/studio` | force-dynamic | Auth required |
| `/experiments/*` | force-dynamic | Feature-gated |
| Badge SVG | CDN s-maxage=21600 | CDN-cached 6h, stale 7d |

### Bundle Size

- No chunks exceed 500 KB threshold (largest: 219 KB Next.js framework).
- PostHog 175 KB lazy-loaded on first interaction.
- Bundle analyzer available via `ANALYZE=true`.
- `@resvg/resvg-js` correctly marked as `serverExternalPackages`.

## Estimated Monthly Costs

| Service | @500 Users | @10K Users | @50K Users |
|---------|-----------|-----------|-----------|
| **Vercel Pro** | $20 | $20 | $20–40 |
| **Upstash Redis** | Free tier | $20 (Pro) | $20–40 (Pro) |
| **Supabase** | Free tier | Free tier | Free–$25 |
| **Resend** | Free (100/day) | Free–$20 | $20–40 |
| **Total** | **~$20** | **~$40–60** | **~$65–145** |

## Carried Items

| Item | Since | Priority | Notes |
|------|-------|----------|-------|
| `dbGetCampaignStats()` JS aggregation | 2026-03-18 | ACCEPTED | PostgREST lacks GROUP BY. Documented. Correct approach per triage. |

## Monitor Items

| Item | Trigger | Action |
|------|---------|--------|
| `sync-audience` contact pagination | 10K+ contacts | Consider cursor caching for incremental sync |
| OG image Redis memory | 50K+ users (~2.5 GB) | Consider Vercel Blob or R2 for OG images |

## Recommendations

1. **No action needed** — all systems GREEN. No new cost risks, no resource leaks, no unbounded growth patterns.
2. **Future scale (50K+)**: Move OG images from Redis to blob storage (Vercel Blob, Cloudflare R2) to free Redis memory.
3. **Future scale (10K+ contacts)**: Add cursor caching to `sync-audience` cron for incremental Resend syncs.

## Delta vs Previous Report (2026-03-22)

- **Redis key families**: 15 → 16 (+`campaign:active-engagement` cache confirmed).
- **Rate-limited routes**: 14+ confirmed (comprehensive audit with exact limits/windows).
- **`dbGetCampaignStats` JS aggregation**: Reclassified from CARRIED to ACCEPTED (per triage confirmation — PostgREST lacks GROUP BY, documented trade-off).
- **Badge SVG `Promise.allSettled()`**: Re-verified at `route.ts:104`. Confirmed working correctly.
- **All other metrics stable**: No new risks, no regressions.
