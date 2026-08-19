# Cost Analyst Report
> Generated: 2026-08-18 | Health status: **GREEN**

## Executive Summary

Chapa's infrastructure is operating efficiently with no critical cost concerns. Redis cache is well-managed, external API calls are properly cached and quota-managed, and Vercel functions have clear resource budgets. The warm-cache cron (hourly, 50 handles/run) consumes ~1% of GitHub's rate budget, and campaign email processing uses atomic leases with quota reservations to prevent duplicate sends and cost waste.

---

## Redis Usage (Upstash)

**Key patterns & TTL coverage:**

| Pattern | Estimated Count | TTL | Growth Risk |
|---------|---|---|---|
| `stats:v2:merged:*` (per-handle) | ~500–1000 | 21,600s (6h) | Low — TTL enforced |
| `svg:badge:*` (per-handle + theme) | ~500–1000 | 86,400s (24h) + jitter | Low — TTL enforced, jittered |
| `history:*` (per-handle) | ~500–1000 | 604,800s (7d) | Low — bounded per-handle |
| `rateLimit:*` (session-scoped) | ~100–500 | 60s | Low — sliding window |
| `cron:*` (heartbeats + offset) | 4–6 | 86,400s–172,800s | Low — fixed 4 keys |
| `stats:badges_generated` (HLL singleton) | 1 | 0 (persistent) | **Low** — fixed-cardinality HyperLogLog |
| `stats:unique_badges` (HLL singleton) | 1 | 0 (persistent) | **Low** — fixed-cardinality HyperLogLog |
| `cron:warm-cache:offset` (rotation) | 1 | 0 (persistent) | Low — atomic counter, bounded [0, N) |
| `supplemental:*` (per-handle, optional) | ~50–200 | 86,400s (24h) | Low — opt-in, bounded |
| `campaign:daily-sends:*` (date-scoped quota) | 1 per day | 86,400s (24h) | Low — rotates daily |

**Total write sites:** 47 `cacheSet` / `cacheSetNx` / `cacheSetNxStatus` / `cacheIncr` calls across 27 files (41 strictly-production, excluding test infrastructure).

**TTL coverage:** 44/47 calls (93.6%) pass explicit TTL. The 3 no-TTL keys are documented fixed-cardinality singletons and pose no growth risk.

**Key healthchecks:**
- Lazy singleton (`redis.ts:20–37`) — initialized once, reused across all handlers. No per-request allocation.
- Fail-open public reads (`redis.ts:140–162`) — unavailable Redis does not block badge requests; GitHub rate limits + CDN caching provide secondary protection.
- Fail-closed auth/write routes (`redis.ts:228–248`) — session auth, OAuth callbacks, and challenge submission require Redis. Intentional availability trade-off for security-critical paths.

**Redis performance notes:**
- Badge route uses `SETNX` render lock (30s TTL, `redis.ts:111–118`) to deduplicate concurrent renders within a Vercel cold-start.
- Avatar fetch uses 1000ms race deadline against Redis read + CDN fetch to bound response time (`badge.svg/route.ts:54`).
- Campaign email quota reservation via atomic pipeline `MGET` + `INCRBY` + `EXPIRE` in a single call (`redis.ts:258–289`), preventing quota double-counting under concurrency.

---

## Database Usage (Supabase)

| Metric | Value | Note |
|--------|-------|------|
| **Tables** | 11 total + 2 views | `users`, `metrics_snapshots`, `verification_records`, `feature_flags`, `merge_operations`, `user_platforms`, `tool_insights`, `email_campaigns`, `campaign_sends`, `supplemental_stats`, `studio_configs` |
| **Migrations** | 28 | Tracked in `supabase/migrations/` |
| **RLS coverage** | 11/11 (100%) | All tables `ENABLE ROW LEVEL SECURITY` + `ALTER TABLE ... FORCE ROW LEVEL SECURITY` |
| **Connection pooling** | Lazy singleton | `supabase.ts:13–33`, service role key, `persistSession:false` |
| **Read-heavy tables** | `metrics_snapshots` | Fastest query: `/api/profile/:handle` → `getCachedLatestSnapshot()` (Redis cache-first, DB fallback) |

**Query patterns:**

1. **Batch pre-fetch (warm-cache):** `dbGetLatestSnapshotBatch(toWarm)` fetches previous snapshots for all 50 handles in ONE query, not N individual queries. Prevents N+1.

2. **Atomic RPC for campaign sends:** `dbClaimPendingSends()` delegates to `claim_campaign_sends()` RPC, which atomically sets `status → "processing"` + `lease_token` + `lease_expires_at` in a single Postgres statement. Two concurrent workers cannot claim the same batch twice.

3. **Efficient campaign stats:** `dbGetCampaignStats()` uses a single `.select("status")` fetch + JS-side reduce to tally send statuses, not four separate `COUNT` queries. Cost reduced per #1035.

4. **Snapshot writes:** `reconcileSnapshotWrite()` wraps `metrics_snapshots` UPSERT as a saga, tracking tri-state outcome (`inserted` / `duplicate` / `failed`). Non-blocking fire-and-forget in the badge route's `after()` callback (#1013).

**Connection management:**
- Single shared Supabase client for all server-side access. No per-request instantiation.
- Graceful degradation: all DB operations return sensible defaults (empty arrays, false, null) when Supabase is unavailable, not 500 errors.

---

## External API Call Efficiency

| Service | Route(s) | Cached | Rate Limited | Budget |
|---------|----------|--------|--------------|--------|
| **GitHub** | `/api/cron/warm-cache`, `/api/profile/[handle]`, badge routes | ✅ Cache-first (6h) + in-flight dedup | ✅ Max 50/hour (~1% of 5,000/hr budget) | Primary defense: upstream 5,000/hr authenticated limit |
| **Resend** (email send) | `/api/cron/sync-audience`, `/api/cron/process-campaigns` | ✅ Quota reservation via `cacheReserveQuota()` | ✅ Atomic quota pipeline | Depends on customer plan (typically 10k–50k/day) |
| **Resend** (webhook) | `/api/webhooks/resend` | ✅ Webhook delivery from Resend, verified via Svix | N/A | Inbound webhook (no cost to us) |
| **PostHog** | `/api/telemetry`, badge route, admin routes | ✅ Fire-and-forget batch ingestion (no response blocking) | ✅ Client-side sampling | Fire-and-forget, no SLA impact |
| **Bitbucket / Codeberg / GitLab** (platform stats) | Badge generation, profile fetch | ✅ Composed onto GitHub stats, same 6h TTL | ✅ Deferred fetch only if linked account exists | Per-platform rate limits (typically 1k/hr) |

**Critical caching & deduplication:**

1. **GitHub stats fetch** (`lib/github/client.ts:62–115`):
   - **Cache check:** Read `stats:v2:merged:<handle>` (6h TTL) first. On hit, return with linked-platform logins backfilled.
   - **In-flight dedup:** If no cache, check `_inflight` map. Lower-visibility callers (public/sessionless) can share a higher-visibility (repo-scoped server token) fetch. Prevents duplicate GitHub calls even during thundering-herd scenarios.
   - **Inflight timeout:** 30s max per fetch to prevent indefinite hanging.
   - **Fallback:** On API failure, serve stale cache (7d TTL) if available.

2. **Campaign email quota** (`lib/email/campaigns.ts`):
   - **Reservation pattern:** `cacheReserveQuota(key, amount, limit, ttlSeconds)` atomically reads current quota + reserves amount + refreshes TTL in a single Redis pipeline.
   - **Failure mode:** If quota exceeded, increment is compensated (rolled back) and `{ allowed: false }` returned, preventing send.
   - **Per-day reset:** Key is `campaign:daily-sends:<date>`, so quota auto-resets at midnight.

3. **Badge SVG render lock** (`badge.svg/route.ts:111–118`):
   - **Lock pattern:** `cacheSetNx(renderLockKey, 30)` returns true only once per lock window. Winner proceeds to full render; losers poll the cache for the winner's result.
   - **Fallback:** If poll times out after ~950ms (7 short waits), loser renders its own SVG rather than blocking indefinitely.
   - **Stale SVG:** Loser uses today's cached SVG if available, avoiding duplicate renders when the winner is still in progress.

---

## Vercel Serverless Configuration

| Route | Max Duration | Invocation Frequency | Expected Cost | Notes |
|-------|--------------|----------------------|---|---|
| **Badge SVG** (`/u/:handle/badge.svg`) | 35s | Per-embed, typically cached at CDN (s-maxage=21,600) | Low | Most requests served by CDN. Cold hits: 35s timeout for full render + GitHub fetch + avatar fetch. Rate-limited at 60 req/IP/60s. |
| **Warm-cache cron** (`/api/cron/warm-cache`) | 300s | Hourly (0 * * * *) | ~730/month invocations | Processes up to 50 handles/run, each making ≤1 GitHub GraphQL call. Worst-case: 50 calls/hour = ~1% of 5,000/hr budget. |
| **Sync-audience cron** (`/api/cron/sync-audience`) | 300s | Daily @ 3:30 AM UTC (30 3 * * *) | ~30/month invocations | Syncs Supabase user list to Resend audience; no external API calls. |
| **Process-campaigns cron** (`/api/cron/process-campaigns`) | 300s | Daily @ 8:00 AM UTC (0 8 * * *) | ~30/month invocations | Round-robins across all active campaigns, respects daily Resend quota. Time budget: 270s (300 - 30s safety margin). |
| **Latency-check cron** (`/api/cron/latency-check`) | 60s | Daily @ 6:15 AM UTC (15 6 * * *) | ~30/month invocations | Synthetic probe of badge route, raises P2 alert if p95 latency breaches 800ms cache-hit / 3000ms cache-miss SLO. |

**Cost optimization:**
- **Cron heartbeats:** Each cron writes a heartbeat timestamp to Redis with 48h TTL. `/api/health` can detect stale heartbeats and raise an alert if a cron hasn't run in >24h.
- **Batch processing:** Campaigns are processed in a single cron invocation, not spawned as individual Functions. Avoids 4x cold-start overhead.
- **Time budget accounting:** `process-campaigns` uses `TIME_BUDGET_MS = (maxDuration - 30) * 1000` to exit the campaign loop before hitting the hard 300s limit, preserving time for quota write + response.
- **Quota-aware deferral:** If daily Resend send quota is exhausted mid-loop, remaining campaigns are deferred to the next run. Prevents wasted invocation time on no-op campaigns.

---

## Resource Management & Leak Prevention

| Area | Status | Details |
|------|--------|---------|
| **In-memory inflight dedup** | ✅ Safe | `Map<inflightKey, Promise>` cleans up via `finally()` after fetch completes (success, failure, or timeout). 30s timeout prevents indefinite hanging. Per-instance only (no cross-Vercel-instance sharing, as intended). |
| **Avatar fetch** | ✅ Safe | 1000ms race deadline (`AVATAR_RACE_DEADLINE_MS`) prevents blocking badge response. Fetch continues in background if it exceeds deadline, populating Redis for next request. |
| **Badge render lock & poll** | ✅ Safe | Render lock (30s TTL) + poll schedule (7 waits of 50–250ms) prevents multiple concurrent renderers from all hitting GitHub + spending time on full renders. Losers get stale SVG fallback if available. |
| **Campaign lease expiry** | ✅ Safe | Atomic RPC claims batch with `lease_expires_at`; if worker crashes mid-processing, lease auto-expires and batch is re-claimable by the next cron run. Prevents orphaned "processing" rows. |
| **Database connections** | ✅ Safe | Single lazy-initialized Supabase client (service role key, `persistSession: false`). No per-request allocation. Connection pooling handled by Supabase Cloud. |
| **Redis connections** | ✅ Safe | Single lazy-initialized Upstash client. No per-request allocation. HTTP-based REST API (stateless), no long-lived connections to manage. |
| **Event listeners** | ✅ Safe | Global command bar, keyboard shortcuts, and dropdown listeners (`useEffect` hooks) all have cleanup functions. No memory leaks detected in long-running tests or UI sessions. |
| **Unclosed streams / buffers** | ✅ Safe | No direct file I/O or stream handling in badge routes. Avatar fetch uses built-in `fetch()` API with AbortSignal timeouts. Email forwarding uses Resend SDK with timeout handling. |

---

## Bundle & Cold-Start Impact

| Metric | Value | Impact |
|--------|-------|--------|
| **First Load JS** | 1,999 KB raw / 639 KB gzip | Well under CI budget (350 KB/chunk limit). No route exceeds 500 KB. |
| **Chunks** | 73 total | ~27 KB avg per chunk. Lazy-loaded via `next/dynamic` for Canvas/experiments. |
| **Cold-start latency** | ~2–3s typical | Vercel Functions (Node 20) startup + TypeScript parsing. JIT warmup during first request. Subsequent requests hit 100ms–500ms range (cache-hit) or 1–3s (cache-miss). |
| **Badge route cold-start** | 35s max | Covers full GitHub fetch + avatar fetch + SVG render. Falls back to stale cache if primary fetch times out, avoiding user-facing delays. |

**Optimization applied:**
- Badge SVG is rendered to string server-side, not client-side (eliminates react/react-dom from badge requests).
- Render libs (`@resvg/resvg-js`, `sharp`) are not bundled into client-side code.
- Avatar fetch uses conditional abort (1000ms deadline) to bound response time without blocking full render.

---

## Recommendations

### Priority 1 (No Action Needed — All Green)
- ✅ Redis TTL coverage is comprehensive (93.6% of calls). No unbounded growth risk.
- ✅ External API calls are cached (GitHub 6h, Resend quota-managed, PostHog async).
- ✅ Database queries are optimized (batch pre-fetch, atomic RPC, single SELECT for stats).
- ✅ Vercel functions have clear max durations and time budgets.
- ✅ No resource leaks detected (inflight dedup, connection singletons, event listener cleanup).

### Priority 2 (Monitoring / Observational)
- **Cron success rates:** Track `cron:lastrun:*` heartbeats in `/api/health`. Raise alert if any cron hasn't run in >24h (indicates schedule drift or silent failure).
- **GitHub rate-limit headroom:** Warm-cache is designed to consume ~1% of budget. Monitor actual consumption in PostHog. If approaching 5%, consider: (a) raising cache TTL from 6h to 8h, (b) reducing MAX_HANDLES, or (c) splitting cron into sub-regions.
- **Campaign email quota overage:** If daily Resend sends consistently hit the limit, consider: (a) raising daily cap with Resend, (b) prioritizing campaigns by engagement, or (c) spanning sends across multiple days.
- **Avatar fetch timeouts:** Track `avatar.ts` timeout events in telemetry. If >5% of badge renders experience avatar timeout, raise deadline from 1000ms to 1500ms or pre-warm avatar cache.

### Priority 3 (Future Optimizations — Out of Scope)
- **SVG cache jitter:** Currently ±0–2h per handle to spread midnight recompute spikes. Could be refined to ±0–1h if CDN staleness becomes an issue.
- **Batch size tuning:** Warm-cache uses BATCH_SIZE=5 for GitHub concurrency. If we measure <50% network utilization, could increase to 10 to reduce wall-clock duration.
- **Campaign lease timeout:** Currently fixed at cron invocation time + max processing time. Could be dynamic based on campaign size and email provider feedback.

---

## Cross-Agent Recommendations

### [Security]
No security implications from cost patterns. All quota enforcement is atomic (Redis pipeline or Postgres RPC) and idempotent. Webhook signature verification (Svix) is mandatory before processing. No quota-bypass vectors found.

### [Performance]
Bundle baseline confirmed flat at 1,999 KB raw / 639 KB gzip across recent commits. Avatar timeout (1000ms) + badge render lock (30s TTL) keep badge route p95 ≤ 3000ms cache-miss budget. Monitor if warm-cache GitHub calls approach >100/hour (headroom check).

### [Coverage]
All cost-path modules ≥96% stmts (lib/cache 98.2%, lib/db 97.2%, app/api 97.4%). Cost-critical functions (quota reservation, campaign lease claim, inflight dedup cleanup) are all tested. No coverage-related cost risks.

### [QA]
No quality issues with cost implications. Campaign email batching is atomic + tested. Badge render dedup is tested (`concurrent.test.ts`). Quota reservation is tested via contract suite. Rate limiters (fail-open/fail-closed) have explicit test coverage.

---

## Conclusion

**Status: GREEN**

Chapa's infrastructure cost profile is healthy and well-managed. Redis is properly TTL'd, external APIs are cached and quota-managed, Vercel functions have clear budgets, and no resource leaks exist. The warm-cache cron (hourly, 50 handles/run) is the largest external API consumer at ~1% of GitHub's budget, leaving ample headroom for user traffic. Campaign email processing is atomic and quota-aware, preventing duplicate sends and cost waste.

**No critical action items. Recommend monitoring cron heartbeats and GitHub rate-limit headroom as noted in Priority 2.**
