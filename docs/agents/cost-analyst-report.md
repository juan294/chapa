# Cost Analyst Report
> Generated: 2026-03-29 | Health status: GREEN

## Executive Summary

Infrastructure costs remain stable with no new risk vectors since the 2026-03-28 report. The scoring v6.1 changes (batch size score, lead time modifier, week coverage) added a new `bulk-recalculate` endpoint but it's properly rate-limited and auth-gated. The `sync-audience` `Promise.all()` resilience issue from the prior report has been resolved (now uses `Promise.allSettled`). Estimated monthly cost at 10K users: **~$40-60**. No regressions.

## Delta vs 2026-03-28 Report

| Item | Previous | Current | Status |
|------|----------|---------|--------|
| API routes | 43 (+1 agents-summary) | 44 (+1 agents-summary) | +1 (`bulk-recalculate`) |
| Client JS | 1,800 KB / 71 chunks | 1,800 KB / 71 chunks | STABLE |
| Test count | 6,414 | 6,609 | +195 |
| Coverage | 92.43% stmts | 92.69% stmts | +0.26% |
| sync-audience resilience | `Promise.all()` ⚠️ | `Promise.allSettled()` ✓ | RESOLVED |
| Resource leaks | 0 critical, 1 minor | 0 critical, 0 minor | RESOLVED |

## Redis Usage

### Key Pattern Families (25 total, +1 vs prior)

| Key Pattern | TTL | Type | Size Per Key | Notes |
|-------------|-----|------|-------------|-------|
| `stats:v2:merged:{handle}` | 6h | JSON string | ~2-4 KB | Primary stats cache |
| `stats:stale:{handle}` | 7d | JSON string | ~2-4 KB | Fallback on GitHub failure |
| `stats:v2:bitbucket:{handle}` | 6h | JSON string | ~1-2 KB | Bitbucket platform stats |
| `stats:v2:codeberg:{handle}` | 6h | JSON string | ~1-2 KB | Codeberg platform stats |
| `supplemental:{handle}` | 6h (default) | JSON string | ~0.5-1 KB | EMU supplemental stats |
| `snapshot:latest:{handle}` | 24h | JSON string | ~1-2 KB | MetricsSnapshot cache |
| `craft:{handle}` | 1h | JSON string | ~0.5 KB | Tool insights scores |
| `avatar:{handle}` | 6h | base64 string | ~1.5 KB | Avatar data URIs |
| `og-image:v1:{handle}:{date}` | 48h | base64 PNG | ~15 KB | OG image render cache |
| `ff:all` | 1h | JSON array | ~0.5 KB | All feature flags |
| `ff:key:{key}` | 1h | JSON string | ~0.1 KB | Individual feature flag |
| `campaign:active-engagement` | 1h | JSON string | ~0.5 KB | Active engagement campaign |
| `campaign:daily-sends:{date}` | 24h | Integer | ~8 bytes | Daily email quota counter |
| `cli:device:{sessionId}` | 5min | JSON string | ~0.2 KB | Device auth sessions |
| `ratelimit:*:{id}` | Variable (60s-3600s) | Integer | ~8 bytes | Rate limit counters |
| `ratelimit:admin-bulk-recalc:{ip}` | 3600s | Integer | ~8 bytes | **NEW** — bulk recalculate limiter |
| `cron:warm-cache:offset` | **NONE** ⚠️ | Integer | ~8 bytes | Round-robin rotation offset |
| `stats:badges_generated` | **NONE** ⚠️ | Integer | ~8 bytes | Total badge view counter |
| `stats:unique_badges` | **NONE** ⚠️ | HyperLogLog | ~12-16 KB | Unique developer cardinality |

### TTL Coverage

- **Per-user keys**: 100% TTL coverage (6h–48h depending on type)
- **Global singletons without TTL**: 3 — intentional, combined <16 KB:
  1. `cron:warm-cache:offset` (rotation state, 8 bytes)
  2. `stats:badges_generated` (counter, 8 bytes)
  3. `stats:unique_badges` (HyperLogLog, ~12-16 KB)
- **Growth risk**: LOW — all per-user keys expire. The 3 persistent keys are bounded (HyperLogLog is O(1) memory regardless of cardinality).

### Estimated Redis Memory @ Scale

| Users | User data | Avatars | OG images | Overhead | Total | Upstash Pro 10 GB |
|-------|-----------|---------|-----------|----------|-------|-------------------|
| 1K | ~8 MB | ~1.5 MB | ~15 MB | ~2 MB | ~27 MB | 99.7% headroom |
| 10K | ~78 MB | ~15 MB | ~150 MB | ~10 MB | ~253 MB | 97.5% headroom |
| 50K | ~390 MB | ~75 MB | ~750 MB | ~50 MB | ~1,265 MB | 87.7% headroom |
| 100K | ~780 MB | ~150 MB | ~1,500 MB | ~100 MB | ~2,530 MB | 75.3% headroom |

**OG images remain the #1 memory consumer (59-62% of total).** Consider migrating to Vercel Blob at 50K+ users.

## Database Usage

- **Tables**: 9 (users, metrics_snapshots, verification_records, feature_flags, merge_operations, user_platforms, tool_insights, email_campaigns, campaign_sends)
- **Views**: 2 (latest_snapshots, admin_users) — both with `security_invoker = true`
- **Indexes**: 11 covering all major query paths
- **RLS**: FORCE on all 9 tables with explicit deny policies for anon role
- **Connection management**: Lazy singleton via `getSupabase()` — initialized once, reused across invocations
- **Query patterns**: Batch operations throughout (`.in()` for multi-handle fetches, bulk upsert for campaign sends). 0 N+1 patterns.
- **`dbGetCampaignStats()` JS aggregation**: ACCEPTED — PostgREST limitation, safe at <1K sends/campaign scale
- **SELECT * in campaigns.ts**: 4 instances — low risk, not on hot paths, ~14-16 columns

## External API Calls

| Route | External Service | Cached | Rate Limited | Risk |
|-------|-----------------|--------|-------------|------|
| `/api/generate` | GitHub GraphQL | ✓ 6h cache + 7d stale | ✓ 10/hr | LOW |
| `/api/refresh` | GitHub GraphQL | ✓ Cache cleared intentionally | ✓ 5/hr | LOW |
| `/api/recalculate` | GitHub GraphQL | ✓ 6h cache + 7d stale | ✓ 20/hr | LOW |
| `/api/admin/bulk-recalculate` | GitHub GraphQL | ✓ 6h cache + 7d stale | ✓ 5/hr (IP) | MEDIUM — **NEW** |
| `/api/cron/warm-cache` | GitHub GraphQL | ✓ 6h cache, max 50 handles | Cron-protected | MEDIUM |
| `/api/auth/callback` | GitHub OAuth (3 calls) | ✗ No cache (one-time) | ✓ 10/15min | LOW |
| `/api/cron/process-campaigns` | Resend batch send | Redis 95/day quota | Cron-protected | MEDIUM |
| `/api/admin/campaigns/[id]/send` | Resend batch send | Redis 95/day quota | Admin-protected | MEDIUM |
| `/api/admin/campaigns/[id]/test` | Resend single send | None (test email) | Admin-protected | LOW |
| `/api/webhooks/resend` | Resend email fetch + forward | None (webhook) | HMAC-verified | LOW |
| `/api/cron/sync-audience` | Resend contacts API | None (sync operation) | Cron-protected | LOW |
| `/api/telemetry` | PostHog (fire-and-forget) | None (unique events) | ✓ 10/60s | LOW |

### GitHub API Budget

- **Cache TTL**: 6h primary + 7d stale fallback
- **In-flight deduplication**: Yes — Map-based, prevents concurrent fetches for same handle
- **Estimated calls/hr @ 10K users**: ~57 (1.1% of 5K/hr authenticated limit)
- **`bulk-recalculate`**: New endpoint processes in batches of 5; rate-limited to 5/hr. Uses cached stats, only fetches on cache miss. At worst, 50 handles × 1 API call = 50 calls in a single run — 1% of hourly budget.
- **Safe until**: ~500K+ users

### Resend Email Budget

- **Daily quota**: 95 emails/day (tracked via Redis `campaign:daily-sends:{date}`)
- **Batch size**: 50 per `resend.batch.send()` call
- **Campaign sends**: Batched, quota-checked before each batch
- **Sync-audience**: Daily cron, creates/updates contacts (no send quota impact)

## Resource Management

- **Resource leaks**: 0 critical, 0 minor (all resolved)
  - `sync-audience` now uses `Promise.allSettled()` for initial data fetch ✓
  - All timers cleaned up via `.finally()` blocks
  - All event listeners properly removed in cleanup functions
  - All `after()` callbacks wrapped in `Promise.allSettled()`
  - Agent run process: hard 300s timeout with SIGTERM → 5s grace → SIGKILL, stream `.destroy()`, `removeAllListeners()`
- **Module-level caches**: 2, both bounded:
  - `_inflight` Map in `github/client.ts` — cleaned via `.finally()` after each request
  - `_cachedSegmentId` in `email/audience.ts` — single string, per-process lifetime
- **In-memory buffers**: Agent run log capped at 500 lines (`MAX_LOG_LINES`)
- **Streaming**: No streaming responses in codebase (no ReadableStream/SSE)
- **Fetch timeouts**: 100% coverage — all external calls use `AbortSignal.timeout()` or `withTimeout()`

## Vercel Cost Factors

| Factor | Value | Status |
|--------|-------|--------|
| Total API routes | 44 (+1 agents-summary) | STABLE (+1) |
| Static pages | 8 prerendered (icon, robots, sitemap, etc.) | STABLE |
| Dynamic pages | ~77 server-rendered | STABLE |
| Total client JS | 1,800 KB across 71 chunks | STABLE |
| Largest chunk | 232 KB (Next.js framework) | Under 500 KB ✓ |
| Edge runtime | None — all serverless | ✓ |
| `force-dynamic` routes | 2 (studio, experiments) | Intentional |
| ISR pages | Archetype (7d), share pages (1h), legal (24h) | Optimal |
| Cron jobs | 3 (warm-cache 6am, sync-audience 3:30am, process-campaigns 8am) | ~90 exec/mo |
| `maxDuration` | 300s on cron routes + bulk-recalculate | Within Pro limits |

### Estimated Monthly Cost @ Scale

| Users | Vercel | Redis (Upstash) | Resend | Supabase | Total |
|-------|--------|-----------------|--------|----------|-------|
| 1K | ~$20 | ~$0-5 | $0 | $0 (free) | **~$20-25** |
| 10K | ~$20 | ~$10-20 | $0-20 | $0 (free) | **~$40-60** |
| 50K | ~$20-40 | ~$30-50 | $20-80 | $25 | **~$95-195** |
| 100K | ~$40-60 | ~$50-100 | $80+ | $25 | **~$195-265** |

## Recommendations

### Carried from Previous Report (Monitoring)

1. **MONITOR: OG image Redis memory** — 62% of Redis budget at 10K users. No action needed now. At 50K+, consider migrating OG image cache to Vercel Blob storage.
2. **MONITOR: `sync-audience` pagination** — Currently fetches all contacts in one call. Future risk at 50K+ users only.

### New This Report

3. **INFO: `bulk-recalculate` cost profile** — New endpoint uses batches of 5 concurrent handles. At max utilization (5 calls/hr × 50 handles each = 250 GitHub API calls/hr), still only 5% of hourly budget. No cost concern at current scale.
4. **INFO: Scoring v6.1 changes are compute-only** — New fields (`batchSizeScore`, `medianPrLeadTimeHours`, `weekCoverage`) are derived from existing cached stats data. No additional external API calls.

### Resolved This Cycle

- ~~`sync-audience` `Promise.all()` resilience~~ → Fixed to `Promise.allSettled()` (triage 2026-03-28)
