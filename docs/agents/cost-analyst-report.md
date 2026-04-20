# Cost Analyst Report
> Generated: 2026-04-20 | Health status: green

## Executive Summary

Infrastructure efficiency is unchanged and strong. All Redis keys have appropriate TTLs, no N+1 patterns exist, external API calls are cache-first, and all prior P3s from 2026-04-19 were resolved. Single carried P2 (campaigns RPC aggregation) remains a future-scale item only.

---

## Redis Usage

### Key patterns and TTLs

| Key pattern | TTL | Notes |
|---|---|---|
| `stats:{handle}` | 21,600 s (6h) | GitHub stats cache |
| `svg:{handle}:{theme}` | 86,400 s (24h) | Badge SVG output |
| `history:{handle}` | 21,600 s (6h) | Score history |
| `craft:{handle}` | 3,600 s (1h) | Craft score sidecar |
| `rateLimit:{key}` | `windowSeconds` | Per-window rate limit counter — expires on first increment |
| `ff:{flag}` / `ff:all` | 3,600 s (1h) | Feature flags |
| `campaign:engagement:{handle}` | 3,600 s (1h) | Active campaign tracking |
| `contacts:resend:all` | 3,600 s (1h) | Resend contacts list (sync-audience cron) |
| `og:{handle}` | 86,400 s (24h) | OG image cache |
| `avatar:{handle}` | 86,400 s (24h) | Avatar base64 cache |
| `cron:warm-cache:offset` | **none** | Rotation offset — intentional, 1 key, ~8 bytes |
| `stats:badges_generated` / `stats:unique_badges` | **none** | HyperLogLog counters — intentional, bounded ~12 KB total |

- **TTL coverage**: 100% on per-user keys. 3 persistent keys (rotation offset + 2 HyperLogLogs) — all intentional and bounded.
- **Timer cleanup**: `withTimeout()` in `lib/cache/with-timeout.ts` clears all timers in `.finally()` — no timer leaks anywhere in the cache layer.
- **Rate limiter**: `expire` set only on first increment (`current === 1`) — correct, no duplicate expire calls.

### Storage estimate

~300–800 MB at 10K users (~91% headroom on Upstash free/starter tier). Unchanged.

### Growth risk

**Low.** No unbounded patterns. The only no-TTL keys are intentional singletons (1 offset key + HyperLogLog pair).

---

## Database Usage

- **Tables accessed**: 9 tables + 1 view (`admin_users`)
  - `users`, `email_campaigns`, `campaign_sends`, `verification_records`, `metrics_snapshots`, `tool_insights`, `feature_flags`, `merge_operations`, `user_platforms`, `admin_users` (view)
- **RLS**: All tables have RLS enabled + `FORCE ROW LEVEL SECURITY`. 2 views use `security_invoker = true`. Service role key bypasses RLS for server-side writes (intentional).
- **Connection management**: Singleton lazy client in `lib/db/supabase.ts:11` — module-level `let _client` initialized once. Zero per-request connection overhead. Upstash Redis uses HTTP REST (no persistent connections).

### Query patterns

- **0 N+1 patterns detected** — batch queries throughout:
  - `dbGetLatestSnapshotBatch()` in warm-cache — fetches all handles in one query
  - `campaigns.ts` transforms data in-memory after a single batch upsert
- **P2-1 CARRIED**: `dbGetCampaignStats()` at `lib/db/campaigns.ts:439` performs client-side aggregation (summing `sent_count` across campaign_sends rows in JS). Acceptable at current scale; move to Supabase RPC at >5K sends/campaign to avoid transferring all rows.

---

## External API Calls

| Route | External Service | Cached | Rate Limited | Risk |
|---|---|---|---|---|
| `/api/health` | GitHub (`/rate_limit`) | No | N/A — health probe only | Low — 3s timeout, monitoring path only |
| `/api/cron/sync-audience` | Resend (contacts list) | Yes — 1h Redis TTL | N/A — cron, bearer auth | Low |
| `/api/cron/process-campaigns` | Resend (batch send) | No — transactional | 95/day cap enforced | Low — intentional, bounded |
| `lib/email/resend.ts` | Resend (transactional) | No — per-event | N/A | Low — fire-and-forget, 10s timeout |
| `lib/analytics/server-errors.ts` | PostHog | No — fire-and-forget | N/A | Low — 5s timeout added 2026-04-10 |
| `/api/generate`, `/api/refresh` | GitHub (stats fetch) | Yes — cache-first (6h + 7d stale) | Yes — 5/hr per handle | Low |

All GitHub data fetches check Redis first. No route calls GitHub unconditionally.

---

## Resource Management

**No leaks found.**

- All `setTimeout` usage is via `withTimeout()` at `lib/cache/with-timeout.ts` — timer cleared in `.finally()`.
- No raw `Promise.race` + `setTimeout` patterns remain (last one in `pingRedis` fixed in 2026-04-19 triage).
- No module-level mutable arrays or maps that grow unboundedly.
- Warm-cache batch processing uses `processInBatches(handles, BATCH_SIZE=5)` — bounded concurrency, GC'd after each cron run.
- Supabase and Resend connections are HTTP-based; no explicit close needed or missing.

---

## Vercel Cost Factors

### Serverless configuration

- **No `middleware.ts`** — zero per-request middleware overhead.
- **No edge runtime routes** — all Node.js serverless (appropriate; SVG rendering + native `@resvg/resvg-js` requires Node).
- **`serverExternalPackages: ["@resvg/resvg-js"]`** — native binary kept server-side, correct.
- **`outputFileTracingIncludes`** — font TTF files bundled for badge SVG, OG image, and SVG-to-PNG routes. Necessary for resvg-js; no over-bundling.

### ISR / static generation

| Route | Revalidation | Mode |
|---|---|---|
| `/` | 3,600 s (1h) | ISR |
| `/about`, `/about/scoring`, `/about/verification` | 86,400 s (24h) | ISR |
| `/archetypes/[type]` (7 pages) | 604,800 s (7d) | ISR |
| `/privacy`, `/terms` | 86,400 s (24h) | ISR |
| `/u/[handle]` | 3,600 s (1h) | ISR |
| `/studio` | — | `force-dynamic` (intentional — user auth required) |
| `/experiments/*` | — | `force-dynamic` (intentional — feature-gated) |

All static-ish pages correctly configured. No ISR opportunities remain.

### Cron handlers

| Handler | `maxDuration` | Frequency | Notes |
|---|---|---|---|
| `warm-cache` | 300 s | Daily (2 AM) | 50 handles/run, batch-5 |
| `process-campaigns` | 300 s | Daily | 50 emails/batch, bounded |
| `sync-audience` | 300 s | Daily | Paginated Resend sync |
| `bulk-recalculate` (admin) | 300 s | On-demand | Admin-only, not scheduled |

3 scheduled crons — well within Vercel Pro invocation budget.

---

## Cost Estimate

**~$55–70/month at 10K users.** Unchanged from prior cycle. No new cost drivers introduced.

---

## Recommendations

### P2 (Future scale)

| # | Item | File | Action |
|---|---|---|---|
| P2-1 | `dbGetCampaignStats()` client-side aggregation | `lib/db/campaigns.ts:439` | Move sum to Supabase RPC at >5K sends/campaign |

### Monitors (ongoing)

| # | Item | Threshold |
|---|---|---|
| M1 | Avatar Redis memory (~300 MB max @10K users) | Review if approaching Upstash tier limit |
| M2 | OG image Redis memory (~150 MB max @1K active/day) | Review if approaching Upstash tier limit |
| M3 | HyperLogLog ~12 KB | Review quarterly |
| M4 | `metrics_snapshots` table (~3.65M rows/year @10K users) | Consider partitioning or archive policy at 5M rows |

No P1s. No P3s. All prior findings resolved.
