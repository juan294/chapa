# Cost Analyst Report
> Generated: 2026-07-01 | Health status: green

## Executive Summary
No cost-surface changes since the 2026-06-30 cycle — HEAD is still `e54c7a6b` (only uncommitted agent-report diffs exist locally, no application code changed). Redis TTL coverage, Supabase RLS/connection posture, and external API caching all verified unchanged and healthy. Estimated monthly cost at 10K users remains **~$50–75/mo**.

## Redis Usage
- Key patterns: `stats:*` (GitHub stats + stale fallback), `svg:*`/badge cache, `history:*`, `rateLimit:*`/`ratelimit:*`, `supplemental:*`, `craft:*`, `config:*` (studio), `cli:device:*`, `og:*` — **29 non-redis-module `cacheSet()` call sites**.
- TTL coverage: **28/29 (96.5%) with explicit positive TTL**. The one exception (`cron:warm-cache/route.ts:146`, `ROTATION_KEY`, TTL 0) is an intentional persistent rotation cursor, not unbounded growth — single fixed key, overwritten each run.
- Two direct-redis singleton counters outside the `cacheSet()` wrapper: `stats:badges_generated` (INCR) and `stats:unique_badges` (HyperLogLog) — fixed cardinality, ~12 KB total, no growth risk.
- Two 365-day overwrite keys (`studio:config:<login>`, `badge:notified:<handle>`) — one row per user, overwritten not appended, so storage scales linearly with user count, not with time. Monitor-only.
- Growth risk: **LOW**. No pattern found where keys accumulate without a TTL or fixed-cardinality bound.

## Database Usage
- Tables: **11 user tables + 1 view = 12 active DB objects**, 27 migrations applied (latest `027_create_studio_configs.sql`). All 11 tables have `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY` (10 RLS-policy files matched; `studio_configs` confirmed covered by migration 027).
- Query patterns: No N+1 found. Warm-cache cron uses `dbGetLatestSnapshotBatch` for batched snapshot reads. `dbGetCampaignStats` (`lib/db/campaigns/sends.ts:251`) runs 4 parallel `COUNT` queries via `Promise.all` (one per send status) — efficient at current volume, flagged as a monitor item if campaign sends scale past ~5K/campaign (see Recommendations).
- Connection management: **Lazy singleton** (`apps/web/lib/db/supabase.ts:13-34`) — one `SupabaseClient` created on first call and cached in module scope (`_client`), `persistSession: false`, gated behind `import "server-only"`. No per-request client construction found.

## External API Calls
| Route | External Service | Cached | Rate Limited | Risk |
|-------|-----------------|--------|-------------|------|
| `/u/:handle/badge.svg` | GitHub GraphQL | Yes — 6h primary + 7d stale-fallback + in-flight dedup + Redis lock | Yes (fail-open, by design) | Low |
| `/api/profile/:handle`, `/api/history/:handle` | GitHub (via cache) | Yes — same cache path as badge route | Yes | Low |
| `/api/refresh`, `/api/recalculate`, `/api/generate` | GitHub GraphQL | Bypasses cache on purpose (force refresh) | Yes | Low — auth-gated, intentional bypass |
| GitLab/Bitbucket/Codeberg link status + stats | Platform APIs | Yes — 6h positive / 1h negative-result cache | Implicit via platform OAuth | Low |
| `/api/health` | GitHub API probe | Yes — `unstable_cache` 60s | Yes | Low |
| `/api/feature-flags` | Supabase (not external) | Yes — s-maxage 60 / SWR 300 | Yes | Low |
| PostHog analytics calls | PostHog | N/A (fire-and-forget, batched) | N/A | Low |
| Resend email (campaigns, notifications, webhooks) | Resend | N/A (transactional) | Yes (cron-driven batching) | Low |
| `/api/challenge` | Resend (email challenge) | N/A | **Yes, but handle-level limiter is fail-open `rateLimit()`** (`route.ts:81`) | **Low-medium** — see Recommendations |
| OAuth callbacks (GitHub/GitLab/Bitbucket/Codeberg) | Respective OAuth providers | N/A by design (per-request token exchange) | Provider-side | Low |

Fetch-timeout coverage: **100%** — all outbound GitHub/platform calls wrapped with `AbortSignal.timeout`/`AbortController` (11 files) or Supabase's `withTimeout` helper. No unbounded external calls found.

## Resource Management
- No unclosed connections or missing cleanup found in API routes — Supabase uses a lazy singleton (no per-request client leaks), Redis client is the Upstash REST client (stateless, no persistent connection to leak).
- No unbounded in-memory buffers or caches — all caching goes through Redis with TTLs; no module-level `Map`/`Array` accumulators found in hot paths.
- Vercel serverless function config: badge route `maxDuration=35`; crons + bulk-recalculate `maxDuration=300`. No route found without an explicit duration cap where one would be needed.
- ISR/SSG: `force-static` + `revalidate=3600` applied to 10 static-ish pages (7 archetype pages, about, privacy, terms, verify) — appropriate, no missed ISR opportunities identified.
- Bundle size (carried from performance agent, 2026-06-25 measurement, no app-code change since): **2,074 KB raw / 657 KB gzipped**, 0 routes over the 350 KB/chunk CI budget.

## Recommendations
1. **P3 (carried, unresolved)** — Swap `/api/challenge`'s handle-level rate limiter from `rateLimit()` (fail-open) to `rateLimitStrict()` (fail-closed) at `apps/web/app/api/challenge/route.ts:81`. During a Redis outage, an authenticated user could exceed the 3/day handle limit and trigger extra Resend sends. Low exploitability (session-auth required, Resend has its own limits) but a one-line fix. Flagged by security agent (2026-06-29) and cost-analyst for 4+ consecutive cycles — recommend actually applying this fix in the next triage cycle rather than continuing to carry it.
2. **P3 (monitor-only)** — `dbGetCampaignStats` 4-parallel-COUNT pattern (`lib/db/campaigns/sends.ts:251`) is fine today; revisit only if a single campaign's send volume exceeds ~5K rows (COUNT scan cost, not connection cost).
3. **P3 (monitor-only)** — Bundle sits at 2,074 KB raw. Trigger an `ANALYZE=true` build-analyzer run if a future cycle pushes past 2,300 KB raw.
4. No new P1/P2 cost items this cycle.

---

SHARED_CONTEXT_START
## Cost Analyst — 2026-07-01
- **Status**: GREEN
- Redis key growth risk: low
- Uncached external calls: 0
- Resource leak risks: 0

**Cross-agent recommendations:**
- [Performance]: Bundle unchanged at 2,074 KB raw / 657 KB gzipped (no app-code delta since 2026-06-25 measurement). M-bundle stays closed.
- [Security]: `/api/challenge` handle-level rate limit (3/day) remains fail-open at `route.ts:81` — recommend applying the one-line `rateLimitStrict()` fix now rather than continuing to carry it across cycles (4+ cycles unresolved).
- [Coverage]: All cost-path modules remained ≥96% stmts per coverage agent's 2026-06-30/07-01 cycles (lib/cache 98.2%, lib/db 96.5%, app/api 97.3%) — stable, no action needed.
SHARED_CONTEXT_END
