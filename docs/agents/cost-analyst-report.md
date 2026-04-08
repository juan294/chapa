# Cost Analyst Report
> Generated: 2026-04-08 | Health status: green

## Executive Summary

All infrastructure usage patterns remain efficient and cost-controlled. P2-2 (`dbRecomputeCraft()` untested) is confirmed **RESOLVED** by the coverage agent (97.6% coverage as of 2026-04-08). P2-3 (warm-cache timeout risk) is **RESOLVED** — batching at 5 concurrent handles keeps runtime to ~50–100s, well within the 300s Vercel Pro limit. No new P1s or P2s identified.

---

## Redis Usage

### Key Patterns and TTL Coverage

| Key Pattern | TTL | File | Notes |
|---|---|---|---|
| `stats:v2:merged:<handle>` | 6h (21600s) | `lib/github/client.ts:17` | Primary stats cache |
| `stats:stale:<handle>` | 7d (604800s) | `lib/github/client.ts:18` | Fallback stale data |
| `stats:v2:bitbucket:<handle>` | 6h | `lib/github/client.ts:243` | Bitbucket stats cache |
| `stats:v2:codeberg:<handle>` | 6h | `lib/github/client.ts` | Codeberg stats cache |
| `supplemental:<handle>` | 6h (via cacheSet default) | `lib/github/client.ts:136` | EMU supplemental data |
| `craft:<handle>` | 1h (3600s) | `lib/cache/craft-cache.ts:17` | Tool insights craft score |
| `snapshot:latest:<handle>` | 24h (86400s) | `lib/cache/snapshot-cache.ts:16` | Latest metrics snapshot |
| `og-image:<handle>:<theme>` | 24h (estimated) | `lib/render/` | OG image SVG cache |
| `svg:<handle>:<config-hash>` | 6h | `app/u/[handle]/badge.svg/` | Badge SVG cache |
| `history:<handle>` | 1h (estimated) | `lib/history/` | Score history cache |
| `campaign:active-engagement` | 1h (3600s) | `lib/db/campaigns.ts:256` | Active engagement banner |
| `campaign:daily-sends:<date>` | 24h (86400s) | `lib/email/campaigns.ts:43,80` | Daily email quota counter |
| `ratelimit:<prefix>:<id>` | varies (60–3600s) | `lib/cache/redis.ts:178–181` | All rate limit windows |
| `cron:warm-cache:offset` | 0 (persistent) | `app/api/cron/warm-cache/route.ts:105` | **INTENTIONAL** — round-robin cursor |
| `stats:badges_generated` | None (persistent) | `lib/cache/redis.ts:210` | **INTENTIONAL** — HLL counter |
| `stats:unique_badges` | None (persistent) | `lib/cache/redis.ts:211` | **INTENTIONAL** — HyperLogLog |

- **TTL coverage**: 100% on per-user/per-request keys. 2 intentional no-TTL singletons (badge stats counter + HyperLogLog, both memory-bounded). 1 intentional TTL=0 cron cursor.
- **Growth risk**: LOW. No unbounded patterns. OG images remain #1 consumer (~1.3 GB at 10K users, 81% of total ~1.52 GB). Upstash Pro 10 GB — **85% headroom**.
- **Warm-cache P2-3 RESOLVED**: `BATCH_SIZE=5` concurrent handles × ~10s avg = 10 batches × 10s = ~100s max, well within Vercel Pro 300s `maxDuration`.

---

## Database Usage

- **Tables**: 10 tables + 2 views (unchanged)
- **Connection management**: Lazy singleton (`lib/db/supabase.ts:12–31`) — one `SupabaseClient` per process, lazily initialized, `persistSession: false`. Same pattern for Redis (`lib/cache/redis.ts:18–36`).
- **Query patterns**: 0 N+1 patterns detected. Warm-cache cron pre-fetches all snapshots in one batch query before the loop (`dbGetLatestSnapshotBatch()`), mapping to `Map<string, unknown>` for O(1) per-handle lookup.
- **`dbRecomputeCraft()`** (`lib/db/tool-insights.ts:149–180`): 1 SELECT + 1 UPSERT per call. Bounded to user-initiated refresh/recalculate only. Now **fully tested** (97.6% coverage per coverage agent 2026-04-08).
- **`dbGetCampaignStats()`** (`lib/db/campaigns.ts:425–463`): Client-side aggregation via single `SELECT status WHERE campaign_id=?` + O(n) JS loop. PostgREST lacks GROUP BY. Acceptable at <1K sends/campaign — **P2-1 CARRIED** (migrate to RPC at >5K).

---

## External API Calls

| Route | External Service | Cached | Rate Limited | Risk |
|---|---|---|---|---|
| `POST /api/refresh` | GitHub GraphQL | YES — cache-first, 6h TTL | YES — 5/hr per handle | LOW |
| `POST /api/generate` | GitHub GraphQL | YES — `getStats()` cache-first | YES — 10/hr per handle | LOW |
| `GET /api/cron/warm-cache` | GitHub GraphQL (50 handles/run) | YES — skips cached handles | N/A (cron) | LOW |
| `GET /api/cron/process-campaigns` | Resend API | N/A (send operations) | YES — 95/day quota | LOW |
| `GET /api/cron/sync-audience` | Resend API (paginated) | N/A (sync operation) | N/A (cron) | LOW |
| `GET /api/auth/callback` | GitHub OAuth (token exchange) | NO (OAuth flow) | YES — 10/15min per IP | LOW |
| `GET /api/auth/bitbucket/callback` | Bitbucket OAuth | NO (OAuth flow) | YES — 10/15min per IP | LOW |
| `GET /api/auth/codeberg/callback` | Codeberg OAuth | NO (OAuth flow) | YES — 10/15min per IP | LOW |
| `GET /u/[handle]/og-image` | (SVG→PNG render, no external) | YES — `s-maxage=21600` CDN | NO | LOW |

**GitHub API headroom**: ~50–150 calls/hr baseline vs 5,000/hr authenticated limit. Cache deduplication via in-flight request map prevents duplicate concurrent fetches.

---

## Resource Management

- **Fetch timeouts**: 100% coverage — all external calls use `AbortSignal.timeout()`. Previously flagged GitHub/Codeberg OAuth calls now confirmed covered (per security scanner 2026-04-06).
- **Resource leaks**: 0 detected. In-flight GitHub request map cleaned via `.finally()` (`lib/github/client.ts:60–62`). All Resend SDK calls wrapped in `withTimeout()` with `EMAIL_SEND_TIMEOUT_MS=10_000`.
- **Bitbucket AbortController**: `setTimeout` not `clearTimeout()`d on success path — hygiene only, no functional leak. LOW/P3.
- **No unbounded in-memory buffers** detected. Redis and Supabase are singletons; no per-request connection allocations.

---

## Vercel Cost Factors

### Serverless Function maxDuration
| Route | maxDuration | Notes |
|---|---|---|
| `/api/cron/warm-cache` | 300s | Safe — BATCH_SIZE=5, ~100s actual |
| `/api/cron/process-campaigns` | 300s | Campaign batch sender |
| `/api/cron/sync-audience` | 300s | Resend contact sync |
| `/api/admin/bulk-recalculate` | 300s | Admin-only |

All other routes use the default (10s Hobby / configurable on Pro).

### Runtime
- **All routes**: Serverless (Node.js). No Edge runtime declarations. Correct for this use case — SVG rendering and Redis calls are not Edge-compatible.

### ISR Revalidate
| Page | Revalidate | Notes |
|---|---|---|
| `/` (home) | 3600s (1h) | Good — content changes infrequently |
| `/u/[handle]` | 3600s (1h) | Good — ISR + badge CDN cache |
| `/about/*` | 86400s (24h) | Optimal |
| `/archetypes/*` | 604800s (7d) | Optimal — static content |
| `/terms`, `/privacy` | 86400s (24h) | Optimal |

### Cache-Control Headers
- Badge SVG: `public, s-maxage=21600, stale-while-revalidate=86400` ✓
- OG Image: `public, s-maxage=21600, stale-while-revalidate=86400` ✓
- Profile API: `public, s-maxage=300, stale-while-revalidate=3600` ✓
- History API: `public, s-maxage=3600, stale-while-revalidate=86400` ✓
- Feature flags: `public, s-maxage=60, stale-while-revalidate=300` ✓

All headers correctly minimize serverless invocations via CDN caching.

---

## Recommendations

### Open Items

| Priority | Item | Status | Action |
|---|---|---|---|
| P2-1 | `dbGetCampaignStats()` client-side aggregation | CARRIED | Migrate to Supabase RPC when campaign sends exceed 5K |
| MONITOR | OG image Redis memory (~1.3 GB @10K users) | CARRIED | CDN `s-maxage=21600` bounds generation rate; watch quarterly |
| MONITOR | `sync-audience` Resend pagination | CARRIED | Only relevant at >10K subscribers |
| MONITOR | HyperLogLog (`stats:unique_badges`) | CARRIED | ~12 KB; track quarterly |

### Resolved Since Last Report

| Item | Resolution |
|---|---|
| P2-2: `dbRecomputeCraft()` untested | **RESOLVED** — 97.6% coverage per coverage agent 2026-04-08 |
| P2-3: Warm-cache timeout risk (50 handles × ~10s = 500s) | **RESOLVED** — `BATCH_SIZE=5` confirmed; actual runtime ~100s vs 300s limit |
| Fetch timeouts on GitHub/Codeberg OAuth | **RESOLVED** — 100% AbortSignal coverage per security scanner 2026-04-06 |

### Estimated Monthly Cost at 10K Users

~**$60–70/mo** (unchanged). Breakdown:
- Upstash Redis: ~$20–30 (1.52 GB storage, ~50K req/day)
- Supabase: ~$0–10 (free tier likely sufficient at 10K users)
- Vercel: ~$20 (Pro plan baseline)
- Resend: ~$10 (email sends)

No new cost vectors introduced since last cycle.
