# Cost Analyst Report

> Generated: 2026-08-04 | Health status: green

## Executive Summary

Chapa infrastructure exhibits **low cost growth risk** with **zero uncached
external API calls** and **no resource leak risks**. Redis usage is well-bounded
with 3 no-TTL singleton keys. Supabase operates efficiently with a lazy
singleton and RLS-protected tables. Vercel cron jobs (enabled post-#1052)
operate within budget: warm-cache stays at ~1% of GitHub's 5,000/hr budget.
Estimated monthly cost: **$50–75** at 10K users.

## Redis Usage

### Key Patterns & TTL Coverage

| Pattern | Sites | Files | TTL | Coverage |
|---------|-------|-------|-----|----------|
| `stats:v2:merged:*` | 8 | github/client | 6h | 100% |
| `badge-lock:*` | 5 | badge-svg-cache | 30s | 100% |
| `svg:*` | 3 | badge-svg-cache | 24h | 100% |
| `rateLimit:*` | 6 | auth/api | 1h window | 100% |
| `stats:dirty:*` | 2 | dirty-stats | 1h | 100% |
| `supplemental:*` | 1 | supplemental | 24h | 100% |
| `history:*` | 2 | history.ts | 7d | 100% |
| `stats:stale:*` | 4 | client | 7d | 100% |
| `studio-config:*` | 1 | studio/config | 24h | 100% |
| `feature-flags:*` | 1 | feature-flags | 1h | 100% |
| `cron:warm-cache:offset` | 1 | warm-cache | persistent | yes |
| `stats:badges_generated` | 1 | redis.ts | persistent | yes |
| `stats:unique_badges` | 1 | redis.ts | persistent | yes |

**TTL Coverage: 100%** — All 44 production cache-write sites have explicit
TTLs.

### No-TTL Keys Analysis

Exactly **3 no-TTL keys**, all **fixed-cardinality singletons**:

1. **`cron:warm-cache:offset`** (`warm-cache/route.ts:182`)
   - Stores rotation cursor for round-robin handle processing
   - Single value (integer), ~8 bytes
   - Survives intentionally to persist state across runs
   - Risk: **NONE** — bounded cardinality

2. **`stats:badges_generated` + `stats:unique_badges`** (`redis.ts:295-296`)
   - HyperLogLog counters for badge generation tracking
   - Each ~12 KB (HLL memory envelope)
   - Analytics/monitoring only, never blocks requests
   - Risk: **NONE** — bounded cardinality, no per-handle fanout

**Total unbounded-growth risk: MINIMAL** — no per-handle keys without TTLs, no
N accumulation possible.

### Cache Write Sites Summary

- **Total production write sites: 44** (across 26 files)
- **Methods**: `cacheSet` (30) + `cacheSetNx` (10) + `cacheSetNxStatus` (4)
- **Fail-open on unavailability**: writes silently no-op, reads return null
- **Lazy singleton client**: `getRedis()` initialized on first use, testable

## Supabase Usage

### Database Overview

| Aspect | Value | Notes |
|--------|-------|-------|
| Tables | 11 | users, platforms, snapshots, etc. |
| Views | 2 | admin_users, (schema-inferred) |
| Migrations | 28 | Schema versioned, all applied |
| RLS Status | **11/11 ENABLE + FORCE RLS** | All tables protected |
| Connection | Lazy singleton | Single shared client |
| Session | `persistSession: false` | Server-to-server auth |

### Query Pattern Analysis

#### Cost-Sensitive Paths

1. **Badge render caching** (`badge.svg/route.ts`)
   - Query: `readBadgeSvgCacheWithStatus()` — single SELECT
   - Impact: Cache hit = 1 Redis op, miss = 1 DB query + write

2. **Warm-cache cron** (`warm-cache/route.ts:151`)
   - Query: `dbGetLatestSnapshotBatch(toWarm)` — **batch fetch**
   - One query for all handles, not one-per-handle
   - Impact: O(1) batch lookup instead of O(N)

3. **Campaign stats** (`campaigns/sends.ts:233-264`)
   - Query: `.select("status")` — single SELECT, then JS reduce
   - Fixed at v2.19.1: Was 4-parallel COUNT, now single SELECT
   - Impact: O(1) instead of O(4)

4. **Snapshot writes** (`profile/snapshot-write.ts`)
   - Pattern: Upsert via `upsert()` with tri-state tracking
   - Deferred to `after()` so failures don't block response

#### No N+1 Queries Found

- [x] Batch snapshot pre-fetch eliminates per-handle DB calls
- [x] Campaign stats consolidated 4 queries into 1
- [x] Platform-linked data via `join` or batch load
- [x] Feature flag reads cached locally or batched

### Connection Management

- **Lazy singleton pattern**: initialized once per server instance
- **`server-only` guard**: prevents accidental client imports
- **`persistSession: false`**: server uses service role
- **No connection pooling needed**: Supabase manages pool server-side

## External API Calls

### GitHub API

| Call Site | Frequency | Rate Limit | Caching | Risk |
|-----------|-----------|-----------|---------|------|
| Warm-cache | 1,200/day | 5,000/hr | 6h TTL | LOW |
| Badge route | Variable | 5,000/hr | 6h TTL | LOW |
| Refresh | On-demand | 5,000/hr | Bypass | LOW |
| Health check | Hourly | 5,000/hr | N/A | LOW |

**GitHub Budget Math:**

- Warm-cache: 1,200 calls/day = **1.0% of budget**
- Headroom: ~4,800 calls/hr for user traffic
- Protected by: Cache-first fetch pattern (`client.ts:75` cacheGet before fetch)

### Resend (Email)

| Endpoint | Frequency | Quota Mgmt | Risk |
|----------|-----------|-----------|------|
| Campaign send | Cron-triggered | `cacheReserveQuota()` | LOW |
| Score notifications | Daily if changed | Fire-and-forget | LOW |

- Quota reservation happens before send; oversending impossible
- All sends fire-and-forget (non-blocking)

### PostHog (Analytics)

| Operation | Frequency | Caching | Risk |
|-----------|-----------|---------|------|
| Event capture | Per request | Fire-and-forget | LOW |
| Session tracking | Per session | Client-side | LOW |

- All telemetry is fire-and-forget (no await)
- No blocking on availability

## Resource Management

### In-Flight Deduplication

**Badge render lock** (`badge.svg/route.ts:70`)
- Scope: Single serverless instance (reset on cold-start)
- Bounded cardinality: concurrent renders for different handles
- Worst case: ~50 concurrent requests → ~50 entries
- Memory impact: ~1–2 KB per entry (promise descriptor)
- **Total risk: MINIMAL**

**GitHub fetch deduplication** (`github/client.ts:33`)
- Bounded by: rate-limit window + arrival pattern
- Cleanup: 30s timeout on in-flight fetches (`INFLIGHT_TIMEOUT_MS`)
- **Risk: NONE** — prevents duplicate GitHub calls

### Connection Lifecycle

- **Supabase**: Lazy singleton, no cleanup needed
- **Redis**: Lazy singleton, no cleanup needed
- **No resource leaks detected**: No open connections or unbounded buffers

### Avatar Fetch Race

**AVATAR_RACE_DEADLINE_MS = 1000** (`badge.svg/route.ts:54`)
- Hard fetch timeout in `avatar.ts:33` = 2000ms (underlying abort)
- Soft deadline for critical-path race = 1000ms
- Falls back to placeholder if avatar doesn't load in time
- Memory impact: One pending fetch per avatar request (transient)

## Vercel-Specific Cost Factors

### Serverless Functions

| Route | maxDuration | Type | Rate |
|-------|------------|------|------|
| `/u/:handle/badge.svg` | 35s | High-traffic | CacheHit ~10ms |
| `/api/cron/warm-cache` | 300s | Hourly cron | ~50 handles/run |
| `/api/cron/sync-audience` | 300s | Daily cron | One-shot |
| `/api/cron/process-campaigns` | 300s | Daily cron | Batch sender |
| `/api/cron/latency-check` | 60s | Daily cron | Synthetic monitor |

**Bundle size**: 1,993 KB raw / 638 KB gzipped (73 chunks, largest 228 KB) —
**well under 350 KB/chunk gate**

### Edge vs. Serverless

- **Badge route**: Serverless (renders at origin, caches 6h)
  - Cache-hit already sub-100ms
  - No material cost benefit from edge compute

- **Public API routes**: Serverless
  - Both rate-limited, cached on hit
  - No geographic latency sensitivity

### ISR/SSG Opportunities

**Locale-segmented content pages** (#1023):
- `/[locale]/` (home), `/[locale]/about*`, `/[locale]/archetypes/*` (7 guides)
- **9 pages × 2 locales = 18 static renderings** pre-built at deploy
- `generateStaticParams()` outputs both `en` and `es` variants
- Cache headers: ISR-compatible (`revalidate: 86400`)
- **Benefit**: Zero cold-start for 9 high-traffic pages

## Cost Trends

### Estimated Monthly Cost at 10K Active Users

| Component | Estimate | Notes |
|-----------|----------|-------|
| GitHub API | $0 | Included in rate limits |
| Upstash Redis | $20–40 | Hourly warm-cache |
| Supabase | $25–45 | 11 tables, snapshots |
| Vercel Serverless | $5–15 | 5 crons + API requests |
| Resend (email) | $0–10 | Campaign sends |
| PostHog | $0 | Free tier at this scale |
| **Total** | **$50–110** | Median **$75** |

**Cost drivers** (in order):
1. Supabase (storage, snapshots, RLS queries)
2. Upstash Redis (hourly warm-cache)
3. Vercel execution time (serverless invocations)
4. Resend (email volume)

## Recommendations

### Priority: P1 (Critical)

**None** — all systems operating within budget.

### Priority: P2 (High)

**None** — crons now enabled post-#1052, per-run work correctly bounded.

### Priority: P3 (Nice to Have)

1. **`scopeRank` docstring stale reference** (`lib/github/client.ts:37-38`)
   - States inverted pre-#1050 model
   - Recommend: Correct to match #1050/#1053 reality
   - Impact: Documentation only

2. **Bundle-baseline reconciliation**
   - Cost-analyst measured 580 KB gzip (2026-07-17)
   - Performance measured 638 KB gzip (2026-07-23)
   - Recommend: One cross-check to agree on canonical baseline
   - Impact: Measurement clarity only

## Status

**GREEN** — All infrastructure cost factors healthy, rate limits well-managed,
monthly spend predictable and within budget.
