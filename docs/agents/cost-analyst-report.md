# Cost Analyst Report
> Generated: 2026-05-11 | Health status: **green**

## Executive Summary

Infrastructure cost posture remains stable at ~$50–75/mo estimated for 10K users. Zero new cost-surface changes this cycle — recent commits were documentation and test-only. One carried P2 (dbGetCampaignStats threshold-gated) and one new P3 (health endpoint uncached GitHub call). All prior P2s fully resolved.

---

## Redis Usage

**Key prefixes: 16 production prefixes** (28 total including ops/test-suite keys)

| Prefix | TTL | Per-user? | Growth risk |
|--------|-----|-----------|-------------|
| `stats:v2:merged:{handle}` | 21,600s (6h) | ✅ Yes | Low — bounded |
| `stats:v2:bitbucket:{handle}` | 21,600s (6h) | ✅ Yes | Low |
| `stats:v2:codeberg:{handle}` | 21,600s (6h) | ✅ Yes | Low |
| `stats:stale:{handle}` | 604,800s (7d) | ✅ Yes | Low |
| `stats:dirty:{handle}` | 3,600s (1h) | ✅ Yes | Low — 1h TTL |
| `badge:{version}:{handle}:warm-amber:{date}` | 86,400s (24h) | ✅ Yes | Low — date-keyed |
| `badge-lock:{version}:{handle}:...:{date}` | 30s | ✅ Yes | Negligible |
| `craft:{version}:{handle}` | 3,600s (1h) | ✅ Yes | Low |
| `snapshot:latest:{handle}` | DB-backed | ✅ Yes | Low |
| `history:{handle}[:{from}:{to}]` | 3,600s (1h) | ✅ Yes | Low |
| `supplemental:{handle}` | 86,400s (24h) | ✅ Yes | Low |
| `ratelimit:*` | 60–900s | Per-IP | Low — short TTL |
| `oauth-state:{state}` | 600s (10m) | Per-request | Low |
| `campaign:*` | 3,600s (1h) | No | Low |
| `ff:{key}` | 300s (Next.js cache) | No | Low — few flags |
| **`stats:badges_generated`** | **NONE** | No | Intentional counter |
| **`stats:unique_badges`** | **NONE** | No | Intentional HyperLogLog |
| **`cron:warm-cache:offset`** | **NONE (explicit 0)** | No | Intentional rotation state |

- **TTL coverage**: 25/28 keys have TTLs (89%). The 3 persistent singletons are intentional design choices — counters and rotation state.
- **Growth risk**: LOW. At 10K users: ~7 per-user keys × 10,000 = ~70K keys plus ~900 daily campaign keys. Upstash free tier supports 10K keys; paid tiers support millions. No concern at current scale.
- **`_inflight` Map** (`lib/github/client.ts:28`): bounded by 30s INFLIGHT_TIMEOUT_MS + guaranteed `.finally()` cleanup at line 82-84. Not unbounded.

---

## Database Usage

- **Tables**: 11 (users, verification_records, email_campaigns, campaign_sends, supplemental_stats, metrics_snapshots, feature_flags, tool_insights, user_platforms, telemetry, admin_users)
- **Client**: Lazy singleton at `lib/db/supabase.ts:14` — optimal for serverless (one connection reused across invocations per container, not per-request)
- **N+1 patterns**: 0 found

**Query efficiency highlights:**
- Warm-cache cron uses `dbGetLatestSnapshotBatch()` with `.in(handle, [...])` — single query for up to 50 handles (`lib/db/snapshots.ts:325`)
- Campaign sends use RPC `claim_campaign_sends()` — atomic single round-trip (`lib/db/campaigns.ts:626`)
- Cleanup jobs batched at 1,000 rows/run to avoid table locks
- All feature flag reads go through Redis + in-memory cache (300s `unstable_cache`) — Supabase queried at most once per 5 minutes per serverless container

---

## External API Calls

| Route | External Service | Cached | Rate Limited | Risk |
|-------|-----------------|--------|-------------|------|
| `lib/github/client.ts:51` | GitHub GraphQL | ✅ Redis 6h TTL + 7d stale fallback | ✅ Per-IP + per-handle | Low |
| `app/api/health/route.ts:31` | GitHub REST (`/rate_limit`) | ❌ No cache | ❌ No rate limit on this call | **P3** — see below |
| `app/api/cron/sync-audience` | Resend contacts API | ✅ Redis 1h TTL | ✅ 300s maxDuration guard | Low |
| `lib/email/campaigns.ts` | Resend emails send | ❌ Not cached (by design — sends are idempotent via campaign_sends claim) | ✅ RPC claim prevents double-send | Low |
| `lib/analytics/posthog.ts` | PostHog | ✅ Lazy-loaded, fire-and-forget | N/A | Low |

**P3 — Health endpoint uncached GitHub call** (`app/api/health/route.ts:31`):
- Every `/api/health` invocation calls `api.github.com/rate_limit` with no cache
- At current scale (monitoring + Vercel health checks): ~5–10 calls/hr — well within the 60/hr unauthenticated limit
- Risk is low but unnecessary. Fix: wrap in `unstable_cache(revalidate=60)` or skip the probe entirely (health checks don't need live GitHub API status to be useful)
- No action required now; note for next refactor pass

---

## Resource Management

| Resource | Pattern | Cleanup | Risk |
|----------|---------|---------|------|
| `_inflight` Map (`lib/github/client.ts:28`) | Per-handle dedup | `.finally()` at line 82-84 + 30s timeout | None |
| Badge render lock (`app/u/[handle]/badge.svg/route.ts:66`) | Redis `SET NX` 30s TTL | TTL auto-expires | None |
| OAuth state Map (`lib/auth/oauth-state.ts:15`) | Fallback when Redis down | Lazy cleanup on read (line 53-56); no proactive sweep | Negligible — max ~200 bytes/entry, <1000 entries typical |
| Feature flag Map (`lib/feature-flags.ts:77`) | 5-min in-memory TTL | Entries expire passively; `invalidateFeatureFlagCache()` available | None — typically <10 unique keys |
| Supabase client (`lib/db/supabase.ts:14`) | Lazy singleton | Persistent across invocations (intended) | None |

No resource leaks detected. All Maps are bounded by either TTL expiry, `.finally()` cleanup, or guaranteed low cardinality.

---

## Vercel Cost Factors

| Factor | Status | Detail |
|--------|--------|--------|
| Badge route `maxDuration` | ✅ Fixed (cycle 10) | `export const maxDuration = 35` at `app/u/[handle]/badge.svg/route.ts:29` |
| Cron routes `maxDuration` | ✅ Correct | All 3 cron handlers at 300s |
| Edge runtime | Not used | All routes serverless (appropriate — most use Node.js APIs) |
| ISR regression | ✅ Resolved (May 7) | `unstable_cache(revalidate=300s)` at `lib/feature-flags.ts:84-94` — 13 pages CDN-eligible again |
| Bundle size | ⚠️ Monitor | 2,266 KB raw (+34.7% over 4 weeks, source unidentified) — no chunk ≥500 KB; no cold-start risk yet |
| Static pages | 4 static, 82 dynamic | `/`, `/about`, `/privacy`, `/terms` are static-eligible candidates |
| OG image routes | Dynamic, no ISR | `/u/[handle]/og-image` generates per-request; cached via response headers |

---

## Recommendations

| # | Priority | Item | File | Action |
|---|----------|------|------|--------|
| P2-1 | **P2 (carried, cycle 13)** | `dbGetCampaignStats()` uses 4 parallel COUNT queries | `lib/db/campaigns.ts:727-765` | Replace with single GROUP BY RPC. Threshold: >5K sends/campaign. Not yet triggered. |
| M-bundle | **Monitor** | Bundle +34.7% over 4 weeks (1,682 → 2,266 KB raw) | — | Run `ANALYZE=true pnpm run build` before next growth milestone to identify culprit packages. No chunk ≥500 KB; no immediate cold-start risk. |
| M7 | **Monitor** | `config:` key TTL = 1 year per user | `app/api/studio/config/route.ts:73` | PUT replaces existing key — no per-write accumulation. Negligible at current scale. |
| P3 | **Low** | Health endpoint makes uncached GitHub API call | `app/api/health/route.ts:31` | Wrap in `unstable_cache(revalidate=60)` or remove probe. Well within rate limits now. |

---

## Cost Model (unchanged)

| Tier | Redis ops/day | Supabase reads/day | GitHub API calls/day | Est. cost/mo |
|------|-------------|-------------------|---------------------|-------------|
| 1K users | ~5K | ~200 | ~100 | ~$15–25 |
| 10K users | ~50K | ~2K | ~1K | ~$50–75 |
| 100K users | ~500K | ~20K | ~10K | ~$300–500 |

No changes to cost model this cycle.
