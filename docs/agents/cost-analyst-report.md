# Cost Analyst Report
> Generated: 2026-07-07 | Health status: green

## Executive Summary
Cost surface is unchanged and healthy at HEAD `29d2b524` (v2.16.0). The 3-commit delta since the last cycle (`09666b59`) is actually **cost-reducing**: the admin users tab gained a 400 ms client-side search debounce (fewer requests per keystroke) alongside a bounded rate-limit raise (10→30 req/60 s, admin-auth-gated). Estimated monthly cost at 10K users remains **~$50–75/mo**.

## Cost-Surface Delta Since 2026-07-06 Cycle
HEAD `09666b59 → 29d2b524` — 3 commits (v2.16.0 release):
- `fix(admin)` #993: new `hooks/useDebouncedValue.ts` debounces admin search at 400 ms (replaces `useDeferredValue`, which fired a request per keystroke); `adminAuth` on `/api/admin/users` raised from the 10/60 s default to explicit `30, 60` (`route.ts:35`). Net effect: **fewer** Supabase view queries from normal dashboard use, limiter still bounded and behind session + admin-handle checks.
- `docs(snapshots)`: comment-only (detect-don't-mask rationale in `snapshotToRow`).
- Release/changelog chore.

**Zero new cache keys, Supabase queries, or external API calls.**

## Redis Usage
- Key patterns (by writer, verified from source — no production Redis access from this environment):
  - `stats:<handle>` / `stats:stale:<handle>` — GitHub stats cache (6h TTL / 7d SWR stale copy)
  - `svg:<handle>:<theme>` — rendered badge cache (24h + 0–2h per-handle jitter)
  - `supplemental:<handle>` — EMU hot path (24h TTL, Supabase durable fallback)
  - `stats:dirty:<handle>` — same-day refresh marker (1h TTL)
  - `ratelimit:*` — fixed-window counters, all TTL'd to their window
  - `cron:lastrun:<name>` — heartbeat (TTL'd), `cron:warm-cache:offset` — rotation cursor
  - `stats:badges_generated` (INCR) + `stats:unique_badges` (HLL, ~12 KB fixed) — bounded singletons
- TTL coverage: **34 non-redis-module `cacheSet()` call sites; 33/34 (97%) pass an explicit positive TTL.** Default TTL is 21,600 s (`lib/cache/redis.ts:68`), so nothing accidentally persists.
- The single TTL-0 write is intentional: `cron:warm-cache:offset` (`app/api/cron/warm-cache/route.ts:148`) — a rotation cursor overwritten in place, not additive.
- Growth risk: **LOW** — no unbounded key families.

## Database Usage
- Tables: **11 tables + 2 views, 28 migrations** (unchanged; latest `028_grant_service_role_access.sql`). 11/11 ENABLE + FORCE RLS per prior migration audit — unchanged this cycle.
- Query patterns: no N+1 patterns in `lib/db/`. The one carried watch item is `dbGetCampaignStats`'s 4-parallel-COUNT (`lib/db/campaigns/sends.ts`, P2-1, admin-only, threshold-gated — monitor only). The v2.16.0 admin fix *reduces* `admin_users` view query volume via debounce.
- Connection management: lazy singleton (`lib/db/supabase.ts:15-34`), `import "server-only"`, `persistSession: false`, all calls wrapped in `withTimeout`. Correct for serverless.

## External API Calls
| Route | External Service | Cached | Rate Limited | Risk |
|-------|-----------------|--------|-------------|------|
| `/u/:handle/badge.svg` | GitHub GraphQL | 6h + 7d SWR + in-flight dedup + Redis lock | CDN `s-maxage=21600` | Low |
| `/api/refresh` | GitHub GraphQL | Bypasses cache by design | Yes (per-handle) | Low |
| `/api/profile/:handle`, `/api/history/:handle` | — (reads cache/DB) | Yes | Yes | Low |
| `/api/health` | GitHub probe | 60s `unstable_cache` | Yes | Low |
| `/api/cron/warm-cache` | GitHub GraphQL (batch) | Writes cache; rotation cursor bounds batch | `CRON_SECRET` | Low |
| `/api/challenge` | Resend | n/a (send) | `rateLimitStrict` IP 5/hr + handle 3/day (`route.ts:24,81`) | Low |
| `/api/cron/sync-audience`, `process-campaigns` | Resend | Batched/dedup-marker guarded | `CRON_SECRET` | Low |
| Client analytics | PostHog | Fire-and-forget | n/a | Low |
| Bitbucket/Codeberg/GitLab aggregation | Platform APIs | 6h positive / 1h negative | Inherits badge caching | Low |

**0 uncached external calls** (excluding fire-and-forget). Fetch-timeout coverage: **23 lib files** use `AbortSignal.timeout`/`AbortController`/`withTimeout` — unchanged.

## Resource Management
- `inflightBadgeRenders` Map (`badge.svg/route.ts:51`): self-clearing per request, documented in `docs/accepted-risks.md`. No change.
- `setInterval` usages are all client components with cleanup refs (`experiments/tier-visuals`, `admin/agents/terminal-display`) — zero serverless cost impact.
- No unclosed connections, dangling timers in API routes, or unbounded in-memory buffers found.

## Vercel Cost Factors
- Function durations: badge route `maxDuration = 35`; 4 long-runners at `300` (`admin/bulk-recalculate` + 3 cron routes). All appropriate.
- Badge CDN caching: success `s-maxage=21600 / SWR=86400` (`badge.svg/route.ts:55`), error `300/600` (`:246`) — keeps invocation volume low.
- Bundle: carried at **2,079 KB raw / 659 KB gzipped, 76 chunks** (performance 2026-07-02; the v2.16.0 delta adds one 14-line hook — no re-measure warranted). Below the 2,300 KB `ANALYZE=true` trigger.
- ISR/static surfaces unchanged (feature-flags `unstable_cache(300)`, archetype/about pages static).

## Recommendations
1. **(P2-1, carry, monitor-only)** `dbGetCampaignStats` 4-parallel-COUNT — revisit only if campaign volume grows past the threshold gate. No action now.
2. **No new items.** The v2.16.0 admin debounce is the model pattern for future search UIs hitting rate-limited endpoints — prefer debounce over `useDeferredValue` when each value change triggers a network request.

**P1s: NONE. P2s: 1 (P2-1, unchanged). P3s: 0.**
