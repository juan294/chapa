# Cost Analyst Report
> Generated: 2026-03-02 | Health status: GREEN

## Executive Summary

Chapa's infrastructure is well-optimized for cost. Multi-layer caching (Redis 6h + stale 7d + CDN 6h) prevents redundant GitHub API calls. All external service failures degrade gracefully. The primary cost growth driver is **avatar caching in Redis** (~50 KB per user), which dominates storage at scale. No resource leaks, no N+1 queries, and no unbounded growth patterns were found outside of intentional permanent storage (lifetime snapshots in Supabase, badge counters in Redis).

---

## Redis Usage

### Key Patterns & TTLs

| Key Pattern | TTL | Avg Size | Growth Model |
|---|---|---|---|
| `stats:v2:merged:<handle>` | 6h (21,600s) | 20 KB | 1 per active user |
| `stats:stale:<handle>` | 7d (604,800s) | 20 KB | 1 per user ever fetched |
| `stats:v2:bitbucket:<handle>` | 6h | 15 KB | 1 per linked Bitbucket user |
| `stats:v2:codeberg:<handle>` | 6h | 15 KB | 1 per linked Codeberg user |
| `avatar:<handle>` | 6h | 50 KB | 1 per user with avatar |
| `snapshot:latest:<handle>` | 24h (86,400s) | 1 KB | 1 per active user |
| `supplemental:<handle>` | 24h | 15 KB | 1 per EMU merge |
| `config:<handle>` | 365d | 2 KB | 1 per Studio user |
| `og-image:v1:<handle>:<date>` | 24h | ~50 KB | 1 per user per day |
| `score-bump:<handle>` | 7d | 1 B | 1 per score-bump email |
| `badge:notified:<handle>` | 365d | 1 B | 1 per user (one-time) |
| `cli:device:<sessionId>` | ~15min | 100 B | Transient, auto-expires |
| `ratelimit:*` | 60s–86,400s | 50 B | 1 per IP or handle per window |
| `stats:badges_generated` | Permanent | 8 B | Single counter |
| `stats:unique_badges` | Permanent | 12 KB | HyperLogLog (fixed) |
| `cron:warm-cache:offset` | Permanent | 8 B | Single key |

### TTL Coverage

- **100% of transient keys** have TTLs (rate limits, stats, avatars, snapshots)
- **3 permanent keys** by design: badge counter, HyperLogLog unique count, cron offset — all fixed-size (~12 KB total)
- **2 long-lived markers**: `badge:notified:*` (365d) and `config:*` (365d) — grow linearly with users but tiny size

### Growth Risk Assessment

**Current risk: LOW** (at current user count)

| Scenario | Users | Est. Redis Memory | Upstash Free Tier (256 MB) |
|---|---|---|---|
| Current | ~50 | ~5 MB | Well within |
| 1,000 users | 1,000 | ~86 MB | Within limits |
| 5,000 users | 5,000 | ~430 MB | **Exceeds free tier** |
| 10,000 users | 10,000 | ~860 MB | Requires paid plan |

**Primary growth driver**: Avatar cache (`avatar:<handle>`) at ~50 KB each = 47% of per-user storage. The stats duplication (primary 6h + stale 7d) accounts for another 38%.

### Rate Limit Key Proliferation

27 rate-limited endpoints create keys by IP or handle. Window-based expiry (60s–86,400s) prevents accumulation. Worst case with 10,000 unique IPs: ~750 KB of rate limit keys at any time — negligible.

---

## Database Usage (Supabase)

### Tables

| Table | Rows (est.) | Key Indexes | RLS |
|---|---|---|---|
| `users` | ~50 | `idx_users_registered_at` | Enabled (deny-default) |
| `metrics_snapshots` | ~500+ | `idx_snapshots_handle_date` (handle, date DESC) | Enabled |
| `verification_records` | ~100 | `idx_verification_handle`, `idx_verification_expires` | Enabled |
| `feature_flags` | ~10 | Implicit on `key` | Enabled |
| `merge_operations` | ~5 | None documented | Enabled |
| `user_platforms` | ~10 | Implicit on user+platform | Enabled |

**Views**: `latest_snapshots`, `admin_users` (users LEFT JOIN latest_snapshots) — both use `SECURITY INVOKER` (migration 014).

### Query Patterns: EFFICIENT

- **No N+1 queries detected.** All batch operations use proper patterns:
  - `dbGetLatestSnapshotBatch()` — single `.in("handle", handles)` for cron warming (replaces 50 individual queries)
  - `admin_users` view — pre-joined in DB, single query for admin dashboard
  - Badge route uses `Promise.all()` for parallel I/O (snapshot + avatar)
- **Feature flag queries**: No caching layer — each `isStudioEnabled()` call hits Supabase. Low-frequency (server-side only, ~1 per page load), but could benefit from 5-minute in-memory cache at scale.

### Connection Management: SINGLETON

- **Pattern**: Lazy singleton via `getSupabase()` (`lib/db/supabase.ts:12`)
- **Session**: `persistSession: false` (service role, no user sessions)
- **Protocol**: HTTP REST (Supabase JS SDK), not native Postgres — Supabase handles pooling server-side
- **Test support**: `_resetClient()` for isolation

### Maintenance

- **Verification cleanup**: Cron deletes up to 1,000 expired records per daily run (`dbCleanExpiredVerifications()`)
- **Snapshot dedup**: UNIQUE(handle, date) constraint prevents duplicate daily entries
- **14 migrations** (001–014), clean evolution

---

## External API Calls

| Route | External Service | Cached | Rate Limited | Risk |
|---|---|---|---|---|
| `/u/:handle/badge.svg` | GitHub GraphQL (1 call) | Redis 6h + stale 7d + CDN 6h | 100/IP/60s (fail-open) | LOW |
| `/api/refresh` | GitHub GraphQL (1 call) | Cache invalidated, then re-fetched | 5/handle/1h | LOW |
| `/api/cron/warm-cache` | GitHub (up to 50 calls) | Redis 6h per handle | CRON_SECRET auth | LOW — batched (5 concurrent) |
| `/api/auth/callback` | GitHub OAuth (2–3 calls) | No (session-based) | 10/IP/15min | LOW |
| `/api/generate` | GitHub GraphQL (1 call) | Cache-first | 10/handle/1h | LOW |
| `/u/:handle/badge.svg` (after) | Resend (0–1 email) | 365d dedup | Feature-flagged | NEGLIGIBLE |
| `/api/cron/warm-cache` (after) | Resend (0–N emails) | 7d dedup per handle | Feature-flagged | LOW |
| `/api/webhooks/resend` | Resend (1 fetch + 1 send) | No | 20/IP/60s | LOW — webhook only |
| Client-side | PostHog | N/A (client SDK) | Lazy-loaded | NONE |

### GitHub API Budget

- **Authenticated**: 5,000 requests/hour (OAuth token)
- **Cron consumption**: 50 handles/day = 50 requests (1% of hourly budget)
- **Badge requests**: Cached 6h, so ~4 GitHub calls/user/day max
- **Deduplication**: In-flight Map prevents concurrent duplicate calls (`client.ts:22`)
- **Headroom**: At 1,000 users with 6h cache, worst case = 4,000 calls/day = ~167/hour — well within limits

### Cascading Call Prevention

All post-response work uses `after()` with `Promise.allSettled()` — failures in email, snapshot recording, or verification don't cascade. Badge SVG is returned before any async work completes.

---

## Resource Management

### Status: EXCELLENT — No leaks detected

| Category | Finding | Risk |
|---|---|---|
| **Connections** | All clients (Redis, Supabase, Resend) use lazy singletons | NONE |
| **In-flight Map** | `_inflight` Map cleaned in `promise.finally()` (client.ts:60–62) | NONE |
| **Fetch timeouts** | GitHub: 15s abort signal; Codeberg: AbortController with cleanup | NONE |
| **Buffer allocation** | Avatar base64 (~50 KB) and SVG string (~50 KB) — GC'd per request | NONE |
| **PNG rendering** | resvg creates ~2.25 MB peak per OG image — brief, rare (1x/user/day) | LOW |
| **Error isolation** | All fire-and-forget ops wrapped in try/catch or Promise.allSettled | NONE |

---

## Vercel Cost Factors

### Serverless Functions

- **Runtime**: All Node.js (no Edge functions) — appropriate for resvg native binary
- **resvg/resvg-js**: Marked as `serverExternalPackages` in next.config.ts — not bundled, loaded from Vercel's runtime
- **Cold start**: ~500–1,500ms (standard for Node.js, includes lazy client init)

### Cron Jobs

| Cron | Schedule | Max Duration | Cost |
|---|---|---|---|
| `/api/cron/warm-cache` | Daily 6:00 AM UTC | 300s | ~$0.50–$2/month |

### ISR/SSG

- **4 static pages** revalidate every 1h: `/`, `/about`, `/about/scoring`, `/about/verification`
- **Dynamic pages** (badge, share, studio, admin): server-rendered per request — correct for personalized content
- **ISR cost**: ~16 rebuilds/day — negligible on Vercel

### Bundle Analysis

Available via `ANALYZE=true pnpm run build`. Key dependencies:
- `next` 16.x (~2.5 MB) — core
- `@supabase/supabase-js` (~800 KB) — all data routes
- `posthog-js` (~150 KB) — client-side only
- `@resvg/resvg-js` (~15 MB native) — external, only OG image route

### Function Size Risk: LOW

No oversized routes detected. resvg is external. Badge route imports are lean (Redis + Supabase + render utils). OG image route is the heaviest but called infrequently (~1x/user/day, cached).

---

## Recommendations

### Priority 1 — Monitor (No action needed yet)

1. **Track Redis memory usage** via Upstash dashboard. At ~50 users, memory is ~5 MB. Set alert at 200 MB (approaching free tier limit).
2. **Monitor GitHub API rate limit headroom** — add a metric to the health endpoint showing remaining API calls per hour.

### Priority 2 — Optimize at scale (1,000+ users)

3. **Avatar cache optimization**: Consider serving avatars via CDN URL with `Cache-Control` headers instead of storing base64 in Redis. Saves ~50 KB per user = 50 MB at 1,000 users.
4. **Eliminate stats duplication**: The `stats:stale:<handle>` key duplicates primary stats for 7 days. Consider using Redis's native `stale-while-revalidate` behavior (serve expired key while refreshing) instead of a separate stale key. Saves ~20 KB per user.
5. **Feature flag caching**: Add 5-minute in-memory TTL to `isStudioEnabled()` and similar calls to reduce Supabase queries under load.

### Priority 3 — Low-impact optimizations

6. **Lazy-import resvg**: Dynamic `import()` in `svg-to-png.ts` would reduce cold start for all routes except OG image by ~100–200ms.
7. **CLAUDE.md documentation update**: CLAUDE.md mentions "MetricsSnapshot records stored in Redis sorted sets (`history:<handle>`) with no TTL" — this is outdated. Snapshots are stored in Supabase. Update to reflect actual implementation.

### Not Recommended (over-engineering)

- Edge runtime for badge route — resvg requires Node.js, and CDN caching already handles latency
- Connection pooling — Supabase SDK uses HTTP REST; server-side pooling is handled by Supabase
- Rate limit CIDR aggregation — current IP-based limits are fine at expected scale

---

## Cost Projection

| Scale | Redis (Upstash) | Supabase | Vercel | GitHub API | Total |
|---|---|---|---|---|---|
| 50 users | Free | Free | Free/Hobby | Free | **$0/mo** |
| 500 users | Free (~43 MB) | Free | Hobby | Free | **$0/mo** |
| 1,000 users | Free (~86 MB) | Free | Pro ($20) | Free | **~$20/mo** |
| 5,000 users | Pay-as-you-go (~430 MB) | Pro ($25) | Pro ($20) | Free | **~$55–75/mo** |
| 10,000 users | Pay-as-you-go (~860 MB) | Pro ($25) | Pro ($20) | Free | **~$75–120/mo** |

*Costs assume current caching strategy. Avatar optimization (#3 above) would reduce Redis costs by ~47%.*
