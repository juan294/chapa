# Cost Analyst Report
> Generated: 2026-05-26 | Health status: green

## Executive Summary

Pure carry/audit cycle with one material improvement: the long-standing P3 (uncached GitHub probe in `/api/health`) was resolved in commit `dc0b7261` — `pingGitHub` is now wrapped in `unstable_cache(revalidate=60)` at `apps/web/app/api/health/route.ts:56-58`, so concurrent health probes share a single outbound GitHub call. No new cost regressions. Estimated monthly cost at 10K users remains **~$50–75/mo**.

## Redis Usage

- **Key patterns**: 16 production prefixes + 3 persistent singletons. 25/28 keys have explicit TTLs (89%).
  - `stats:<handle>` (24h), `svg:<handle>:<theme>` (24h), `history:<handle>` (24h)
  - `rate:<scope>:<id>` (60s window), `inflight:<handle>` (30s), `supplemental:<handle>` (24h)
  - `stats:dirty:<handle>` (1h), `config:<handle>` (1y, PUT-replaces)
  - `feature-flag:<key>` (300s via `unstable_cache`)
- **TTL coverage**: 89%. `cacheSet()` defaults to 21,600s; all call sites pass an explicit TTL. `cacheIncr()` always refreshes TTL (race-safe).
- **Growth risk**: LOW. No unbounded patterns. `config:` 1y TTL is replace-by-PUT (no accumulation).

## Database Usage

- **Tables**: 11. All have `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY` + deny-all anon (latest migration `025_force_supplemental_stats_rls.sql`).
- **Query patterns**: Efficient. Critical path uses singleton lazy client; reads are cache-first via Redis. Lone outlier (`dbGetCampaignStats`) is threshold-gated (see P2-1).
- **Connection management**: Singleton lazy client at `apps/web/lib/db/supabase.ts:14`, guarded by `import "server-only"` (line 8). One client instance per serverless invocation — never per-request.

## External API Calls

| Route | External Service | Cached | Rate Limited | Risk |
|-------|------------------|--------|--------------|------|
| `/u/[handle]/badge.svg` | GitHub GraphQL | Yes (6h + 7d stale) | Yes (in-flight dedup) | Low |
| `/api/refresh` | GitHub GraphQL | Yes (write-through) | Yes (Redis) | Low |
| `/api/generate` | GitHub GraphQL | Yes | Yes | Low |
| `/api/profile/[handle]` | Redis only | Yes | Yes (60/60s) | Low |
| `/api/verify/[hash]` | Redis only | Yes | Yes (30/60s) | Low |
| `/api/health` | GitHub `/rate_limit` | **Yes (60s, NEW)** | Yes | Low |
| `/api/auth/callback` | GitHub OAuth | N/A (per-login) | Yes | Low |
| `/api/cron/warm-cache` | GitHub GraphQL | Writes cache | Bearer-gated | Low |
| `/api/cron/process-campaigns` | Resend | N/A (writes) | Bearer-gated | Low |
| `/api/cron/sync-audience` | Resend | N/A (writes) | Bearer-gated | Low |
| `/api/webhooks/resend` | None (HMAC ingress) | N/A | HMAC verified | Low |
| `/api/telemetry` | None (ingress) | N/A | Yes | Low |

## Resource Management

- **Connections**: Supabase singleton; Upstash uses REST (no socket lifecycle). No leaks.
- **In-memory state**: `_inflight` Map for GitHub fetch dedup — bounded by 30s TTL key, cleared after resolve.
- **Fetch timeouts**: 100% coverage — every outbound `fetch` uses `AbortSignal.timeout()`. Verified for GitHub probe (3s), Resend, OAuth callbacks.
- **Rate limiter**: Fail-open by design (availability over correctness) — documented in `lib/cache/redis.ts`. Secondary protection via GitHub API limits + CDN caching.

## Vercel Cost Factors

- **Serverless function sizes**: 0 routes >500 KB First Load JS (per perf 2026-05-14). Bundle flat 8/8 cycles at 2,266 KB raw / 706 KB gzipped.
- **`maxDuration`**: Badge route holds `maxDuration = 35` at `app/u/[handle]/badge.svg/route.ts:29` — 11th cycle hold.
- **ISR coverage**: 13 archetype/about pages CDN-eligible via `unstable_cache(revalidate=300)` at `lib/feature-flags.ts:84-94`.
- **Edge vs serverless**: All API routes serverless (Node runtime) — correct for current dependencies (Sharp, resvg, Supabase service-role).

## Recommendations

### Active carries
- **P2-1 (threshold-gated, cycle 26)** — `dbGetCampaignStats()` at `lib/db/campaigns.ts:730-770` uses 4 parallel COUNT queries per campaign. Threshold comment in source at lines 720-726. Replace with a single `GROUP BY status` RPC when any campaign exceeds ~5K sends. Not yet triggered.

### Monitors
- **M-bundle (carry)** — Bundle 2,266 KB raw / 706 KB gzipped, flat 8 cycles. Sustained +34.7% over 4 weeks unresolved. `ANALYZE=true pnpm run build` still needs interactive run to localize source. No chunk ≥500 KB — informational only.
- **M-config-TTL (carry)** — `config:<handle>` 1y TTL (31,536,000s). PUT replaces — no accumulation, but worth periodic review.

### Resolved this cycle
- **P3 (cycle 11) — RESOLVED** — `/api/health` GitHub probe now cached via `unstable_cache(revalidate=60)`. Concurrent probes share one outbound call. Implemented in `dc0b7261`.

### P1s
- **None.**

<!-- SHARED_CONTEXT_START -->
## Cost Analyst — 2026-05-26
- **Status**: GREEN
- Redis key growth risk: LOW
- Uncached external calls: 0 (all external calls cached or write-through)
- Resource leak risks: 0
- Estimated monthly cost at 10K users: **~$50–75/mo**, unchanged.
- **Commits this cycle**: 1 cost-surface change since 2026-05-24 entry — `dc0b7261` cached `/api/health` GitHub probe via `unstable_cache(revalidate=60)`. P3 (cycle 11) RESOLVED.
- Redis: 16 production prefixes + 3 persistent singletons (25/28 with TTLs, 89%). `cacheSet` defaults to 21,600s. `cacheIncr` race-safe.
- Supabase: 11 tables, 11/11 FORCE RLS. Singleton lazy client at `lib/db/supabase.ts:14` guarded by `import "server-only"` (line 8).
- Feature-flags ISR: `unstable_cache(revalidate=300)` at `lib/feature-flags.ts:84-94` active — 13 pages CDN-eligible.
- Badge `maxDuration=35` at `app/u/[handle]/badge.svg/route.ts:29` — 11th cycle hold.
- **P2-1 CARRIED (cycle 26)**: `dbGetCampaignStats()` 4-query parallel COUNT aggregation. Threshold comment at `lib/db/campaigns.ts:720-726`. Replace with GROUP BY RPC when campaigns exceed ~5K sends. Not yet triggered.
- **MONITOR M-bundle CARRIED**: Bundle 2,266 KB raw / 706 KB gzipped (flat 8/8 cycles per perf 2026-05-14). 4-week +34.7% trend stable but unresolved. `ANALYZE=true pnpm run build` still needs interactive run.
- **MONITOR M-config-TTL CARRIED**: `config:` TTL 31,536,000s (1y per user). PUT replaces — no accumulation.
- GitHub API cache-first unchanged (6h primary + 7d stale fallback). 100% fetch timeout coverage. `_inflight` dedup Map bounded.
- Coverage context (May 24): 7589 tests GREEN across 3 clean runs, 0 flakes. lib/cache 98.1%, lib/db 96.5%, app/api 97.5% — all stable.
- **P1s: NONE. P2s: 1 active (P2-1, threshold-gated). P3s: 0 (health probe P3 resolved).**

**Cross-agent recommendations:**
- [Performance]: Bundle flat 8/8 cycles. 4-week +34.7% trend stable but unresolved; `ANALYZE=true pnpm run build` still needs interactive run to localize source. Carry-only.
- [Security]: No cost-security regressions. `server-only` boundary on Supabase client + FORCE RLS on all 11 tables intact. Fail-open rate limiter and 100% fetch timeout coverage maintained. Health endpoint GitHub probe now cached at 60s — reduces outbound dependency.
- [Coverage]: lib/cache 98.1%, lib/db 96.5%, app/api 97.5% — all stable per May 24. New `/api/health` cache wrapper covered by the 2 new tests in `route.test.ts` (commit `dc0b7261`). No cost-path coverage gaps.
<!-- SHARED_CONTEXT_END -->
