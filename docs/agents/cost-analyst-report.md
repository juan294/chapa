# Cost Analyst Report
> Generated: 2026-05-10 | Health status: **green**

## Executive Summary

Zero cost-surface changes this cycle — three commits since the May 9 report are documentation and test-only. All prior P2s remain resolved; P2-1 (`dbGetCampaignStats` GROUP BY aggregation) carries to cycle 12, still threshold-gated at >5K sends/campaign.

## Redis Usage

**Key patterns (28 audited, 15 production prefixes + 3 persistent singletons):**

| Prefix | TTL | Notes |
|--------|-----|-------|
| `stats:v2:merged:` | 21,600s (6h) | GitHub stats cache (hot path) |
| `stats:stale:` | 604,800s (7d) | Stale fallback |
| `svg:` | 21,600s (6h) | Badge SVG output cache |
| `badge-lock:` | 30s | Render deduplication lock |
| `supplemental:` | 86,400s (24h) | EMU account stats |
| `config:` | 31,536,000s (1yr) | Studio config per-user (M7) |
| `ratelimit:` | Window-based | Per-route rate counters |
| `campaign:active-engagement` | 3,600s (1h) | Active campaign cache |
| `sync-audience:contacts` | 3,600s (1h) | Resend contacts list |
| `stats:dirty:` | 3,600s (1h) | CLI upload dirty marker |
| `feature-flag:` | 300s | Flag cache via `unstable_cache` |
| `inflight:` | 30s | GitHub in-flight dedup |
| `cron:lock:` | 300s | Cron execution lock |
| `cron:warm-cache:offset` | **No TTL** | Persistent rotation offset (singleton) |
| `stats:badges_generated` | **No TTL** | INCR lifetime counter (singleton) |
| `stats:unique_badges` | **No TTL** | HLL ~12 KB (singleton) |

**TTL coverage:** 25/28 keys have TTLs = **89%** (unchanged from prior cycles). 3 persistent singletons are intentional: rotation offset, lifetime badge counter, unique badge HLL.

**Growth risk:** LOW. No new unbounded patterns. `config:` keys accumulate ~200–400 bytes/user per PUT but TTL=1yr and value is replaced on write (no per-write accumulation). `stats:unique_badges` HLL bounded at ~12 KB regardless of user count.

## Database Usage

**Tables: 11** (confirmed via `from('table_name')` grep across `apps/web/lib/db/*.ts`) — unchanged.

| Table | Primary query pattern |
|-------|----------------------|
| `users` | Point lookup + list (paginated) |
| `email_campaigns` | CRUD + status filter |
| `campaign_sends` | Status batch update |
| `verification_records` | Point lookup + expiry cleanup |
| `metrics_snapshots` | UPSERT + batch SELECT (IN query) + date-range cleanup |
| `merge_operations` | Upsert + 90-day retention cleanup |
| `tool_insights` | UPSERT + point lookup |
| `supplemental_stats` | UPSERT + point lookup + delete |
| `admin_users` | Paginated list |
| `user_platforms` | Upsert + point lookup + delete |
| `feature_flags` | Point read + write |

**Query patterns:** No N+1 patterns detected. `dbGetLatestSnapshotBatch()` uses a single `IN()` query for cron warm-cache batch processing. All multi-step operations use `Promise.all()` for independent lookups.

**Connection management:** Singleton lazy client at `lib/db/supabase.ts:14` — initialized once per process, reused across requests. Service role key used server-side (bypasses RLS overhead on all queries).

## External API Calls

| Route | External Service | Cached Before Call | Rate Limited | Risk |
|-------|-----------------|-------------------|-------------|------|
| `GET /u/[handle]/badge.svg` | GitHub (stats + profile) | Yes — `stats:v2:merged:` (6h fresh), `stats:stale:` (7d stale), in-flight Map dedup | Yes — fail-open Redis rate limiter | LOW |
| `POST /api/generate` | GitHub (stats fetch) | Yes — same cache stack; 10/hr rate limit | Yes | LOW |
| `POST /api/refresh` | GitHub (forced refresh) | Cache cleared intentionally; 5/hr rate limit | Yes | LOW |
| `GET /api/health` | GitHub + Redis + Supabase (probe) | No — intentional health probe | Yes — 5/min | LOW |
| `GET /api/cron/warm-cache` | GitHub (batch, 50 handles/5 concurrent) | Pre-warms cache; `dbGetLatestSnapshotBatch()` filters handled handles | Bearer auth (not public) | LOW |
| `GET /api/cron/sync-audience` | Resend (contacts.list) | Yes — `sync-audience:contacts` (1h TTL) | Bearer auth | LOW |
| `GET /api/cron/process-campaigns` | Resend (send emails) | Engagement campaign cached 1h | Bearer auth | LOW |
| `GET /api/insights/:handle` | Internal only | N/A | Yes | LOW |

All external calls: 100% fetch timeout coverage via `AbortSignal.timeout()` or `withTimeout()`. GitHub cache-first path ensures zero GitHub API calls for cached handles within 6h. Bitbucket/Codeberg clients also confirmed with `clearTimeout()` in finally blocks.

## Resource Management

**In-flight Maps (2 active):**
- `_inflight` (`lib/github/client.ts:28`) — bounded by 30s timeout + `.finally()` delete at line 83. `_resetInflight()` exported for test isolation.
- `inflightBadgeRenders` (`app/u/[handle]/badge.svg/route.ts:41`) — deleted in finally block at line 249. No unbounded growth.

**Timers:**
- All `setTimeout` in API routes paired with `clearTimeout()` in finally blocks.
- No server-side `setInterval`. Browser-side `setInterval` in `ClaudeCodeStar.tsx:26` has `return () => clearInterval(id)` cleanup in useEffect.

**In-memory caches:**
- `flagCache` (`lib/feature-flags.ts`) — bounded at ~5–20 entries (one per distinct flag key).
- Badge render schedule array — fixed at 10-element max retry queue.

**Resource leaks:** NONE detected. All async operations bounded by timeout or finally cleanup.

## Vercel Cost Factors

**Serverless functions:** All routes use Node.js serverless runtime. No edge runtime declarations (`export const runtime = 'edge'`) found.

**maxDuration configuration:**

| Route | maxDuration | Status |
|-------|------------|--------|
| `app/u/[handle]/badge.svg/route.ts` | **35s** (line 29) | VERIFIED — P2 resolved May 8 |
| `app/api/cron/warm-cache/route.ts` | 300s (line 30) | Correct for batch processing |
| `app/api/cron/sync-audience/route.ts` | 300s (line 17) | Correct |
| `app/api/cron/process-campaigns/route.ts` | 300s (line 7) | Correct |
| All other routes | Default (15s Vercel Pro) | Appropriate — none approach limit |

**ISR/CDN caching status:** `unstable_cache(revalidate=300s)` in `lib/feature-flags.ts:84-94` confirmed active. 13 pages (about, archetypes/*, cli/authorize) correctly eligible for CDN caching. ISR regression from Apr 30 confirmed resolved.

**Bundle context (from May 7 performance report):** 2,266 KB raw / 706.5 KB gzipped — +34.7% vs Apr 9. Bundle growth source unknown; `ANALYZE=true pnpm run build` recommended before next performance cycle. No chunks exceed 500 KB — no immediate cold-start concern.

## Recommendations

| Priority | Item | File | Action |
|----------|------|------|--------|
| **P2-1 (cycle 12 carry)** | `dbGetCampaignStats()` 4-query parallel COUNT aggregation | `lib/db/campaigns.ts:727-765` | Replace with single GROUP BY RPC. Threshold-gated at >5K sends/campaign — not yet triggered. Carry. |
| **Monitor M7** | `config:` studio key TTL = 1yr per user | `app/api/studio/config/route.ts:73` | Watch at scale. Negligible currently (~200–400 bytes/user, replaced on write). |
| **Monitor M-bundle** | Bundle +34.7% over 4 weeks, source unknown | `next.config.ts` | Run `ANALYZE=true pnpm run build` to identify culprit packages before significant user growth. Informational — no chunk exceeds 500 KB. |
| **Monitor M1–M5 (carried)** | Avatar cache, OG cache, HLL, snapshot row growth, PostHog fire-and-forget | Various | All threshold-gated or bounded. No action needed at current scale. |

**P1s: NONE. P2s: 1 active (P2-1, threshold-gated, cycle 12 carry).**

**Estimated monthly cost at 10K users: ~$50–75/mo. Unchanged.**
