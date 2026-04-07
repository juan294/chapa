# Cost Analyst Report
> Generated: 2026-04-07 | Health status: green

## Executive Summary
Infrastructure remains healthy with no new P1 items. The main new finding this cycle is a **warm-cache cron timeout risk**: at `BATCH_SIZE=5` × 50 max handles × ~10s/handle, execution time can reach 500s — exceeding Vercel Pro's 300s serverless limit. All other patterns are stable and carry from the prior cycle.

---

## Redis Usage

### Key Patterns with TTLs

| Key Pattern | TTL | Notes |
|---|---|---|
| `stats:v2:merged:<handle>` | 21600s (6h) | Primary merged stats |
| `stats:stale:<handle>` | 604800s (7d) | Stale fallback on API failure |
| `stats:v2:bitbucket:<handle>` | 21600s (6h) | Bitbucket per-user stats |
| `stats:v2:codeberg:<handle>` | 21600s (6h) | Codeberg per-user stats |
| `supplemental:<handle>` | 21600s (6h) | EMU merged stats |
| `avatar:<handle>` | 21600s (6h) | Base64 avatar data URI |
| `craft:<handle>` | 3600s (1h) | CraftResult from tool_insights (added v2.7.x) |
| `snapshot:latest:<handle>` | 86400s (24h) | Latest MetricsSnapshot for EMA |
| `history:<handle>[:<from>[:<to>]]` | 3600s (1h) | Snapshot array for history API |
| `ff:all` | 3600s (1h) | All feature flags |
| `ff:key:<key>` | 3600s (1h) | Single feature flag |
| `campaign:active-engagement` | 3600s (1h) | Active engagement campaign |
| `config:<handle>` | 31536000s (365d) | User badge config |
| `badge:notified:<handle>` | 31536000s (365d) | First-badge email dedup marker |
| `email:score-bump:<handle>` | 604800s (7d) | Score-bump email dedup |
| `og:<handle>:<date>` | 172800s (48h) | OG image PNG as base64 |
| `cli:device:<sessionId>` | 300s (5m) | CLI device auth session |
| `ratelimit:badge:<ip>` | 60s | 100 req/IP/min |
| `ratelimit:refresh:<handle>` | 3600s | 5 req/handle/hr |
| `ratelimit:recalculate:<handle>` | 3600s | 20 req/handle/hr |
| `ratelimit:cli-approve:<ip>` | 60s | 10 req/IP/min |
| `stats:badges_generated` | **None** | Integer counter — bounded (single key) |
| `stats:unique_badges` | **None** | HyperLogLog — bounded at ~12 KB |
| `cron:warm-cache:offset` | **None (TTL=0)** | Rotation cursor — intentionally persistent |

- **Key pattern count**: 24 patterns (was 21; `craft:{handle}`, `ratelimit:recalculate`, `ratelimit:cli-approve` confirmed this cycle)
- **TTL coverage**: 100% on per-user keys. 2 no-TTL HyperLogLog/counter singletons + 1 intentional TTL=0 cron cursor.
- **Growth risk**: None. All no-TTL keys are structurally bounded.

### Storage Estimate at 10K Users

| Category | Size | % |
|---|---|---|
| OG images (`og:<handle>:<date>`) | ~1.3 GB | ~81% |
| Stats + stale cache | ~120 MB | ~8% |
| Avatars | ~50 MB | ~3% |
| Configs + history + snapshots | ~30 MB | ~2% |
| Craft cache + flags + rate limits | ~20 MB | ~1% |
| HyperLogLog + cron cursor | <1 MB | — |
| **Total** | **~1.52 GB** | — |

Upstash Pro 10 GB limit → **85% headroom** at 10K users.

---

## Database Usage

- **Tables**: 10 tables + 2 views (unchanged)
- **Connection management**: Singleton lazy client (`getSupabase()`) with `persistSession: false`. One instance per warm serverless lifecycle. Correct.
- **N+1 patterns**: None. `dbGetLatestSnapshotBatch` uses a single bulk query returning a `Map<handle, snapshot>` for the warm-cache cron.
- **Parallel DB calls**: `_enrichWithLogins` in `lib/github/client.ts:80–91` runs 2 parallel `dbGetLinkedPlatform` calls for users with 2 linked platforms — not a loop, runs only on cache-miss path. Acceptable.

### v2.7.x New Query Pattern: `dbRecomputeCraft`

`lib/db/tool-insights.ts:149–180` — SELECT `raw_data` (JSONB) + UPSERT scores.

| Endpoint | Added DB ops | Added Redis ops |
|---|---|---|
| `POST /api/refresh` | +2 (SELECT raw_data, UPSERT scores) | +1 SET craft (1h TTL) |
| `POST /api/recalculate` | +2 (SELECT raw_data, UPSERT scores) | +1 SET craft (1h TTL) |
| `GET /badge.svg` (cache miss) | +1 (SELECT tool_insights fallback) | +1 GET + conditional SET |

`raw_data` is a JSONB column storing the full `InsightsUpload` object — large payload read on every refresh/recalculate. Bounded to users who have submitted tool insights. Cost impact: negligible at current scale.

### Cleanup Jobs

| Job | Table | Frequency | Max rows/run |
|---|---|---|---|
| `dbCleanOldSnapshots` | `metrics_snapshots` | Cron warm-cache | ~1K |
| `dbCleanExpiredVerifications` | `verification_records` | Periodic | ~1K |
| `dbCleanExpiredMergeOperations` | `merge_operations` | Periodic | ~1K |

---

## External API Calls

| Route / Lib | External Service | Cached Before Call | AbortSignal/Timeout | Rate Limit Risk |
|---|---|---|---|---|
| `lib/github/queries.ts` | GitHub GraphQL | ✅ `cacheGet(stats:v2:merged)` | ✅ `AbortSignal.timeout(15000)` | MEDIUM — 5,000/hr auth |
| `lib/auth/github.ts` (OAuth token) | GitHub OAuth | ✗ (auth flow) | ✗ **no timeout** | LOW — rare |
| `lib/auth/github.ts` (user/emails) | GitHub API | ✗ (auth flow) | ✗ **no timeout** | LOW — rare |
| `lib/bitbucket/queries.ts` | Bitbucket API | ✅ `cacheGet(stats:v2:bitbucket)` | ✅ `AbortController` 30s | MEDIUM |
| `lib/auth/bitbucket.ts` (OAuth) | Bitbucket OAuth | ✗ (auth flow) | ✅ `AbortSignal.timeout(10000)` | LOW |
| `lib/codeberg/queries.ts` | Codeberg API | ✅ cache checked | ✅ signal passed | MEDIUM |
| `lib/auth/codeberg.ts` (OAuth token) | Codeberg OAuth | ✗ (auth flow) | ✗ **no timeout** | LOW — rare |
| `lib/auth/codeberg.ts` (user profile) | Codeberg API | ✗ (auth flow) | ✗ **no timeout** | LOW — rare |
| `lib/render/avatar.ts` | GitHub avatar CDN | ✅ `cacheGet(avatar:<handle>)` | ✅ `AbortSignal.timeout(5000)` | LOW |
| `lib/analytics/server-errors.ts` | PostHog | ✗ (event sink, fire-and-forget) | ✗ intentional | LOW — fire-and-forget `void` |
| `lib/email/resend.ts` | Resend | ✗ (status check) | ✅ `AbortSignal.timeout(5000)` | LOW |

**Note on auth-flow timeout gaps**: The security report (2026-04-06) claims 100% fetch timeout coverage, but GitHub and Codeberg OAuth flows lack AbortSignal. These are infrequent (login events only) and don't block badge serving. LOW risk. A hanging OAuth callback would time out via Vercel's own serverless function limit (300s) as a backstop.

---

## Resource Management

- **SDK client singletons**: Redis, Supabase — confirmed. No per-request client instantiation.
- **AbortController cleanup**: All controllers cleaned in `finally` blocks. Bitbucket `setTimeout` not `clearTimeout()`d on success — hygiene only, no functional impact.
- **Large in-memory buffers**: None. OG image `base64` is written to Redis (48h TTL), not held in memory.
- **Resource leaks**: 0 identified.

---

## Vercel Cost Factors

### Serverless Runtime Configuration

| Route | Runtime | maxDuration | ISR |
|---|---|---|---|
| `/u/[handle]/badge.svg` | Node.js | default (10s) | — |
| `/api/cron/warm-cache` | Node.js | **300s** | — |
| `/api/cron/sync-audience` | Node.js | **300s** | — |
| `/api/cron/process-campaigns` | Node.js | **300s** | — |
| `/api/admin/bulk-recalculate` | Node.js | **300s** | — |
| `/u/[handle]` (share page) | Node.js | default | `revalidate=3600` |
| `/` (landing) | Node.js | default | `revalidate=3600` |
| `/about/*` | Node.js | default | `revalidate=86400` |
| `/archetypes/*` | Node.js | default | `revalidate=604800` |
| `/studio`, `/experiments/*` | Node.js | default | `force-dynamic` |

### ⚠️ P2-NEW: Warm-Cache Cron Timeout Risk

`/api/cron/warm-cache` processes up to 50 handles in `BATCH_SIZE=5` batches sequentially. Each handle requires:
- 1 GitHub GraphQL call (~2–5s)
- 1–2 Supabase writes (~0.5s)
- Badge SVG render + Redis writes (~1–2s)

**Budget estimate**: 50 handles × ~10s = **500s** vs 300s Vercel Pro limit.

At current user counts (likely <100 active handles in warm-cache list), this is not yet a problem. But as the priority handle list grows, this will timeout and silently fail mid-batch. Mitigation: reduce max batch to 25 handles, or split into multiple cron invocations.

---

## Recommendations

### P1 — None

All P1s from previous cycles remain resolved.

### P2 (Carried)

**P2-1**: `dbGetCampaignStats()` (`lib/db/campaigns.ts`) fetches all `campaign_sends` rows and aggregates in JavaScript. At >5K sends/campaign, this becomes a full table scan. Move to a Supabase RPC/aggregate query. Trigger: campaign scale.

**P2-2**: `dbRecomputeCraft()` (`lib/db/tool-insights.ts:149–180`) has 0 test cases (3rd cycle carried). Silent failure in craft refresh/recalculate paths is unverified. This is now a Coverage P1 and Security P2 — shared priority. Fix: add `describe("dbRecomputeCraft")` in `tool-insights.test.ts`.

**P2-3 (NEW)**: Warm-cache cron timeout risk at 50 handles. Add a `WARM_CACHE_MAX_HANDLES` ceiling (recommend 25) or paginate across two cron windows.

### P3 (Minor)

- GitHub/Codeberg OAuth callbacks lack `AbortSignal` — add `AbortSignal.timeout(10000)` to the 4 auth calls in `lib/auth/github.ts` and `lib/auth/codeberg.ts` for defense-in-depth.
- Bitbucket `clearTimeout()` not called on success path — cosmetic hygiene fix.

### Monitor (Unchanged)

- **OG image Redis memory**: ~1.3 GB at 10K users (81% of total). CDN `s-maxage=21600` bounds generation frequency. Track quarterly.
- **`sync-audience` pagination**: Single query returns all audience contacts. Add cursor pagination if >10K subscribers.
- **HyperLogLog cardinality**: `stats:unique_badges` at ~12 KB, sublinear growth. Track quarterly.

---

## Cost Estimate

| Service | Est. monthly @ 10K users |
|---|---|
| Vercel Pro | ~$20 base + invocation costs |
| Upstash Redis Pro | ~$15–25 (1.52 GB / 10 GB limit) |
| Supabase Pro | ~$25 |
| PostHog | Free tier (1M events/mo) |
| Resend | Free tier (<3K emails/mo) |
| **Total** | **~$60–70/mo** |

No change from prior cycle. Cost model stable.
