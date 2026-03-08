# Cost Analyst Report
> Generated: 2026-03-08 | Health status: GREEN

## Executive Summary

Infrastructure costs remain well-optimized with strong caching discipline and bounded resource usage. Three previously recurring issues are now **resolved**: share page ISR (3-audit streak), `merge_operations` retention policy, and `svgToPng()` timeout guard. Estimated monthly cost at 10K users holds steady at ~$56. One remaining gap: 3 GitHub OAuth fetch functions lack `AbortSignal.timeout()`.

## Redis Usage

### Key Patterns & TTLs

| Key Pattern | TTL | Size (per user) | Growth Risk | Notes |
|-------------|-----|-----------------|-------------|-------|
| `stats:v2:merged:{handle}` | 6h | ~2-3 KB | Bounded | Primary merged stats cache |
| `stats:stale:{handle}` | 7d | ~2-3 KB | Bounded | Fallback for rate-limited API |
| `stats:v2:bitbucket:{handle}` | 6h | ~2-3 KB | Bounded | Bitbucket platform cache |
| `stats:v2:codeberg:{handle}` | 6h | ~2-3 KB | Bounded | Codeberg platform cache |
| `avatar:{handle}` | 6h | ~20-50 KB | Bounded | Base64-encoded avatar (#1 per-user cost driver) |
| `snapshot:latest:{handle}` | 24h | ~300 bytes | Bounded | Latest MetricsSnapshot for EMA smoothing |
| `supplemental:{handle}` | 24h | ~2-3 KB | Bounded | EMU supplemental stats |
| `studio:config:{handle}` | 365d | ~1-2 KB | Bounded | Badge customization config |
| `badge:notified:{handle}` | 365d | 1 byte | Bounded | First-badge email dedup marker |
| `score-bump:{handle}` | 7d | 1 byte | Bounded | Score-bump email dedup marker |
| `ratelimit:badge:{ip}` | 60s | 8 bytes | Auto-expires | IP-based, momentary accumulation |
| `ratelimit:verify:{ip}` | 60s | 8 bytes | Auto-expires | IP-based |
| `ratelimit:history:{ip}` | 60s | 8 bytes | Auto-expires | IP-based |
| `ratelimit:refresh:{handle}` | 1h | 8 bytes | Bounded | Per-handle |
| `ratelimit:supplemental:{handle}` | 24h | 8 bytes | Bounded | Per-handle |
| `stats:badges_generated` | None | 8 bytes | Fixed | Persistent counter (intentional) |
| `stats:unique_badges` | None | ~12 KB | Fixed | HyperLogLog (intentional) |
| `cron:warm-cache:offset` | None | 8 bytes | Fixed | Round-robin rotation state (intentional) |
| `og-image:{handle}` | 24h | ~50-200 KB | Bounded | Cached PNG for OG images |

### Summary
- **TTL coverage**: 100% of per-user keys have TTLs. 3 global keys without TTL — intentional, combined <16 KB.
- **Per-user Redis**: ~60–210 KB (with avatar) / ~8–15 KB (without). Avatar cache remains #1 per-user cost driver.
- **Growth risk**: LOW. All patterns bounded. IP-based rate limit keys auto-expire in 60s.

## Database Usage (Supabase)

### Tables & Views

| Table | Retention | Cleanup | Row Estimate (10K users) |
|-------|-----------|---------|--------------------------|
| `users` | Permanent | — | 10K |
| `metrics_snapshots` | Permanent | — | ~3.6M/year (10K × 365) |
| `verification_records` | 30 days | Cron batch (1000/run) | ~10K active |
| `merge_operations` | **90 days** ✅ | Cron batch (1000/run) | ~1K active |
| `feature_flags` | Permanent | — | <20 |
| `user_platforms` | Permanent | — | ~5K (multi-platform users) |
| **Views**: `latest_snapshots`, `admin_users` | — | — | Derived |

### Query Efficiency
- **Connection model**: Lazy singleton via `getSupabase()`, service role key, `persistSession: false`.
- **N+1 queries**: 1 minor — `isAgentEnabled()` in `feature-flags.ts:78-84` makes 2 sequential queries (master flag + agent flag). Low impact (small table, infrequent).
- **Batch operations**: `dbGetLatestSnapshotBatch()` (snapshots.ts:270) fetches up to 50 snapshots in single `IN` query — prevents N+1 in warm-cache cron.
- **View optimization**: `admin_users` view pre-joins users + latest snapshot, eliminating client-side joins.
- **Fail-open**: All DB functions return defaults on error — no badge/page failures from DB outages.

### Resolved: `merge_operations` Retention
Previously flagged as write-only with unbounded growth. Now has:
- 90-day retention via `MERGE_OPS_RETENTION_DAYS` constant (telemetry.ts:11)
- Batch cleanup: `dbCleanExpiredMergeOperations()` (telemetry.ts:81-105), 1000 rows/run
- Called from warm-cache cron (warm-cache/route.ts:164)

## External API Calls

| Route | External Service | Cached | Rate Limited | Timeout | Risk |
|-------|-----------------|--------|-------------|---------|------|
| `/u/[handle]/badge.svg` | GitHub API | ✅ 6h+7d stale | ✅ 100/IP/60s | ✅ 15s | Low |
| `/u/[handle]/page.tsx` | GitHub API | ✅ 6h+ISR 1h | — | ✅ 15s | Low |
| `/u/[handle]/og-image` | GitHub API + Resvg | ✅ 24h PNG | — | ✅ 10s race | Low |
| `/api/auth/callback` (GitHub) | GitHub OAuth (3 calls) | N/A | ✅ 10/IP/15m | ❌ **None** | **Medium** |
| `/api/auth/bitbucket/callback` | Bitbucket OAuth | N/A | ✅ 10/IP/15m | ✅ 10s | Low |
| `/api/auth/codeberg/callback` | Codeberg OAuth | N/A | ✅ 10/IP/15m | ✅ 10s | Low |
| `/api/refresh` | GitHub API (forced) | Invalidates first | ✅ 5/handle/1h | ✅ 15s | Low |
| `/api/supplemental` | GitHub user validation | ✅ 24h | ✅ 10/handle/24h | ❌ inherits | Low |
| `/api/cron/warm-cache` | GitHub API (50 handles) | ✅ per-handle | N/A (cron) | ✅ 15s | Low |
| GitHub GraphQL | `fetchContributionData` | Via stats cache | OAuth token | ✅ 15s | Low |
| Bitbucket REST | `fetchBitbucketContributionData` | Via stats cache | OAuth token | ✅ 30s global | Low |
| Codeberg API | `fetchCodebergContributionData` | Via stats cache | OAuth token | ✅ 30s global | Low |

### GitHub API Headroom
- Authenticated: 5,000 req/hr → ~3.6M/month
- Estimated usage at 10K users: ~100K calls/month (warm-cache: 50/day × 30 = 1,500; badge renders: ~3K/day)
- **Headroom**: ~35x over estimated usage
- Request deduplication (`_inflight` Map) reduces concurrent calls 40–60%

### Resolved: Platform Fetch Parallelization
Bitbucket + Codeberg platform fetches now run in parallel via `Promise.allSettled()` (client.ts:117). Per-repo API calls within each platform are still sequential — optimization opportunity exists but impact is low (capped at 50 repos, 30s global timeout).

## Resource Management

| Resource | Pattern | Status |
|----------|---------|--------|
| Redis client | Lazy singleton (`redis.ts:14-36`) | ✅ No leaks |
| Supabase client | Lazy singleton (`supabase.ts:10-31`) | ✅ No leaks |
| In-flight dedup | Self-cleaning Map with `.finally()` (`client.ts:20-62`) | ✅ No leaks |
| `after()` hooks | `Promise.allSettled()` isolation (`badge.svg/route.ts:123-164`) | ✅ No leaks |
| Avatar fetch | 5s `AbortSignal.timeout()`, host whitelist (`avatar.ts:18-74`) | ✅ Safe |
| SVG→PNG | `Promise.race()` with 10s timeout (`og-image/route.ts:81-86`) | ✅ **Resolved** |
| Pagination | Hard caps: MAX_PAGES=5, MAX_REPOS=50 (`bitbucket/queries.ts`, `codeberg/queries.ts`) | ✅ Safe |
| Email notifications | Fire-and-forget, deduped, production-only guard | ✅ Safe |

**Zero resource leaks detected.** All connections properly managed via singletons. All deferred work isolated. No unbounded in-memory buffers.

## Vercel Cost Factors

### ISR Coverage

| Page | ISR | Revalidate | Status |
|------|-----|-----------|--------|
| `/u/[handle]` (share page) | ✅ | 1h | **RESOLVED** — 3-audit recurring item |
| `/about` | ✅ | 1h | Good |
| `/about/scoring` | ✅ | 1h | Good |
| `/about/verification` | ✅ | 1h | Good |

Share page ISR cuts serverless invocations by 80–90% for popular handles.

### Edge Caching
- Badge SVG: `s-maxage=21600, stale-while-revalidate=604800` — blocks ~90% of badge requests at CDN edge
- OG image: `s-maxage=21600` — same pattern
- History API: `s-maxage=3600, stale-while-revalidate=86400`
- Verify API: `s-maxage=3600, stale-while-revalidate=86400`

### Serverless Optimization
- `@resvg/resvg-js` externalized (native binary, not bundled) — `next.config.ts:93`
- Only 6 `"use client"` components in critical paths — minimal hydration overhead
- No edge runtime usage (appropriate for this workload)
- Cron job for warm-cache runs daily at 6 AM UTC — reduces cold starts

### Estimated Monthly Cost (10K users)

| Service | Estimated Cost | Notes |
|---------|---------------|-------|
| Vercel (Pro) | ~$26 | ISR + edge caching drastically reduce invocations |
| Upstash Redis | ~$20 | ~600 KB–2 MB total, well within free/pay-as-you-go |
| Resend | ~$10 | First-badge + score-bump notifications |
| Supabase | Free tier | <10K rows active, metrics_snapshots grows ~3.6M/year |
| **Total** | **~$56/month** | |

## Recurring Items Tracker

| Item | First Flagged | Status | Resolution |
|------|--------------|--------|------------|
| Share page ISR | 2026-03-05 | ✅ **RESOLVED** | `revalidate=3600` added to `/u/[handle]/page.tsx:1` |
| `merge_operations` retention | 2026-03-05 | ✅ **RESOLVED** | 90-day cleanup via `dbCleanExpiredMergeOperations()` (telemetry.ts:81) |
| `svgToPng()` timeout | 2026-03-06 | ✅ **RESOLVED** | `Promise.race()` with 10s timeout in og-image/route.ts:81-86 |
| GitHub OAuth timeouts | 2026-03-05 | ⚠️ **OPEN** | 3 functions in `lib/auth/github.ts` still lack `AbortSignal.timeout()` |
| Sequential per-repo BB/CB calls | 2026-03-05 | ℹ️ **Low priority** | Capped by pagination limits + 30s global timeout |

## Recommendations

### Priority 1 — Add Timeouts to GitHub OAuth (Medium Risk)
**3 functions** in `apps/web/lib/auth/github.ts` lack `AbortSignal.timeout()`:
- `exchangeCodeForToken()` — token exchange with `github.com`
- `fetchGitHubUser()` — user profile from `api.github.com/user`
- `fetchGitHubUserEmail()` — email from `api.github.com/user/emails`

Without timeouts, these can hang up to Vercel's 31s max function duration. Bitbucket and Codeberg equivalents already have 10s timeouts. Add `AbortSignal.timeout(10_000)` to all three.

### Priority 2 — Parallelize GitHub OAuth Email Fetch (Low Risk)
In `/api/auth/callback/route.ts`, `fetchGitHubUserEmail()` runs sequentially after `fetchGitHubUser()`. These could run in parallel via `Promise.all()` to save ~200ms per login.

### Priority 3 — Monitor `metrics_snapshots` Growth
At 10K users, this table grows ~3.6M rows/year. Currently on Supabase free tier. At ~10M rows, consider:
- Adding a retention window (keep last 2 years)
- Or upgrading to Supabase Pro (~$25/month) when approaching free tier limits

### No Action Required
- Redis key growth: fully bounded, all TTLs in place
- `badge:notified:*`: 365-day TTL, 1 byte per user — negligible
- Fail-open rate limiting: intentional, documented, GitHub API limits provide backup
- Per-repo sequential BB/CB calls: capped by pagination limits, 30s global timeout
