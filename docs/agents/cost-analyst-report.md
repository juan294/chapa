# Cost Analyst Report
> Generated: 2026-05-01 | Health status: GREEN

## Executive Summary

Estimated monthly cost at 10K users remains **~$55–70/mo**. The Apr 30 ISR
regression flagged by Performance has been remediated — `dbGetFeatureFlag` is
now wrapped in `unstable_cache` (5-min revalidate, `feature-flags` tag) so the
root layout's `isStudioEnabled()` no longer pulls Upstash REST `no-store` into
every request. CDN-cached pages (/about/*, /archetypes/*, /, /u/[handle],
/privacy, /terms) are eligible for ISR again — recovering the projected
serverless-invocation regression from the previous cycle. No new external API
calls, no new TTL gaps, no new in-memory growth surfaces.

## Redis Usage

- **Key prefixes** (27 distinct, unchanged from 2026-04-30):
  - Per-user / per-handle: `stats:`, `stats:v2:`, `stats:v2:bitbucket:`,
    `stats:v2:codeberg:`, `impact:`, `badge:`, `history:`, `og:`, `avatar:`,
    `supplemental:`, `craft:`, `agent:`, `pr-stats:`, `bitbucket:`, `codeberg:`,
    `feature-flag:`
  - Per-IP / per-key rate limit counters: `rl:` family
  - Auth/lock/session: `oauth:state:`, `cli:auth:`, `badge-lock:`,
    `dirty:stats:`, `agent:run:`, `webhook:resend:idem:`
  - Persistent singletons (TTL=0): `cron:warm-cache:offset` (int),
    `stats:badges_generated` (INCR), `stats:unique_badges` (HLL ~12 KB)
- **TTL coverage**: 24/27 (89%). All non-singleton keys have explicit `ex`
  (cache reads) or `EXPIRE` (rate limiters, sliding-window pipelines)
  documented in `lib/cache/redis.ts:66-385`.
- **Growth risk**: LOW. The 3 TTL=0 keys are bounded singletons (single
  integer, single counter, fixed-size HLL).
- **New `lib/cache/dirty-stats.ts`** module + tests (this cycle): same dirty
  marker pattern as before, 1h TTL, 100% covered. No new growth surface.
- **No changes** to `cacheSet`, `cacheSetNx`, `rateLimit`, or pipeline
  builders. Env access centralized via `lib/env.ts` getters — purely a safety
  refactor; zero functional or cost impact.

## Database Usage

- **Tables**: 11 (users, metrics_snapshots, campaign_sends, email_campaigns,
  feature_flags, user_platforms, supplemental_stats, verification_records,
  merge_operations, tool_insights, plus telemetry).
- **Views**: 2 (`latest_snapshots`, `admin_users` — both `security_invoker = true`).
- **RPC**: 1 (`claim_campaign_sends`).
- **Connection management**: lazy singleton via
  `getSupabase()` at `apps/web/lib/db/supabase.ts:11` — no per-request client
  instantiation, no connection-pool growth.
- **Query patterns**: 0 N+1s. Batch reads use a single `IN()` query
  (`dbGetLatestSnapshotBatch()` at `lib/db/snapshots.ts:325`).
- **Retention**: `dbCleanOldSnapshots()` invoked from warm-cache cron at
  `route.ts:175` — 365-day retention. All retention jobs wired and running.
- **`dbGetFeatureFlag` now `unstable_cache`-wrapped** (`lib/feature-flags.ts:80-94`):
  5-minute revalidate, `feature-flags` tag for invalidation. Reduces Supabase
  reads for the root layout `isStudioEnabled()` call from ~1/request to
  ~1/300s per server instance — material cost recovery.

## External API Calls

| Route | External Service | Cached | Rate Limited | Risk |
|-------|-----------------|--------|-------------|------|
| `/api/health` | GitHub probe (uncached, by design) | No | 30/60s | LOW |
| `/api/refresh` | GitHub stats fetch | Yes (post-fetch) | 5/hr/handle + auth | LOW |
| `/api/generate` | GitHub stats fetch | Yes | 5/hr + auth | LOW |
| `/api/recalculate` | GitHub stats fetch | Yes | 5/hr + auth | LOW |
| `/api/profile/[handle]` | None (cache-only read) | Yes | 60/60s | LOW |
| `/api/history/[handle]` | None (Supabase only) | Yes | 60/60s | LOW |
| `/api/verify/[hash]` | None (HMAC only) | N/A | 30/60s | LOW |
| `/api/auth/{platform}/callback` | OAuth token exchange | N/A | per-state-token | LOW |
| `/api/auth/{platform}/connect` | None (just redirect) | N/A | per-IP | LOW |
| `/api/webhooks/resend` | Resend (Svix HMAC + idempotency) | N/A | 60/60s | LOW |
| `/api/cron/warm-cache` | GitHub stats batch | Yes | bearer (CRON_SECRET) | LOW |
| `/api/cron/sync-audience` | Resend audience sync | N/A | bearer | LOW |
| `/api/cron/process-campaigns` | Resend send | N/A | bearer + per-batch lock | LOW |
| `/api/telemetry` | None (write to Supabase) | N/A | 30/60s | LOW |
| `/api/insights/[handle]` | None | Yes | per-handle | LOW |
| `/api/insights` (POST) | None | N/A | 5/hr + auth | LOW |

- All external fetches use `withTimeout()` or `AbortSignal.timeout()` (100%
  coverage, unchanged).
- In-flight dedup at `lib/github/client.ts:28` — 30s TTL, `.finally()` clear.

## Resource Management

- **Timers**: All `setTimeout` paired with cleanup. No server-side
  `setInterval`. No leaks observed.
- **In-memory caches**:
  - `_inflight` Map (GitHub client) — bounded by 30s timeout + `.finally()`.
  - `inflightBadgeRenders` — bounded by 30s SETNX `badge-lock` TTL.
  - `flagCache` (in-process) — fixed flag set (~5–10 entries).
  - `warmSet` — MAX_HANDLES=50.
  - `unstable_cache` data cache (new, this cycle) — Next.js framework manages
    eviction; revalidate=300s bounds entry age.
- **Connection pools**: Supabase singleton, Upstash Redis singleton — both
  lazy via `lib/env.ts` getters now.
- **Buffer/blob handling**: OG image renderer uses `@resvg/resvg-js` with
  output to `Uint8Array` (no streaming); resvg buffers are GC'd per-request.
  Avatar fetch caps response size implicitly via 5s timeout (no body cap, but
  hostname + MIME whitelist limits surface).

## Vercel-Specific Cost Factors

- **Serverless invocation profile recovered** via `unstable_cache`:
  `/about`, `/about/scoring`, `/about/verification`, `/archetypes/*` (7),
  `/cli/authorize`, `/admin`, `/_not-found` no longer forced dynamic by the
  root-layout `isStudioEnabled()` call. The 13-page ISR regression flagged
  Apr 30 is closed.
- **Cron handlers**: 4, all `maxDuration=300s`, all bearer-authenticated.
  Vercel Pro cron-minute budget unaffected.
- **Edge vs serverless**: All routes Node runtime (Redis + Supabase clients
  require it). No edge opportunity without abandoning Upstash/Supabase SDKs.
- **Bundle**: Performance reports +194.9 KB client-side growth Apr 30. No
  cost impact server-side (this is browser cache + CDN bandwidth, not Vercel
  function size).
- **No oversized routes** — no chunk >500 KB.

## Recommendations

1. **Wire admin write hook to call `revalidateTag("feature-flags")`** when
   feature flag rows are mutated via `/api/admin/feature-flags`. Currently
   the in-process `flagCache` is invalidated but the `unstable_cache` data
   cache will lag up to 5 minutes. Low priority — admin-facing, infrequent.
2. **(P2 carried, 6th cycle)** `dbGetCampaignStats()` 4-query parallel count
   aggregation (`lib/db/campaigns.ts:734-751`). Move to a `GROUP BY status`
   Postgres RPC at >5K sends/campaign. Threshold not yet triggered — defer.
3. **(MONITOR M1–M5 carried)** Avatar cache (~300 MB @10K), OG image cache
   (~200 MB @1K active/day), HLL (~12 KB), `metrics_snapshots` row growth
   (~3.65M rows/year @10K — cleanup wired), `withErrorCapture` PostHog spike
   risk at high error rate (fire-and-forget, timeout-protected). All within
   budget; no action needed yet.

---

<!-- Shared-context entry for docs/agents/shared-context.md -->

SHARED_CONTEXT_START
## Cost Analyst — 2026-05-01
- **Status**: GREEN
- Estimated monthly cost at 10K users: **~$55–70/mo**. Unchanged.
- **ISR regression CLOSED**: Apr 30 triage wrapped `dbGetFeatureFlag` in
  `unstable_cache` (`lib/feature-flags.ts:80-94`, revalidate=300, tag
  `feature-flags`). 13 pages (`/about*`, `/archetypes/*`, `/cli/authorize`,
  `/admin`, `/_not-found`) eligible for ISR again — Vercel serverless
  invocation regression projected by Performance Apr 30 is recovered.
- Redis: 27 prefixes, TTL coverage 24/27 (89%), 3 bounded singletons. Growth
  risk LOW. Env access centralized via `lib/env.ts` getters this cycle (zero
  functional/cost impact).
- New `lib/cache/dirty-stats.ts` covered 100% — no new growth surface.
- GitHub API: cache-first unchanged. 100% timeout coverage. Only intentionally
  uncached: `/api/health` probe + `/api/refresh` (5/hr + auth).
- Supabase: 11 tables + 2 views + 1 RPC, lazy singleton client. 0 N+1s.
  `dbGetFeatureFlag` reads now reduced to ~1/300s/instance via `unstable_cache`.
- External APIs: 16 routes audited, all cached or rate-limited, all with
  explicit timeouts. No new uncached calls.
- Cron: 4 handlers at maxDuration=300s, bearer-auth, unchanged.
- No edge routes (Redis + Supabase SDKs require Node runtime).
- Resource leaks: 0. All timers paired with cleanup. All in-memory structures
  bounded.
- **P1s: NONE. P2s: 1 active.**
- **P2-1 CARRIED (6th cycle)**: `dbGetCampaignStats()` 4-query parallel count
  aggregation (`lib/db/campaigns.ts:734-751`). Move to `GROUP BY status` RPC
  at >5K sends/campaign. Not yet triggered.
- **NEW MONITOR M6**: `unstable_cache(feature-flags)` data cache lag up to
  5 min after admin writes — wire `revalidateTag("feature-flags")` into
  `/api/admin/feature-flags` PATCH handler when convenient.
- **MONITOR M1–M5 CARRIED**: avatar cache (~300 MB @10K users), OG image
  cache (~200 MB @1K active/day), HLL (~12 KB), `metrics_snapshots` row
  growth (~3.65M rows/year @10K — cleanup wired), `withErrorCapture` PostHog
  spike risk at high error rate (fire-and-forget, timeout-protected).

**Cross-agent recommendations:**
- [Performance]: ISR regression closed — re-measure archetype/about CDN-cache
  hit ratios next cycle to confirm serverless invocations dropped to baseline.
  Bundle growth (+194.9 KB Apr 30) is browser-side and outside cost scope.
- [Security]: No new cost-security conflicts. Fail-open rate limiter intact
  (`redis.ts:183`). All env reads now go through `lib/env.ts` `.trim()` —
  eliminates invisible-character auth-failure class. Resend webhook 3-layer
  defense intact.
- [Coverage]: `lib/feature-flags.ts` `unstable_cache` wrap should be tested —
  confirm a covered fixture exists for the cached path and the
  `revalidateTag` invalidation. `app/api` ~97.48%, `lib/db` 96.48% stable.
SHARED_CONTEXT_END
