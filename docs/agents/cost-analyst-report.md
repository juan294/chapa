# Cost Analyst Report
> Generated: 2026-05-28 | Health status: GREEN

## Executive Summary
Pure carry/audit cycle — last cost-surface code change was `dc0b7261` (2026-05-25), which already resolved the long-running P3 (uncached health-probe GitHub call). HEAD is `9542fddc` (agent-report doc updates only). No new P1/P2/P3 findings. Estimated monthly cost at 10K users remains **~$50–75/mo**.

## Redis Usage
- Key patterns: **16 production prefixes + 3 persistent singletons** — `stats:`, `svg:`, `history:`, `score:`, `config:`, `supplemental:`, `stats:dirty:`, `inflight:`, `rate:`, `metrics:`, `audience:sync:`, `campaign:send:`, `feature-flag:`, `og:`, `health:`, `cli-auth:` (+ persistent admin counters).
- TTL coverage: **25/28 keys with TTLs (89%)** — three intentional persistent singletons. `cacheSet()` defaults to 21,600 s; every call site passes an explicit TTL. `cacheIncr()` always refreshes TTL (race-safe).
- Growth risk: **LOW**. `config:` is the only 1-year TTL but PUT replaces — no accumulation.

## Database Usage
- Tables: **11** (last migration `025_force_supplemental_stats_rls.sql`). **11/11 ENABLE + FORCE RLS** confirmed.
- Query patterns: No N+1 patterns observed in `apps/web/lib/db/`. Bulk admin and stats routes use parallel `Promise.all` queries. **P2-1 (carried, threshold-gated cycle 26)**: `dbGetCampaignStats()` runs 4 parallel COUNT aggregations at `lib/db/campaigns.ts:723-726` — replace with GROUP BY RPC when campaigns exceed ~5K sends. Not yet triggered.
- Connection management: Singleton lazy client at `lib/db/supabase.ts:14`, guarded by `import "server-only"` at line 8. No per-request client construction.

## External API Calls
| Route | External Service | Cached | Rate Limited | Risk |
|-------|------------------|--------|--------------|------|
| `/u/[handle]/badge.svg` | GitHub GraphQL | 6h primary + 7d stale fallback, in-flight dedup | Yes (fail-open) | Low |
| `/api/generate` | GitHub GraphQL | Same cache layer | Yes | Low |
| `/api/refresh` | GitHub GraphQL | Forces re-fetch but writes cache | Yes (per-handle) | Low |
| `/api/profile/[handle]` | Redis only (no external) | Reads cached stats | 60/60s | Low |
| `/api/verify/[hash]` | Redis only | Reads cached payload | 30/60s | Low |
| `/api/health` | GitHub `/rate_limit` | **`unstable_cache(revalidate=60)` (dc0b7261)** | Yes | Low (resolved) |
| `/api/webhooks/resend` | Resend (verify HMAC) | n/a (inbound) | HMAC-guarded | Low |
| `/api/cron/warm-cache` | GitHub GraphQL | Writes cache | Bearer-auth, daily | Low |
| `/api/cron/sync-audience` | Resend audiences | Daily | Bearer-auth | Low |
| `/api/cron/process-campaigns` | Resend send | Daily batch | Bearer-auth + per-recipient claim | Low |
| `/api/telemetry` | PostHog (server-side) | n/a (write-only) | Rate limited | Low |

## Resource Management
- All `fetch()` calls use `AbortSignal.timeout(...)` — 100% timeout coverage maintained.
- `_inflight` dedup Map in `lib/github/client.ts` is bounded (cleared on resolution).
- No unbounded buffers or per-request caches identified.
- Badge route `maxDuration=35` at `app/u/[handle]/badge.svg/route.ts:29` (11th cycle hold).
- Fail-open rate limiter in `lib/cache/redis.ts` — accepted availability-first design.

## Recommendations
1. **P2-1 (carry, threshold-gated)** — `lib/db/campaigns.ts:723-726`: replace 4-query parallel COUNT with GROUP BY RPC when any campaign exceeds ~5K sends. Threshold comment is in source; no action until triggered.
2. **Monitor (carry)** — `config:` 1-year TTL: PUT-replace semantics confirmed safe; no action.
3. **Monitor (carry)** — Bundle 2,266 KB raw / 706 KB gzipped (flat 9/9 cycles per performance 2026-05-14). 4-week +34.7% trend stable but origin unidentified; `ANALYZE=true pnpm run build` still needs an interactive run to localize source. Not a runtime cost driver yet but worth quantifying before next major dependency bump.
4. **No P1 or P3 active**. Health-probe P3 closed in `dc0b7261` and confirmed test-covered per coverage 2026-05-28.

---

SHARED_CONTEXT_START
## Cost Analyst — 2026-05-28
- **Status**: GREEN
- Redis key growth risk: low
- Uncached external calls: 0 (P3 health probe now cached at 60 s via `unstable_cache`, confirmed in dc0b7261)
- Resource leak risks: 0

**Cross-agent recommendations:**
- [Performance]: Bundle flat 9/9 cycles; 4-week +34.7% trend stable but unresolved as source. `ANALYZE=true pnpm run build` still requires interactive run to localize. Carry-only — no runtime cost impact yet.
- [Security]: No cost-security regressions. `server-only` boundary on Supabase client + FORCE RLS on all 11 tables intact. Fail-open rate limiter and 100% fetch timeout coverage maintained. New `/api/health` cache wrapper is a pure cost win — does not change security posture.
- [Coverage]: lib/cache 98.1%, lib/db 96.5%, app/api 97.5% — all stable per 2026-05-28 entry. New `/api/health` `unstable_cache(revalidate=60)` wrapper confirmed test-covered in `route.test.ts`. No cost-path coverage gaps.
SHARED_CONTEXT_END
