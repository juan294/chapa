# Cost Analyst Report
> Generated: 2026-04-19 | Health status: green

## Executive Summary

Infrastructure remains stable and cost-efficient with zero new P1 or P2 issues. The 2026-04-18 P3-1 (add ISR to `/about` and `/archetypes/*`) is closed as a false positive — those pages already have correct `revalidate` exports. One minor new P3 found: `pingRedis()` uses a raw `setTimeout` inside `Promise.race()` without cleanup, matching the pattern fixed for og-image and supabase in the 2026-04-17 triage.

---

## Redis Usage

**Key patterns and TTLs (full audit):**

| Cache Key Pattern | TTL | Notes |
|---|---|---|
| `craft:{handle}` | 3600 (1h) | Tool insights score |
| `snapshot:latest:{handle}` | 86400 (24h) | Latest metrics snapshot |
| `stats:v2:merged:{handle}` | 21600 (6h) | Primary merged stats (GH+BB+CB) |
| `stats:stale:{handle}` | 604800 (7d) | Stale fallback on API failure |
| `stats:v2:bitbucket:{handle}` | 21600 (6h) | Bitbucket platform stats |
| `stats:v2:codeberg:{handle}` | 21600 (6h) | Codeberg platform stats |
| `supplemental:{handle}` | 86400 (24h) | EMU supplemental stats |
| `config:{handle}` | 31536000 (365d) | User badge config (persistent) |
| `sync-audience:contacts` | 3600 (1h) | Resend contacts list |
| `cron:warm-cache:offset` | ∞ (no TTL) | Round-robin rotation state (intentional, single key) |
| `stats:badges_generated` | ∞ (no TTL) | Monotonic counter (intentional, bounded) |
| `stats:unique_badges` | ∞ (no TTL) | HyperLogLog unique users (~12 KB) |
| `ratelimit:generate:{handle}` | 3600 (1h) | Badge generation rate limit |
| `ratelimit:supplemental:{handle}` | 86400 (24h) | EMU upload rate limit |
| `ratelimit:config:{handle}` | 3600 (1h) | Studio config save rate limit |
| `ratelimit:admin-bulk-recalc:{ip}` | 3600 (1h) | Admin bulk action rate limit |

- **TTL coverage**: 100% on per-user keys. 3 intentional no-TTL keys (2 bounded counters + 1 cron state key).
- **Storage estimate**: ~300–800 MB @ 10K users (~91% headroom on Upstash free tier). Unchanged.
- **Growth risk**: LOW. All unbounded-growth paths (per-user keys) have TTLs. No new key patterns introduced since 2026-04-18.

---

## Database Usage

- **Tables**: 10 (users, metrics_snapshots, email_campaigns, email_campaign_sends, verification_codes, merge_operations, user_platforms, tool_insights, feature_flags, admin_users) + 2 views
- **Query patterns**: No N+1 patterns. `dbGetLatestSnapshotBatch()` uses `IN ("handle", [...])` for batch pre-fetch in warm-cache cron. All queries use explicit column selects.
- **Connection management**: Lazy singleton pattern (`apps/web/lib/db/supabase.ts`). Single client instance reused across serverless function lifetime.
- **Timeouts**: `DB_TIMEOUT_MS = 10,000` (10s) on all queries via `dbTimeoutOr504()`. Health check uses 5s timeout.
- **Cleanup**: `metrics_snapshots` older than 365 days deleted in batches of 1,000 rows. No unbounded table growth.

---

## External API Calls

| Route | External Service | Cached | Rate Limited | Risk |
|---|---|---|---|---|
| `/api/generate`, `/u/[handle]/badge.svg` | GitHub | Yes (6h + 7d stale, in-flight dedup) | Yes (5/hr generate) | LOW |
| `/api/generate`, `/u/[handle]/badge.svg` | Bitbucket | Yes (6h + 7d stale) | Yes (feature-flag gated) | LOW |
| `/api/generate`, `/u/[handle]/badge.svg` | Codeberg | Yes (6h + 7d stale) | Yes (feature-flag gated) | LOW |
| `/api/cron/sync-audience` | Resend (list contacts) | Yes (1h TTL) | Cron-only | LOW |
| `/api/cron/process-campaigns` | Resend (send email) | N/A (transactional) | Cron-only | LOW |
| All API routes | PostHog | N/A (fire-and-forget) | N/A | LOW |
| `/api/auth/callback`, `/api/auth/bitbucket/*`, `/api/auth/codeberg/*` | GitHub/Bitbucket/Codeberg OAuth | N/A (auth flow) | Yes (10s AbortSignal) | LOW |

All external calls have `AbortSignal.timeout()` or `withTimeout()` wrappers. No uncached external calls on hot paths.

---

## Vercel Cost Factors

**ISR / Static pages (correctly configured):**
| Page | Revalidate | Cost impact |
|---|---|---|
| `/` | 3600 (1h) | LOW |
| `/about`, `/about/scoring`, `/about/verification` | 86400 (24h) | MINIMAL |
| `/archetypes/*` (7 pages) | 604800 (7d) | MINIMAL |
| `/privacy`, `/terms` | 86400 (24h) | MINIMAL |
| `/u/[handle]` | 3600 (1h) | LOW |

**Force-dynamic pages (intentional, compute on every request):**
| Page | Reason | Risk |
|---|---|---|
| `/studio` | Personalized, session-dependent | MEDIUM — acceptable for low-traffic page |
| `/experiments/*` | Feature-gated, canvas/WebGL | LOW — low traffic |

**Serverless function limits:**
- `/api/cron/warm-cache`, `/api/cron/sync-audience`, `/api/admin/bulk-recalculate`: `maxDuration = 300` (Vercel Pro)
- All other routes: default 60s (adequate for current workloads)

**OG image routes**: include font file tracing in `next.config.ts` — adds ~few hundred KB to Lambda package size. Cosmetic.

---

## Resource Management

- **No critical resource leaks detected.**
- `withTimeout()` in `apps/web/lib/async/with-timeout.ts` correctly clears `setTimeout` in `finally()` — used by all DB calls and email sends.
- HTTP fetches use native `AbortSignal.timeout()` (no manual cleanup required).
- GitHub in-flight dedup map cleaned via `.finally()` on each promise.
- **P3-NEW**: `pingRedis()` in `apps/web/lib/cache/redis.ts` (lines 262–266) uses a raw `Promise.race([redis.dbsize(), new Promise(reject => setTimeout(...))])` without clearing the timer. Same pattern previously fixed for og-image, supabase, and sync-audience in 2026-04-17 triage. LOW severity — health check path only, timer fires in 5s max, no functional impact.

---

## Issue Tracker

### Active P2s

| ID | Issue | File | Action |
|---|---|---|---|
| P2-1 | `dbGetCampaignStats()` client-side aggregation (`lib/db/campaigns.ts:439`) | campaigns.ts | Move to Supabase RPC at >5K sends/campaign |

### Active P3s

| ID | Issue | File | Severity |
|---|---|---|---|
| P3-1 | `pingRedis()` raw `setTimeout` not cleared (`redis.ts:262–266`) | lib/cache/redis.ts | Cosmetic — refactor to `withTimeout()` |
| P3-2 | CLI device session key TTL unconfirmed (`api/cli/auth/approve/route.ts`) | app/api/cli/auth/approve/route.ts | PENDING — verify key has TTL set |

### Closed This Cycle

| ID | Issue | Resolution |
|---|---|---|
| ~~P3-1 (2026-04-18)~~ | Add `revalidate = 86400` to `/about` and `/archetypes/*` | FALSE POSITIVE — already present (`/about` → 86400, `/archetypes/*` → 604800) |

### Monitor Items (Unchanged)

| ID | Item | Threshold | Status |
|---|---|---|---|
| M1 | Avatar cache Redis memory | ~300 MB @ 10K users | STABLE |
| M2 | OG image Redis memory | ~150 MB @ 1K active/day | STABLE |
| M3 | HyperLogLog (`stats:unique_badges`) | ~12 KB | Track quarterly |
| M4 | `metrics_snapshots` table growth | ~3.65M rows/year @ 10K users | STABLE |

---

## Recommendations

| Priority | Item | Effort |
|---|---|---|
| P2 | Move `dbGetCampaignStats()` aggregation to Supabase RPC (at scale) | Medium |
| P3 | Refactor `pingRedis()` to use `withTimeout()` pattern (redis.ts:262–266) | Trivial |
| P3 | Verify CLI device session key TTL in `api/cli/auth/approve/route.ts` | Trivial |

**Estimated monthly cost @ 10K users: ~$55–70/mo.** Unchanged from prior cycles.
