# Cost Analyst Report
> Generated: 2026-07-09 | Health status: green

## Executive Summary
The 13-commit delta since the 2026-07-08 cycle (HEAD `3b953903` → `3a619e26`, the v2.17.0 release + observability/security batch) is **cost-neutral to cost-reducing**: the landing page (highest-traffic route) is now statically rendered with ISR, and the only new recurring workload is a once-daily synthetic latency probe. Estimated monthly cost at 10K users holds at **~$50–75/mo**.

## Cost-Surface Delta (since 2026-07-08 cycle)

Audited commit-by-commit:

| Commit | Change | Cost impact |
|--------|--------|-------------|
| `767c1a3e` | Landing page `force-static` + `revalidate: 3600` (#982) | **Reducing** — `/` no longer invokes a serverless function per request; served from CDN/ISR, re-rendered at most hourly. Locale/OAuth-error params moved client-side (`LandingPageClient.tsx`). |
| `ba66bea1` | Badge route `Server-Timing` header + `/api/cron/latency-check` (#974) | **Negligible** — header formatting is in-memory string work per response; the cron adds 1 probe/day (`maxDuration: 60`, 10s abort) that hits `badge.svg?__chapa_smoke=1` (read-only smoke param — no snapshot persistence, no cache writes). ~30 extra badge invocations/month. |
| `f260a00a` | `reconcileSnapshotWrite` saga (#975) | **Neutral** — same two writes as before (Supabase + Redis mirror); adds one webhook `captureOperationalAlert` call only on genuine partial failure (incident-bounded). `isRedisConfigured()` guard avoids false alerts on unconfigured deployments. |
| `0cd25d86` | `rateLimit` → `rateLimitStrict` on `/api/auth/session` (60/min/IP) and `/api/refresh` (5/hr/handle) | **Neutral** — identical Redis op count; only the Redis-unavailable behavior changed (fail-closed). Availability tradeoff accepted as a security fix, not a cost item. |
| `5b4bc7c6` | Health probe now queries `metrics_snapshots` (select + order + limit 1) instead of `users` (#976) | **Negligible** — marginally heavier indexed query on a rate-limited health route. |
| `2895a761`, `3a619e26` | `buildStatsFrom*` pipeline extraction, i18n typed accessors | **Neutral** — pure refactors, no new I/O. |
| `49342fdf` | Supplemental stats magnitude caps (#985) | **Neutral** — validation only; marginally *reduces* garbage-data persistence risk. |
| `e6ec78bf` | ADR only (no middleware) | None. |

## Redis Usage
- Key patterns (by producer): `stats:<handle>` + `stats:stale:<handle>` (GitHub stats, 6h/7d), `svg:*` via `badge-svg-cache` (24h + jitter), `supplemental:<handle>` (24h, Supabase-backed), `history:*` / snapshot cache, `craft:*`, `avatar:*`, `og:*`, `flags:*`, `cli:device:*`, `ratelimit:*` (pipeline INCR+EXPIRE), `stats:dirty:<handle>` (1h), cron heartbeats, email dedup markers, platform negative-cache keys.
- TTL coverage: **35 non-redis-module `cacheSet()` call sites; 34/35 (97%) pass an explicit positive TTL**; the default parameter is 21,600s (`redis.ts:82`), so nothing falls through to no-expiry. The single TTL-0 site remains the intentional `cron:warm-cache:offset` rotation cursor (`warm-cache/route.ts:148`) — a fixed-size overwrite-in-place key, not additive.
- Rate limiter: `rateLimit`/`rateLimitStrict` use pipelined INCR+EXPIRE (`redis.ts:262-273`) — every rate-limit key expires.
- New this cycle: `isRedisConfigured()` helper (pure env check, no I/O). Zero new key patterns.
- Growth risk: **LOW** — no unbounded patterns. Bounded direct-redis singletons unchanged (`stats:badges_generated` INCR counter, `stats:unique_badges` HLL ~12 KB).

## Database Usage
- Tables: **11 tables + 2 views, 28 migrations** (028 = service-role grants; no new tables this cycle).
- Query patterns: efficient — no N+1 detected. `dbGetLatestSnapshot`-shaped reads are select+order+limit on indexed columns; the health probe now mirrors that shape. `reconcileSnapshotWrite` performs the same single durable write (insert or replace) as before, just wrapped in an observable envelope. `dbGetCampaignStats` 4-parallel-COUNT (P2-1) carried, monitor-only (admin surface, threshold-gated).
- Connection management: lazy singleton (`lib/db/supabase.ts`), `server-only`, `persistSession: false`, all queries under `withTimeout` — unchanged and correct for serverless.

## External API Calls
| Route | External Service | Cached | Rate Limited | Risk |
|-------|-----------------|--------|-------------|------|
| `/u/:handle/badge.svg` | GitHub GraphQL (+ linked platforms) | 6h primary + 7d SWR stale, SVG cache 24h, in-flight dedup + Redis lock | Yes (on cache miss only) | Low |
| `/api/cron/warm-cache` | GitHub GraphQL | Writes cache; rotation-bounded batch | CRON_SECRET | Low |
| `/api/cron/latency-check` (new) | Own badge endpoint (1 fetch/day) | n/a (synthetic, read-only smoke param) | CRON_SECRET | Low |
| `/api/refresh` | GitHub GraphQL | Busts + rewrites cache | **Strict** 5/hr/handle (now fail-closed) | Low |
| `/api/auth/session` | — (Redis only) | n/a | **Strict** 60/min/IP (now fail-closed) | Low |
| `/api/health` | GitHub probe + Supabase + Redis | 60s probe cache | Yes | Low |
| `/api/challenge` | Resend | n/a | Strict IP 5/hr + handle 3/day | Low |
| Cron sync-audience / process-campaigns | Resend | Contacts cached; heartbeat keys | CRON_SECRET | Low |
| Telemetry/analytics | PostHog | Fire-and-forget, dedup-marker guarded | Per-handle | Low |

**Uncached external calls: 0** (excluding fire-and-forget analytics and the intentional daily synthetic probe).

## Resource Management
- No leaks found. Fresh grep: **0 `setInterval` in server code** (`app/api`, `lib`); all intervals are client components with cleanup.
- `inflightBadgeRenders` Map remains self-clearing per request (documented accepted risk).
- Latency-check probe drains the response body and uses `AbortSignal.timeout(10_000)` — no dangling fetches; `maxDuration: 60` caps the function.
- **P3-1 carried (unchanged)**: the `fetchStats` rejection path (`client.ts:174-181`) serves stale without refreshing the primary key — during a transient GitHub partial-degradation incident, uncached handles refetch per origin request until healed. Bounded by CDN s-maxage + in-flight dedup. Fix remains: mirror the 6h stale re-cache or add a short negative-cache.

## Vercel-Specific Cost Factors
- **Function sizes/durations**: badge `maxDuration=35`; `bulk-recalculate` + 3 crons at 300; new `latency-check` correctly scoped to **60** (not 300) — good hygiene. 4 crons total, all daily.
- **Landing page now static** (`force-static`, `revalidate: 3600`): the single biggest invocation-count route moved from per-request serverless to CDN/ISR. This is the most material cost improvement of the cycle.
- **Caching headers**: badge `s-maxage=21600 / SWR=86400` (success), `300/600` (error) — unchanged. The added `Server-Timing` header does not affect cacheability.
- **Bundle**: landing page was restructured into `LandingPageClient.tsx` (501 lines, client component) — content moved rather than added; carried figure 2,079 KB raw / 659 KB gzipped remains below the 2,300 KB `ANALYZE=true` trigger, but the next performance cycle should re-measure since `/` shifted server → client rendering.

## Recommendations
1. **(P3, carried)** Add a short negative-cache or stale re-cache on the `fetchStats` rejection path (`apps/web/lib/github/client.ts:174-181`) to bound refetch churn during GitHub partial-degradation incidents.
2. **(P3, new — monitor only)** The `reconcileSnapshotWrite` P2 alert fires per divergent write; during a sustained Redis outage on a busy day this could emit one webhook call per snapshot write. If it ever gets noisy, add a per-incident dedup marker (same pattern as email dedup keys). Not worth building preemptively.
3. **(P2-1, carried, monitor-only)** `dbGetCampaignStats` 4-parallel-COUNT — revisit only if `campaigns/sends.ts` changes or campaign volume grows.
4. **(Info)** Ask the performance agent to re-baseline First Load JS next cycle: the landing-page static refactor moved ~475 lines of server JSX into `LandingPageClient.tsx`; the visitor-facing chunk composition changed even if totals look flat.
