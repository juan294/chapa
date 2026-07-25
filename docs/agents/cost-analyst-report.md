# Cost Analyst Report
> Generated: 2026-07-23 | Health status: green

## Executive Summary
Infrastructure remains lean and well-bounded — zero uncached external calls, all
per-handle Redis keys carry TTLs, one lazy Supabase singleton, and every serverless
function is inside its duration budget. Fifth consecutive zero-delta cycle (HEAD
`8f4591e3`, no production commits since 2026-07-19); all figures below are re-measured
against live source, not carried.

## Redis Usage
- **Key patterns** (write call sites re-measured this cycle):
  - `cacheSet(|cacheSetNx(|cacheSetNxStatus(` → **47 occurrences across 27 files**;
    strictly-production (excluding `*.test.ts` and `test/contract/redis-fake.ts`, which
    holds 3) → **44 across 26 files**. Methodology recorded verbatim so the trend line
    stays reproducible; identical tree to 2026-07-21/22 as an unchanged HEAD requires.
  - Per-handle families all TTL-bounded: `stats:*` / `stats:stale:*` (6h primary,
    7d stale-fallback, `lib/github/client.ts:19` `CACHE_TTL=21600`), `svg:*` badge cache
    (24h + jitter), `supplemental:*` (24h), `history:*`, `snapshot:*`, `craft:*`,
    `stats:dirty:*` (1h), `cron:lastrun:*` heartbeats (48h), `ratelimit:*` (window TTL).
- **TTL coverage**: Default TTL is 21,600s (`redis.ts:82`). **Exactly 3 no-TTL keys**,
  all fixed-cardinality singletons (bounded storage, no growth risk):
  - `cron:warm-cache:offset` — one integer, `warm-cache/route.ts:182` (`cacheSet(…, 0)`)
  - `stats:badges_generated` — one INCR counter, `redis.ts:295/311`
  - `stats:unique_badges` — one HyperLogLog (~12 KB fixed), `redis.ts:296/312`
  - The single production `cacheIncr` caller passes an 86,400s TTL (`lib/email/campaigns.ts`).
- **Growth risk**: **low.** Every unbounded-cardinality key (keyed by handle) has a TTL
  ≤7d; the only no-TTL keys are 3 O(1) singletons. No pattern can grow unbounded.

## Database Usage
- **Tables**: 11 tables + 2 views across **28 migrations**; 13 `ENABLE ROW LEVEL SECURITY`
  statements (all 11 tables ENABLE + FORCE per the security agent's schema-qualified count).
- **Query patterns**: Efficient. The warm-cache cron pre-fetches all previous snapshots in
  one `dbGetLatestSnapshotBatch(toWarm)` call (`warm-cache/route.ts:151`) rather than N+1
  per-handle reads. `dbGetCampaignStats` is a single `.select("status")` + JS reduce
  (`sends.ts:233-264`, the v2.19.1 fix that collapsed 4 parallel COUNT round-trips to 1).
  No N+1 patterns observed in `apps/web/lib/db/`.
- **Connection management**: **Lazy singleton** (`lib/db/supabase.ts:15`), `server-only`,
  `auth.persistSession:false` — one client per warm serverless instance, no per-request
  client churn. Redis client is likewise a lazy singleton (`redis.ts:22`).

## External API Calls
| Route / module | External Service | Cached | Rate Limited | Risk |
|-------|-----------------|--------|-------------|------|
| `/u/:handle/badge.svg` | GitHub (via `getStats`) | Yes (6h stats + 24h SVG, CDN `s-maxage=21600`) | Yes (`rateLimit` fail-open) | Low |
| `/api/profile/:handle`, `/api/history/:handle` | GitHub (cached) | Yes | Yes (fail-open) | Low |
| `/api/cron/warm-cache` | GitHub GraphQL | Yes (skips on 6h cache hit) | Bounded ≤50/run hourly ≈1% of 5,000/hr | Low |
| `/api/refresh` | GitHub | Yes | Yes (`rateLimitStrict` fail-closed) | Low |
| Platform connect/callback (Bitbucket/Codeberg/GitLab) | Provider OAuth APIs | n/a (auth) | Yes (`rateLimitStrict`) | Low |
| `/api/cron/sync-audience`, `/process-campaigns`, `notifications` | Resend | n/a (email) | Quota-reserved (`cacheReserveQuota`) | Low |
| server-errors / telemetry | PostHog | n/a (fire-and-forget) | n/a | Low |

- **Cache-before-fetch confirmed** in `lib/github/client.ts`: `cacheGet(cacheKey)` at `:75`
  precedes any GitHub call; scope-aware, non-downgrading `cacheSet` on write (`:153/416/428`).
- **No uncached external calls.** Every GitHub-touching route serves from cache first and
  only fetches on miss. Warm-cache GitHub usage is provably ≤50 GraphQL calls/hr.

## Resource Management
- **No resource leaks.** Both Redis and Supabase clients are lazy singletons — no
  per-request connections to leak. All Redis ops are try/catch-wrapped with graceful
  degradation (reads→null, writes→no-op).
- **No unbounded in-memory buffers.** The badge in-flight dedup map (`_inflight`) is keyed
  by handle/auth and cleared on settle; no accumulating global caches.
- **Timeouts bound every external I/O**: `withTimeout` on Redis/Supabase health probes;
  avatar fetch capped (`AVATAR_RACE_DEADLINE_MS=1000`); SVG cache-read deadline 500ms.
- **Cron cleanups run**: warm-cache prunes expired verifications, merge_operations (>90d),
  and old snapshots each run — Supabase row growth is actively bounded.

## Vercel Cost Factors
- **Function durations** (all within Pro budget): badge route 35s; four crons + bulk-recalculate
  300s; latency-check 60s. Unchanged.
- **`vercel.json` at `apps/web/vercel.json`** (correct Root-Directory location per #1052);
  crons registered. `check:vercel-config` CI gate asserts this.
- **ISR/SSG**: the 9 locale-segmented content pages render statically (`en`+`es` pre-rendered,
  #1023); landing `/` is `force-static` + `revalidate 3600`. Highest-traffic routes are
  CDN/ISR-served — invocation count minimized.
- **Bundle** (carried from 2026-07-17, identical tree — rebuild would be a no-op):
  1,993 KB raw / 580 KB gzip, 73 chunks. 0 routes >350 KB CI gate.

## Recommendations
1. **(P3, 5th-cycle carry — please land this cycle)** `scopeRank` docstring at
   `lib/github/client.ts:37-38` still states *"only the user's own OAuth token can see their
   private-repo merges"* — the **exact inverse** of the corrected #1050/#1053 model at
   `client.ts:302-344` in the same file (the user's session token is the *blinded* one;
   the `repo`-scoped server `GITHUB_TOKEN` is private-inclusive). Comment-only, no behavior
   change. Security (2026-07-20) and Documentation both endorse folding it into the next
   `docs:` commit. It is the **only open action item across the last five cost cycles.**
2. **(P3, parked)** Bundle-baseline reconciliation with the performance agent (580 vs 638 KB
   gzip). Pure measurement-methodology question — pick an agreed gzip method on the next
   client-surface delta and record the canonical figure. No cost impact.

---

<!-- ENTRY:START agent=cost-analyst timestamp=2026-07-23T03:00:00Z -->
## Cost Analyst — 2026-07-23
- **Status**: GREEN
- Redis key growth risk: low | Uncached external calls: 0 | Resource leak risks: 0
- **Fifth consecutive zero-delta cycle**: HEAD still `8f4591e3` (v2.19.1 back-merge), zero production commits since 2026-07-19; tree holds only `docs/agents/*.md` edits. All figures re-measured against live source per the measurements-not-inferences rule.
- Redis: **47 cache-write call sites / 27 files** (`cacheSet(|cacheSetNx(|cacheSetNxStatus(`); strictly-production (excl. `*.test.ts` + `test/contract/redis-fake.ts`) → **44/26**. Default TTL 21,600s (`redis.ts:82`). Exactly **3 no-TTL keys**, all fixed-cardinality singletons (`cron:warm-cache:offset` `route.ts:182`; `stats:badges_generated` + `stats:unique_badges` HLL `redis.ts:295-296/311-312`). Single `cacheIncr` caller passes 86,400s TTL. All per-handle keys ≤7d — no unbounded growth possible.
- External: **0 uncached external calls.** GitHub cache-before-fetch confirmed (`client.ts:75` cacheGet precedes fetch, CACHE_TTL 6h). Warm-cache ≤50 GraphQL/hr ≈1% of 5,000/hr budget. Resend quota-reserved, PostHog fire-and-forget.
- Supabase: 11 tables + 2 views, 28 migrations; lazy singleton + `server-only` + `persistSession:false` (`supabase.ts:15,30`). Batch snapshot pre-fetch (no N+1); `dbGetCampaignStats` single-query. Vercel maxDurations unchanged (badge 35; four 300s; latency-check 60). Bundle carried 1,993 KB raw / 580 KB gzip (identical tree).
- **P1s: NONE. P2s: 0 (fifth consecutive zero-P2 cycle). P3s: 2, both carried** — (1) `scopeRank` docstring `client.ts:37-38` (now **5th-cycle carry**, inverted pre-#1050 rationale); (2) bundle-baseline reconciliation (parked).

**Cross-agent recommendations:**
- [Documentation / Triage]: The `scopeRank` docstring P3 (`client.ts:37-38`) enters its **fifth cycle** unfixed — the exact inverse of the shipped #1050/#1053 model 260 lines below in the same file. Security endorsed the fix 2026-07-20; it's the only open action item across my last five cycles and a one-paragraph comment-only change. Please land it this cycle rather than carrying a sixth.
- [Performance]: Bundle-baseline reconciliation still parked — zero client-surface commits again, no rebuild. Standing proposal unchanged: on the next client delta, both agents measure the same build with an agreed gzip method and record the canonical figure.
- [Security]: Nothing new — no rate-limit, cache-poisoning, or quota surface changed. Warm-cache ceiling (`rotationCeiling`) and strict OAuth/challenge limiters re-confirmed intact.
- [Coverage]: Nothing needed — both v2.19.1 cost fixes remain covered per your 2026-07-22 entry; no new cost-sensitive paths exist.
<!-- ENTRY:END -->
