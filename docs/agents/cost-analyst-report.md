# Cost Analyst Report
> Generated: 2026-04-26 | Health status: GREEN

## Executive Summary
Infrastructure remains lean and well-bounded. No P1 cost risks; one carried P2 scale concern (`dbGetCampaignStats` aggregation) and the established monitor list (avatar/og/HLL caches). Estimated monthly cost at 10K users: **~$55–70/mo**, unchanged.

## Redis Usage
- **Key patterns audited (16 distinct prefixes):**

| Prefix | TTL | Source | Growth Bound |
|--------|-----|--------|--------------|
| `stats:v2:merged:{handle}` | 6h | `lib/github/client.ts:49` | O(users) |
| `stats:stale:{handle}` | 6h | `lib/github/client.ts:120` | O(users) |
| `supplemental:{handle}` | 6h | `app/api/supplemental/route.ts:71` | O(users) |
| `history:{handle}` | 1h | `lib/history/history.ts:20` | O(users) |
| `history:{handle}:{from}:{to}` | 1h | `lib/history/history.ts:20-26` | Per-range, 1h TTL |
| `craft:{version}:{handle}` | 1h | `lib/cache/craft-cache.ts:22` | O(users) |
| `snapshot:{version}:latest:{handle}` | 24h | `lib/cache/snapshot-cache.ts:21` | O(users) |
| `badge:{version}:{handle}:warm-amber:{date}` | 24h | `app/u/[handle]/badge.svg/route.ts:61` | One/day/user, 24h TTL |
| `badge-lock:{version}:{handle}:warm-amber:{date}` | 30s | `badge.svg/route.ts:65` | Render lock |
| `ratelimit:{endpoint}:{key}` | 60s–24h | many | Bounded windows |
| `avatar:{handle}` | 6h | `lib/render/avatar.ts:60` | O(users) — see M1 |
| `config:{handle}` | 365d | `app/api/studio/config/route.ts:72` | O(studio users) |
| `oauth-state:{state}` | 10m | `lib/auth/oauth-state.ts:4,61` | High churn, short TTL |
| `sideeffects:done:{handle}:{date}` | 1d | `lib/profile/public-profile.ts:70` | One/day/user |
| `cron:warm-cache:offset` | ∞ | `lib/cache/redis.ts:107` | Single int (intentional) |
| `stats:badges_generated` / `stats:unique_badges` | ∞ | `lib/cache/redis.ts:242-243` | INCR counter + HLL ~12 KB |

- **TTL coverage**: 100% on per-user keys. 3 persistent (TTL=0) keys — all intentional, bounded.
- **Growth risk**: LOW. No unbounded sets/sorted-sets discovered. Date-keyed `badge:{...}:{date}` and `history:{handle}:{from}:{to}` linear-but-bounded by 24h/1h TTLs.

## Database Usage
- **Tables**: 9 — `users`, `metrics_snapshots`, `verification_records`, `feature_flags`, `merge_operations`, `user_platforms`, `tool_insights`, `email_campaigns`, `campaign_sends`. Plus 2 views (`latest_snapshots`, `admin_users`, both `security_invoker=true`) and 1 RPC (`claim_campaign_sends`).
- **RLS**: ENABLE + FORCE ROW LEVEL SECURITY on all 9 tables (migration 018) with explicit deny-all for anon.
- **Query patterns**: Efficient. Batch fetches via `.in("handle", ...)` (e.g., `dbGetLatestSnapshotBatch` at `lib/db/snapshots.ts:325`). 0 N+1 patterns. All `.select()` paths have filters or `.maybeSingle()`.
- **Connection management**: Lazy singleton at `lib/db/supabase.ts:11-32` (`_client` cached on first call, returns null when env missing).
- **Cleanup**: `dbCleanOldSnapshots()` (`lib/db/snapshots.ts:410-434`) runs in warm-cache cron (`route.ts:175`). 365-day retention, 1000-row batches. `metrics_snapshots` is bounded — M4 stays as a monitor only.

## External API Calls
| Route | External Service | Cached | Rate Limited | Timeout | Risk |
|-------|------------------|--------|--------------|---------|------|
| `/api/generate` | GitHub (via `getStats`) | 6h + 7d stale | 10/hr | 30s inflight | LOW |
| `/api/refresh` | GitHub (cache-cleared) | rebuilt | 5/hr | 30s inflight | LOW |
| `/api/cron/warm-cache` | GitHub (50 handles, conc=5) | 6h | internal | 30s inflight | LOW |
| `/api/health` | GitHub probe (intentional) | none | 30/60s per IP | 3s | LOW (by design) |
| `/api/insights` (POST) | DB only | n/a | 10/24h | n/a | LOW |
| `/api/supplemental` | DB only | invalidates | 10/24h | n/a | LOW |
| `/api/telemetry` | DB only | fire-and-forget | 3-tier | n/a | LOW |
| `/api/profile/[handle]` | DB only | DB | 60/60s | n/a | LOW |
| `/api/studio/config` | Redis only | 365d | 30/hr | n/a | LOW |
| `/api/webhooks/resend` | Resend (fetch+forward) | n/a (one-shot) | none | 5s/30s | LOW (Svix-signed) |
| `/api/cron/process-campaigns` | Resend send | n/a | internal | bounded | LOW |
| `/api/cron/sync-audience` | Resend audience API | n/a | internal | bounded | LOW |
| Server analytics (PostHog) | PostHog | fire-and-forget | n/a | 5s | LOW |

GitHub/Bitbucket/Codeberg clients all cache-first with in-flight dedup; Bitbucket/Codeberg now in dedicated modules (`lib/bitbucket/client.ts`, `lib/codeberg/client.ts`).

## Resource Management
- **Timers**: All `setTimeout`/`setInterval` cleaned up — every interactive UI use returns `clearTimeout`/`clearInterval` in `useEffect` cleanup. Server-side timers go through `withTimeout()` (clears in `finally`). `pingRedis` uses `withTimeout` (`redis.ts:310`).
- **In-memory caches**:
  - `_inflight` Map (GitHub client) — bounded by 30s timeout + explicit `delete`.
  - `flagCache` Map (`lib/feature-flags.ts`) — bounded by fixed flag-key set (~5–10 entries).
  - `warmSet` (warm-cache cron) — scoped to single invocation, capped at `MAX_HANDLES=50`.
- **Streams/buffers**: No `ReadableStream`, large `Buffer`, or `Uint8Array` allocations in handlers. No leaks detected.

## Vercel Cost Factors
- **`maxDuration=300s` (Pro)**: 4 handlers — `cron/warm-cache`, `cron/process-campaigns`, `cron/sync-audience`, `admin/bulk-recalculate`. All justified batch jobs; `bulk-recalculate` enforces a 250s soft deadline.
- **Runtime**: Default Node.js everywhere. No edge routes (intentional — Redis/Supabase clients used universally).
- **ISR**: `/`→3600, `/u/[handle]`→3600, `/about*`→86400, `/privacy`+`/terms`→86400, `/archetypes/*`→604800. Coverage appropriate by content velocity.
- **`force-dynamic`**: `/studio` (auth-gated, feature-flagged) and `/experiments/*` layout (non-cacheable by design). Both intentional.
- **Oversized routes**: None. No puppeteer/sharp imports in route handlers; SVG→PNG via `@resvg/resvg-js` lazy-loaded only by OG image route.

## Recommendations

### P1 — None.

### P2 (1 carried)
- **P2-1 CARRIED**: `dbGetCampaignStats()` runs 4 parallel `count` queries (`lib/db/campaigns.ts:727-765`). Acceptable today; migrate to a `GROUP BY status` Postgres RPC once any campaign exceeds ~5K sends.

### Monitors (no action — track only)
- **M1**: `avatar:{handle}` cache (~300 MB at 10K users / 6h TTL). Within Upstash free-tier limits at current scale.
- **M2**: OG image cache (~150 MB at 1K active/day) bounded by CDN `s-maxage=21600`.
- **M3**: HLL `stats:unique_badges` (~12 KB constant).
- **M4**: `metrics_snapshots` row growth (~3.65M rows/year at 10K users) — cleanup confirmed wired (`route.ts:175`); retention 365d. Stays a monitor.

### Observation (informational)
- `/api/webhooks/resend` has no rate limit but is Svix-signature-verified end-to-end. Fine as is — flagged only so future changes don't introduce an unauthenticated path through it.
