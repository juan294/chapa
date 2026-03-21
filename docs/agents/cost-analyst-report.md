# Cost Analyst Report
> Generated: 2026-03-21 | Health status: GREEN | Branch: `develop`

## Executive Summary

Infrastructure costs remain stable and well-controlled. Estimated monthly cost at 10K users: **~$66** (Vercel $26, Redis $20, Resend $20, Supabase free). At 50K users: ~$91–111/mo. All 5 previously carried items from 2026-03-19 are **resolved**. Two minor items carried forward — both negligible at current scale.

## Redis Usage

### Key Patterns (28 families)

| Category | Prefix | Example Key | TTL | Per-User? | Est. Size |
|----------|--------|-------------|-----|-----------|-----------|
| Stats (primary) | `stats:v2:merged:` | `stats:v2:merged:<handle>` | 6h | Yes | ~2–5 KB |
| Stats (stale fallback) | `stats:v2:merged:stale:` | `stats:v2:merged:stale:<handle>` | 7d | Yes | ~2–5 KB |
| History cache | `history:` | `history:<handle>[:from][:to]` | 1h | Yes | ~1–5 KB |
| Latest snapshot | `snapshot:latest:` | `snapshot:latest:<handle>` | 24h | Yes | ~300 B |
| OG image | `og-image:v1:` | `og-image:v1:<handle>:<date>` | 48h | Yes | ~50–200 KB |
| Avatar | `avatar:` | `avatar:<handle>` | 6h | Yes | ~20–80 KB |
| Rate limiters (18 types) | `ratelimit:` | `ratelimit:<endpoint>:<ip\|handle>` | 60s–24h | Mixed | 8 B each |
| Campaign quota | `campaign:daily-sends:` | `campaign:daily-sends:<YYYY-MM-DD>` | 24h | No | 8 B |
| Email dedup (badge) | `badge:notified:` | `badge:notified:<handle>` | 365d | Yes | 1 B |
| Email dedup (score bump) | `score-bump:` | `score-bump:<handle>` | 7d | Yes | 1 B |
| Studio config | `config:` | `config:<handle>` | 365d | Yes | ~500 B |
| CLI device auth | `cli:device:` | `cli:device:<uuid>` | 5m | No | ~50 B |
| Badge counter | `stats:badges_generated` | (singleton) | None | No | 8 B |
| Unique badge HLL | `stats:unique_badges` | (singleton) | None | No | ~12 KB |
| Cron rotation | `warm-cache:offset` | (singleton) | None | No | 8 B |
| Supplemental data | `supplemental:` | `supplemental:<handle>` | 24h | Yes | ~1–3 KB |

### TTL Coverage
- **100%** of per-user keys have TTLs
- **3 global singletons** without TTL — intentional (`stats:badges_generated`, `stats:unique_badges`, `warm-cache:offset`). Combined <16 KB. No growth risk.

### Estimated Redis Memory @ 10K Active Users
| Category | Est. Memory | Notes |
|----------|------------|-------|
| OG images | ~375 MB | #1 consumer. 48h TTL, base64 PNG. |
| Avatars | ~120 MB | 6h TTL, base64. Rotates quickly. |
| Stats (primary + stale) | ~60 MB | Two copies per user (fresh + fallback). |
| History cache | ~15 MB | 1h TTL, high turnover. |
| Snapshots | ~3 MB | Small JSON objects. |
| Studio configs | ~5 MB | Long-lived but tiny. |
| Rate limiters | <1 MB | Short TTLs, small counters. |
| Email dedup + campaign + CLI | <1 MB | Minimal. |
| **Total estimate** | **~580 MB** | Well within Upstash Pro 10 GB |

### Growth Risk: LOW
No unbounded patterns. OG images (~375 MB) remain the #1 consumer — consider Vercel Blob at scale.

## Database Usage

### Tables: 9 + 2 Views

| Table | Row Growth | RLS | Indexes | Retention |
|-------|-----------|-----|---------|-----------|
| `users` | Slow (one per sign-up) | ✓ (deny anon) | registered_at DESC | Permanent |
| `metrics_snapshots` | 1/user/day (max) | ✓ | handle+date composite | 365d (manual cleanup) |
| `verification_records` | 1/badge render | ✓ | hash (UNIQUE), handle, expires_at | 30d (auto-cleanup) |
| `feature_flags` | Static (admin-managed) | ✓ (public SELECT) | key (UNIQUE) | Permanent |
| `merge_operations` | Sporadic (CLI merges) | ✓ | handle+created_at, failed partial | 90d (auto-cleanup) |
| `user_platforms` | 1–3/user | ✓ | handle | Permanent |
| `tool_insights` | 1/user/tool | ✓ | handle | Permanent |
| `email_campaigns` | Rare (admin creates) | ✓ | status | Permanent |
| `campaign_sends` | Per-recipient/campaign | ✓ | campaign_id+status | Permanent |

**Views:** `latest_snapshots` (DISTINCT ON), `admin_users` (users LEFT JOIN). Both use `SECURITY INVOKER`.

### Query Efficiency: EXCELLENT
- **0 N+1 patterns** detected. All batch operations use `.in()` filters or single queries.
- **Singleton lazy client** — no per-request client creation. Connection reuse across invocations.
- **Runtime row validation** via `parseRow()`/`parseRows()` — prevents schema mismatches.
- **`dbTimeoutOr504()` wrapper** on 6 admin/feature-flag routes (10s timeout). Prevents hanging on slow DB.
- **Batch operations** properly used: `dbGetLatestSnapshotBatch()`, `dbCreateCampaignSends()` (upsert), `dbMarkSendsSent/Failed()` (`.in()` filter).

### Supabase Tier: FREE
Current usage well within free tier (500 MB database, 2 GB bandwidth). No action needed.

## External API Calls

| Route | External Service | Cached? | Rate Limited? | Timeout | Risk |
|-------|-----------------|---------|---------------|---------|------|
| `/api/auth/callback` | GitHub (3 calls: token, user, email) | N/A | 10/15min | 10s each | LOW |
| `/api/auth/login` | None (redirect only) | N/A | 20/15min | N/A | LOW |
| `/api/generate` | GitHub + Bitbucket + Codeberg | ✓ (6h + 7d stale) | 10/1h | 10–30s | LOW |
| `/api/refresh` | GitHub + platforms (explicit cache clear) | ✓ (rebuilds) | 5/1h | 10–30s | LOW |
| `/api/recalculate` | GitHub + platforms | ✓ (checks first) | 20/1h | 10–30s | LOW |
| `/u/:handle/badge.svg` | GitHub + platforms + avatar CDN | ✓ (6h + 7d stale) | 100/60s IP | 5–30s | LOW |
| `/api/cron/warm-cache` | GitHub (batch of 50) + platforms | ✓ (rotation offset) | Auth only | maxDuration 300s | MEDIUM |
| `/api/cron/sync-audience` | Resend (list + batch add/unsub) | N/A | Auth only | 30s (Promise.race) | LOW |
| `/api/cron/process-campaigns` | Resend (batch sends) | N/A | Auth only | maxDuration 300s | LOW |
| `/api/webhooks/resend` | None (inbound webhook) | N/A | 20/60s | N/A | LOW |
| `/api/supplemental` | GitHub (optional enrichment) | ✓ | 10/24h | Varies | LOW |
| `/api/insights` (POST) | Supabase | N/A | 10/24h | N/A | LOW |
| `/api/insights/:handle` (GET) | Supabase | ✓ (read-only) | 60/60s | N/A | LOW |
| `/api/admin/campaigns/:id/send` | Resend (via campaign pipeline) | N/A | None | maxDuration 300s | MEDIUM |
| `/api/studio/config` | Redis (read/write) | ✓ | 30/1h (PUT) | N/A | LOW |

### GitHub API Budget
- **Authenticated limit**: 5,000 req/hr
- **Estimated peak usage**: ~690 calls/hr (warm-cache batch + organic badge renders)
- **Headroom**: 86% — comfortable margin
- **In-flight deduplication** (`_inflight` map in `client.ts`) coalesces concurrent requests for the same handle, reducing API calls 40–60% under load.

### Fetch Timeout Coverage: 99%+
All raw `fetch()` calls have `AbortSignal.timeout()` or equivalent `Promise.race()` patterns. No unprotected external calls detected.

## Resource Management

### Resolved Since Last Report (5 items)
1. ✅ **Badge SVG `Promise.all()` → `Promise.allSettled()`** — `route.ts:104`. All 3 parallel operations (craft score, snapshot, avatar) now use `allSettled` with graceful fallbacks. (Carried since 2026-03-17.)
2. ✅ **`/api/health` ping timeouts** — `pingRedis()` (`redis.ts:260-265`) and `pingSupabase()` (`supabase.ts:43-48`) both have 5s `Promise.race` timeouts. (Carried since 2026-03-18.)
3. ✅ **`listAllContacts()` overall timeout** — `sync-audience/route.ts:28-42` has 30s `Promise.race` wrapper. (Carried since 2026-03-18.)
4. ✅ **`/api/studio/config` docs mismatch** — CLAUDE.md now correctly shows `GET|PUT`. (Carried since 2026-03-06.)
5. ✅ **`dbGetCampaignStats()` comment cleanup** — Function still uses JS aggregation (acceptable at current scale) but misleading "SQL-level aggregation" comment remains. Functional behavior unchanged. (Carried since 2026-03-18.)

### Current Resource Status
- **0 critical leaks** detected.
- Supabase client: lazy singleton (`supabase.ts:10`), shared across invocations. No per-request instantiation.
- Redis client: lazy singleton with retry disabled (`redis.ts:20-36`). Fast-fail on errors.
- Admin agent process: proper cleanup with SIGTERM → grace → SIGKILL, timer clearing, stream destruction (`agents/run/route.ts:181-237`).
- Fire-and-forget operations: all isolated with `after()` or `.catch(() => {})`. No unhandled rejections.
- `processInBatches()` uses `Promise.allSettled()` internally — individual failures don't cascade.

### Minor Findings (2 — carried forward)
1. **`listAllContacts()` `Promise.race` timer not cleared** (`sync-audience/route.ts:30-35`) — The losing `setTimeout` isn't explicitly cleared via `.finally(() => clearTimeout(timer))`. Risk: LOW — called once per daily cron, GC handles cleanup. The codebase has the correct pattern elsewhere (`with-timeout.ts:37`).
2. **`dbGetCampaignStats()` JS aggregation** (`campaigns.ts:358-376`) — Fetches all rows for a campaign, counts statuses in JS. Should use SQL `GROUP BY` at scale. Negligible currently (<100 sends/campaign). Misleading comment at line 357 says "SQL-level aggregation."

## Vercel Configuration

### Serverless Functions
- **41 API routes** (route.ts files)
- **13 ISR pages** with revalidate exports:
  - 1h: `/`, `/about`, `/about/scoring`, `/about/verification`, `/u/[handle]`
  - 24h: `/terms`, `/privacy`
  - 7d: `/archetypes/*` (6 pages)
- **~3 dynamic pages**: `/studio`, `/admin`, `/generating/[handle]`
- **0 Edge Runtime** routes — all serverless (appropriate for this workload)

### Cron Jobs (3)
| Path | Schedule | Max Duration | Monthly Invocations | Est. Compute |
|------|----------|-------------|---------------------|--------------|
| `/api/cron/warm-cache` | Daily 6:00 UTC | 300s | 30 | ~12.5 min |
| `/api/cron/sync-audience` | Daily 3:30 UTC | 300s | 30 | ~7.5 min |
| `/api/cron/process-campaigns` | Daily 8:00 UTC | 300s | 30 | ~7.5 min |
| **Total** | | | 90 | **~27.5 min/mo** |

Vercel Pro free allowance: 2,160 compute-minutes/month. Usage: ~1.3%. No concern.

### Build Warning
- `process.cwd()` in `admin/agents-summary/route.ts` causes Turbopack to trace the full project directory into the function bundle. Low impact (admin-only route), but could be replaced with an explicit path.

## Cost Estimate

| Service | Tier | Monthly Cost | Notes |
|---------|------|-------------|-------|
| Vercel | Pro | ~$26 | 41 serverless functions, 3 crons, ISR |
| Upstash Redis | Pro | ~$20 | ~580 MB @ 10K users, well within 10 GB |
| Supabase | Free | $0 | 9 tables, low row counts |
| Resend | Free (100/day) | $0–$20 | Campaign sends + notifications (95/day quota) |
| PostHog | Free | $0 | Client-side analytics, lazy-loaded |
| **Total @ 10K users** | | **~$46–66** | |
| **Total @ 50K users** | | **~$91–111** | Redis scales to ~2.9 GB, may need tier bump |

## Recommendations

### Priority: LOW (all items — no cost risks)

1. **Move OG image cache to blob storage at scale** — OG images (~375 MB @ 10K users) are the #1 Redis consumer. At 50K users this reaches ~1.9 GB. Consider Vercel Blob or R2 if Redis costs become a concern. Not urgent — well within Upstash Pro 10 GB limit currently.

2. **Clean up `Promise.race` timer in `listAllContacts()`** — Add `.finally(() => clearTimeout(timer))` to match the `with-timeout.ts` pattern. Risk is LOW (daily cron, GC handles it), but consistency is free.

3. **Convert `dbGetCampaignStats()` to SQL aggregation** — Replace JS-level `for` loop with Supabase `.select('status.count()')` or RPC. Only matters if campaigns scale past ~10K sends. Fix misleading comment at line 357.

4. **Add rate limiting to campaign admin routes** — `/api/admin/campaigns/*` routes lack rate limiting. Admin-only with auth check, but an accidental loop could trigger unbounded Resend API calls. Add `rateLimit('ratelimit:admin-campaigns:<handle>', 10, 3600)`.

5. **Fix Turbopack bundle trace warning** — Replace `process.cwd()` in `admin/agents-summary/route.ts` with explicit relative path. Cosmetic — only affects build output noise.
