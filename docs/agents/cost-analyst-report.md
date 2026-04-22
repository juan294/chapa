# Cost Analyst Report
> Generated: 2026-04-22T01:04:00Z | Health status: **GREEN**

## Executive Summary
No cost regressions since 2026-04-21. Redis TTL discipline intact, all external API calls remain cache-first with 100% timeout coverage, and database access continues to use a lazy singleton with zero N+1 patterns. Estimated monthly cost at 10K users stays **~$55–70/mo**.

## Redis Usage
Client: lazy singleton at `apps/web/lib/cache/redis.ts:21–37` with no retry (`retries: 0`) — failures surface immediately and fail open.

- **Key patterns audited (all with explicit TTL except noted):**
  | Pattern | TTL | Scope | Source |
  |---|---|---|---|
  | `stats:<handle>` / `svg:<handle>:<theme>` | 21 600s (6h) | per-user | default in `cacheSet` (`redis.ts:68`) |
  | `snapshot:latest:<handle>` | 86 400s (24h) | per-user | `lib/cache/snapshot-cache.ts:16,19` |
  | `craft:<handle>` | 3 600s (1h) | per-user | `lib/cache/craft-cache.ts:17,20` |
  | `avatar:<handle>` | `AVATAR_CACHE_TTL` | per-user | `lib/render/avatar.ts:60,71` |
  | `config:<handle>` | 31 536 000s (1y) | per-user | `app/api/studio/config/route.ts:72` |
  | `sideeffects:done:<handle>:<YYYY-MM-DD>` | 86 400s | per-user-per-day | `lib/profile/public-profile.ts:72` |
  | `ratelimit:<scope>:<key>` | 60–3 600s | per-IP/handle | `redis.ts:170–189` |
  | `cli:device:<code>` | 300s | per-session | `app/api/cli/auth/*` |
  | `sync-audience:contacts` | 3 600s | global | `app/api/cron/sync-audience/route.ts:17–18` |
  | `og:<handle>` | 86 400s | per-user | OG image route |
  | **`cron:warm-cache:offset`** | **∞ (TTL=0)** | single int | `app/api/cron/warm-cache/route.ts:35,106` |
  | **`stats:badges_generated`** | **∞ (INCR counter)** | global | `redis.ts:195,211` |
  | **`stats:unique_badges`** | **∞ (HyperLogLog ~12 KB)** | global | `redis.ts:196,212` |

- **TTL coverage:** 100% on per-user keys. The three unbounded keys are **intentional and bounded by design** (single integer offset, INCR counter, HLL capped ~12 KB).
- **Growth risk:** LOW. No unbounded key fan-out observed.
- **Rate limiter:** fixed-window `INCR + EXPIRE`, fail-open on Redis outage (`redis.ts:170–189`) — documented accepted risk.

## Database Usage
- **Tables: 9** — `users`, `metrics_snapshots`, `verification_records`, `feature_flags`, `merge_operations`, `user_platforms`, `tool_insights`, `email_campaigns`, `campaign_sends`.
- **Views: 2** — `latest_snapshots`, `admin_users` (both `security_invoker = true`, migration `014`).
- **RLS:** enabled on all tables (migration `002_enable_rls.sql`) with explicit deny-all policies for anon (`008_add_rls_deny_policies.sql`). Service-role server client intentionally bypasses RLS.
- **Client management:** lazy singleton at `apps/web/lib/db/supabase.ts` — one `SupabaseClient` per process.
- **Query patterns:** 0 N+1 patterns found. Batch reads via `dbGetLatestSnapshotBatch()` in warm-cache; campaign processing uses `processInBatches()` + `Promise.allSettled`. `dbGetCampaignStats` still does client-side aggregation (**P2-1 carried** — acceptable at current scale).

## External API Calls
| Route | External Service | Cached | Rate Limited | Timeout | Risk |
|-------|-----------------|--------|-------------|---------|------|
| `/api/generate`, `/api/refresh`, `/api/recalculate` | GitHub GraphQL | Yes (6h fresh + 7d stale) | Yes (per-route) | Yes (`withTimeout`) | low |
| `/api/auth/bitbucket/*`, share pipeline | Bitbucket REST | Yes (7d stale fallback) | Token-based | Yes (`clearTimeout` in finally, `bitbucket/queries.ts:34,153`) | low |
| `/api/auth/codeberg/*`, share pipeline | Codeberg REST | Yes (7d stale fallback) | Token-based | Yes (`codeberg/queries.ts:30,115`) | low |
| `/api/webhooks/resend`, campaign sends | Resend | Partial (1h contacts cache) | 20/60s webhook | 30s on contact list | low |
| `/api/telemetry`, cron fire-and-forget | PostHog | n/a (ingest) | n/a | 5s `AbortSignal` (`server-errors.ts`) | low |
| `/api/health` | GitHub probe + Redis dbsize | No (intentional) | 30/60s | 3s / 5s (`redis.ts:263`) | low |

No unconditional external calls in user-facing routes. All user-triggered GitHub fetches go through the cache-first path.

## Resource Management
- **Timers:** `withTimeout()` (`lib/async/with-timeout.ts`) clears its timer in `finally`. Bitbucket/Codeberg query paths clear their own `AbortController` timers in `finally`. `pingRedis` now uses `withTimeout` (`redis.ts:263`). **No raw `Promise.race/setTimeout` leaks.**
- **In-memory caches:**
  - `_inflight` Map in GitHub client — bounded by 30s timeout + explicit clear on settle.
  - `flagCache` Map at `lib/feature-flags.ts:66` — bounded by ~5–10 known flag keys, TTL-refreshed.
  - `trendCache` in `use-trend-data.ts:43` — per-React-component, not module-persistent.
- **No unclosed connections / no unbounded Maps / no large in-memory buffers.**

## Vercel-Specific Factors
- **ISR / revalidate:** `/` → 3 600s, `/u/[handle]` → 3 600s, `/about*` → 86 400s, `/privacy` + `/terms` → 86 400s, `/archetypes/*` → 604 800s.
- **Force-dynamic (intentional):** `/studio`, `/experiments/*` (auth/user-gated).
- **Cron handlers: 4** at `maxDuration = 300` — `warm-cache`, `process-campaigns`, `sync-audience`, plus admin-on-demand `bulk-recalculate`. `warm-cache` caps at 50 handles/run with rotation offset.
- **API routes:** 44 `route.ts` files (multiple export methods per file). No oversized route handlers detected.
- No edge runtime misuse; heavy routes stay serverless where Node APIs (Supabase, Resend SDK, SVG rendering) are required.

## Recommendations
Priority-ordered; all carried from prior cycles, no new items this run.

1. **P2-1 (carried):** Move `dbGetCampaignStats()` client-side aggregation to a Postgres RPC once any campaign exceeds ~5 000 sends. File: `apps/web/lib/db/campaigns.ts:439`. Current aggregation is correct — this is a future-scale concern.
2. **Monitor M1:** Avatar cache (`avatar:*`) Redis memory. Estimate ~300 MB at 10K users.
3. **Monitor M2:** OG image cache (`og:*`) Redis memory. Estimate ~150 MB at 1K active/day.
4. **Monitor M3:** `stats:unique_badges` HyperLogLog ~12 KB. Review quarterly.
5. **Monitor M4:** `metrics_snapshots` table growth (~3.65M rows/year at 10K users). Still comfortable on Supabase free/Pro tiers; revisit partitioning if retention expands past 24 months.

No P1 items open. No action required for GREEN status.
