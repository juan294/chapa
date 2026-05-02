# Cost Analyst Report
> Generated: 2026-05-02 | Health status: **GREEN**

## Executive Summary
Infrastructure footprint remains stable at the ~$55–70/mo @10K-users baseline. The Apr 30 ISR regression has been fully resolved — `dbGetFeatureFlag` is now wrapped in `unstable_cache()` (revalidate=300s, tag=`feature-flags`), restoring CDN caching for `/about/*`, `/archetypes/*`, and other ISR-eligible pages that inherit the root layout. No new Redis prefixes, no new external API surface, no new cron jobs, zero N+1 patterns.

## Redis Usage
- **Key patterns: 28 distinct prefixes** — all bounded by explicit TTLs (1h–24h) except 3 intentional persistent singletons:
  - `cron:warm-cache:offset` (rotation pointer, integer)
  - `stats:badges_generated` (INCR counter)
  - `stats:unique_badges` (HLL ~12 KB)
- **TTL coverage: 25/28 keys (89%)** — the 3 persistent keys are bounded singletons, growth risk LOW.
- **Hot prefixes**: `stats:v2:{merged,github,bitbucket,codeberg}` (24h), `badge:{handle}:{date}` (24h), `history:{handle}:{from}:{to}` (1h), `craft:*` (1h), `snapshot:*` (1h), `avatar:*` (6h), `ff:*` (1h), `supplemental:*` (24h), `ratelimit:*` (15m windows), `sideeffects:done:{handle}:{date}` (daily guard), `sync-audience:contacts` (1h Resend pagination cache).
- **In-memory caches**: `_inflight` Map (`lib/github/client.ts:28`) cleared via `.finally()` + 30s timeout. `flagCache` Map (`lib/feature-flags.ts:77`) bounded by ~5 keys, 5-min TTL. `warmSet` capped MAX_HANDLES=50.
- **Growth risk: LOW.** No unbounded patterns.

## Database Usage
- **Tables: 11** (`users`, `user_platforms`, `admin_users`, `email_campaigns`, `campaign_sends`, `feature_flags`, `metrics_snapshots`, `verification_records`, `supplemental_stats`, `merge_operations`, `tool_insights`) + 2 views (`latest_snapshots`, `admin_users` — both `security_invoker=true`) + 1 RPC (`claim_campaign_sends`).
- **Connection management: singleton lazy client** at `lib/db/supabase.ts:11`, service-role key (intentional for server-side; RLS enforced via deny-all anon policies on all 9 application tables).
- **Query patterns: zero N+1.** Batch fan-in confirmed:
  - `dbGetLatestSnapshotBatch()` at `lib/db/snapshots.ts:325` — single `IN()` query for cron warm-cache.
  - `sync-audience` cron uses `Promise.allSettled([dbGetUsersWithEmail(), listAllContacts()])`.
  - `dbGetCampaignStats()` at `lib/db/campaigns.ts:734-751` — 4 parallel `count` queries (P2 carry; threshold-gated at >5K sends/campaign).

## External API Calls
| Route | External Service | Cached | Rate Limited | Risk |
|-------|-----------------|--------|--------------|------|
| `/api/generate` | GitHub | Yes (6h) | 10/hr/handle | LOW |
| `/api/refresh` | GitHub | No (intentional bypass) | 5/hr + auth | LOW |
| `/api/health` | GitHub probe | No (intentional probe) | 30/60s | LOW |
| `/api/auth/callback` | GitHub OAuth | n/a | OAuth-gated | LOW |
| `/api/auth/bitbucket/*` | Bitbucket | Yes (6h via `lib/bitbucket/client.ts`) | 10–120/15m IP | LOW |
| `/api/auth/codeberg/*` | Codeberg | Yes (6h via `lib/codeberg/client.ts`) | 10–120/15m IP | LOW |
| `/api/cron/warm-cache` | GitHub (batch) | Writes cache | MAX_HANDLES=50, BATCH_SIZE=5 | LOW (≤250 calls/run vs 5K/hr budget) |
| `/api/cron/sync-audience` | Resend | Yes (1h `sync-audience:contacts`) | Cron-only | LOW |
| `/api/webhooks/resend` | Resend (inbound) | n/a | Svix HMAC + idempotency dedup | LOW |
| `/api/telemetry` | PostHog (write-only) | n/a | Fire-and-forget, timeout-protected | LOW |

**Fetch timeout coverage: 100%** — all external calls use `withTimeout()` or `AbortSignal.timeout()`.

## Resource Management
- **Server-side `setInterval`: none.** All `setTimeout` calls paired with `clearTimeout()` in `.finally()` (`lib/async/with-timeout.ts:42`).
- **Module-level state: bounded.** `_inflight` Map cleared via `.finally()` + 30s timeout. `flagCache` Map bounded by ~5 entries. `warmSet` capped MAX_HANDLES=50.
- **No oversized buffers.** Avatar Base64 cached in Redis (6h TTL) and capped per-handle. No uncontrolled `Buffer` allocations in API routes.

## Vercel-Specific Cost Factors
- **Cron handlers: 4** at `maxDuration=300s` — `warm-cache`, `process-campaigns`, `sync-audience`, admin `bulk-recalculate`. Unchanged.
- **Edge runtime: 0 routes** (Redis + Supabase clients require Node).
- **ISR coverage: restored.**
  - `/` revalidate=3600
  - `/u/[handle]` revalidate=3600
  - `/about*` revalidate=86400
  - `/archetypes/*` revalidate=604800 (7d)
  - `/privacy`, `/terms` revalidate=86400
  - `/studio`, `/admin/*` `force-dynamic` (intentional, auth-gated)
- **ISR regression FIXED.** `lib/feature-flags.ts:84-93` confirms `unstable_cache(fetchFlagFromDb, ["feature-flag-v1"], { revalidate: 300, tags: ["feature-flags"] })` wraps the Upstash `no-store` fetch. Root layout's `isStudioEnabled()` no longer leaks dynamic rendering into ISR-eligible pages.
- **No oversized routes.**

## Recommendations
1. **(P3, monitor only)** When DB feature flags are toggled via `/api/admin/feature-flags`, ensure the admin route calls `revalidateTag("feature-flags")` so the new `unstable_cache` data cache propagates within seconds rather than waiting up to 5 min for the data-cache `revalidate: 300` to expire. The in-process `flagCache` is already invalidated; only the Next data cache lags.
2. **(P2 carry)** `dbGetCampaignStats()` 4-query parallel count aggregation (`lib/db/campaigns.ts:734-751`) — migrate to a `GROUP BY status` Postgres RPC once any campaign exceeds ~5K sends. Not yet triggered.
3. **(MONITOR carry)** Avatar cache Redis memory (~300 MB @10K users), OG image cache (~200 MB @1K active/day), `metrics_snapshots` row growth (~3.65M rows/year @10K — 365d retention cron wired), HLL `stats:unique_badges` (~12 KB stable), `withErrorCapture` PostHog spike risk at high error rate (fire-and-forget + timeout-protected).
4. **(P3, performance cross-cutting)** Apr 30 performance report flagged a +194.9 KB bundle growth attributed to a 325 KB layout client-modules entry. No cost-path impact, but quantify Vercel CDN egress next cycle once root cause is identified.
