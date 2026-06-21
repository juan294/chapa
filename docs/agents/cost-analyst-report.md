# Cost Analyst Report
> Generated: 2026-06-21 | Health status: green

## Executive Summary

Infrastructure cost posture remains GREEN and flat at ~$50–75/mo for 10K users. Two merges since the last cycle — progressive-disclosure (UI-only, zero cost) and platform-fetcher refactor (consolidation of bitbucket/codeberg/gitlab clients into a shared skeleton, cost-neutral) — leave every cached call site, TTL configuration, and Supabase query pattern unchanged from the prior audit.

---

## Cost-Surface Diff Since 2026-06-20

HEAD `226e5528 → f83d346f` via four commits:

| Commit | Change | Cost impact |
|--------|--------|-------------|
| `91790f88` | feat(share): progressive disclosure — `CommandBarHint` UI component, i18n keys | **ZERO** — UI-only, no API changes |
| `924f6f1a` | refactor(platform): unify bitbucket/codeberg/gitlab into `fetchLinkedPlatformStats` | **ZERO** — pure consolidation, same TTLs, same neg-cache behavior |
| `aaa1784c` | fix(env): NEXT_PUBLIC flags via static literals | **ZERO** — build-time inlining only |
| `f83d346f` | chore: back-merge main into develop (v2.11.0 reconcile) | **ZERO** — no app code |

All prior cost findings re-verified in source this cycle — not blind-carried.

---

## Redis Usage

### Key Patterns & TTLs

| Key pattern | TTL | Notes |
|-------------|-----|-------|
| `stats:v2:merged:<handle>` | 6h | Primary merged stats (GitHub + platforms) |
| `stats:stale:<handle>` | 7d | Stale fallback served on API failure |
| `stats:v2:<platform>:<handle>` | 6h | Per-platform stats (bitbucket/codeberg/gitlab) |
| `stats:v2:<platform>:<handle>:neg` | 1h | Negative-result short-circuit (new in prior cycle, now in shared skeleton `fetch-linked-platform.ts:96,102`) |
| `supplemental:<handle>` | 24h | EMU supplemental stats (Redis hot path) |
| `badge:<version>:<handle>:warm-amber:<date>` | 24–26h | SVG output cache (base 24h + per-handle jitter up to +2h, `badge-svg-cache.ts:85`) |
| `badge-lock:<version>:<handle>:warm-amber:<date>` | 30s | Render dedup lock |
| `badge:notified:<handle>` | 365d | First-badge notification dedup marker (fixed cardinality) |
| `config:<login>` | 365d | Studio badge config (fixed cardinality) |
| `snapshot:<handle>` | 24h | Snapshot cache (`snapshot-cache.ts:18`) |
| `craft:<handle>` | 1h | Craft score cache |
| `history:<handle>` | 1h | Score history |
| `avatar:<handle>` | 6h | Avatar base64 |
| `og:<handle>` | 48h | OG image base64 |
| `score-bump:<handle>` | 7d | Score bump notification dedup |
| `ratelimit:*` | 60s–3600s | Rate limit counters (badge, health, refresh, config, profile) |
| `cli:device:<sessionId>` | 5m | CLI device auth sessions |
| `cron:contacts` | 1h | Resend audience contact list |
| `engagement:campaign:<id>` | 1h | Campaign engagement flag |
| `dirty-stats:<handle>` | 1h | Same-day refresh dirty marker |
| `cron:warm-cache:offset` | **0 (persistent)** | Rotation cursor — bounded single key |
| `stats:badges_generated` | **0 (persistent)** | INCR counter — single key |
| `stats:unique_badges` | **0 (persistent)** | HLL ~12KB — single key |

**TTL coverage: 23/24 non-test `cacheSet` call sites carry explicit positive TTL (96%).** The 3 TTL-0 exceptions are all bounded singletons (rotation cursor, INCR counter, HLL). The `cacheSet` default is 21600s with a `ttlSeconds > 0` guard at `redis.ts:75–76` preventing accidental persistent writes.

**Growth risk: LOW.** Per-user key count is bounded (~12 keys/user). The two 365d keys (`config:` and `badge:notified:`) are overwrite semantics (fixed cardinality, not accumulating). The `fetch-linked-platform.ts` refactor (#744) confirmed: neg-cache keys (`stats:v2:<platform>:<handle>:neg`) use 1h TTL and are bounded to 3 platforms × N users.

---

## Database Usage

**Tables: 10** (migrations 001–026, latest `026_seed_integration_flags.sql`)

| Table | Notes |
|-------|-------|
| `users` | Central user registry |
| `metrics_snapshots` | Permanent lifetime history (UNIQUE on handle+date, SNAPSHOT_RETENTION_DAYS=365, cleaned by cron) |
| `verification_records` | Badge HMAC records (cleaned by cron) |
| `feature_flags` | Async-readable flags, cached in Redis |
| `merge_operations` | CLI EMU merge ops (cleaned after 90d by cron) |
| `user_platforms` | Linked platform accounts (bitbucket/codeberg/gitlab) |
| `tool_insights` | AI tool insights submissions |
| `email_campaigns` | Campaign definitions |
| `campaign_sends` | Individual send records |
| `supplemental_stats` | Durable EMU fallback (Redis is hot path) |

**RLS: 10/10 ENABLE + 10/10 FORCE RLS.** Service-role client (`supabase.ts`) bypasses RLS for all server-to-server operations — intentional. Deny-all-anon policies in migrations 008 + 018.

**Connection management: lazy singleton** (`supabase.ts:13–34`), `persistSession: false`, `server-only` boundary at line 8. One connection per serverless instance lifetime — no per-request reconnects.

**Query efficiency:**
- Warm-cache cron: `dbGetLatestSnapshotBatch()` — single batch query for all handles, not N+1. (`warm-cache/route.ts:115`)
- `_enrichWithLogins()` — N DB reads for platforms on cache-hit enrichment path, bounded to max 3 (one per platform). Backfills enriched stats to Redis on fire-and-forget so subsequent hits skip reads.
- **P2-1 (CARRIED)**: `dbGetCampaignStats()` makes 4 parallel `COUNT` queries (`campaigns/sends.ts:251`). Zero row transfer (`head: true`). Only matters at >5K sends/campaign — not triggered at current scale.

---

## External API Calls

| Route | External Service | Cached? | Rate Limited? | Risk |
|-------|-----------------|---------|---------------|------|
| `GET /api/health` | GitHub (rate_limit probe) | ✅ `unstable_cache` 60s | ✅ 30/IP/60s | LOW |
| `GET /u/[handle]/badge.svg` | GitHub (via `getStats`) | ✅ 6h + 7d stale | ✅ 100/IP·handle/60s | LOW |
| `POST /api/refresh` | GitHub (force-refresh) | ✅ writes 6h cache after | ✅ 5/handle/hr | LOW |
| `POST /api/generate` | GitHub (via `getStats`) | ✅ 6h cache | ✅ session auth | LOW |
| `GET /api/cron/warm-cache` | GitHub (batched, BATCH_SIZE=5) | ✅ writes 6h cache | ✅ CRON_SECRET | LOW |
| `GET /api/cron/sync-audience` | Resend (audience list) | ✅ 1h Redis | ✅ CRON_SECRET | LOW |
| `GET /api/cron/process-campaigns` | Resend (email send) | N/A (event-driven) | ✅ daily `cacheReserveQuota` | LOW |
| `GET /api/cron/warm-cache` | Bitbucket/Codeberg/GitLab (per linked user) | ✅ 6h per platform + 1h neg | ✅ CRON_SECRET | LOW |
| `GET /api/admin/bulk-recalculate` | GitHub (batched, ADMIN_SECRET) | ✅ writes 6h cache | ✅ bearer token | LOW |

**Uncached external calls: 0.** Every outbound call is behind a Redis or `unstable_cache` layer. Fetch-timeout coverage: **100%** — all server fetches carry `AbortSignal.timeout` or `withTimeout`.

---

## Resource Management

**In-flight dedup maps:**
- `inflightBadgeRenders` (`badge.svg/route.ts:41`): keyed by SVG cache key, deleted in `finally` block — no leak.
- `_inflight` (`github/client.ts:29`): keyed by `<handle>:public|authenticated`, cleaned via `.finally()` — no leak. Bounded by INFLIGHT_TIMEOUT_MS=30s.

**Platform fetcher refactor (#744):**  
`fetch-linked-platform.ts` is a pure function with no module-level state. Each call is synchronous setup + async resolution. No leak surface introduced by the refactor.

**Progressive disclosure (#783):**  
`CommandBarHint.tsx` is a client component with local `useState`. No effect cleanup concerns — no subscriptions, no timers.

**Memory bounds:**
- No large in-memory caches without TTL. Redis is the sole durable store for computed values.
- `stats:unique_badges` HLL: ~12KB fixed — the only unbounded-time Redis structure, bounded in size.
- In-memory `_inflight` maps are per-instance; serverless cold-starts reset them.

**Cron cleanup:** warm-cache cron performs 3 table cleanups per run:
- `dbCleanExpiredVerifications()` — verification records
- `dbCleanExpiredMergeOperations()` — merge ops >90d
- `dbCleanOldSnapshots()` — snapshots >365d (batch 1000 rows max to avoid table locks)

---

## Vercel Configuration

| Route | maxDuration | Cache-Control | Rendering |
|-------|-------------|--------------|-----------|
| `/u/[handle]/badge.svg` | 35s | `public, s-maxage=21600, stale-while-revalidate=86400` | Dynamic + Redis |
| Error badge fallback | — | `public, s-maxage=300, stale-while-revalidate=600` | — |
| `/api/cron/warm-cache` | 300s | `no-store` | Serverless |
| `/api/cron/sync-audience` | 300s | — | Serverless |
| `/api/cron/process-campaigns` | 300s | — | Serverless |
| `/api/admin/bulk-recalculate` | 300s | — | Serverless |
| `/api/profile/[handle]` | default | `public, s-maxage=300, stale-while-revalidate=3600` | Dynamic |
| `/api/health` | default | `no-cache` (implicit) | Dynamic |
| `/`, archetypes, about, verify, privacy, terms | — | ISR `revalidate=3600, force-static` | Static |
| `/u/[handle]` (share page) | — | ISR `revalidate=3600` | ISR |
| `/studio`, `/admin` | — | `force-dynamic` | Dynamic |

**ISR coverage**: landing page, 7 archetype pages, about (3 sub-pages), verify, privacy, terms — all `force-static` with 1h revalidate. These pages generate zero Vercel function invocations on CDN-hit traffic.

**Bundle (flat since 2026-06-18)**: 1,950 KB raw / 623 KB gzipped. No new client bundle weight from progressive-disclosure or platform-fetcher refactor (both are server-side or minimal client components).

---

## Recommendations

### Carries from prior cycles

| ID | Finding | Priority | Threshold |
|----|---------|----------|-----------|
| P2-1 | `dbGetCampaignStats()` runs 4 parallel COUNT queries per campaign stats read (`campaigns/sends.ts:251`). Zero row transfer; cost only matters above ~5K sends/campaign. Add Redis counter cache if campaign scale grows. | P2 | >5K sends/campaign |
| M7 | `config:<login>` key: 365d TTL, overwrite semantics. Fixed cardinality — no accumulation risk. Monitor if user count grows beyond 10K. | Monitor | >10K users |
| M8 | `badge:notified:<handle>` key: 365d TTL, overwrite semantics. Same as M7. | Monitor | >10K users |

### New findings this cycle

None. The platform-fetcher refactor and progressive-disclosure commits introduce no new cost surface. All 24 non-test `cacheSet` sites verified in source.

**P1s: NONE. P2s: 1 active (P2-1, threshold-gated). P3s: 0.**

---

## Cost Estimate

| Service | Usage pattern | Estimated monthly (10K users) |
|---------|--------------|-------------------------------|
| Upstash Redis | ~12 keys/user, daily cache warm + badge serves | ~$10–15 |
| Supabase | 10 tables, daily snapshot inserts, cron cleanup | ~$25 (Pro tier) |
| Vercel | ISR for static pages, 35s badge fn, 300s cron | ~$15–35 (Pro) |
| **Total** | | **~$50–75/mo** |
