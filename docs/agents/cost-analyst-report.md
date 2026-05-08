# Cost Analyst Report
> Generated: 2026-05-08 | Health status: GREEN

## Executive Summary
Stable cycle. All commits since 2026-05-06 are CI metadata, coverage tests, triage docs, and a Dependabot patch bump — zero new Redis writes, external API calls, or Supabase queries. Estimated monthly cost at 10K users remains **~$50–75/mo**. P2 carry: badge route `maxDuration` still missing (4th consecutive cycle).

## Redis Usage
- **Key patterns** (28 distinct prefixes, unchanged from 2026-05-07):
  - Stats/cache: `stats:*`, `svg:*`, `history:*`, `og:*`, `avatar:*`, `metric_snap:*`
  - Coordination: `lock:*`, `inflight:*`, `rateLimit:*`, `quota:*`, `setnx:*`
  - Persistent: `cron:warm-cache:offset`, `stats:badges_generated` (INCR), `stats:unique_badges` (HLL ~12 KB)
  - User-bound: `config:` (1yr TTL), `supplemental:*` (24h)
- **TTL coverage**: 25/28 (89%). 3 intentional persistent singletons.
- **Growth risk**: LOW. No new key prefixes this cycle.
- **Default TTL**: 21,600s (6h) via `cacheSet()` (`lib/cache/redis.ts:69`). Fail-open rate limiter intact.

## Database Usage
- **Tables**: 11 (unchanged) — users, snapshots, supplemental_stats, feature_flags, campaigns, telemetry, tool_insights, user_platforms, verification, admin_users, engagement_flags
- **Query patterns**: 0 N+1 patterns. `dbGetLatestSnapshotBatch()` uses single `IN()` query for cron warm-cache.
- **Connection management**: Singleton lazy client (`lib/db/supabase.ts:14`). One client per process.
- **RLS**: 9 tables FORCE RLS + deny-anon (per security agent 2026-04-20).

## External API Calls
| Route | External Service | Cached | Rate Limited | Risk |
|-------|------------------|--------|--------------|------|
| `/u/[handle]/badge.svg` | GitHub GraphQL | Yes (6h fresh + 7d stale + inflight dedup) | Yes (per IP) | **P2: no `maxDuration`** |
| `/api/refresh` | GitHub GraphQL | Bypasses cache | 5/hr + auth | LOW |
| `/api/health` | GitHub probe | No (intentional) | Yes | LOW |
| `/api/auth/callback` | GitHub OAuth | N/A (one-time) | Yes | LOW |
| `/api/auth/bitbucket/callback` | Bitbucket OAuth | N/A | Yes | LOW |
| `/api/auth/codeberg/callback` | Codeberg OAuth | N/A | Yes | LOW |
| `/api/cron/sync-audience` | Resend API | N/A (cron) | maxDuration=300s | LOW |
| `/api/cron/process-campaigns` | Resend API | N/A (cron) | maxDuration=300s | LOW |
| `/api/telemetry` | PostHog (server) | N/A | Yes (fire-and-forget) | LOW |
| `/api/webhooks/resend` | (inbound) | N/A | HMAC + IP allowlist | LOW |

All external fetches use `AbortSignal.timeout()` or `withTimeout()` wrappers — 100% timeout coverage.

## Resource Management
- `_inflight` Map (`lib/github/client.ts:28-84`): bounded by 30s timeout + `.finally()` clear.
- `inflightBadgeRenders` Map: cleared in finally.
- `flagCache`: bounded ~5–20 entries (one per feature flag).
- All `setTimeout` paired with `clearTimeout()` in finally blocks. No server-side `setInterval`.
- 0 connection leaks observed.

## Vercel-Specific Cost Factors
- **Cron handlers (3)**: all at `maxDuration=300s` (warm-cache, sync-audience, process-campaigns) + admin/bulk-recalculate.
- **Edge routes**: none.
- **ISR**: feature-flag lookups wrapped in `unstable_cache(revalidate=300s)` (`lib/feature-flags.ts:84-94`) — 13 pages eligible for CDN caching.
- **Bundle size** (per Performance 2026-05-07): 2,266 KB raw / 706.5 KB gzipped — +34.7% vs Apr 9. Cost-relevant only via cold-start memory; not a billing driver yet.

## Recommendations

### P2 (carried — 4th cycle, not blocking)
1. **Badge route `maxDuration` missing** — `apps/web/app/u/[handle]/badge.svg/route.ts` has no `export const maxDuration`. Vercel default is 10s; internal `INFLIGHT_TIMEOUT_MS=30s` exceeds this — cold-path renders silently killed at 10s. **Fix**: add `export const maxDuration = 35;` near the top of the file (alongside other route-level constants). Cost impact: minor — currently we pay for ≤10s invocations that never complete the work.
2. **`dbGetCampaignStats()` 4-query parallel COUNT aggregation** (`lib/db/campaigns.ts:727-765`). Threshold-gated at >5K sends/campaign — not triggered. Replace with a single `GROUP BY status` RPC when the threshold is approached.

### Monitors (carried, no action)
- **M1** Avatar cache (~300 MB @10K users)
- **M2** OG image cache (~200 MB @1K active/day)
- **M3** HyperLogLog (~12 KB)
- **M4** `metrics_snapshots` row growth (~3.65M rows/year @10K — cleanup wired)
- **M5** `withErrorCapture` PostHog spike risk (fire-and-forget, timeout-protected)
- **M7** `config:` TTL = 1yr per user (`/api/studio/config/route.ts`) — negligible at current scale.

<!-- ENTRY:START agent=cost-analyst timestamp=2026-05-08T03:00:00Z -->
## Cost Analyst — 2026-05-08
- **Status**: GREEN
- Estimated monthly cost at 10K users: **~$50–75/mo**. Unchanged.
- Redis: **28 distinct prefixes**, TTL coverage 25/28 (89%). 3 persistent singletons unchanged. Growth risk: LOW.
- **Commits this cycle** (3d344cda, 1ff1c9e2, 34062680, 6e496747, ba1b1568, 8f6fe87a, 1396fda5, 25573aba): CI metadata fix + coverage tests (archetype/cli/i18n) + triage docs + Dependabot patch bump (jsdom, supabase-js, posthog-js) + Spanish share-menu i18n. Zero new Redis writes, zero new external API calls, zero new Supabase queries, zero new env-derived cost surface.
- **P2 (4th cycle, escalated) — Badge route `maxDuration` missing**: `app/u/[handle]/badge.svg/route.ts` confirmed still no `export const maxDuration`. Vercel default 10s vs internal `INFLIGHT_TIMEOUT_MS=30s` mismatch unchanged. Fix: `export const maxDuration = 35;`. Performance agent has flagged this in parallel (3rd cycle on their side). Recommend triage assign this cycle.
- **P2-1 CARRIED (11th cycle)**: `dbGetCampaignStats()` 4-query parallel COUNT (`lib/db/campaigns.ts:727-765`). Threshold-gated at >5K sends/campaign. Not triggered.
- GitHub API: cache-first unchanged (6h fresh + 7d stale + in-flight dedup). 100% timeout coverage. `_inflight` Map bounded by 30s + `.finally()` clear (`lib/github/client.ts:28-84`).
- Supabase: **11 tables** confirmed, singleton lazy client at `lib/db/supabase.ts:14`. 0 N+1 patterns.
- Feature flags: `unstable_cache(revalidate=300s)` confirmed (`lib/feature-flags.ts:84-94`). No regression.
- **MONITORS M1–M5, M7 CARRIED** unchanged.

**Cross-agent recommendations:**
- [Performance]: Badge `maxDuration` is now P2 in both cost and performance cycles for 3+ cycles. One-line fix; recommend triage prioritize. Bundle +34.7% growth in 4 weeks (per Perf 2026-05-07) does not yet hit billing — but worth `ANALYZE=true pnpm run build` to identify culprit before next cycle.
- [Security]: Fetch timeouts 100%. Fail-open rate limiter intact. Resend webhook 3-layer defense intact. `lib/env.ts` typed getters trim invisible chars on all env reads. No new attack surface.
- [Coverage]: `app/api` 97.5%, `lib/db` 96.5%, `lib/cache` 98.1% — stable. No cost-path coverage gaps. Badge cold-path (the `maxDuration` gap) has no specific test; low priority since the fix is a single declaration.
<!-- ENTRY:END -->
