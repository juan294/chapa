# Cost Analyst Report
> Generated: 2026-04-04 | Health status: **green**

## Executive Summary

All previous P1s are resolved (refresh rate limit reverted to 5/hr, supplemental orphan cleanup added). Infrastructure cost model is stable at ~$15–70/month at 10K users with no new risks. Most expensive Vercel route remains `/u/[handle]/badge.svg` (per-request SSR); OG image Redis memory is the primary storage concern (~1.3–1.9 GB at 10K active users).

---

## Redis Usage

### Key Pattern Families (21 total, more complete audit vs prior cycles)

| Pattern | TTL | Notes |
|---------|-----|-------|
| `stats:v2:merged:*` | 6h | Primary merged stats per user |
| `stats:v2:bitbucket:*` | 6h | Bitbucket stats per user |
| `stats:v2:codeberg:*` | 6h | Codeberg stats per user |
| `stats:stale:*` | 7d | Stale fallback (availability protection) |
| `og-image:v1:*` | 48h | **#1 storage consumer** — base64 PNG, ~40–130 KB/key |
| `avatar:*` | 6h | GitHub avatar base64 data URI, ~5–20 KB/key |
| `config:*` | 365d | Studio badge config per user, ~5–10 KB/key |
| `snapshot:latest:*` | 24h | Latest metrics snapshot per user, ~1–2 KB/key |
| `craft:*` | 1h | AI tool proficiency score, <1 KB/key |
| `history:*` | 1h | Score history w/ optional date filters |
| `ff:all` / `ff:key:*` | 1h | Feature flag cache (avoids Supabase hits) |
| `campaign:daily-sends:*` | 24h | Email quota counter per campaign/day |
| `badge:notified:*` | 365d | First-badge notification dedup, <1 KB/key |
| `cli:device:*` | 5m | CLI device auth session, short-lived |
| `engagement:*` | varies | Active engagement campaign cache |
| `supplemental:*` | **none** | EMU data — intentional (data integrity); cleanup added on disconnect ✅ |
| `cron:warm-cache:offset` | **none** | Single rotation key — bounded, intentional |
| `stats:badges_generated` | **none** | INCR counter — memory-bounded (8 bytes) |
| `stats:unique_badges` | **none** | HyperLogLog — memory-bounded (~12 KB fixed) |
| `ratelimit:*` | window-based | ~25 rate limit namespaces, tiny per-key |
| Platform OAuth state | 10–15m | Per-provider CSRF state, transient |

### TTL Coverage

- **Per-user keys**: 100% have TTLs
- **Global singletons without TTL**: 4 keys — all intentional and memory-bounded
  - `supplemental:*` per-handle: no TTL by design (data integrity); disconnect cleanup added 2026-04-03 ✅
  - `cron:warm-cache:offset`: 1 key, single integer
  - `stats:badges_generated`: 1 key, 8 bytes
  - `stats:unique_badges`: 1 key, ~12 KB fixed HyperLogLog

### Redis Storage Estimate at 10K Users

| Key Family | Size/Key | Keys at 10K Users | Total |
|------------|----------|-------------------|-------|
| OG images (`og-image:v1:*`) | ~130 KB | ~4K active keys (2K users/day × 48h) | **~520 MB–1.3 GB** |
| Avatar cache | ~10 KB | ~10K | ~100 MB |
| Stats merged+stale | ~8 KB | ~20K | ~160 MB |
| Config | ~8 KB | ~10K | ~80 MB |
| All others | <2 KB | ~30K | ~60 MB |
| **Total** | | | **~920 MB–1.6 GB** |

Upstash Pro 10 GB — ~84–91% headroom. Well within limits.

### Growth Risk

- **Low**: All per-user keys auto-expire. Supplemental orphan risk eliminated by disconnect cleanup.
- **Monitor**: OG image storage is the dominant driver. CDN `s-maxage=21600` bounds real generation rate.

---

## Database Usage

- **Tables**: 10 application tables + 2 views (`admin_users`, `latest_snapshots`)
- **RLS**: All 9 tables with `FORCE ROW LEVEL SECURITY` + explicit deny policies. 2 views with `security_invoker = true`.

### Query Patterns

| Pattern | Assessment |
|---------|-----------|
| N+1 queries | **None found** — `dbGetLatestSnapshotBatch()` batch-fetches before processing loops |
| Client aggregation | `dbGetCampaignStats()` counts client-side (PostgREST GROUP BY limitation) — low risk at current scale |
| Batched cleanup | All 3 cleanup functions use 1,000-row batches to prevent table locks |
| Feature flags | Cached in Redis (1h TTL) — Supabase only hit on cache miss or invalidation |

### Connection Management

- **Singleton lazy client** — `getSupabase()` in `lib/db/supabase.ts` returns a cached instance
- Single `_client` variable shared across all requests in the process
- Graceful null return if env vars missing (feature degrades, doesn't crash)

---

## External API Calls

| Route | External Service | Cached Before Call | Rate Limited | Risk |
|-------|-----------------|-------------------|-------------|------|
| `POST /api/refresh` | GitHub GraphQL | No (cache explicitly cleared) | 5 req/hr/user ✅ | LOW — user-initiated, rate-limited |
| `POST /api/generate` | GitHub GraphQL | Yes (6h `stats:v2:merged:*`) | No explicit | LOW — cache usually absorbs |
| `GET /api/cron/warm-cache` | GitHub GraphQL | Yes (6h TTL) | 50 handles/run, 5 concurrent | LOW — ~50 calls/day total |
| `lib/github/client.ts` (Bitbucket path) | Bitbucket REST | Yes (6h TTL) | Behind feature flag | LOW |
| `lib/github/client.ts` (Codeberg path) | Codeberg API | Yes (6h TTL) | Behind feature flag | LOW |
| `POST /api/admin/campaigns/[id]/test` | Resend | No (direct admin send) | Admin-gated | LOW — admin only |
| `POST /api/admin/campaigns/[id]/send` | Resend (via batch) | No (new sends) | 95/day quota, Redis-tracked | LOW — quota enforced |
| `POST /api/webhooks/resend` | Resend (forward) | No (event-driven) | HMAC-verified | LOW — inbound only |
| PostHog | PostHog | N/A | N/A | **Client-side only** — no server API calls |

**All GitHub API calls**: cache-first (6h primary, 7d stale fallback), in-flight dedup map prevents thundering herd. Budget: ~50–150 calls/hr at 10K baseline vs GitHub's 5,000/hr authenticated limit.

**All fetches have timeouts**: GitHub 15s (`AbortSignal.timeout`), Resend SDK wrapped with `withTimeout()` (all 5 call sites).

---

## Resource Management

- **Resource leaks**: **0** — no unclosed connections, no unbounded buffers, no missing cleanup
- **Fetch timeout coverage**: **100%** (GitHub + Resend SDK all wrapped)
- **Supabase singleton**: single shared client, no per-request instantiation
- **Redis singleton**: lazy init, `retries: 0` (fail-fast), shared across requests
- **Resend singleton**: `getResend()` lazy init, same pattern
- **Fire-and-forget safety**: All async side effects use `.catch(() => {})` — no unhandled promise rejections
- **DB cleanup**: 3 batched cleanup jobs (snapshots, telemetry, verifications) run in warm-cache cron — prevent unbounded table growth

---

## Vercel Cost Factors

### Runtime

- **All routes: serverless** — no `export const runtime = "edge"` found anywhere
- Edge would save cold-start latency but not cost (Vercel charges per invocation either way)

### Serverless Function Durations

| Route | maxDuration | Cost Driver |
|-------|-------------|-------------|
| `/api/cron/warm-cache` | **300s** | Pro plan required; runs GitHub fetches serially/batched |
| `/api/cron/process-campaigns` | **300s** | Pro plan; Resend batch sends |
| `/api/cron/sync-audience` | **300s** | Pro plan; Supabase + Resend audience sync |
| `/api/admin/bulk-recalculate` | **300s** | Admin-triggered; low frequency |
| All other routes | default (10–30s) | Normal invocation duration |

### Caching & SSR Strategy

| Route | Strategy | Cost Impact |
|-------|----------|-------------|
| `/u/[handle]/badge.svg` | **Dynamic SSR** (per-request) | **Highest** — SVG rendering on every cache miss; CDN `s-maxage=21600` amortizes |
| `/u/[handle]/page.tsx` | **ISR 3600s** | Medium — revalidates hourly, calls `getStats()` |
| `/u/[handle]/og-image` | **Dynamic** | High — PNG render per request; Redis 48h cache prevents repeats |
| `/about/**` | **ISR 86400s** | Very low — once/day max |
| `/archetypes/**` | **ISR 604800s** | Negligible |
| `/` (landing) | **Static** | Negligible |

### SSG Opportunity Assessment

- `/u/[handle]` handles are user-dynamic — ISR 1h is already optimal (no static pre-generation possible)
- `/u/[handle]/badge.svg` cannot be ISR (must respond to live data with rate limit enforcement)
- No missed SSG opportunities for practical routes

### Bundle Size

- Total client JS: **1,663 KB** (stable from 2026-04-02 report)
- No chunk exceeds 500 KB — no oversized Lambda risk
- Largest: 232 KB (Next.js framework), 179 KB (PostHog lazy-loaded), 137 KB (React DOM)

---

## Recommendations

| # | Priority | Item | Action |
|---|----------|------|--------|
| 1 | P2 | `dbGetCampaignStats()` client-side aggregation | At scale (>10K campaign sends), move to Supabase RPC with `GROUP BY` for O(1) vs O(n) counting. Current risk: LOW |
| 2 | P3 | `config:*` keys have 365d TTL with no account-deletion cleanup | Add `cacheDel(configKey)` to any future account deletion flow. Current risk: negligible (bounded by user count, auto-expires in 1 year) |
| 3 | MONITOR | OG image Redis memory | ~1.3–1.9 GB at 10K active users. CDN `s-maxage=21600` bounds real generation. Watch if Redis approaches 7 GB (70% of Pro 10 GB). |
| 4 | MONITOR | `sync-audience` pagination | Currently single-page Supabase query. Add pagination if audience exceeds 1,000 users. |

---

## Status Changes vs Prior Cycles

| Item | Previous Status | Current Status |
|------|----------------|----------------|
| Refresh rate limit 15→5/hr | P1 OPEN | **RESOLVED** (triage 2026-04-03) |
| `supplemental:*` orphan keys | P3 OPEN | **RESOLVED** (triage 2026-04-03) |
| Turbopack NFT warning | LOW | **RESOLVED** (turbopackIgnore added 2026-04-03) |
| `debug-quality` endpoint | P1 (exposure) | **RESOLVED** (deleted) |
| OG image Redis memory | MONITOR | **MONITOR** (carried) |
| `sync-audience` pagination | MONITOR | **MONITOR** (carried) |
