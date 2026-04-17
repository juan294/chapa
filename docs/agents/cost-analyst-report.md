# Cost Analyst Report
> Generated: 2026-04-17 | Health status: green

## Executive Summary

Infrastructure posture remains GREEN with no P1s or active P2s. Two new P3 findings this cycle: missing `AbortSignal` on Bitbucket/Codeberg token refresh calls (`lib/github/client.ts`) and missing `.catch()` on `cacheDel()` in feature flag updates (`lib/db/feature-flags.ts`). All prior carried items unchanged.

---

## Redis Usage

**Key patterns (18 total across route files + core cache lib):**

| Pattern | TTL | Notes |
|---------|-----|-------|
| `stats:badges_generated` | **None** | Global counter — intentional, bounded (1 key) |
| `stats:unique_badges` | **None** | HyperLogLog — intentional, bounded ~12 KB (1 key) |
| `stats:v2:merged:{handle}` | **None** | Deleted on invalidation — effectively bounded |
| `craft:{handle}` | 1 hour | Craft score cache |
| `snapshot:latest:{handle}` | 24 hours | Latest metrics snapshot |
| `config:{handle}` | 365 days | Studio badge config — very long TTL, intentional |
| `og-image:v1:{handle}:{date}` | 48 hours | OG image PNG per handle/day |
| `ratelimit:badge:{ip}` | 60 s | 100 req/60s window |
| `ratelimit:insights:{handle}` | 24 hours | 10 req/24h window |
| `ratelimit:insights:{ip}` | 60 s | 60 req/60s window |
| `ratelimit:config:{handle}` | 1 hour | 30 req/hr window |
| `ratelimit:verify:{ip}` | 60 s | 30 req/60s window |
| `ratelimit:logout:{ip}` | 60 s | 10 req/60s window |
| `ratelimit:callback:{ip}` | 15 min | 10 req/15min window |
| `ratelimit:generate:{handle}` | 1 hour | 10 req/hr window |
| `ratelimit:refresh:{handle}` | 1 hour | 5 req/hr window |
| `ratelimit:history:{ip}` | 60 s | 100 req/60s window |
| `quota:daily:{key}` | Configurable | General daily quota (opt-in TTL) |

- **TTL coverage**: 100% on per-user keys. 3 no-TTL keys — all intentional and bounded.
- **Rate limiter behavior**: Fail-open (`redis.ts:126–148`) — allows all requests when Redis is unavailable. Correct design for a public badge service.
- **Growth risk**: LOW. Storage estimate ~300–800 MB @ 10K users (~91% headroom on Upstash free tier).
- **Monitor M1**: Avatar cache Redis memory (~300 MB max @ 10K users). CARRIED.
- **Monitor M2**: OG image Redis memory (`og-image:v1:*`) — ~150 MB max @ 1K active/day. CARRIED.
- **Monitor M3**: HyperLogLog ~12 KB. Track quarterly. CARRIED.

---

## Database Usage

- **Tables**: 9 (`users`, `metrics_snapshots`, `verification_records`, `feature_flags`, `user_platforms`, `merge_operations`, `email_campaigns`, `campaign_sends`, `tool_insights`)
- **Views**: 2 (`admin_users`, `latest_snapshots`)
- **Indexes**: 11 covering all hot query paths
- **Monitor M4**: `metrics_snapshots` table growth — ~3.65M rows/year @ 10K users. CARRIED.

**Query patterns:**
- No N+1 patterns detected. `dbGetLatestSnapshotBatch()` uses `.in()` bulk fetch correctly.
- `dbCreateCampaignSends()` and `dbMarkSendsSent()`/`dbMarkSendsFailed()` use bulk upsert/update.
- Batch cleanup functions cap at 1,000 rows per call to avoid table locks.

**Connection management**: Lazy singleton (`lib/db/supabase.ts:12–31`) — one client per Node.js process, reused across requests. No resource leaks. Graceful null return when env vars missing.

**P2-1 CARRIED**: `dbGetCampaignStats()` (`campaigns.ts:425–463`) — client-side aggregation via `for...of` loop over all sends. Acceptable at <1K sends/campaign; move to Supabase RPC at >5K sends/campaign.

**P3-8 NEW**: `dbUpdateFeatureFlag()` (`feature-flags.ts:177–180`) — `cacheDel()` calls not wrapped in `.catch()`. If Redis is unavailable, the thrown error crashes the entire flag update. Fix: add `.catch(() => {})` to both `cacheDel()` calls.

---

## External API Calls

| Route | External Service | Cached | Rate Limited | Timeout | Risk |
|-------|-----------------|--------|-------------|---------|------|
| `GET /api/cron/warm-cache` | GitHub GraphQL | ✅ Cache-first (6h + 7d stale) | ✅ 5 concurrent | 15s | LOW |
| `POST /api/generate` | GitHub GraphQL | ✅ Via `getStats()` | ✅ 10/handle/hr | 15s | LOW |
| `POST /api/refresh` | GitHub GraphQL | ✅ Explicit invalidate | ✅ 5/handle/hr | 15s | LOW |
| `POST /api/admin/bulk-recalculate` | GitHub GraphQL | ✅ Via `getStats()` | ✅ 5/IP/hr | 15s | LOW |
| `POST /api/webhooks/resend` | Resend REST | ✅ N/A (webhook) | ✅ 20/IP/60s | 5s | LOW |
| `GET /api/cron/sync-audience` | Resend Contacts API | ✅ Process-lifetime | N/A (cron) | 30s race | LOW |
| `GET /api/cron/process-campaigns` | Resend Batch API | ✅ Quota tracking | N/A (cron) | 10s via `withTimeout()` | LOW |
| `GET /api/auth/callback` (Bitbucket) | Bitbucket token refresh | ❌ No cache | ✅ 10/IP/15min | **⚠️ NONE** | MEDIUM |
| `GET /api/auth/callback` (Codeberg) | Codeberg token refresh | ❌ No cache | ✅ 10/IP/15min | **⚠️ NONE** | MEDIUM |
| Various | PostHog | N/A (analytics fire) | N/A | 5s | LOW |

**P3-7 NEW**: Bitbucket and Codeberg token refresh calls (`lib/github/client.ts:215, 284`) have no `AbortSignal.timeout()`. If the OAuth provider is unresponsive, the function hangs until the Vercel function timeout (10s default). Fix: add `AbortSignal.timeout(10000)` to both refresh fetches.

---

## Resource Management

- **Promise.race() timers**:
  - `sync-audience/route.ts:29–45` — timer properly cleared in `.finally()`. ✅
  - `og-image/route.ts:81–86` — timer **not** cleared. **P3-2 CARRIED** (cosmetic, fires harmlessly after response).
  - `supabase.ts:43–48` (`pingSupabase()`) — timer **not** cleared. **P3-3 CARRIED** (cosmetic, fires harmlessly).
  - All `withTimeout()` usages — timer correctly cleared via `.finally()`. ✅
- **Unclosed connections**: None detected. Supabase client manages its own connections.
- **In-memory buffers**: No unbounded in-process caches. Feature flag in-process TTL cache (5 min) is bounded.
- **Resource leaks**: 0 detected.

---

## Vercel Cost Factors

**ISR / Static strategy:**

| Page | Revalidate | Assessment |
|------|-----------|------------|
| `/archetypes/*` (7 pages) | 604,800s (7d) | ✅ Optimal for static archetype guides |
| `/about`, `/about/scoring`, `/about/verification` | 86,400s (1d) | ✅ Good for informational content |
| `/privacy`, `/terms` | 86,400s (1d) | ✅ Good |
| `/` (homepage) | 3,600s (1h) | ✅ Acceptable |
| `/u/[handle]` | 3,600s (1h) | ⚠️ Highest cost driver — regenerates hourly per unique handle |
| `/studio` | `force-dynamic` | ⚠️ No ISR — every request = 1 invocation |
| `/experiments/*` | `force-dynamic` | Accepted — feature-flagged, canvas/WebGL |

- **Edge runtime**: Not used anywhere — all routes run on serverless Node.js. No savings from edge compute.
- **Middleware**: None (`middleware.ts` absent) — zero per-request overhead. ✅
- **Cron jobs**: 3/day (`warm-cache` 06:00 UTC, `sync-audience` 03:30 UTC, `process-campaigns` 08:00 UTC), all capped at `maxDuration = 300s`. ✅
- **Badge SVG**: `s-maxage=21600, stale-while-revalidate=86400` — 6h CDN cache dramatically reduces origin invocations. ✅
- **Bundle**: 1,682 KB (68 chunks), no chunk >500 KB. Stable.

**P3-1 CARRIED**: Cache `listAllContacts()` in `sync-audience` cron — adds 1–2h Redis TTL to avoid repeated Resend API calls across cron runs on the same day.

**Informational**: `/studio` uses `force-dynamic` — every authenticated user visit hits a serverless function. At current scale (no public traffic) this is negligible, but consider `revalidate = 3600` if the page content allows.

---

## Recommendations

| Priority | Item | File | Action |
|----------|------|------|--------|
| P2-1 (scale) | `dbGetCampaignStats()` client-side aggregation | `lib/db/campaigns.ts:425–463` | Move to Supabase RPC when campaigns exceed 5K sends |
| P3-1 | Cache `listAllContacts()` in sync-audience | `app/api/cron/sync-audience/route.ts` | Add 1–2h Redis TTL to avoid repeated Resend list fetches |
| P3-2 | OG image `Promise.race()` timer leak | `app/u/[handle]/og-image/route.ts:81–86` | Add `.finally(() => clearTimeout(timer))` |
| P3-3 | `pingSupabase()` timer leak | `lib/db/supabase.ts:43–48` | Add `.finally(() => clearTimeout(timer))` |
| P3-4 | vite 7.3.1 dev-only vulns | `package.json` | Bump vite ≥7.3.2 |
| P3-5 | Outdated dev deps | `package.json` | vitest 4.1.2→4.1.4, @vitest/coverage-v8 4.1.2→4.1.4, jsdom 29.0.1→29.0.2 |
| P3-6 | Partial index for `dbGetUsersWithEmail()` | Supabase migration | Add `WHERE email IS NOT NULL AND email_notifications = true` partial index |
| **P3-7 NEW** | Bitbucket/Codeberg token refresh missing timeout | `lib/github/client.ts:215, 284` | Add `AbortSignal.timeout(10000)` to both refresh fetches |
| **P3-8 NEW** | `dbUpdateFeatureFlag()` cache invalidation can throw | `lib/db/feature-flags.ts:177–180` | Add `.catch(() => {})` to both `cacheDel()` calls |

**Estimated monthly cost at 10K users: ~$60–70/mo. Unchanged.**
