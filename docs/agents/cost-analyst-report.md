# Cost Analyst Report
> Generated: 2026-04-30 | Health status: green

## Executive Summary

Infrastructure cost profile remains stable at ~$55–70/mo at 10K users. The sole new commit since yesterday (`lib/env.ts` typed env getters, b2c8d3c) adds zero Redis writes, zero external calls, and zero Vercel function overhead — it is a pure safety refactor. No new cost surfaces; all monitors and the one active P2 carry unchanged.

## Redis Usage

- **Key prefixes audited:** 27 distinct patterns (unchanged from 2026-04-29)
- **TTL coverage:** 24/27 (89%) — 3 intentional persistent singletons
- **Default TTL:** `cacheSet()` defaults to 21,600s (6h) at `lib/cache/redis.ts:69`
- **Persistent keys (TTL=0):**
  - `stats:badges_generated` — INCR counter, bounded by usage (~10 KB/yr)
  - `stats:unique_badges` — HyperLogLog, ~12 KB fixed
  - `cron:warm-cache:offset` — single integer, bounded
- **Growth risk:** LOW — all per-handle keys are date-keyed or TTL-bounded; HLL capped at ~12 KB; counters grow linearly at negligible rate
- **Fail-open rate limiter:** intact at `redis.ts:183` — allows all requests when Redis is unavailable (intentional design, documented at `redis.ts:127-149`)

## Database Usage

- **Tables:** 11 tables + 2 views (`security_invoker=true`) + 1 RPC (`claim_campaign_sends`)
- **Connection management:** Lazy singleton at `lib/db/supabase.ts:11` — one persistent connection per Node.js worker, `persistSession: false`
- **Query patterns:** 0 N+1 patterns. Batch reads use single `IN()` query (`dbGetLatestSnapshotBatch()` at `lib/db/snapshots.ts:325`). All retention jobs run batched 1,000-row deletes.
- **Retention:** `dbCleanOldSnapshots` (365d), `dbCleanExpiredMergeOperations` (90d), `dbCleanExpiredVerifications` (30d) — all wired in `cron/warm-cache/route.ts:175`

## External API Calls

| Route | External Service | Cached | Rate Limited | Risk |
|-------|-----------------|--------|-------------|------|
| `/api/health` | GitHub (`api.github.com/rate_limit`) | No (intentional) | 30 req/60s | LOW — probe only, 3s timeout |
| `/api/refresh` | GitHub (stats fetch) | Cache-bypass by design | 5 req/hr per user + auth-gated | LOW — intentional, auth required |
| `/u/[handle]/badge.svg` | GitHub (via `lib/github/client.ts`) | Yes — 6h fresh + 7d stale + in-flight dedup | Yes — per-IP | LOW |
| `/u/[handle]/og-image` | GitHub avatar URL (base64 fetch) | Yes — 48h Redis cache (`og-image:v2:*`) | 30 req/60s per IP | LOW |
| `/api/generate` | GitHub (via client) | Yes — 6h fresh | Yes | LOW |
| `/api/webhooks/resend` | Resend (inbound webhook) | N/A | 20 req/60s + Svix HMAC | LOW |
| All routes (server errors) | PostHog (`/capture/`) via `withErrorCapture` | N/A — per-error event | Fire-and-forget, 5s timeout | LOW — bounded by real error rate |

All Bitbucket/Codeberg external calls go through `lib/bitbucket/client.ts` + `lib/codeberg/client.ts` with explicit timeouts. 100% timeout coverage via `AbortSignal.timeout()` or `withTimeout()`.

## Resource Management

- **Timers:** All `setTimeout` calls have paired cleanup in `.finally()`. No server-side `setInterval`. No leaks.
- **In-memory `_inflight` Map** (`lib/github/client.ts:28`): bounded by 30s timeout + explicit `.finally()` clear — prevents unbounded growth under concurrency
- **`flagCache`:** bounded by fixed feature-flag set (~5–10 entries)
- **`warmSet`:** bounded to `MAX_HANDLES=50` in cron handler
- **`fallbackStateStore`:** bounded by 10-min OAuth nonce TTL
- **`@resvg/resvg-js`:** declared in `serverExternalPackages` (`next.config.ts:90`) — not bundled, loaded on-demand by OG image routes only
- **OG image base64 write:** fire-and-forget at `og-image/route.ts:97` via `fireAndForget()` — non-blocking, timeout-protected

## New Since Last Report (2026-04-30)

**`lib/env.ts` — typed env getters (commit b2c8d3c)**
- Centralizes all `process.env` reads with `.trim()` applied exactly once
- Returns typed values: `string | undefined`, `boolean`, `string[]`
- Zero Redis writes, zero external calls, zero Vercel compute overhead
- Coverage: 100% stmts/funcs, 87.5% branches (one minor uncovered ternary)
- Phase 9C ESLint rule (`no-restricted-syntax` blocking direct `process.env` reads) still pending — call-site sweep of ~20 remaining usages not yet complete

## Vercel Cost Factors

- **ISR revalidation intervals:** `/about*`→86400s, `/archetypes/*`→604800s, `/`→3600s, `/u/[handle]`→3600s, `/privacy`+`/terms`→86400s
- **`force-dynamic` pages:** `/studio`, `/admin/*`, `/experiments/*` — intentional (auth/flag-gated)
- **Edge vs serverless:** All routes use Node.js runtime (Redis + Supabase clients require it). No edge routes. No misclassified routes.
- **Cron handlers:** 4 at `maxDuration=300s` — `warm-cache`, `process-campaigns`, `sync-audience`, `bulk-recalculate`
- **No oversized routes** — largest chunks are framework/vendor (~232 KB framework, ~173 KB PostHog lazy)

## Active Issues

### P2 Active — 5th Carry Cycle
**`dbGetCampaignStats()` — 4-query parallel count aggregation**
- Location: `lib/db/campaigns.ts:734-751`
- Pattern: 4 parallel `SELECT COUNT(*)` calls, one per campaign status
- Fix: Single `SELECT status, COUNT(*) GROUP BY status` Postgres RPC
- Trigger: >5K sends per campaign
- Current state: Not yet triggered. Acceptable today.

## Monitors (Carried)

| ID | Item | Threshold |
|----|------|-----------|
| M1 | Avatar Redis cache memory | ~300 MB at 10K users |
| M2 | OG image Redis cache memory | ~200 MB at 1K active/day |
| M3 | HyperLogLog `stats:unique_badges` | ~12 KB fixed — no action needed |
| M4 | `metrics_snapshots` row growth | ~3.65M rows/year at 10K users — cleanup wired (365d retention) |
| M5 | `withErrorCapture` PostHog spike | Fire-and-forget + 5s timeout protects cost; monitor for high error rate bursts |

## Recommendations

1. **[P2 — scale gate]** Migrate `dbGetCampaignStats()` to a `GROUP BY status` RPC once campaign sends exceed 5K/campaign. Not urgent.
2. **[Phase 9C — pending]** Complete the `process.env` call-site sweep (~20 remaining usages) after the ESLint rule is wired. No cost impact but improves env-var safety and prevents invisible-character auth failures.
3. **[Monitor]** OG image cache (M2) is the largest Redis memory risk at scale — if avatar+OG cache approaches 500 MB, evaluate shorter TTL or CDN offload.
