# Cost Analyst Report
> Generated: 2026-05-03 | Health status: GREEN

## Executive Summary

Cost posture unchanged from the May 2 cycle: estimated ~$55–70/mo at 10K users with no new external surface, no leaks, and no unbounded growth. Since the prior report, the only production-side delta is the `revalidateTag("feature-flags","seconds")` wired into the admin flag PATCH handler — closing the prior P3. All other changes on `develop` are test additions.

## Redis Usage

- **Key prefixes (28 distinct, unchanged)**: `stats:`, `stats:v2:bitbucket:`, `stats:v2:codeberg:`, `stats:dirty:`, `stats:badges_generated`, `stats:unique_badges`, `impact:`, `craft:`, `svg:`, `history:`, `snapshot:`, `supplemental:`, `config:`, `og:`, `avatar:`, `bb:`, `cb:`, `feature-flag:`, `feature-flags:all`, `engagement-flag:`, `dedup:bump:`, `notif:marker:`, `email:dedupe:`, `quota:campaign-daily`, `cli:auth:`, `sideeffects:done:`, `cron:warm-cache:offset`, `sync-audience:contacts`, plus all `ratelimit:*` (TTL via INCR+EXPIRE on first hit).
- **TTL coverage**: 25/28 prefixes (89%). The 3 persistent (TTL=0) keys are bounded singletons:
  - `cron:warm-cache:offset` — single integer, intentionally persistent (warm-cache rotation pointer at `app/api/cron/warm-cache/route.ts:145`)
  - `stats:badges_generated` — single INCR counter
  - `stats:unique_badges` — HyperLogLog, ~12 KB ceiling
- **Per-key TTLs (verified)**:
  - Badge SVG: 6h (`badge-svg-cache.ts:43`)
  - Stats: 6h fresh + 7d stale (`github/client.ts:212-213`)
  - Bitbucket/Codeberg stats: per `CACHE_TTL` (`bitbucket/client.ts:68`, `codeberg/client.ts:80`)
  - Supplemental EMU: 24h Redis hot path (`api/supplemental/route.ts:76`) + Supabase durable
  - Avatar (data URI): 6h (`render/avatar.ts:71`)
  - OG image (Base64): `OG_CACHE_TTL` (`og-image/route.ts:96`)
  - History: `HISTORY_CACHE_TTL` (`history/history.ts:61`)
  - Snapshot: `SNAPSHOT_TTL` (`snapshot-cache.ts:52`)
  - Craft: `CRAFT_CACHE_TTL` (`craft-cache.ts:54`)
  - Studio config: 1 year (31_536_000s) — bounded by user count
  - Feature flags: 5-min `unstable_cache` (`lib/feature-flags.ts:84-92`) + `revalidateTag` on admin write (`api/admin/feature-flags/route.ts:61`)
  - Resend audience contacts: 1h (`api/cron/sync-audience/route.ts:48`)
  - Webhook dedupe: `DEDUPE_TTL_SECONDS` (`api/webhooks/resend/route.ts:98`)
  - Score-bump dedup, notification markers, badge-render lock, sideeffects-done: all TTL-bounded
  - Daily campaign quota: 24h via `cacheReserveQuota` + `cacheIncr(... 86400)`
- **Growth risk**: LOW. No unbounded patterns. Avatar (~300 MB @10K users) and OG image (~200 MB @1K active/day) remain the largest projected memory footprints — both 6h TTL.

## Database Usage

- **Tables**: 11 (`users`, `metrics_snapshots`, `feature_flags`, `engagement_flags`, `supplemental_stats`, `tool_insights`, `email_campaigns`, `campaign_recipients`, `telemetry`, `verification_records`, `user_platforms`) + 2 views + 1 RPC. Unchanged.
- **Connection management**: Single lazy singleton via `getSupabase()` at `lib/db/supabase.ts:11`. No per-request client construction. Service-role key used server-side only.
- **Query patterns**: 0 N+1. Batch reads use single `IN()` query (`dbGetLatestSnapshotBatch` in `snapshots.ts`). Cron warm-cache + sync-audience parallelize independent reads via `Promise.allSettled`.
- **RLS**: ENABLE + FORCE on all 9 user-data tables, with explicit deny-all for anon (per security report 2026-04-20).
- **Retention**: `metrics_snapshots` cleanup wired (~3.65M rows/year @10K users projected).

## External API Calls

| Route | External Service | Cached | Rate Limited | Risk |
|-------|-----------------|--------|-------------|------|
| `/api/auth/callback` | GitHub OAuth | n/a (one-time) | yes (login limiter) | low |
| `/api/auth/bitbucket/callback` | Bitbucket OAuth | n/a | yes | low |
| `/api/auth/codeberg/callback` | Codeberg OAuth | n/a | yes | low |
| `/u/[handle]/badge.svg` | GitHub GraphQL (via `getStats`) | 6h fresh + 7d stale + in-flight dedup | yes | low |
| `/u/[handle]` (share page) | GitHub (via `getStats`) | same as above | yes | low |
| `/u/[handle]/og-image` | Avatar fetch | 6h Base64 cache | indirect | low |
| `/api/refresh` | GitHub | force-bypass (intentional) | 5/hr/user + auth | low |
| `/api/recalculate` | None (DB-only) | — | yes + auth | low |
| `/api/profile/[handle]` | DB only | snapshot cache | 60/60s | low |
| `/api/history/[handle]` | DB only | history cache | yes | low |
| `/api/verify/[hash]` | DB only | — | 30/60s | low |
| `/api/health` | GitHub probe + Redis + Supabase | uncached (intentional) | yes | low — diagnostic |
| `/api/insights/[handle]` | DB only | — | yes | low |
| `/api/cron/warm-cache` | GitHub batch | writes Redis cache | bearer auth | bounded by MAX_HANDLES=50 |
| `/api/cron/sync-audience` | Resend `.list()` | 1h (`sync-audience:contacts`) | bearer auth + 30s timeout | low |
| `/api/cron/process-campaigns` | Resend send | per-day quota via `cacheReserveQuota` | bearer auth | low |
| `/api/webhooks/resend` | None (inbound) | dedup via `cacheSetNx` | yes + Svix HMAC | low |
| `/api/telemetry` | None (inbound, fire-and-forget) | — | yes | low |
| `/api/supplemental` | None (inbound) | writes Supabase + Redis | yes + auth | low |

All external `fetch()` calls use `AbortSignal.timeout()` or `withTimeout()` — 100% timeout coverage (per security 2026-04-20).

## Resource Management

- **Timers**: All `setTimeout` in `lib/async/with-timeout.ts:42` paired with `clearTimeout()` in `.finally()`. No server-side `setInterval`. No leaks.
- **In-flight dedup map**: `_inflight` Map at `lib/github/client.ts:28-82` bounded by 30s timeout + `.finally()` clear.
- **Feature flag in-process cache**: `flagCache` Map ~5 entries; invalidated on admin write.
- **Warm-cache handle set**: `MAX_HANDLES=50` cap enforced.
- **Avatar Base64 cache**: 6h Redis TTL — no in-process buffering.
- **PostHog error capture**: fire-and-forget, timeout-protected via `withErrorCapture` (no blocking, no buffer accumulation).

## Vercel Cost Factors

- **Routes**: 50 API + 24 pages. No oversized routes.
- **Cron**: 4 handlers, all `maxDuration=300s`. No edge-runtime routes (Redis/Supabase clients require Node runtime — correct).
- **ISR**: `/about/*`→86400, `/archetypes/*`→604800, `/`→3600, `/u/[handle]`→3600, `/privacy`+`/terms`→86400. ISR regression from Apr 30 remains FIXED — `lib/feature-flags.ts:84-92` wraps the Upstash fetch in `unstable_cache(..., { revalidate: 300, tags: ["feature-flags"] })`. Admin PATCH busts via `revalidateTag("feature-flags","seconds")` at `api/admin/feature-flags/route.ts:61`.
- **Force-dynamic** (intentional): `/studio` (auth-gated, `app/studio/page.tsx:49`), `/experiments/*` (gated by feature flag, `app/experiments/layout.tsx:7`).

## Recommendations

**P1**: None.

**P2 (carried, threshold-gated, 7th cycle)**:
- `dbGetCampaignStats()` 4-query parallel count aggregation (`lib/db/campaigns.ts:734-751`). Migrate to a `GROUP BY status` RPC at >5K sends/campaign. Not yet triggered. **Acceptable today.**

**Monitor (carried, M1–M5, all bounded)**:
- M1: avatar cache (~300 MB @10K users) — 6h TTL, bounded by user count.
- M2: OG image cache (~200 MB @1K active/day) — 6h TTL, bounded by daily active.
- M3: HLL `stats:unique_badges` (~12 KB ceiling).
- M4: `metrics_snapshots` row growth (~3.65M rows/year @10K users) — cleanup wired.
- M5: `withErrorCapture` PostHog spike risk during incident (fire-and-forget + timeout-protected; revisit if 5xx rate sustained >1%).

No new recommendations this cycle. The prior P3 (`revalidateTag` on admin flag writes) is resolved.

<!-- ENTRY:START agent=cost-analyst timestamp=2026-05-03T03:00:00Z -->
## Cost Analyst — 2026-05-03
- **Status**: GREEN
- Estimated monthly cost at 10K users: **~$55–70/mo**. Unchanged.
- Redis: **28 distinct prefixes**. TTL coverage 25/28 (89%). 3 persistent singletons: `cron:warm-cache:offset`, `stats:badges_generated` (INCR), `stats:unique_badges` (HLL ~12 KB). Growth risk: LOW.
- **P3 RESOLVED**: `revalidateTag("feature-flags","seconds")` now wired to admin PATCH at `app/api/admin/feature-flags/route.ts:61` (commit 4ed82d63). Next.js data cache busts within seconds of a flag write instead of waiting for the 5-min `unstable_cache` TTL. ISR fix from Apr 30 remains intact — `lib/feature-flags.ts:84-92` wraps `dbGetFeatureFlag` in `unstable_cache` with `revalidate: 300` + tag `feature-flags`.
- GitHub API: cache-first unchanged (6h fresh + 7d stale + in-flight dedup at `lib/github/client.ts:28-82`). 100% timeout coverage. Only intentionally uncached: `/api/health` probe + `/api/refresh` (5/hr + auth).
- Supabase: **11 tables + 2 views + 1 RPC** unchanged. Singleton lazy client at `lib/db/supabase.ts:11`. 0 N+1 patterns. `dbGetLatestSnapshotBatch()` single `IN()` query intact.
- External APIs: GitHub / Bitbucket / Codeberg / Resend / PostHog — all cached or rate-limited, all with explicit timeouts. No new external surface since 2026-05-02.
- ISR (verified): `/about*`→86400, `/archetypes/*`→604800, `/`→3600, `/u/[handle]`→3600, `/privacy`+`/terms`→86400. `/studio`, `/experiments/*` `force-dynamic` (intentional, gated).
- Cron: **4 handlers** at maxDuration=300s unchanged. No edge routes. No oversized routes.
- Timers: All `setTimeout` paired with `clearTimeout()` in `.finally()`. No server-side `setInterval`. No leaks.
- In-memory: `_inflight` Map bounded by 30s timeout + `.finally()` clear. `flagCache` Map ~5 entries. `warmSet` MAX_HANDLES=50. Avatar Base64 in Redis (6h TTL).
- **Production code delta since 2026-05-02 cost-analyst report**: NONE. The 12 commits since are test-only additions covering experiment pages, layout/icons, studio, and admin renderers. No new external calls, no new cache keys, no new routes.
- **P1s: NONE. P2s: 1 active.**
- **P2-1 CARRIED (7th cycle)**: `dbGetCampaignStats()` 4-query parallel count aggregation (`lib/db/campaigns.ts:734-751`). Move to `GROUP BY status` RPC at >5K sends/campaign. Not yet triggered.
- **MONITOR M1–M5 CARRIED**: avatar cache, OG image cache, HLL, `metrics_snapshots` row growth, `withErrorCapture` PostHog spike risk — all unchanged.

**Cross-agent recommendations:**
- [Performance]: ISR fix verified intact and admin-flag invalidation now propagates within seconds. Layout-bundle aggregation (`0-v7viuocyjmh.js`, 325 KB) flagged Apr 30 is still the dominant client-side cost — quantify CDN egress next cycle if unchanged.
- [Security]: Fetch timeouts 100%. Fail-open rate limiter intact (`redis.ts:127-149`). Resend webhook 3-layer defense (rate-limit + Svix HMAC + idempotency dedup) intact. `revalidateTag` is admin-auth-gated.
- [Coverage]: `lib/feature-flags.ts` ISR wrapper covered transitively via PATCH handler test (added 2026-05-02 with revalidateTag assertion). `app/api` 98.60%, `lib/db` 97.07% — stable. No cost-path coverage gaps.
<!-- ENTRY:END -->
