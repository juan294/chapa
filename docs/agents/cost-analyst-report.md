# Cost Analyst Report
> Generated: 2026-04-25 | Health status: green

## Executive Summary

Infrastructure cost posture is unchanged: GREEN at ~$55–70/mo projected for 10K users. No new key patterns, no new external API calls, and no source changes since the 2026-04-22 cycle (only docs/* files modified). All carried items remain as-is. One line-number correction: `dbGetCampaignStats()` now at `lib/db/campaigns.ts:727` (file grew; previously cited as :439).

## Redis Usage

### Key Patterns (24 confirmed)

| Pattern | TTL | Per-user? | Notes |
|---------|-----|-----------|-------|
| `stats:v2:merged:*` | 21,600s (6h) | Yes | Primary GitHub stats cache |
| `stats:stale:*` | 604,800s (7d) | Yes | Stale fallback — served on API failure |
| `stats:badges_generated` | **0** (persistent) | No | INCR counter, bounded integer |
| `stats:unique_badges` | **0** (persistent) | No | HyperLogLog ~12 KB, bounded |
| `svg:*` | 86,400s (24h) | Yes | SVG badge output per handle+theme |
| `snapshot:*` | 86,400s (24h) | Yes | Latest materialized snapshot |
| `avatar:*` | 21,600s (6h) | Yes | Base64-encoded avatar PNG ~30 KB each |
| `craft:v*:*` | 3,600s (1h) | Yes | Craft score cache per version+handle |
| `history:*` | 3,600s (1h) | Yes | History list; range variants share TTL |
| `og:*` | 172,800s (48h) | Yes | OG image base64 PNG ~150 KB each |
| `supplemental:*` | 86,400s (24h) | Yes | EMU supplemental stats |
| `config:*` | 31,536,000s (1yr) | Yes | Studio badge config ~500 B — intentional persistence |
| `badge:notified:*` | 31,536,000s (1yr) | Yes | First-badge email dedup boolean — intentional |
| `score-bump:*` | 604,800s (7d) | Yes | Score-bump email dedup boolean |
| `sideeffects:done:*:YYYY-MM-DD` | 86,400s (24h) | Yes/daily | Per-user SETNX once-per-day guard |
| `bitbucket:stats:*` | 21,600s (6h) | Yes | Bitbucket stats cache |
| `codeberg:stats:*` | 21,600s (6h) | Yes | Codeberg stats cache |
| `ratelimit:*` | 60–3,600s | Yes/IP | Many sub-patterns, all bounded |
| `cron:warm-cache:offset` | **0** (persistent) | No | Rotation int, bounded single key |
| `campaign:active-engagement` | 3,600s (1h) | No | Single engagement campaign snapshot |
| `campaign:daily-sends` | Daily reset | No | Daily send quota counter |
| `sync-audience:contacts` | 3,600s (1h) | No | Resend contacts list |
| `feature-flags:*` | 3,600s (1h) | No | Feature flags, bounded by flag count |
| `cli:*` | 300s (5min) | Yes (ephemeral) | CLI device auth token — short-lived |

**TTL coverage:** 100% — all per-user keys have TTLs. The 3 persistent keys (`cron:warm-cache:offset`, `stats:badges_generated`, `stats:unique_badges`) are intentional, each bounded to a single key regardless of user count.

**Year-long TTL keys:** `config:*` and `badge:notified:*` — both intentional, bounded to one key per user. At 10K users: ~5 MB (config) + ~10 KB (booleans) = negligible.

**Growth risk:** LOW

### Storage Estimates (@10K users)

| Category | Estimate | Monitor |
|----------|----------|---------|
| Stats (primary + stale) | ~100 MB | No |
| SVG badges | ~100–200 MB | No |
| Avatars | ~300 MB | M1 |
| OG images | ~150 MB (1K active/day) | M2 |
| HyperLogLog | ~12 KB | M3 |
| All other keys | ~50 MB | No |
| **Total** | **~700–800 MB** | ~91% headroom on 10 GB free tier |

## Database Usage

- **Tables:** 9 — users, metrics_snapshots, verification_records, feature_flags, merge_operations, user_platforms, tool_insights, email_campaigns, campaign_sends
- **Views:** 2 — `latest_snapshots` (security_invoker=true), `admin_users` (security_invoker=true)
- **RLS:** Enabled + FORCE on all 9 tables; explicit deny-all for anon
- **Client:** Singleton lazy-init at `lib/db/supabase.ts:13` — one connection per serverless instance
- **Query patterns:** 0 N+1 patterns found. `dbGetLatestSnapshotBatch()` handles batch pre-fetch in warm-cache cron. `dbGetUsersWithEmail()` uses partial index.
- **Snapshot retention:** `SNAPSHOT_RETENTION_DAYS = 365`; `warm-cache` cron runs `dbCleanOldSnapshots()` (1,000 rows/batch) — table growth is bounded at ~3.65M rows @10K users, not unbounded.

**P2-1 CARRIED:** `dbGetCampaignStats()` at `lib/db/campaigns.ts:727` issues 4 separate `COUNT` queries per call (one per status: sent, pending, processing, failed). Acceptable at current campaign volume; move to a single `SELECT status, COUNT(*)... GROUP BY status` Postgres RPC when a campaign exceeds ~5K sends.

## External API Calls

| Route | External Service | Cached | Rate Limited | Risk |
|-------|-----------------|--------|-------------|------|
| `GET /u/:handle/badge.svg` | GitHub (via `getStats`) | Yes — 6h primary, 7d stale | No (CDN + in-flight dedup) | LOW |
| `POST /api/generate` | GitHub | Yes — same cache | 10/hr per handle | LOW |
| `POST /api/refresh` | GitHub | Cache cleared intentionally | 5/hr per handle | LOW |
| `GET /api/cron/warm-cache` | GitHub (batch, 50 handles) | Yes — fills cache | Cron-only, 300s maxDuration | LOW |
| `GET /api/health` | GitHub (`/rate_limit`) | **No** (intentional probe) | 30/min per IP | LOW — intentional, 3s timeout |
| `GET /api/history/:handle` | Supabase only | Redis 1h | 60/min per IP | LOW |
| `GET /api/profile/:handle` | Supabase only | No (DB read) | 60/min per IP | LOW |
| `POST /api/supplemental` | None (Redis write) | N/A | N/A | LOW |
| `GET /api/cron/sync-audience` | Resend contacts API | Yes — 1h Redis | Cron-only | LOW |
| `GET /api/cron/process-campaigns` | Resend send API | Daily quota (95/day) | Cron-only | LOW |
| Analytics events | PostHog | N/A | 5s timeout | LOW |

**All external calls have explicit timeouts** via `AbortSignal.timeout()` or `withTimeout()`. GitHub client uses 30s in-flight dedup to prevent stampeding.

## Resource Management

**Timer leaks:** None. `withTimeout()` cleans up in `finally`. `pingRedis()` wraps with `withTimeout(5000)` (`redis.ts:310`). Bitbucket and Codeberg query paths use `AbortSignal.timeout()` directly.

**In-memory unbounded buffers:** None.
- `_inflight` Map in `lib/github/client.ts:32` — bounded by 30s timeout + explicit `finally` clear
- `flagCache` Map in `lib/feature-flags.ts:66` — bounded by fixed flag set (~5–10 entries, 5min TTL)

**Unclosed connections:** None. Supabase uses HTTP (no persistent socket). Redis client is HTTP/REST (Upstash). Both are singletons that degrade gracefully on missing credentials.

**Fire-and-forget calls:** All use `fireAndForget()` wrapper which catches errors. Avatar pre-warming, snapshot recording, and SVG cache writes are all safely non-blocking.

## Vercel / ISR

| Route | Revalidation | Notes |
|-------|-------------|-------|
| `/` | 3,600s (1h) | Landing page |
| `/u/[handle]` | 3,600s (1h) | Share page |
| `/about`, `/about/*` | 86,400s (24h) | |
| `/archetypes/*` | 604,800s (7d) | Archetype guides, very static |
| `/privacy`, `/terms` | 86,400s (24h) | |
| `/studio` | `force-dynamic` | Auth-gated, intentional |
| `/experiments/*` | `force-dynamic` | Feature-flagged, intentional |

Badge SVG response headers: `public, s-maxage=21600, stale-while-revalidate=86400` — 6h CDN cache, 7d stale. Reduces serverless invocations for the most-fetched route.

**Cron handlers:** 4, all at `maxDuration=300s` — `warm-cache` (daily), `sync-audience` (daily), `process-campaigns` (daily), `bulk-recalculate` (admin on-demand).

## Recommendations

### P2 — Scale trigger (no action now)

**P2-1 CARRIED:** `dbGetCampaignStats()` at `lib/db/campaigns.ts:727` — 4 COUNT queries per campaign detail view. Migrate to a single `GROUP BY status` Postgres RPC when any campaign exceeds ~5K sends. At current scale (early launch), no action needed.

### Monitors (ongoing)

| ID | Metric | Current Estimate | Action Threshold |
|----|--------|-----------------|-----------------|
| M1 | Avatar cache Redis memory | ~300 MB @10K users | >80% plan limit |
| M2 | OG image cache Redis memory | ~150 MB @1K active/day | >80% plan limit |
| M3 | HyperLogLog (`stats:unique_badges`) | ~12 KB | Quarterly review only |
| M4 | `metrics_snapshots` table rows | ~3.65M rows/yr @10K users | Cron cleanup bounded at 365d — no action needed |

M4 is now actively managed: `warm-cache` cron runs `dbCleanOldSnapshots()` (1,000 rows/batch, 365-day retention) on every run. Table size is bounded, not unbounded.

### No action required

All P1s remain resolved. All P3s from prior cycles resolved. Cost profile stable at ~$55–70/mo for 10K users.
