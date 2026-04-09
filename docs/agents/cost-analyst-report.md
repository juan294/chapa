# Cost Analyst Report
> Generated: 2026-04-09 | Health status: green

## Executive Summary

Infrastructure costs remain stable at an estimated **~$60–70/mo at 10K users**. All critical paths are cache-first, no resource leaks, no unbounded growth patterns, and no new P1 or P2 items. One new P3 found: `lib/analytics/server-errors.ts:106` has a `fetch()` to PostHog without `AbortSignal.timeout()` — a discrepancy with the security agent's prior "100% timeout coverage" claim.

---

## Redis Usage

### Key Patterns

| Pattern | TTL | Purpose |
|---------|-----|---------|
| `craft:<handle>` | 3,600s (1h) | Craft score per user |
| `snapshot:latest:<handle>` | 86,400s (24h) | Latest daily metrics snapshot |
| `history:<handle>[:<from>[:<to>]]` | 3,600s (1h) | Snapshot history, date-range variants |
| `config:<handle>` | 31,536,000s (365d) | Creator Studio badge config |
| `ratelimit:<platform>:<action>:<ip>` | 900s (15m) | Fixed-window rate limit counters |
| `campaign:daily-sends:<YYYY-MM-DD>` | 86,400s (1d) | Daily email send quota |
| `feature_flags` | 3,600s (1h) | Feature flag cache |
| `stats:badges_generated` | **None** | Total badge generation counter (HLL sibling) |
| `stats:unique_badges` | **None** | HyperLogLog unique developer count |
| `cron:warm-cache:offset` | **None (intentional)** | Round-robin cron cursor — persistent by design |

### TTL Coverage
- **Per-user keys**: 100% have TTLs
- **No-TTL singletons**: 3 keys — `stats:badges_generated`, `stats:unique_badges`, `cron:warm-cache:offset`
  - All intentional: counters and cursor. Sizes bounded (~12 KB HyperLogLog, ~8 bytes counter, ~8 bytes cursor)
- **Default `cacheSet` TTL**: 21,600s (6h) when not explicitly passed

### Growth Risk: LOW
- Storage estimate: ~1.52 GB @ 10K users (unchanged)
- Upstash Pro 10 GB limit → **85% headroom**
- OG image cached in Redis with 48h TTL — CDN `s-maxage=21600` bounds generation frequency
- No unbounded key permutations: `history:<handle>:<from>:<to>` expires in 1h naturally

---

## Database Usage

### Tables
11 tables + 2 views in Supabase:

| Table | Purpose |
|-------|---------|
| `users` | User accounts, email preferences |
| `email_campaigns` | Campaign metadata and content |
| `campaign_sends` | Individual send records |
| `feature_flags` | Feature flag config (also Redis-cached) |
| `verification_records` | Badge HMAC hashes (30-day expiry) |
| `tool_insights` | Craft score data from CLI/IDE uploads |
| `metrics_snapshots` | Historical impact score snapshots (1yr retention) |
| `merge_operations` | CLI merge telemetry (90-day retention) |
| `user_platforms` | Linked Bitbucket/Codeberg accounts (encrypted tokens) |
| `admin_users` (view) | Left join: users + latest snapshots |
| `latest_snapshots` (view) | Per-user most recent snapshot |

### Query Patterns: EFFICIENT
- **No N+1 patterns** — batch fetches use `IN()` clauses (`dbGetLatestSnapshotBatch()`)
- **Parallel fetches** — Bitbucket/Codeberg stats fetched via `Promise.allSettled()`, not sequentially
- **Engagement cache** — `dbGetActiveEngagementCampaign()` uses 1h Redis cache to avoid per-user DB hits during cron

### Connection Management: SINGLETON
- Lazy singleton via `getSupabase()` in `lib/db/supabase.ts` — initialized once, reused across requests
- Uses Supabase REST API (not persistent pg connections) — no connection pool needed
- `_resetClient()` for test isolation

### P2-1 (CARRIED): Client-side aggregation in `dbGetCampaignStats()`
- Fetches all sends then aggregates in JS — acceptable at current scale
- Action: Move to Supabase RPC when campaigns exceed ~5K sends/campaign

---

## External API Calls

| Route | External Service | Cached First | Rate Limited | Risk |
|-------|-----------------|--------------|-------------|------|
| `POST /api/refresh` | GitHub, Bitbucket, Codeberg | YES (cache-delete then refetch) | 5/hr/user | LOW |
| `POST /api/generate` | GitHub, Bitbucket, Codeberg | YES (6h cache-first) | 10/hr/user | LOW |
| `POST /api/recalculate` | GitHub, Bitbucket, Codeberg | YES (6h cache-first) | 20/hr/user | LOW |
| `POST /api/admin/bulk-recalculate` | GitHub, Bitbucket, Codeberg | YES (via `getStats()`) | Bearer token only | MEDIUM (cold cache loop) |
| `GET /api/cron/warm-cache` | GitHub, Bitbucket, Codeberg | YES (6h cache-first) | CRON_SECRET | LOW |
| `GET /api/cron/sync-audience` | Resend | NO (paginated list) | Cron schedule | LOW (Resend limits are generous) |
| `POST /api/cron/process-campaigns` | Resend | NO (send flow) | Daily quota via Redis | LOW |
| `POST /api/admin/campaigns/[id]/send` | Resend | NO (admin-only trigger) | Admin auth | LOW |
| `reportServerError()` (internal) | PostHog | NO (fire-and-forget) | None | **P3** (missing timeout) |
| `GET /u/[handle]/badge.svg` | GitHub (on cache miss) | YES (6h + 7d stale) | 100/min/IP | LOW |

### GitHub API Headroom
- Baseline: ~50–150 calls/hr (warm-cache cron + badge requests on cache miss)
- Limit: 5,000/hr per authenticated token
- **Safety margin: ~97%+**
- In-flight deduplication in `lib/github/client.ts` prevents concurrent calls for same handle

---

## Resource Management

### P3-NEW: PostHog fetch without timeout (`lib/analytics/server-errors.ts:106`)
```typescript
// lib/analytics/server-errors.ts:106 — missing AbortSignal.timeout()
await fetch(`${host}/capture/`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});
```
- **Risk**: LOW — wrapped in try/catch (errors swallowed), Vercel serverless timeout acts as backstop
- **Impact**: A slow PostHog endpoint could delay the API route that called `reportServerError()`
- **Discrepancy**: Security agent reported "100% timeout coverage" on 2026-04-06 — this fetch was missed
- **Fix**: Add `signal: AbortSignal.timeout(5000)` to the fetch call (one-liner)

### All Other Resource Management: CLEAN
- **All GitHub/Codeberg/Bitbucket/Resend fetches**: `AbortSignal.timeout()` present
- **All Resend SDK calls**: wrapped in `withTimeout()` (5s–10s)
- **Timer cleanup**: `clearTimeout()` called in all finally blocks (sync-audience, with-timeout.ts, agents/run)
- **Agent process cleanup**: `cleanupProcess()` destroys streams + clears all timers on termination
- **In-flight map**: `_inflight.delete()` in `.finally()` — no accumulation
- **Module-level singletons**: Redis, Supabase, Resend — all lazy, bounded, with test reset functions

---

## Vercel Cost Factors

### Runtime Configuration
- **All routes**: Serverless (no Edge runtime declared anywhere)
- **Cron jobs**: 3 daily (`warm-cache` 6AM, `sync-audience` 3:30AM, `process-campaigns` 8AM), each `maxDuration: 300`
- **ISR pages**: Share page (`revalidate=3600`), landing (`revalidate=3600`), about pages (`revalidate=86400–604800`)

### Serverless Function Cost Drivers
| Route | Frequency | Execution Weight | Notes |
|-------|-----------|-----------------|-------|
| `/u/[handle]/badge.svg` | HIGH (embedded badges) | HEAVY (stats fetch + SVG render + DB write) | Cache-first — most requests serve from CDN |
| `/u/[handle]/og-image` | MEDIUM (share previews) | HEAVY (PNG render via resvg) | 48h Redis cache + CDN `s-maxage=21600` |
| `/api/cron/warm-cache` | Daily | MEDIUM (batch 5, up to 50 handles) | ~100s actual runtime vs 300s limit |
| `/api/cron/sync-audience` | Daily | LOW (Resend list + Supabase upsert) | 30s timeout guard |
| `/api/cron/process-campaigns` | Daily | LOW (batch email sends) | Daily quota enforced |

### ISR/SSG Opportunities
- Static archetype pages (`/archetypes/[type]`) — already `revalidate=604800` (7 days) ✅
- About pages — already `revalidate=86400` ✅
- Landing page — `revalidate=3600` appropriate given dynamic stats ✅
- No additional ISR opportunities identified

---

## Recommendations

### P3 (NEW) — Fix PostHog fetch timeout
**File**: `apps/web/lib/analytics/server-errors.ts:106`
**Fix**: Add `signal: AbortSignal.timeout(5000)` to the PostHog capture fetch call.
Prevents a slow PostHog endpoint from delaying error-reporting routes.

### P2-1 (CARRIED) — Move `dbGetCampaignStats()` to Supabase RPC
**Trigger**: When any campaign exceeds ~5K sends.
**File**: `apps/web/lib/db/campaigns.ts`
Currently fetches all sends and aggregates in JS. Fine at current scale; revisit before scaling campaigns.

### MONITOR (CARRIED) — OG image Redis memory
CDN `s-maxage=21600` bounds generation to ~4/user/day max. At 10K users, OG images are the largest Redis consumer (~62% of estimated 1.52 GB). Monitor if user count grows significantly.

### MONITOR (CARRIED) — `sync-audience` pagination
Current implementation handles Resend contact list via pagination. Acceptable at current audience size. Monitor if Resend audience exceeds 10K contacts and cron runtime approaches 30s limit.

### MONITOR (CARRIED) — HyperLogLog (`stats:unique_badges`)
~12 KB, permanent singleton. Track quarterly — no action needed.

---

## Status vs Prior Run (2026-04-08)

| Item | 2026-04-08 | 2026-04-09 | Delta |
|------|-----------|-----------|-------|
| P1s | 0 | 0 | — |
| P2s | 0 | 0 | — |
| P3s | 0 | 1 (PostHog timeout) | +1 NEW |
| Redis storage estimate | ~1.52 GB | ~1.52 GB | stable |
| GitHub API headroom | ~97%+ | ~97%+ | stable |
| Fetch timeout coverage | 100% (security claim) | 99% (1 gap found) | discrepancy |
| Cost estimate @ 10K users | ~$60–70/mo | ~$60–70/mo | stable |
