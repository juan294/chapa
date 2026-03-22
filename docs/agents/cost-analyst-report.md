# Cost Analyst Report
> Generated: 2026-03-22 | Health status: GREEN

## Executive Summary

Infrastructure costs remain stable and well-controlled. Estimated monthly cost at 10K users: **~$46–66** (Vercel $20, Redis $20, Resend $0–20, Supabase free tier). All previously carried items from prior reports are now resolved — badge SVG uses `allSettled`, `listAllContacts()` timer properly cleared, campaign admin rate limiting confirmed present via `adminAuth()`. One minor item carried forward (`dbGetCampaignStats` JS aggregation). No new cost risks identified.

## Redis Usage

### Key Pattern Inventory (15 families)

| Pattern | Example Key | TTL | Est. Size/Key | Notes |
|---------|------------|-----|---------------|-------|
| `stats:v2:merged:{handle}` | `stats:v2:merged:juan294` | 6h (21,600s) | 2–5 KB | Primary GitHub+platform stats |
| `stats:v2:bitbucket:{handle}` | `stats:v2:bitbucket:juan294` | 6h | 1–3 KB | Bitbucket-only (if linked) |
| `stats:v2:codeberg:{handle}` | `stats:v2:codeberg:juan294` | 6h | 1–3 KB | Codeberg-only (if linked) |
| `stats:stale:{handle}` | `stats:stale:juan294` | 7d (604,800s) | 2–5 KB | Fallback for API failures |
| `snapshot:latest:{handle}` | `snapshot:latest:juan294` | 24h | 0.5–0.8 KB | Latest MetricsSnapshot |
| `history:{handle}[:{from}[:{to}]]` | `history:juan294:2025-03-01` | 1h (3,600s) | 2–15 KB | Snapshot history ranges |
| `config:{handle}` | `config:juan294` | 365d | 0.5–2 KB | Creator Studio config |
| `supplemental:{handle}` | `supplemental:juan294` | 6h | 2–5 KB | EMU merged stats |
| `og-image:v1:{handle}:{date}` | `og-image:v1:juan294:2026-03-22` | 48h (172,800s) | 30–60 KB | OG PNG as base64 |
| `cli:device:{sessionId}` | `cli:device:xxxxxxxx-...` | ~5–15 min | 0.2–0.5 KB | CLI auth sessions |
| `campaign:daily-sends:{date}` | `campaign:daily-sends:2026-03-22` | 24h | 8 bytes | Resend quota counter |
| `ratelimit:{endpoint}:{key}` | `ratelimit:badge:192.168.1.1` | 60–86,400s | ~50 bytes | 22+ endpoint variants |
| `stats:badges_generated` | — | **No TTL** | 8 bytes | Cumulative INCR counter |
| `stats:unique_badges` | — | **No TTL** | ~16 KB | HyperLogLog (bounded) |
| `cron:warm-cache:offset` | — | **No TTL** | 2 bytes | Rotation integer |

### TTL Coverage
- **Per-user keys**: 100% — all have explicit TTLs (6h to 365d)
- **Global singletons without TTL**: 3 keys, combined <16 KB — intentional, bounded growth
- **Rate limit keys**: All auto-expire with their window (60s–86,400s)

### Memory Estimation

| Scale | Est. Memory | Breakdown |
|-------|------------|-----------|
| 1K users | ~20 MB | ~20 KB/user + global singletons |
| 10K users | ~160 MB + ~375 MB OG | OG images (48h TTL) dominate |
| 50K users | ~800 MB + ~1.8 GB OG | Approaching Upstash Pro 10 GB |

**#1 Redis consumer**: OG images (~30–60 KB each, 48h TTL). At 50K+ active users, OG image cache alone could reach ~1.8 GB. Consider blob storage (Vercel Blob, R2) if scaling past 50K.

### Growth Risk: LOW
No unbounded patterns. The 3 no-TTL keys are bounded by design (HyperLogLog capped at ~16 KB, counter is 8 bytes, offset is 2 bytes).

## Database Usage

### Tables & Views

| Table | Purpose | RLS | Retention |
|-------|---------|-----|-----------|
| `users` | GitHub registration & profile | Enabled (deny anon) | Permanent |
| `metrics_snapshots` | Daily impact scores | Enabled (deny anon) | 365d (batched cleanup) |
| `verification_records` | Badge verification hashes | Enabled (deny anon) | 30d (batched cleanup) |
| `feature_flags` | DB-backed feature toggles | Enabled (public SELECT) | Permanent |
| `user_platforms` | Linked OAuth accounts | Enabled (deny anon) | Permanent |
| `merge_operations` | CLI merge telemetry | Enabled (deny anon) | 90d (batched cleanup) |
| `tool_insights` | AI tool proficiency (Craft) | Enabled (deny anon) | Permanent |
| `email_campaigns` | Campaign metadata | Enabled (deny anon) | Permanent |
| `campaign_sends` | Per-recipient tracking | Enabled (deny anon) | Permanent |
| `latest_snapshots` (view) | Latest snapshot/handle | SECURITY INVOKER | — |
| `admin_users` (view) | Admin dashboard join | SECURITY INVOKER | — |

- **Tables**: 9 + 2 views
- **RLS**: 100% coverage — all 9 tables + views use `security_invoker`
- **Indexes**: 14 indexes cover all hot query paths (verified)

### Query Patterns: EFFICIENT
- **Connection**: Lazy singleton (`getSupabase()`), fail-open, `persistSession: false`
- **N+1 patterns**: 0 — batch queries used everywhere (e.g., `dbGetLatestSnapshotBatch()`)
- **Cleanup**: Batched deletes capped at 1,000 rows/run (prevents table locks)
- **PostgREST only** — no raw SQL

### Carried Item
**`dbGetCampaignStats()` JS aggregation** (`campaigns.ts:350-376`) — fetches all `status` rows, counts in JS. Should use SQL `GROUP BY` at scale. Negligible currently (<100 sends/campaign). Comment at line 357 now accurately reflects this. (Carried since 2026-03-18.)

## External API Calls

| Route | External Service | Cached | Rate Limited | Timeout | Risk |
|-------|-----------------|--------|-------------|---------|------|
| `/u/:handle/badge.svg` | GitHub, Supabase | 6h primary + 7d stale | 100/IP/60s | 15s | LOW |
| `/api/generate` | GitHub | 6h + 7d stale | 10/handle/1h | 15s | LOW |
| `/api/refresh` | GitHub, Supabase | Cache invalidate + fresh | 5/handle/1h | 15s | LOW |
| `/api/auth/callback` | GitHub (3 calls) | No (one-time) | 10/IP/15min | 15s | LOW |
| `/api/auth/bitbucket/*` | Bitbucket | No (one-time) | 5/IP/15min | Implicit | LOW |
| `/api/auth/codeberg/*` | Codeberg | No (one-time) | 5/IP/15min | Implicit | LOW |
| `/api/insights` | Supabase | Cache invalidated | 10/handle/24h | — | LOW |
| `/api/history/:handle` | Supabase | 1h Redis cache | 100/IP/60s | — | LOW |
| `/u/:handle/og-image` | Redis → SVG→PNG | 48h Redis | CDN headers | 10s (resvg) | LOW |
| `/api/cron/warm-cache` | GitHub (50/run) | Refreshes 6h cache | Cron auth | 15s | LOW |
| `/api/cron/sync-audience` | Resend (paginated) | N/A | Cron auth | 30s | MEDIUM |
| `/api/cron/process-campaigns` | Resend (batch) | N/A | Cron auth | — | LOW |
| `/api/admin/campaigns/:id/send` | Resend | No | Admin auth | — | LOW |
| `/api/health` | Redis + Supabase ping | No | 30/IP/60s | 5s | LOW |

### GitHub API Budget

| Scenario | Calls/hr | vs 5,000/hr Limit | Headroom |
|----------|----------|-------------------|----------|
| 1K users (50% cache hit) | ~42 | 0.8% | 99.2% |
| 10K users (50% cache hit) | ~420 | 8.4% | 91.6% |
| 50K users (70% cache hit) | ~630 | 12.6% | 87.4% |
| + Cron (50 handles/day) | +2/hr | negligible | — |

In-flight deduplication reduces concurrent calls by 40–60%.

### Email Budget
- Daily quota: 95 emails/day (Resend Free plan)
- Campaign batch size: 50/call
- Tracked via Redis counter `campaign:daily-sends:{date}` (24h TTL)
- Score bump notifications: ~2–10/day (transactional, reserved buffer)

## Resource Management

### Resource Leaks: 0 CRITICAL

| Area | Status | Notes |
|------|--------|-------|
| Promise management | EXCELLENT | `allSettled()` in badge SVG route (line 104), insights route, background ops |
| Timer cleanup | EXCELLENT | `listAllContacts()` `.finally(() => clearTimeout(timer))` at line 38. Health pings use `Promise.race()` (implicit cleanup, negligible) |
| Database connections | EXCELLENT | Lazy singletons for both Redis and Supabase |
| In-memory buffers | GOOD | In-flight dedup map cleaned via `.finally()`, no unbounded caches |
| Streaming responses | N/A | No streaming — all complete payloads |

**Previously carried items — ALL RESOLVED:**
- Badge SVG `Promise.all()` → now uses `Promise.allSettled()` at `route.ts:104` ✅
- `listAllContacts()` timer → now cleared via `.finally()` at `sync-audience/route.ts:38` ✅
- Campaign admin rate limiting → confirmed present via `adminAuth()` middleware ✅

## Vercel Configuration

### Rendering Strategy

| Type | Routes | Benefit |
|------|--------|---------|
| SSG (build-time) | `/about`, `/about/scoring`, `/verify`, `/about/verification` | Zero function cost |
| ISR 1 day | `/`, `/privacy`, `/terms` | 1 revalidation/day |
| ISR 1 hour | `/u/:handle` (share page) | 24 revalidations/day per unique handle |
| ISR 7 days | `/archetypes/*` (7 pages) | 1 revalidation/week per page |
| Dynamic | `/studio`, `/admin`, `/experiments/*`, all API routes | Per-request invocation |

### Cron Jobs

| Job | Schedule | Max Duration | Operations/Run |
|-----|----------|-------------|----------------|
| `warm-cache` | Daily 6 AM UTC | 300s | 50 GitHub fetches + snapshot writes |
| `sync-audience` | Daily 3:30 AM UTC | 300s | Paginated Resend contact list + sync |
| `process-campaigns` | Daily 8 AM UTC | 300s | 1 batch send (≤50 emails) |

Monthly cron: 90 executions × ~30s avg = **~45 compute-min/mo** vs 2,160 free minutes.

### Estimated Monthly Costs

| Scale | Vercel | Redis (Upstash) | Resend | Supabase | Total |
|-------|--------|----------------|--------|----------|-------|
| 1K users | $20 | $10 | $0 (free) | $0 (free) | **~$30** |
| 10K users | $20 | $20 | $0–20 | $0 (free) | **~$40–60** |
| 50K users | $20 | $25–30 | $20 | $0–25 | **~$65–95** |
| 100K users | $20 | $30–50 | $20 | $25 | **~$95–115** |

Cost growth is **sub-linear** due to CDN caching (6h badge, 7d stale-while-revalidate) and Redis deduplication.

## Recommendations

### Carried (LOW priority)
1. **`dbGetCampaignStats()` JS aggregation** — Refactor to SQL `GROUP BY` when campaigns exceed ~1K sends/campaign. Currently negligible. (`campaigns.ts:350-376`, since 2026-03-18)

### Monitor (no action needed now)
2. **OG image Redis memory** — At 50K+ users, OG images (~30–60 KB × users) could approach Upstash Pro limits. Consider Vercel Blob or R2 as alternative store at that scale.
3. **`sync-audience` contact pagination** — Currently fetches all Resend contacts from page 1 on every run. At 10K+ contacts, consider cursor caching in Redis to enable incremental sync.

### Resolved Since Last Report
- Badge SVG `Promise.allSettled()` ✅
- `listAllContacts()` timer cleanup ✅
- Campaign admin rate limiting (was incorrect finding) ✅
- All 5 items from 2026-03-20 report ✅
