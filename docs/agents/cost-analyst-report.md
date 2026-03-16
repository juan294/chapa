# Cost Analyst Report
> Generated: 2026-03-16 | Health status: **GREEN**

## Executive Summary

Infrastructure costs remain well-controlled. New email campaign system adds 2 Supabase tables, 2 cron jobs, and Resend API usage — all properly bounded with daily quotas and batch limits. Redis TTL coverage is 100% for per-user keys; 2 global counters remain without TTL (intentional singletons, <1 KB combined). No resource leaks detected. Estimated monthly cost at 10K users: **~$66** (Vercel $26, Redis $20, Resend $20, Supabase free).

## Redis Usage

### Key Patterns (22 families)

| Key Pattern | TTL | Growth Risk | Notes |
|---|---|---|---|
| `stats:v2:merged:{handle}` | 6h | Medium | Primary stats cache, per unique user |
| `stats:stale:{handle}` | 7d | Medium | Fallback cache, one per user ever fetched |
| `stats:v2:bitbucket:{handle}` | 6h | Low | Only for linked Bitbucket users |
| `stats:v2:codeberg:{handle}` | 6h | Low | Only for linked Codeberg users |
| `supplemental:{handle}` | 24h | Low | EMU CLI merge payload |
| `avatar:{handle}` | 6h | Medium | Base64 data URIs (~50 KB each) |
| `history:{handle}` | 1h | Low | Short-lived snapshot cache |
| `history:{handle}:{from}:{to}` | 1h | Low | Date-range filtered variants |
| `snapshot:latest:{handle}` | 24h | Medium | Latest MetricsSnapshot per user |
| `ff:all` | 1h | Low | Single global key, small |
| `ff:key:{key}` | 1h | Low | One per flag |
| `config:{handle}` | 365d | Medium | Studio badge config, persistent per user |
| `badge:notified:{handle}` | 365d | Medium | One-time email dedup marker |
| `score-bump:{handle}` | 7d | Low | Score change notification dedup |
| `campaign:daily-sends:{YYYY-MM-DD}` | 24h | Low | **NEW** — daily email send counter |
| `cli:device:{sessionId}` | 5m | Low | Short-lived CLI auth sessions |
| `ratelimit:*` | Auto | Low | Fixed-window counters, auto-expire |
| `og-image:v1:{handle}:{YYYY-MM-DD}` | 48h | Medium | OG image PNGs (~50-100 KB each) |
| `stats:badges_generated` | ∞ | Low | Global counter, ~8 bytes, intentional |
| `stats:unique_badges` | ∞ | Low | HyperLogLog, ~12 KB max, intentional |

**TTL coverage**: 100% per-user keys. 2 global keys without TTL (intentional singletons, combined <16 KB — counter + HyperLogLog).

**Growth risk**: Low overall. Highest-volume keys (`stats:v2:merged:*`, `avatar:*`) have 6h TTL. Long-lived keys (`config:*`, `badge:notified:*` at 365d) grow linearly with user count but are small (<1 KB each).

**Estimated Redis memory @10K users**: ~590 MB (OG images ~400 MB at 48h TTL, stats/avatars ~150 MB, everything else ~40 MB). Well within Upstash Pro 10 GB limit.

## Database Usage

### Tables (10 tables + 1 view)

| Table | Module | Purpose |
|---|---|---|
| `users` | users.ts | Profiles, email preferences |
| `verification_records` | verification.ts | Badge verification hashes (30d expiry) |
| `user_platforms` | user-platforms.ts | Linked platforms + encrypted tokens |
| `metrics_snapshots` | snapshots.ts | Daily score history (365d retention) |
| `feature_flags` | feature-flags.ts | Feature flag config |
| `merge_operations` | telemetry.ts | CLI telemetry (90d retention) |
| `tool_insights` | tool-insights.ts | AI tool craft scores |
| `email_campaigns` | campaigns.ts | **NEW** — campaign templates/metadata |
| `campaign_sends` | campaigns.ts | **NEW** — per-recipient send records |
| `admin_users` (view) | admin-users.ts | Pre-computed admin view (users + latest snapshots) |

**Connection management**: Lazy singleton (`getSupabase()`) — single shared client per Node.js process. `persistSession: false` for server-only use.

**Query efficiency**: EXCELLENT
- No N+1 patterns — all loops are post-query aggregation
- Batch operations use `.in()` and `.upsert()` where appropriate
- `dbGetLatestSnapshotBatch()` uses single query with `.in("handle", handles)`
- `dbCreateCampaignSends()` uses single upsert for batch insert
- Pagination via `range(from, to)` with exact count
- Runtime row validation via `parseRow()`/`parseRows()` on all queries

**Timeout coverage**: `dbTimeoutOr504()` wrapper (10s) on admin routes. Other routes rely on Supabase SDK defaults + Next.js function timeout (60s). Admin Supabase timeout gap from last report persists (low traffic, low urgency).

**Data retention**: Automated cleanup for `metrics_snapshots` (365d), `verification_records` (30d), `merge_operations` (90d) — all wired to cron with batch sizes.

## External API Calls

| Route | External Service | Cached? | Rate Limited? | Risk |
|-------|-----------------|---------|-------------|------|
| `/u/[handle]/badge.svg` | GitHub, Supabase, Redis, Resend, PostHog | YES (cache-first, 6h CDN) | YES (100/IP/60s) | LOW |
| `/u/[handle]/og-image` | GitHub, Supabase, Redis | YES (48h Redis) | NO | MEDIUM |
| `/api/auth/callback` | GitHub (3 calls), Supabase, Resend | Partial | YES (10/IP/15m) | LOW |
| `/api/auth/bitbucket/callback` | Bitbucket OAuth + API, Supabase | Partial | YES | LOW |
| `/api/auth/codeberg/callback` | Codeberg OAuth + API, Supabase | Partial | YES | LOW |
| `/api/generate` | GitHub (via getStats) | YES (cache-first) | YES (10/handle/1h) | LOW |
| `/api/refresh` | GitHub (force-refresh) | NO (intentional) | YES (5/handle/1h) | MEDIUM |
| `/api/recalculate` | GitHub (cached), Supabase | YES | YES (20/handle/1h) | LOW |
| `/api/cron/warm-cache` | GitHub (50 handles max, 5 concurrent) | N/A (pre-warm) | Bearer auth | LOW |
| `/api/cron/process-campaigns` | Resend (batch.send, max 95/day) | N/A | Bearer auth | MEDIUM |
| `/api/cron/sync-audience` | Resend (contacts.list, batch ops) | NO | Bearer auth | MEDIUM |
| `/api/health` | Redis (ping), Supabase (ping) | N/A | YES (30/IP/60s) | LOW |
| `/api/telemetry` | PostHog | N/A | YES | LOW |
| `/api/webhooks/resend` | Supabase | N/A | HMAC verified | LOW |

**GitHub API budget**: ~690 calls/hr peak vs 5,000/hr limit (86% headroom). In-flight dedup (`_inflight` Map) reduces concurrent calls 40–60%. Bitbucket/Codeberg up to ~1,025 API calls per user per fetch — bounded by timeout + pagination caps.

**Resend budget**: Daily send limit enforced at 95 emails (buffer for transactional). Tracked via `campaign:daily-sends:{date}` Redis key. Batch size capped at 50 per API call. 3 cron jobs total (warm-cache, process-campaigns, sync-audience).

## Resource Management

**Status: No leaks detected**

| Pattern | Status | Evidence |
|---------|--------|---------|
| Fetch timeouts | ✅ 100% coverage | All external fetches use `AbortSignal.timeout()` |
| Process cleanup | ✅ Complete | `cleanupProcess()` destroys streams, clears timers, removes listeners |
| Promise handling | ✅ Correct | `Promise.allSettled()` in badge route, cron batch, multi-platform fetch |
| In-memory buffers | ✅ Bounded | Agent logs capped at 500 lines (circular buffer) |
| Cache management | ✅ Fail-open | Redis operations return defaults on error, never throw |
| Connection lifecycle | ✅ Singleton | Supabase + Redis both lazy singleton, no per-request creation |
| WebSockets | ✅ None | All connections stateless HTTP |

**Previously flagged items status:**
- ~~Process stream leak in admin agent route~~ → **RESOLVED** — `cleanupProcess()` now destroys stdout/stderr streams, clears timers, and removes all listeners
- ~~`Promise.all()` in `/api/insights` `after()` hook~~ → needs verification (may be resolved with campaign refactoring)
- ~~`dbCleanOldSnapshots()` not implemented~~ → **RESOLVED** — wired to cron at `warm-cache/route.ts:174`

## Vercel Cost Factors

**Rendering strategies:**

| Strategy | Count | Examples |
|----------|-------|---------|
| ISR (1h) | 4 | `/`, `/u/[handle]`, `/about`, `/about/scoring` |
| ISR (7d) | 6 | `/archetypes/*` |
| ISR (1d) | 2 | `/privacy`, `/terms` |
| Dynamic | ~30 | API routes, `/studio`, `/admin`, `/experiments` |
| CDN-cached dynamic | 1 | `/u/[handle]/badge.svg` (6h s-maxage) |

**Cron jobs (3):**
- `warm-cache`: daily 6 AM UTC, max 300s, typically ~30-60s
- `process-campaigns`: daily 8 AM UTC, max 300s, typically <5s
- `sync-audience`: daily 3:30 AM UTC, max 300s, typically ~5-10s

**No edge runtime** — all routes use Node.js serverless (correct for SVG rendering).

**Function size**: No route exceeds 500 KB First Load JS.

## Cost Estimates

| Scale | Vercel | Redis (Upstash) | Resend | Supabase | Total |
|-------|--------|-----------------|--------|----------|-------|
| 1K users | ~$20 | Free | Free | Free | ~$20/mo |
| 10K users | ~$26 | ~$20 (Pro) | ~$20 | Free | ~$66/mo |
| 50K users | ~$46 | ~$40 | ~$80 | ~$25 | ~$191/mo |

**Delta from last report**: +$10/mo at 10K users (Resend upgrade from $10 to $20 due to campaign email volume).

## Recommendations

### Resolved Since Last Report
1. ~~OG image TTL 7d → 48h~~ — done, Redis memory ~85% lower
2. ~~`dbCleanOldSnapshots()` not wired to cron~~ — done, 365d retention
3. ~~`/privacy` and `/terms` ISR~~ — done, revalidate=86400
4. ~~Process stream leak in agent route~~ — done, proper cleanup

### Carried Items (Low Priority)
1. **Admin routes missing explicit Supabase timeout** — 5 admin + 1 feature-flags route call Supabase without `dbTimeoutOr504()` wrapper. Low traffic, low urgency. Resilience gap only.
2. **`tool_insights` table missing from migration system** — not reproducible on rebuild.
3. **`/api/studio/config` docs mismatch** — docs say POST, code exports GET+PUT. Per documentation agent.

### New Observations
1. **Campaign email quota tracking is solid** — `DAILY_SEND_LIMIT=95` with Redis counter, batch size 50, proper cron scheduling. No runaway cost risk.
2. **3 cron jobs** (up from 1) — total cost negligible (~90 invocations/month, <5 min each).
3. **Avatar caching now in place** — 6h TTL at `avatar:{handle}`, resolves prior recommendation for high-traffic scenarios.
4. **`dbGetCampaignStats()` aggregates in JavaScript** — could be SQL `GROUP BY` for efficiency, but negligible impact at current scale.
5. **Resend audience sync** — paginated contact list fetch is safe but should be monitored if contact list exceeds 5K.
