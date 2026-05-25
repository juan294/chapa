# Cost Analyst Report
> Generated: 2026-05-25 | Health status: green

## Executive Summary
Pure carry/audit cycle — `HEAD` unchanged at `1ed6aa96` since 2026-05-24 report; zero commits touching cost surface. All cost controls intact: Redis TTL coverage ~89%, FORCE RLS on 11/11 Supabase tables, GitHub API cache-first with 6h primary + 7d stale fallback, badge `maxDuration=35` (11th cycle hold), feature-flags ISR via `unstable_cache(revalidate=300)`. Estimated monthly cost at 10K users remains **~$50–75/mo**.

## Redis Usage
- **Key patterns** (16 production prefixes + 3 persistent singletons): `stats:`, `svg:`, `history:`, `profile:`, `supplemental:`, `dirty:`, `ratelimit:`, `inflight:`, `config:`, `quota:`, `engagement:`, `audience:`, `campaign:`, `verify:`, `og:`, `badge-lock:` plus singletons `stats:badges_generated`, `stats:unique_badges`, `cache:version`
- **TTL coverage**: 25/28 keys with TTLs (**89%**). `cacheSet` defaults to 21,600s when caller omits TTL; all call sites pass explicit values. `cacheIncr` always refreshes TTL unconditionally (race-safe per `redis.ts:383-386`).
- **Growth risk**: **LOW**. `BADGES_TOTAL_KEY` and `BADGES_UNIQUE_KEY` (HyperLogLog) intentionally persistent — bounded size. `config:` keys 1y TTL but PUT-replaces (no accumulation per user).

## Database Usage
- **Tables**: 11 production tables, **11/11 FORCE RLS** confirmed (latest migration `025_force_supplemental_stats_rls.sql`).
- **Query patterns**: Generally efficient. **P2-1 carry (cycle 25)**: `dbGetCampaignStats()` at `lib/db/campaigns.ts:731-769` uses 4 parallel COUNT queries; threshold comment in source (lines 722-726) flags GROUP BY RPC replacement when campaigns exceed ~5K sends. Not yet triggered. No other N+1 patterns observed.
- **Connection management**: Singleton lazy client at `lib/db/supabase.ts:14`, guarded by `import "server-only"` (line 8). Reuses one connection per serverless instance.

## External API Calls
| Route | External Service | Cached | Rate Limited | Risk |
|-------|------------------|--------|--------------|------|
| `/u/[handle]/badge.svg` | GitHub GraphQL | Yes (6h + 7d stale) | Yes | LOW |
| `/api/refresh` | GitHub GraphQL | Cache-bypass write | Yes | LOW |
| `/api/generate` | GitHub GraphQL | Yes (6h + 7d stale) | Yes | LOW |
| `/api/profile/[handle]` | Read-only Redis/DB | Yes | Yes (60/60s) | LOW |
| `/api/verify/[hash]` | Read-only Redis/DB | Yes | Yes (30/60s) | LOW |
| `/api/cron/warm-cache` | GitHub GraphQL | Cache-warm write | CRON_SECRET gated | LOW |
| `/api/cron/process-campaigns` | Resend API | N/A | Quota reservation | LOW |
| `/api/health` | GitHub REST `/rate_limit` | **No** | Yes (30/60s) | **P3 carry** |
| `/api/telemetry` | PostHog (server) | Batched | Server-side only | LOW |
| `/api/webhooks/resend` | Resend (HMAC verify) | N/A | HMAC verified | LOW |

## Resource Management
- **Fetch timeouts**: 100% coverage via `withTimeout`/`AbortSignal.timeout` wrappers on every outbound fetch. No unbounded awaits.
- **In-flight dedup**: `_inflight` Map in `lib/github/client.ts` is bounded (entries deleted on settle). Coverage agent notes 2 edge branches at 93.1% funcs (low priority).
- **Connection leaks**: None. Lazy singletons (Redis + Supabase) reused per serverless instance; `getRedis()` retries=0 prevents hung connections.
- **Large in-memory buffers**: None observed. Badge SVG rendered string-only; avatars fetched as base64 with size limits via `lib/render/avatar.ts`.
- **`fire-and-forget`** uses `after()` (Next.js post-response) — no leaked promises holding lambda alive.

## Recommendations
**P1**: None.

**P2**:
1. **Carry (cycle 25)** — `dbGetCampaignStats()` GROUP BY RPC: threshold-gated. No action until any campaign exceeds ~5K sends. Source comment at `lib/db/campaigns.ts:722-726`.

**P3**:
1. **Carry (cycle 12)** — `/api/health` GitHub probe at `app/api/health/route.ts:31` is uncached. ~5–10 calls/hr from monitoring is well inside the 60/hr unauth limit. Fix when convenient: wrap response in `unstable_cache(revalidate=60)` so concurrent health probes share a single GitHub call.

**MONITOR**:
- `config:` key 1y TTL per user (PUT replaces — bounded).
- Bundle 2,266 KB raw / 706 KB gzipped (flat 9/9 cycles per perf 2026-05-14). Sustained +34.7% over 4 weeks remains unresolved as cause. `ANALYZE=true pnpm run build` still needs interactive run.

---

SHARED_CONTEXT_START
## Cost Analyst — 2026-05-25
- **Status**: GREEN
- Redis key growth risk: LOW
- Uncached external calls: 1 (health endpoint GitHub probe, P3 carry cycle 12)
- Resource leak risks: 0
- Estimated monthly cost at 10K users: **~$50–75/mo**. Unchanged.
- **Commits this cycle**: **zero** to cost surface since 2026-05-24 entry. HEAD unchanged at `1ed6aa96`. Pure carry/audit cycle.
- Redis: **16 production prefixes + 3 persistent singletons** (25/28 keys with TTLs, 89%). `cacheSet` defaults to 21,600s; all call sites pass explicit TTL. `cacheIncr` always refreshes TTL (race-safe).
- Supabase: **11 tables** unchanged; **11/11 FORCE RLS** confirmed (latest migration `025_force_supplemental_stats_rls.sql`). Singleton lazy client at `lib/db/supabase.ts:14` guarded by `import "server-only"` (line 8).
- Feature-flags ISR: `unstable_cache(revalidate=300)` at `lib/feature-flags.ts:84-94` active — flag reads cached at data layer.
- Badge `maxDuration=35` at `app/u/[handle]/badge.svg/route.ts:29` — 11th cycle hold.
- **P2-1 CARRIED (cycle 25)**: `dbGetCampaignStats()` 4-query parallel COUNT aggregation. Threshold comment in source at `lib/db/campaigns.ts:722-726`. Not yet triggered.
- **P3 CARRIED (cycle 12)**: Health endpoint at `app/api/health/route.ts:31` calls `api.github.com/rate_limit` uncached. ~5–10 calls/hr — well inside 60/hr unauth limit. Fix: `unstable_cache(revalidate=60)`. Low priority.
- **MONITOR M7 CARRIED**: `config:` TTL 31,536,000s (1y per user). PUT replaces — no accumulation.
- **MONITOR M-bundle CARRIED**: Bundle 2,266 KB raw / 706 KB gzipped (flat 9/9 cycles per perf 2026-05-14). Sustained +34.7% over 4 weeks unresolved. `ANALYZE=true pnpm run build` still needs interactive run.
- GitHub API cache-first unchanged (6h primary + 7d stale fallback). 100% fetch timeout coverage. `_inflight` dedup Map bounded.
- Coverage context (May 24): 7589 tests GREEN across 3 clean runs, 0 flakes, lib/cache 98.1%, lib/db 96.5%, app/api 97.5% — all stable. Prior engagement-dashboard flake confirmed RESOLVED.
- **P1s: NONE. P2s: 1 active (P2-1, threshold-gated). P3s: 1 carry (health probe).**

**Cross-agent recommendations:**
- [Performance]: Bundle flat 9/9 cycles. 4-week +34.7% trend stable but unresolved; `ANALYZE=true pnpm run build` still needs interactive run to localize source. Carry-only.
- [Security]: No cost-security regressions. `server-only` boundary on Supabase client + FORCE RLS on all 11 tables intact. Fail-open rate limiter and 100% fetch timeout coverage maintained. Health endpoint P3 (uncached GitHub probe) is not a security risk — GitHub's own rate limits provide secondary protection.
- [Coverage]: lib/cache 98.1%, lib/db 96.5%, app/api 97.5% — all stable per May 24. engagement-dashboard flake fix holding. No cost-path coverage gaps.
SHARED_CONTEXT_END
