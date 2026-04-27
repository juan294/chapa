# Cost Analyst Report
> Generated: 2026-04-27 | Health status: GREEN

## Executive Summary
Infrastructure posture unchanged from 2026-04-26: Redis TTLs at 100% on per-user keys, all external API calls cache-first or rate-limited with explicit timeouts, Supabase access singleton with no N+1 patterns, no edge runtime usage, no oversized routes. Estimated monthly cost at 10K users remains **~$55–70/mo**. One P2 carried (`dbGetCampaignStats` 4-query aggregation), four monitor items carried (avatar / OG / HLL / metrics_snapshots).

## Redis Usage

### Key patterns (16 prefixes audited, all bounded)

| Prefix | TTL | Site | Notes |
|--------|-----|------|-------|
| `stats:v2:merged:<handle>` | 6h (21600s) | `lib/github/client.ts:51` | Per-user GitHub stats |
| `stats:badges_generated` | persistent (TTL=0) | `lib/cache/redis.ts:242` | Single INCR counter |
| `stats:unique_badges` | persistent (TTL=0) | `lib/cache/redis.ts:243` | HyperLogLog (~12 KB max) |
| `avatar:<handle>` | 6h | `lib/render/avatar.ts:60,71` | Base64 data URI |
| `badge:<v>:<handle>:<theme>:<date>` | 24h (86400s) | `app/u/[handle]/badge.svg/route.ts:105` | Date-keyed, bounded by TTL |
| `badge-lock:<v>:<handle>:<theme>:<date>` | 30s | `app/u/[handle]/badge.svg/route.ts:96` | SETNX render guard |
| `config:<login>` | 1y (31536000s) | `app/api/studio/config/route.ts:72` | Studio badge config (1 per user) |
| `craft:<v>:<handle>` | 1h (3600s) | `lib/cache/craft-cache.ts:54,72` | Tool insights |
| `snapshot:<v>:latest:<handle>` | 1h | `lib/cache/snapshot-cache.ts:52,70` | Daily snapshot |
| `history:<handle>` / `history:<handle>:<from>:<to>` | 1h | `lib/history/history.ts:61` | Range-keyed, bounded by TTL |
| `ratelimit:*` (24 distinct keys) | 60s–86400s | various API routes | All have explicit windows |
| `supplemental:<handle>` | 24h | `app/api/supplemental/route.ts:76` | EMU stats |
| `sync-audience:contacts` | 1h | `app/api/cron/sync-audience/route.ts:46` | Resend contact list |
| `cron:warm-cache:offset` | persistent (TTL=0) | `app/api/cron/warm-cache/route.ts:107` | Single integer (round-robin offset) |
| `sideeffects:done:<handle>:<date>` | 24h | tested in `lib/cache/redis.test.ts:591` | Once-per-day SETNX guard |
| `og-image:<handle>` | 24h | `app/u/[handle]/og-image/route.ts:96` | Rendered PNG |
| `feature-flag:all` / `feature-flag:<key>` | 1h | `lib/db/feature-flags.ts:98,140` | Bounded by fixed flag set (~5–10 entries) |
| `quota:email-send:<user>` | 24h | `lib/email/campaigns.ts:86` | Per-user daily quota |
| `dirty-stats:<handle>` | 1s | `lib/cache/dirty-stats.ts:22` | Cross-request hint |

### TTL coverage
- **100% TTL coverage** on every per-user / per-handle / per-IP key.
- 3 persistent (TTL=0) keys, all intentional and bounded:
  - `cron:warm-cache:offset` — single integer
  - `stats:badges_generated` — single INCR counter
  - `stats:unique_badges` — HyperLogLog, bounded ~12 KB regardless of cardinality

### Growth risk: LOW
- Date-keyed prefixes (`badge:...:<date>`, `history:...:<from>:<to>`, `sideeffects:done:...:<date>`) are linear in unique users × days but capped by 24h/1h TTLs — old keys auto-expire faster than new dates accumulate.
- Per-user keys all per-handle, expire on TTL — no per-call key explosion.
- No glob/scan loops anywhere in the codebase — no risk of orphan key buildup.

## Database Usage

### Tables (11 referenced across `lib/db/`)
`users`, `metrics_snapshots`, `campaign_sends`, `email_campaigns`, `feature_flags`, `user_platforms`, `supplemental_stats`, `verification_records`, `merge_operations`, `tool_insights`, `admin_users` (view).

Plus 2 views (`latest_snapshots`, `admin_users`) with `security_invoker=true`, and 1 RPC (`claim_campaign_sends`).

### Query patterns
- **0 N+1 patterns confirmed**. Critical hot path verified: `app/api/cron/warm-cache/route.ts:113` pre-fetches all previous snapshots in one `dbGetLatestSnapshotBatch()` call instead of looping per-handle.
- Cleanups: `dbCleanOldSnapshots()` (365d retention), `dbCleanExpiredVerifications()`, `dbCleanExpiredMergeOperations()` — all wired into warm-cache cron, fire-and-forget.

### Connection management
- **Singleton lazy client** at `lib/db/supabase.ts` — created once per process, reused across requests.
- Lazy init reads env at runtime (avoids import-time failures in tests).
- Same pattern for Redis (`lib/cache/redis.ts:19`), Resend, PostHog — no per-request connection overhead.

## External API Calls

| Route / Module | Service | Cached | Rate Limited | Timeout | Risk |
|----------------|---------|--------|--------------|---------|------|
| `lib/github/queries.ts:45` | GitHub GraphQL | 6h fresh + 7d stale + in-flight dedup | Upstream (5K/hr OAuth) | 15s `AbortSignal.timeout` + 30s `withTimeout` | LOW |
| `lib/render/avatar.ts:29` | GitHub avatars CDN | 6h | Hostname/MIME whitelist | 5s inline abort | LOW |
| `app/api/health/route.ts:30` | GitHub `/rate_limit` | none (intentional probe) | 30/60s per IP | 3s | LOW |
| `lib/bitbucket/queries.ts:184,335` | Bitbucket API | 6h via `lib/bitbucket/client.ts:67` | per-OAuth-user | wrapped via `withTimeout` | LOW |
| `lib/auth/bitbucket.ts:149,242` | Bitbucket OAuth | n/a | OAuth flow rate | with timeout | LOW |
| `lib/codeberg/queries.ts:137,161` | Codeberg API | 6h via `lib/codeberg/client.ts:79` | per-OAuth-user | wrapped via `withTimeout` | LOW |
| `lib/auth/codeberg.ts:130,211` | Codeberg OAuth | n/a | OAuth flow rate | with timeout | LOW |
| `lib/email/resend.ts:126` | Resend API | n/a | per-user 86400s quota | retry+timeout | LOW |
| `lib/analytics/server-errors.ts:133,170` | PostHog | n/a (write-only) | none (write-only) | timed | LOW |

**Coverage**: 100% timeout coverage (every external `fetch` is bounded). 100% cache-first or write-only — no read path hits an external API without checking Redis first.

**GitHub-impact routes** (4): `/api/generate` (10/hr/handle), `/api/refresh` (5/hr/handle), `/api/health` (probe, 30/60s/IP), `/api/cron/warm-cache` (max 50 handles/run, batch 5).

## Resource Management

### In-memory module-level state (audited 8 sites)
| Variable | Bound / Eviction |
|----------|------------------|
| `_redis`, `_client`, `_resend`, `_posthog`, `_cachedSegmentId` | Singletons (negligible) |
| `_inflight` (`lib/github/client.ts:28`) | `Map<key, Promise>` — entries removed in `.finally()` (`client.ts:82`); 30s `INFLIGHT_TIMEOUT_MS` upper bound; max ~50 concurrent (warm-cache batch size) |
| `inflightBadgeRenders` (`app/u/[handle]/badge.svg/route.ts:36`) | Cleaned on render-promise resolution; bounded by 30s `badge-lock` SETNX TTL |
| `flagCache` (`lib/db/feature-flags.ts`) | Bounded by fixed flag set (~5–10 entries) |
| `warmSet` in warm-cache | Bounded to MAX_HANDLES=50 |

### Timers
- All `setTimeout` / `AbortController` paired with cleanup; server-side timers go through `withTimeout()` finally (`lib/async/with-timeout.ts`).
- `pingRedis` uses `withTimeout` (`lib/cache/redis.ts:310`).
- **No leaks identified.**

### Cron / serverless
- 4 cron handlers, all `maxDuration=300s`: `warm-cache`, `process-campaigns`, `sync-audience`, admin `bulk-recalculate`.
- 0 edge-runtime routes (Redis/Supabase clients require Node runtime — appropriate decision).
- ISR coverage stable: `/about*` 86400, `/archetypes/*` 604800, `/` and `/u/[handle]` 3600, `/privacy`+`/terms` 86400.
- `/studio` `force-dynamic` (auth-gated, intentional).

## Carried items

### P2-1 (carried, threshold-gated)
- **`dbGetCampaignStats()` 4-query parallel `count` aggregation** at `lib/db/campaigns.ts:727-765`.
- Status: acceptable today. Migration to a `GROUP BY status` Postgres RPC is recommended once any campaign exceeds **>5K sends**. Below that threshold the 4 indexed `count(*)` head-scans are negligible.

### Monitor items (carried, all bounded)
- **M1 — avatar cache**: ~300 MB at 10K active users (6h TTL × 30 KB/avatar). Bounded.
- **M2 — OG image cache**: ~150 MB at 1K active/day (24h TTL × 150 KB/PNG). Bounded.
- **M3 — HLL `stats:unique_badges`**: ~12 KB max regardless of cardinality.
- **M4 — `metrics_snapshots` row growth**: ~3.65M rows/year at 10K users; 365d retention enforced via `dbCleanOldSnapshots()` in warm-cache cron (`route.ts:175`). Bounded.

### Observation (carried)
- `/api/webhooks/resend` has no rate limit but is Svix-signature-verified end-to-end. Acceptable as is; flagged so future changes do not open an unauthenticated path.

## Recommendations

### Now
- None. All P1 actionable items remain closed.

### Soon (threshold-gated)
- **P2-1**: Migrate `dbGetCampaignStats` from 4× `count` head-scans to a single `GROUP BY status` Postgres RPC when any campaign exceeds 5K sends.

### Continue monitoring
- M1 (avatar cache MB), M2 (OG image cache MB), M4 (`metrics_snapshots` row count) — quarterly review.

<!-- ENTRY:START agent=cost-analyst timestamp=2026-04-27T03:00:00Z -->
## Cost Analyst — 2026-04-27
- **Status**: GREEN
- Estimated monthly cost at 10K users: **~$55–70/mo**. Unchanged.
- Redis: TTL 100% on per-user / per-handle / per-IP keys. 16 distinct prefixes audited; 3 persistent (TTL=0) keys — `cron:warm-cache:offset` (int), `stats:badges_generated` (INCR), `stats:unique_badges` (HLL ~12 KB). All intentional, bounded. Date-keyed `badge:{...}:{date}` and `history:{handle}:{from}:{to}` linear-but-bounded by 24h/1h TTLs. Growth risk: LOW.
- GitHub API: cache-first (6h fresh + 7d stale + in-flight dedup). 100% timeout coverage via `withTimeout` + `AbortSignal.timeout`. Only uncached call remains `/api/health` GitHub probe (intentional, 3s timeout, 30/60s rate-limited).
- Supabase: **11 tables** (users, metrics_snapshots, campaign_sends, email_campaigns, feature_flags, user_platforms, supplemental_stats, verification_records, merge_operations, tool_insights) + 2 views (`latest_snapshots`, `admin_users`, both `security_invoker=true`) + 1 RPC (`claim_campaign_sends`). Singleton lazy client at `lib/db/supabase.ts`. 0 N+1 patterns. `dbCleanOldSnapshots()` invoked from warm-cache cron at `route.ts:175` — 365d retention.
- External APIs: GitHub / Bitbucket / Codeberg / Resend / PostHog — all cached or rate-limited, all with explicit timeouts. Bitbucket/Codeberg query paths in dedicated modules (`lib/bitbucket/client.ts`, `lib/codeberg/client.ts`).
- ISR: `/about*`→86400, `/archetypes/*`→604800, `/`→3600, `/u/[handle]`→3600, `/privacy`+`/terms`→86400. `/studio` `force-dynamic` (intentional, auth-gated).
- Cron: **4 handlers** at maxDuration=300s — `warm-cache`, `process-campaigns`, `sync-audience`, admin `bulk-recalculate`. No edge routes. No oversized routes.
- Timers: All `setTimeout`/AbortController paired with cleanup; server-side timers go through `withTimeout()` finally. No leaks.
- In-memory: `_inflight` Map bounded by 30s timeout + explicit `.finally()` clear (`lib/github/client.ts:82`). `inflightBadgeRenders` bounded by 30s `badge-lock` SETNX TTL. `flagCache` bounded by fixed flag set (~5–10 entries). `warmSet` bounded to MAX_HANDLES=50.
- **P1s: NONE. P2s: 1 active.**
- **P2-1 CARRIED**: `dbGetCampaignStats()` 4-query parallel `count` aggregation (`lib/db/campaigns.ts:727-765`). Move to `GROUP BY status` Postgres RPC at >5K sends/campaign.
- **MONITOR M1–M4 CARRIED**: avatar cache (~300 MB @10K users), OG image cache (~150 MB @1K active/day), HLL (~12 KB), `metrics_snapshots` row growth (~3.65M rows/year @10K users — cleanup wired, retention 365d).
- **Observation**: `/api/webhooks/resend` has no rate limit but is Svix-signature-verified end-to-end. Acceptable as is; flagged so future changes do not open an unauthenticated path.

**Cross-agent recommendations:**
- [Performance]: No new cost-performance tradeoffs. ISR coverage and `force-dynamic` set unchanged. No edge-route opportunities — Redis/Supabase clients require Node runtime.
- [Security]: Fetch timeouts 100%. Fail-open rate limiter intact (`redis.ts:127-149`). Resend webhook lacks rate limiting but Svix-verified — no cost-security conflict.
- [Coverage]: app/api 97.34%, lib/db 96.48% (per 2026-04-27 coverage report) — stable. No cost-critical path coverage gaps. `dbGetCampaignStats` (P2-1) is a scale concern, not a correctness one.
<!-- ENTRY:END -->
