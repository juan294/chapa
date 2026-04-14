# Cost Analyst Report
> Generated: 2026-04-14 | Health status: GREEN

## Executive Summary

Infrastructure costs remain stable at **~$60–70/mo at 10K users**. No production code changes since 2026-04-12 (only agent report updates). All Redis keys have TTLs, all external calls are cached and timeout-protected, and no resource leaks were found. One minor timer cleanup issue persists in the OG image route (P3, cosmetic).

## Redis Usage

### Key Pattern Inventory

| Key Pattern | TTL | ~Value Size | Purpose |
|---|---|---|---|
| `stats:v2:merged:{handle}` | 6h (21,600s) | 3–5 KB | Primary GitHub stats cache |
| `stats:stale:{handle}` | 7d (604,800s) | 3–5 KB | Stale fallback for API failures |
| `stats:v2:bitbucket:{handle}` | 6h | 3–5 KB | Bitbucket platform stats |
| `stats:v2:codeberg:{handle}` | 6h | 3–5 KB | Codeberg platform stats |
| `supplemental:{handle}` | 24h (86,400s) | 3–5 KB | EMU/enterprise supplemental data |
| `snapshot:latest:{handle}` | 24h | 1–2 KB | Latest metrics snapshot |
| `craft:{handle}` | 1h (3,600s) | 0.5–1 KB | Craft/tool insights score |
| `avatar:{handle}` | 6h | 20–50 KB | Avatar base64 data URI |
| `og-image:v1:{handle}:{date}` | 48h (172,800s) | 50–200 KB | OG PNG badge (base64) |
| `score-bump:{handle}` | 7d | 1 byte | Score bump email dedup |
| `ff:all` | 1h | 1–5 KB | All feature flags |
| `ff:key:{key}` | 1h | 0.1–0.5 KB | Individual feature flag |
| `campaign:daily-sends:{date}` | 24h | integer | Daily email send counter |
| `campaign:active-engagement` | 1h | 0.5 KB | Active engagement campaign |
| `ratelimit:*:{identifier}` | 60s | integer | Rate limit counters (67 routes) |
| `stats:badges_generated` | **None** | integer | Total badge counter (single key) |
| `stats:unique_badges` | **None** | ~12 KB | HyperLogLog unique devs (fixed size) |
| `cron:warm-cache:offset` | **None** | integer | Cron rotation offset (single key) |

### TTL Coverage

- **Per-user keys**: 100% have TTLs (1h–7d)
- **Global keys**: 3 persistent keys — all intentional and bounded:
  - `stats:badges_generated` — monotonic counter, single key
  - `stats:unique_badges` — HyperLogLog, fixed ~12 KB regardless of cardinality
  - `cron:warm-cache:offset` — single integer

### Storage Estimate @ 10K Users

| Category | Per-User Size | @10K Users |
|---|---|---|
| Stats (primary + stale + platforms) | ~20 KB | 200 MB |
| Avatars | ~30 KB | 300 MB |
| OG images | ~150 KB | (date-keyed, ~1K active/day) 150 MB |
| Snapshots + craft + score-bump | ~5 KB | 50 MB |
| Feature flags + counters + rate limits | — | <1 MB |
| **Total estimate** | | **~700–800 MB** |
| **Upstash 10 GB plan headroom** | | **~91%** |

### Growth Risk: LOW

No unbounded patterns. All per-user keys auto-expire. Avatar and OG image caches are the largest consumers but bounded by TTL + active user count.

## Database Usage

### Tables & Views

| Type | Count | Names |
|---|---|---|
| Tables | 9 | users, metrics_snapshots, verification_records, feature_flags, merge_operations, user_platforms, tool_insights, email_campaigns, campaign_sends |
| Views | 2 | latest_snapshots (DISTINCT ON), admin_users (LEFT JOIN) |

### Query Patterns: EFFICIENT

- **Client**: Lazy singleton (module-level `_client`), created once per process. `apps/web/lib/db/supabase.ts:10-28`
- **N+1 prevention**: Batch snapshot prefetch in warm-cache cron via `dbGetLatestSnapshotBatch()`. `apps/web/lib/db/snapshots.ts:316-359`
- **Batched deletes**: All cleanup operations use `BATCH_SIZE=1000` with `.limit()` to prevent table locks
- **Explicit columns**: Most queries select specific columns. `SELECT *` used only in `campaigns.ts:100,128` (16 columns — acceptable)
- **Unbounded queries**: 4 queries without explicit LIMIT — all bounded by filters (single campaign, email-enabled users, all flags, date range). No risk of runaway result sets.
- **No direct Supabase imports outside `lib/db/`** — perfect layering
- **11 indexes** covering all frequently-queried WHERE clauses

### Connection Management: Singleton (correct for serverless)

No connection pooling needed — Supabase JS SDK uses REST (HTTP), not persistent TCP connections.

## External API Calls

| Route | External Service | Cached | Rate Limited | Timeout | Risk |
|-------|-----------------|--------|-------------|---------|------|
| `POST /api/refresh` | GitHub API | 6h cache-first + 7d stale | 5/hr per handle | 15s AbortSignal | MEDIUM |
| `POST /api/recalculate` | GitHub API | 6h cache-first | 20/hr per handle | 15s AbortSignal | MEDIUM |
| `POST /api/generate` | GitHub API | 6h cache-first | 10/hr per handle | 15s AbortSignal | LOW |
| `GET /api/cron/warm-cache` | GitHub API | Batch prefetch, rotation | Cron-protected | 15s AbortSignal | LOW |
| `GET /api/cron/sync-audience` | Resend API | Set-based dedup | Cron-protected | 30s timeout | MEDIUM |
| `GET /api/cron/process-campaigns` | Resend API | Daily quota (95/day) | Cron-protected | 10s timeout | MEDIUM |
| `POST /api/admin/bulk-recalculate` | GitHub API | Batch, cache invalidate | 5/hr per IP | 15s AbortSignal | HIGH |
| `POST /api/admin/campaigns/:id/send` | Resend API | DB state machine + quota | Admin-protected | 10s timeout | HIGH |
| `GET /api/auth/callback` | GitHub API (OAuth) | State validation | 10/15min per IP | 5s PostHog | LOW |
| `POST /api/webhooks/resend` | Gmail (forward) | Svix signature dedup | 20/60s per IP | 10s timeout | MEDIUM |
| `GET /u/:handle/badge.svg` | GitHub API (via getStats) | 6h cache-first + CDN | 100/60s per IP | 15s AbortSignal | LOW |
| `GET /u/:handle/og-image` | GitHub API (via getStats) | 48h Redis + CDN | Via badge route | 10s PNG timeout | LOW |

### In-Flight Deduplication

Implemented in `lib/github/client.ts:20-64`. Concurrent requests for the same handle share a single GitHub API promise. Cleanup via `.finally()` at line 60-62. Per-process only (not cross-instance).

### Cascading Call Analysis

- **warm-cache cron**: Up to 50 handles/run × 1 GitHub call each = ~50 calls/day. Mitigated by rotation and batch prefetch.
- **bulk-recalculate**: O(n) GitHub calls. Mitigated by batch processing (5 concurrent) and admin-only access.
- **auth/callback**: 3–4 GitHub API calls per OAuth flow (token exchange + user info + email). Low volume.

### Estimated Monthly API Usage

| Service | Calls/Month | Headroom |
|---|---|---|
| GitHub API | ~15K (mostly warm-cache) | 97%+ (5K/hr authenticated) |
| Resend API | ~500–1K (campaigns + notifications) | 90%+ |
| PostHog | ~100 error events | Negligible |

## Resource Management

### Resource Leaks: NONE DETECTED

- **Connections**: All clients use lazy singletons (Redis REST, Supabase REST). No persistent TCP connections to leak.
- **Timer cleanup**: `with-timeout.ts` and `sync-audience/route.ts` properly clear timers via `.finally()`.
- **In-flight map**: Cleaned via `.finally()` at `github/client.ts:60-62`.
- **`after()` callbacks**: Use `Promise.allSettled()` — one failure can't block others. `badge.svg/route.ts:130-171`, `u/[handle]/page.tsx:154-186`.
- **Fetch timeouts**: 100% coverage — all external calls have `AbortSignal.timeout()` or `withTimeout()`.
- **No `setInterval`** in server-side code.
- **No middleware.ts** — zero per-request overhead.

### P3 — OG Image Timer Not Cleared

`apps/web/app/u/[handle]/og-image/route.ts:81-86` — `Promise.race()` timeout timer is not explicitly cleared after the race resolves. The timer fires harmlessly (reject on a settled promise is a no-op), but it keeps the timer reference alive until expiry. Cosmetic — Node.js GCs it after 10s. Fix is trivial (add `.finally(() => clearTimeout(timer))`).

## Vercel Cost Factors

### ISR/Revalidation Configuration

| Route | Revalidate | Assessment |
|-------|-----------|------------|
| `/` | 3600 (1h) | Good |
| `/about/*` | 86400 (24h) | Excellent |
| `/archetypes/*` | 604800 (7d) | Excellent |
| `/privacy`, `/terms` | 86400 (24h) | Good |
| `/u/[handle]` | 3600 (1h) | Acceptable (could go 6h) |
| `/studio` | force-dynamic | Correct (auth-gated, needs fresh data) |
| `/experiments/*` | force-dynamic | Acceptable (low traffic) |

### Bundle

- Total client JS: **~1,682 KB** (68 chunks, no chunk >500 KB). Stable — +19 KB vs last cycle.
- No global middleware (zero per-request overhead).
- `@resvg/resvg-js` correctly in `serverExternalPackages` (avoids edge bundling).
- Font files (~2–3 MB) bundled via `outputFileTracingIncludes` for server-side SVG rendering — necessary.

### CDN Caching

- Badge SVG: `s-maxage=21600, stale-while-revalidate=86400` — Excellent
- OG images: `s-maxage=21600, stale-while-revalidate=86400` — Excellent
- Error responses: `s-maxage=300, stale-while-revalidate=600` — Good (short TTL prevents stale errors)

## Vulnerabilities

- **Production (`pnpm audit --prod`)**: 0 vulnerabilities
- **Dev-only (`pnpm audit`)**: 3 in vite 7.3.1 (2 high + 1 moderate) via vitest. No production exposure. Fix: bump vite >=7.3.2 or wait for vitest peer update.

## Recommendations

### Active Items

| ID | Priority | Description | Status |
|----|----------|-------------|--------|
| P2-1 | P2 | `dbGetCampaignStats()` client-side aggregation — move to Supabase RPC at >5K sends/campaign | CARRIED (future scale) |
| P3-1 | P3 | Cache `listAllContacts()` in sync-audience cron (1–2h TTL) to eliminate Resend pagination on repeat runs | CARRIED |
| P3-2 | P3 | OG image timer not cleared in `Promise.race()` at `og-image/route.ts:81-86` | CARRIED |
| P3-3 | P3 | vite 7.3.1 dev-only vulns (3 advisories). Bump to >=7.3.2. | CARRIED |

### Monitors

| ID | What | Threshold | Current |
|----|------|-----------|---------|
| M1 | Avatar cache Redis memory | 300 MB @ 10K users | <1 MB (low traffic) |
| M2 | OG image Redis memory | 150 MB @ 1K active/day | <1 MB (low traffic) |
| M3 | HyperLogLog size | ~12 KB (constant) | ~12 KB. Track quarterly. |

### Resolved Since Last Report

None — no production code changes since 2026-04-12. All prior P1/P2 items remain resolved.
