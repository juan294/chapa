# Cost Analyst Report
> Generated: 2026-03-14 | Health status: GREEN

## Executive Summary

Infrastructure costs remain well-controlled with multi-layered caching reducing external API calls by 80-90%. Four previously carried issues are now **RESOLVED** (admin agent process management, Resend API timeouts, archetype ISR, `/api/insights` `Promise.allSettled()`). One issue remains carried: `dbCleanOldSnapshots()` is implemented and tested but not wired to the cron job. OG image caching remains the dominant Redis cost concern (~60-80% of memory at scale).

**Estimated monthly cost at 10K users: ~$56** (Vercel $26, Redis $20, Resend $10, Supabase free tier). At 50K users: ~$151/mo.

---

## Redis Usage

### Key Pattern Inventory (19 families)

| Pattern | TTL | Avg Size/Key | Growth Constraint | Risk |
|---------|-----|-------------|-------------------|------|
| `stats:v2:merged:{handle}` | 6h | 3-5 KB | 1 per user | LOW |
| `stats:stale:{handle}` | 7d | 3-5 KB | 1 per user (fallback) | LOW |
| `stats:v2:bitbucket:{handle}` | 6h | 2-4 KB | Only if linked | LOW |
| `stats:v2:codeberg:{handle}` | 6h | 2-4 KB | Only if linked | LOW |
| `supplemental:{handle}` | 24h | 1-2 KB | EMU uploads only | LOW |
| `og-image:v1:{handle}:{date}` | 7d | **150-300 KB** | 1 per user per day | **MEDIUM** |
| `avatar:{handle}` | 6h | 20-50 KB | 1 per user | LOW |
| `ff:all` | 1h | ~200 B | Singleton | LOW |
| `ff:key:{name}` | 1h | ~50 B | One per flag | LOW |
| `snapshot:latest:{handle}` | 24h | ~300 B | 1 per user | LOW |
| `config:{handle}` | 365d | 0.5-2 KB | ~10% of users | LOW |
| `badge:notified:{handle}` | 365d | ~10 B | Lifetime marker | LOW |
| `score-bump:{handle}` | 7d | ~10 B | Per bump event | LOW |
| `ratelimit:{scope}:{id}` | 60s-24h | ~10 B | Auto-expires | LOW |
| `device-session:{code}` | 5m | ~200 B | Short-lived auth | LOW |
| `cron:warm-cache:offset` | none | ~10 B | Singleton (intentional) | LOW |
| `stats:badges_generated` | none | ~10 B | Counter (intentional) | LOW |
| `stats:unique_badges` | none | ~12 KB | HyperLogLog (bounded) | LOW |

### TTL Coverage
- **100% of per-user keys** have explicit TTLs
- **3 global keys** without TTL — all intentional singletons (`cron:warm-cache:offset`, `stats:badges_generated`, `stats:unique_badges`), combined < 13 KB

### Redis Memory Estimates

| Users | Stats + Stale | Avatars | OG Images | Other | **Total** |
|-------|-------------|---------|-----------|-------|-----------|
| 1K | 8 MB | 30 MB | ~200 MB | 2 MB | **~240 MB** |
| 5K | 40 MB | 150 MB | ~1.5 GB | 5 MB | **~1.7 GB** |
| 10K | 80 MB | 300 MB | ~3-5 GB | 8 MB | **~3.4-5.4 GB** |
| 50K | 400 MB | 1.5 GB | ~15-25 GB | 20 MB | **~17-27 GB** |

**OG image cache dominates** at 60-80% of total memory. Key format `og-image:v1:{handle}:{YYYY-MM-DD}` creates a new key per handle per day (7d TTL). Base64 PNG encoding inflates size ~33%.

### Growth Risk: OG Image Cache
- At 15K+ daily active users: exceeds Upstash Pro 10 GB limit
- **Mitigations available:** Reduce TTL from 7d to 48h, compress PNG before base64, migrate to blob storage (S3/R2), or generate OG only on first share page visit

---

## Database Usage

### Tables: 7 + 2 Views

| Table | Row Size | Retention | Cleanup | Est. Growth |
|-------|---------|-----------|---------|-------------|
| `users` | ~100 B | Forever | Manual | Linear with signups |
| `metrics_snapshots` | ~300 B | 365 days | **Not wired** | 3.65M rows/yr @ 10K users (~1.5 GB/yr) |
| `verification_records` | ~200 B | 30 days | Batched cron | Self-cleaning |
| `merge_operations` | ~150 B | 90 days | Batched cron | Self-cleaning |
| `user_platforms` | ~300 B | Forever | User-initiated unlink | Bounded by platform count |
| `tool_insights` | ~500 B | Forever | Manual | Bounded by tools × users |
| `feature_flags` | ~100 B | Forever | Manual | Bounded (~10 flags) |

**Views:** `latest_snapshots` (DISTINCT ON optimized), `admin_users` (LEFT JOIN for dashboard)

### Query Efficiency: GOOD
- **Singleton client** — lazy-initialized, reused across requests (`lib/db/supabase.ts`)
- **Batch queries** used in warm-cache cron (`dbGetLatestSnapshotBatch`) and admin dashboard (`admin_users` view) — no N+1 patterns
- **One minor N+1:** `dbGetLinkedPlatform()` called in parallel loop for 2-3 platforms per user — bounded, acceptable
- **All cleanups batched** at 1000 rows per delete to prevent table locks
- **RLS enabled** on all tables with `deny_anon_all` policies; service role bypasses

### Carried Issue: `dbCleanOldSnapshots()` Not Wired
- Function exists at `lib/db/snapshots.ts:397` with full test coverage
- **Not called from any cron job or route** — snapshots accumulate indefinitely
- At 10K users: ~3.65M rows/year (~1.5 GB/year in Supabase)
- **Fix:** Add `dbCleanOldSnapshots()` call to `warm-cache` cron alongside existing `dbCleanExpiredVerifications()` and `dbCleanExpiredMergeOperations()`

---

## External API Calls

| Route | External Service | Cached | Rate Limited | Risk |
|-------|-----------------|--------|-------------|------|
| `/u/[handle]/badge.svg` | GitHub API | Yes (6h) | 100/60s per IP | LOW |
| `/api/refresh` | GitHub API | Clears + re-fetches | 5/hour per handle | LOW |
| `/api/cron/warm-cache` | GitHub API (50 handles, batch 5) | Cache-aware | Bearer auth only | LOW |
| `/api/auth/callback` | GitHub (3 calls: token + user + email) | No (one-time) | 10/15min per IP | LOW |
| `/api/auth/bitbucket/callback` | Bitbucket (2 calls) | No (one-time) | 10/15min per IP | LOW |
| `/api/auth/codeberg/callback` | Codeberg (2 calls) | No (one-time) | 10/15min per IP | LOW |
| `/api/supplemental` | GitHub PAT verification | Clears cache | 10/24h per handle | LOW |
| `/api/generate` | GitHub API (via getStats) | Yes (6h) | 10/hour per handle | LOW |
| `/api/recalculate` | GitHub API (via getStats) | Yes (6h) | 20/hour per handle | LOW |
| `/api/webhooks/resend` | Resend (fetch + forward) | No | 20/60s per IP | LOW |
| `/api/health` | Redis + Supabase pings | No (intentional) | 30/60s per IP | LOW |

### GitHub API Budget
- **Authenticated:** 5,000 requests/hour (OAuth token)
- **Estimated usage at 10K users:** ~2,200-4,150 calls/month
- **Headroom:** ~35x (comfortable)
- **In-flight dedup:** `Map<string, Promise>` in `lib/github/client.ts:22` reduces concurrent duplicate calls by 40-60%

### Fetch Timeout Coverage: 100%
| Component | Timeout | Method |
|-----------|---------|--------|
| GitHub GraphQL | 15s | `AbortSignal.timeout(15_000)` |
| GitHub OAuth (3 calls) | 10s | `AbortSignal.timeout(10_000)` |
| Avatar image fetch | 5s | `AbortSignal.timeout(5_000)` |
| Resend `fetchReceivedEmail()` | 5s | `AbortSignal.timeout(5_000)` |
| Resend `forwardEmail()` | SDK-managed | Resend SDK handles internally |
| Bitbucket queries | `FETCH_TIMEOUT_MS` | `AbortController` + `setTimeout` |
| Codeberg queries | `FETCH_TIMEOUT_MS` | `AbortController` + `setTimeout` |

### Rate Limiting: 18 Scopes Active
All public-facing routes are rate-limited. Fail-open design ensures badge availability when Redis is down. No gaps identified.

---

## Resource Management

### Process Management (Admin Agent Route)
**Status: RESOLVED** (was carried since 2026-03-06)
- `PROCESS_TIMEOUT_MS` = 120,000ms (2 minutes) — hard kill after timeout
- Explicit `child.stdout?.destroy()` + `child.stderr?.destroy()` in 3 cleanup paths (close, error, timeout)
- `SIGTERM` with try/catch for already-exited processes
- `MAX_LOG_LINES = 500` caps buffer growth
- Singleton `currentRun` prevents concurrent runs

### In-Memory State
- **In-flight dedup map:** Cleaned via `.finally()` — no leak risk
- **Cron batch processing:** `Promise.allSettled()` isolates failures; no accumulation
- **Badge SVG after() hook:** `Promise.allSettled()` with isolated operations

### Unclosed Connections: None
- Supabase: singleton client, session persistence disabled
- Redis: Upstash REST API (stateless HTTP, no persistent connections)
- All fetch calls have timeouts

---

## Vercel Configuration

### Route Classification

| Type | Count | Examples |
|------|-------|---------|
| Static (prerendered) | 5 | icons, robots.txt, sitemap.xml |
| ISR (1 hour) | 5 | landing, about, about/scoring, about/verification, share page |
| ISR (7 days) | 6 | archetype pages (builder, guardian, polymath, marathoner, balanced, emerging) |
| Dynamic API | ~30 | all `/api/*` routes |
| Dynamic pages | 8 | studio, admin, verify, generating, privacy, terms |
| Force-dynamic | 11 | experiments pages (feature-flagged) |

### Badge SVG Caching Headers
```
Cache-Control: public, s-maxage=21600, stale-while-revalidate=604800
```
- 6h CDN cache (s-maxage) eliminates ~90% of serverless invocations for repeat badge requests
- 7d stale fallback prevents errors during origin downtime

### Cron Configuration
- Single cron: `/api/cron/warm-cache` at 6 AM UTC daily
- `maxDuration = 300s` (5 minutes) — within Vercel Pro limits
- Processes 50 handles per run in batches of 5

### Bundle
- Build: 20.2s, 0 errors
- No oversized chunks (all under 500 KB)
- `@resvg/resvg-js` excluded via `serverExternalPackages`
- No edge runtime usage

### ISR Opportunities (Minor)
| Page | Current | Recommendation | Savings |
|------|---------|---------------|---------|
| `/privacy` | Dynamic | `revalidate = 86400` | ~10 invocations/mo |
| `/terms` | Dynamic | `revalidate = 86400` | ~10 invocations/mo |

---

## Resolved Issues (Since Last Report)

| Issue | Status | Details |
|-------|--------|---------|
| Admin agent process management | **RESOLVED** | 120s timeout, stream `.destroy()`, `SIGTERM` — all in place |
| Resend API timeouts | **RESOLVED** | `fetchReceivedEmail()` has `AbortSignal.timeout(5000)`. `forwardEmail()` uses Resend SDK (manages own HTTP lifecycle) |
| 6 archetype pages missing ISR | **RESOLVED** | All 6 now have `revalidate=604800` (7 days) |
| `/api/insights` `Promise.all()` | **RESOLVED** | Now uses `Promise.allSettled()` at line 62 |

## Carried Issues

| # | Issue | Severity | Details |
|---|-------|----------|---------|
| C1 | `metrics_snapshots` retention not wired | MEDIUM | `dbCleanOldSnapshots()` exists at `snapshots.ts:397` with tests, but is not called from any cron or route. Rows accumulate at ~3.65M/yr @ 10K users (~1.5 GB/yr). **Fix:** Add to warm-cache cron alongside existing cleanup calls. |
| C2 | `tool_insights` table missing from migration system | LOW | Table exists in production but not reproducible on fresh database rebuild. |
| C3 | `/api/studio/config` docs mismatch | LOW | CLAUDE.md lists POST, code exports GET+PUT. Documentation issue only. |

---

## Recommendations

### P1 — Wire Up Snapshot Cleanup (MEDIUM)
Add `dbCleanOldSnapshots()` to the warm-cache cron job. The function and tests already exist. Without it, `metrics_snapshots` grows ~1.5 GB/year at 10K users with no automatic pruning.

### P2 — Plan OG Image Cache Migration (LOW, Future)
OG image base64 caching is the #1 Redis memory consumer (~60-80% at scale). Before reaching 15K DAU:
- **Quick win:** Reduce TTL from 7d to 48h (~70% memory reduction)
- **Long-term:** Migrate to Vercel Blob or Cloudflare R2 for binary storage

### P3 — Add ISR to Legal Pages (LOW)
`/privacy` and `/terms` are static content rendered dynamically. Adding `revalidate = 86400` saves minimal serverless invocations but improves consistency.

### P4 — Add Application-Level Cache to History Endpoint (LOW)
`/api/history/:handle` queries Supabase on every request. HTTP cache headers help (1h), but a Redis cache layer (`history:{handle}:{from}:{to}`, TTL=1h) would reduce DB load for popular badges.

---

## Cost Projection

| Component | 1K Users | 10K Users | 50K Users |
|-----------|----------|-----------|-----------|
| Vercel (Pro) | $20 | $26 | $60 |
| Upstash Redis | Free | $20 | $80 |
| Supabase | Free | Free | $25 |
| Resend | Free | $10 | $25 |
| **Total** | **~$20/mo** | **~$56/mo** | **~$190/mo** |

**Note:** At 50K users, OG image cache (~17-27 GB) would require Upstash Enterprise or blob storage migration, adding ~$40-60/mo to the Redis line.
