# Cost Analyst Report
> Generated: 2026-07-08 | Health status: green

## Executive Summary
Cost surface remains healthy at HEAD `3b953903` (v2.17.0 release prep in tree). The large delta since the last cycle (`29d2b524`, 23 commits — the #1001–#1004 scoring-integrity batch) was audited call-by-call and is **cost-neutral**: the new authoritative merged-PR count rides inside the existing GitHub GraphQL POST (no extra HTTP request), all new cache writes carry explicit TTLs, and the only new steady-state cost is one extra Redis GET per uncached stats fetch. Estimated monthly cost at 10K users remains **~$50–75/mo**.

## Redis Usage
- Key patterns (from source scan; runtime counts unavailable — no prod Redis access from this environment):
  - `stats:<handle>` (6h) / `stats:stale:<handle>` (7d last-known-good) / `stats:dirty:<handle>` (1h) — per-user, bounded
  - `svg:<handle>:<theme>` (24h + 0–2h jitter), `history:<handle>`, `supplemental:<handle>` (24h), `craft:*`, `snapshot:*`, `avatar:*` — per-user, bounded
  - `rateLimit:*` — short TTLs, self-expiring
  - `cron:lastrun:<name>` heartbeats (TTL'd), `cron:warm-cache:offset` (intentional TTL-0 rotation cursor, overwrite-in-place)
  - `stats:badges_generated` (INCR counter) + `stats:unique_badges` (HLL, ~12 KB fixed) — 2 bounded persistent singletons
- TTL coverage: **35 non-redis-module `cacheSet()` call sites, 34/35 (97%) explicit positive TTL**; the 1 exception is the intentional TTL-0 cursor above. The `cacheSet` signature itself defaults to 21,600s (`redis.ts:69`), so even an omitted TTL is bounded.
- **New this cycle**: `client.ts:313` — degraded-fetch path refreshes the primary key with last-known-good at `CACHE_TTL` (explicitly anti-thrash, cost-reducing). Cached `StatsData` gains a `fetchScope` tag (#1004 phase 2) — a few bytes per entry, negligible.
- Growth risk: **LOW** — all per-user keys TTL'd, persistent keys bounded.

## Database Usage
- Tables: **11 tables + 2 views, 28 migrations** (unchanged since 2026-07-05; all 11 tables ENABLE + FORCE RLS per security agent).
- Query patterns: no N+1. The one DB-code change this cycle (`admin-users.ts`, +9 lines) restores OR semantics in the admin search filter — same single view query, no new round-trips. `materializeProfile`'s new `statsComplete` gate (#1003) *skips* snapshot writes for poisoned stats — a small write-volume reduction. `dbGetCampaignStats` 4-parallel-COUNT (P2-1) carried, monitor-only (threshold-gated, admin-only).
- Connection management: lazy singleton (`lib/db/supabase.ts:15-34`), `server-only`, `persistSession: false`, `withTimeout` wrapper. Unchanged.

## External API Calls
| Route | External Service | Cached | Rate Limited | Risk |
|-------|-----------------|--------|-------------|------|
| `/u/:handle/badge.svg` | GitHub GraphQL | 6h + 7d SWR + in-flight dedup + Redis lock + CDN s-maxage=21600 | CDN-shielded | Low |
| `/api/refresh`, `/api/generate`, `/api/recalculate` | GitHub GraphQL | Same stats cache | Yes | Low |
| `/api/cron/warm-cache` | GitHub GraphQL (server token) | Writes cache; #1002 guard blocks good→bad overwrite | CRON_SECRET, daily | Low |
| Platform fetches (Bitbucket/Codeberg/GitLab) | REST/GraphQL | 6h/1h | Via parent routes | Low |
| `/api/health` | GitHub probe | 60s | Yes | Low |
| `/api/challenge` | Resend | n/a (email) | `rateLimitStrict` IP 5/hr + handle 3/day | Low |
| Server events (`captureServerEvent`) | PostHog | Fire-and-forget | n/a | Low (see P3-1) |

- **GitHub GraphQL delta (#1002/#1004)**: the authoritative `search(is:merged)` count is a new **field in the existing query** (`queries.ts:31-70`) — same single POST, marginally higher per-query rate-limit point cost, negligible against 5,000 pts/hr.
- **New Redis read**: `_fetchAndCache` re-reads the primary key immediately before writing (`client.ts:334`) to close the public/authenticated downgrade race — +1 Upstash command per *uncached* fetch (~1/user/day). Negligible.
- 3 new PostHog server events: `github_degraded_pr_fetch`, `stats_fetch_rejected`, `snapshot_skipped_incomplete_stats` — all fire-and-forget, all bounded by degraded-fetch frequency (see P3-1).

## Resource Management
- No leaks found. `inflightBadgeRenders` Map self-clears per request (documented accepted risk); all `setInterval` usages are client components with cleanup.
- `scripts/heal-poisoned-stats.ts` (#1004 phase 4, 376 lines) is an **operator-run repair script**, not a deployed route — Redis SCAN + Supabase reads run locally on demand, no serverless cost.
- **P3-1 (new, monitor-only)**: asymmetric anti-thrash between the two integrity guards. The `isDegradedPrFetch` path re-caches stale into the primary key for 6h (`client.ts:313`), but the raw-integrity rejection path (`assessRawFetchIntegrity` → `fetchStats` returns null → `client.ts:174-181`) serves stale **without** refreshing the primary key. During a transient GitHub partial-degradation incident, each origin request for an affected uncached handle re-triggers a full GraphQL fetch + one `stats_fetch_rejected` PostHog event until GitHub heals. Bounded by CDN s-maxage, in-flight dedup, and the transient nature of the trigger shapes — but consider mirroring the 6h stale re-cache (or a short negative-cache) on this path.

## Vercel
- `maxDuration`: badge route 35s; 4 routes at 300s (bulk-recalculate + 3 crons). Unchanged.
- Badge headers: success `s-maxage=21600 / SWR=86400`, error `300/600`. Unchanged.
- Bundle: **zero client-bundle delta** — the entire 23-commit batch touches server-side lib code, scripts, and tests only (`apps/web/components`: 0 files; only app-dir change is a test file). Carry **2,079 KB raw / 659 KB gzipped**, below the 2,300 KB `ANALYZE=true` trigger.

## Recommendations
1. **P3-1**: mirror the 6h stale re-cache (or add a short negative-cache TTL, e.g. 5–15 min) on the `fetchStats`-null rejection path in `client.ts` so a transient GitHub degradation incident can't cause per-request refetch + PostHog event churn for uncached handles. One-file change, low urgency.
2. **P2-1 (carried)**: `dbGetCampaignStats` 4-parallel-COUNT — monitor-only until campaign volume grows.
3. Watch the first production week of `stats_fetch_rejected` / `github_degraded_pr_fetch` event volume in PostHog — if either fires more than a handful of times per day, P3-1 graduates to a real fix.
