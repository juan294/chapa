# Cost Analyst Report
> Generated: 2026-03-13 | Health status: GREEN

## Executive Summary

Infrastructure costs remain well-controlled at current scale. Estimated monthly cost at 10K users: **~$56** (Vercel $26, Redis $20, Resend $10, Supabase free). The **OG image cache remains the dominant Redis cost driver** at ~5 GB (96% of total Redis memory), approaching the Upstash Pro 10 GB limit at ~15K DAU. Four carried issues from previous audits remain unresolved; no new critical findings.

## Redis Usage

### Key Pattern Families (19 total)

| # | Pattern | TTL | Est. Size @10K | Growth |
|---|---------|-----|----------------|--------|
| 1 | `stats:v2:merged:{handle}` | 6h | 40 MB | Per active user |
| 2 | `stats:stale:{handle}` | 7d | 40 MB | Per active user |
| 3 | `stats:v2:bitbucket:{handle}` | 6h | 400 KB | ~2% adoption |
| 4 | `stats:v2:codeberg:{handle}` | 6h | 400 KB | ~2% adoption |
| 5 | `snapshot:latest:{handle}` | 24h | 3.5 MB | Per user |
| 6 | `og-image:v1:{handle}:{date}` | 7d | **~5 GB** | **DOMINANT (96%)** |
| 7 | `supplemental:{handle}` | 24h | 1.5 MB | ~5% adoption |
| 8 | `badge:notified:{handle}` | 365d | <5 KB | Per unique user |
| 9 | `score-bump:{handle}` | 7d | <1 KB | Per notified user |
| 10 | `config:{handle}` | 365d | 1.5 MB | ~10% adoption |
| 11–16 | `ratelimit:{type}:{id}` (6 types) | 60s–24h | ~100 KB peak | Transient |
| 17 | `cron:warm-cache:offset` | Persistent | <1 B | Single global |
| 18 | `stats:badges_generated` | Persistent | <1 B | Single global |
| 19 | `stats:unique_badges` (HLL) | Persistent | ~12 KB | Single global |

- **TTL coverage**: 100% for per-user keys. 3 global keys intentionally persistent (combined <13 KB).
- **Growth risk**: LOW overall. OG image cache is the only pattern approaching infrastructure limits.

### Memory Breakdown @10K Users

| Component | Memory | % Total |
|-----------|--------|---------|
| OG Image Cache | ~5.0 GB | 96.2% |
| Stats (primary + stale) | ~81 MB | 1.6% |
| All other patterns | ~7 MB | 0.1% |
| **Total** | **~5.2 GB** | 100% |

### Redis Scaling Thresholds

| DAU | OG Cache | Total Redis | Tier Required |
|-----|----------|-------------|---------------|
| 5K | ~2.5 GB | ~2.6 GB | Starter (5 GB) |
| 10K | ~5.0 GB | ~5.2 GB | Pro (10 GB) |
| 15K | ~7.5 GB | ~7.6 GB | Pro (tight) |
| 20K | ~10 GB | ~10.1 GB | Business required |

## Database Usage

- **Tables**: 7 + 2 views (`latest_snapshots`, `admin_users`)
- **Connection management**: Lazy singleton via `getSupabase()` — no per-request creation, `persistSession: false`
- **Query patterns**: Efficient. Batch queries used correctly (`dbGetLatestSnapshotBatch`). No N+1 patterns detected. Admin dashboard uses paginated view queries with DB-level sort/filter.
- **RLS**: Enabled on all 7 tables. Views use `security_invoker = true`.
- **Fail-open**: All DB functions return sensible defaults when Supabase is unavailable.

### Data Retention

| Table | Retention | Cleanup | Status |
|-------|-----------|---------|--------|
| `verification_records` | 30 days | `dbCleanExpiredVerifications()` | IMPLEMENTED |
| `merge_operations` | 90 days | `dbCleanExpiredMergeOperations()` | IMPLEMENTED |
| `metrics_snapshots` | **None** | `dbCleanOldSnapshots()` | **NOT IMPLEMENTED** |

**`metrics_snapshots` growth risk**: 3.65M rows/year at 10K users (~1.5 GB/year). Will exceed Supabase free tier (500 MB) within months at scale. Cleanup pattern ready to replicate from `verification.ts:184`.

### Migration Gap

`tool_insights` table was created via SQL editor — **not in any migration file**. Database rebuild will fail when code queries this table. Needs migration `015_create_tool_insights.sql`.

## External API Calls

| Route | External Service | Cached | Rate Limited | Risk |
|-------|-----------------|--------|-------------|------|
| `/u/[handle]/badge.svg` | GitHub API, Supabase, avatar fetch | 6h cache + 7d stale fallback | 100 req/IP/60s | LOW |
| `/u/[handle]/og-image` | GitHub API, SVG→PNG conversion | 7d Redis cache | Via badge rate limit | LOW |
| `/api/cron/warm-cache` | GitHub API (batched), Supabase, Resend | Cache-warming only, round-robin 50/run | CRON_SECRET auth | LOW |
| `/api/refresh` | GitHub API, Supabase | Cache cleared by design | 5/handle/1h | MEDIUM |
| `/api/generate` | GitHub API | 6h cache-first | 10/handle/1h | LOW |
| `/api/recalculate` | GitHub API, Supabase | 6h cache-first | 20/handle/1h | LOW |
| `/api/insights` (POST) | Supabase | Feature flag cached | 10/handle/24h | LOW |
| `/api/supplemental` | GitHub API (token validation only) | Cache invalidated after upload | 10/handle/24h | LOW |
| `/api/auth/callback` | GitHub API (OAuth exchange) | No cache (fresh tokens required) | 10/IP/15min | LOW |
| `/api/admin/agents/run` | Shell process spawn | N/A | 10 spawns/IP/60s | MEDIUM |
| `/api/admin/users` | Supabase | No cache (no-store) | 10/IP/60s | LOW |

**GitHub API budget**: ~2,200–4,150 calls/month vs 5,000/hr limit. 35x headroom. In-flight dedup reduces concurrent calls 40–60%.

## Resource Management

### Resolved Since Last Audit
- **Badge SVG `after()` hook**: Now uses `Promise.allSettled()` at `badge.svg/route.ts:164`.

### Still Open (Carried)

| # | Issue | Severity | File | Detail |
|---|-------|----------|------|--------|
| C1 | Admin agent process — no timeout | MEDIUM | `app/api/admin/agents/run/route.ts` | Spawned process has no explicit timeout. `maxDuration=300s` (Vercel Pro) is the only guard. No explicit `.destroy()` on stdout/stderr streams. Buffer bounded at 500 lines. |
| C2 | `metrics_snapshots` retention | HIGH | `lib/db/snapshots.ts` | `dbCleanOldSnapshots()` not implemented. 3.65M rows/year at 10K users (~1.5 GB/year). |
| C3 | Resend API timeouts | HIGH | `lib/email/resend.ts` | `fetchReceivedEmail()` and `forwardEmail()` lack `AbortSignal.timeout()`. Hanging fetch risks webhook reliability. |
| C4 | `/api/insights` after() hook | LOW | `app/api/insights/route.ts` | Uses `Promise.all()` for cache invalidation — should use `Promise.allSettled()` for consistency. |

### No New Resource Leaks Found
- Redis singleton: correct lazy initialization, fail-open
- Supabase singleton: correct, `persistSession: false`
- Fetch timeouts: GitHub API (15s), avatar (5s), SVG→PNG (10s) — all protected
- In-memory buffers: all bounded (agent logs 500 lines max, no unbounded arrays)

## Vercel Cost Factors

### Route Classification

| Type | Count | Examples |
|------|-------|---------|
| Static (ISR) | 5 | `/`, `/about`, `/about/scoring`, `/u/[handle]` (1h), `/api/verify` |
| Dynamic (cached at CDN) | 3 | `/u/[handle]/badge.svg` (6h s-maxage), `/u/[handle]/og-image`, `/api/history` |
| Dynamic (auth-required) | 3 | `/studio`, `/admin`, `/generating` |
| Dynamic API | ~30 | All `/api/*` routes |
| Force-dynamic (experiments) | 11 | `/experiments/*` layout forces dynamic |
| **Missing ISR** | **6** | **`/archetypes/*` — static content, no `revalidate`** |

### ISR Status

| Page | ISR | Status |
|------|-----|--------|
| Share page `/u/[handle]` | `revalidate=3600` | RESOLVED |
| About pages | `revalidate=3600` | GOOD |
| Landing `/` | `revalidate=3600` | GOOD |
| Archetype pages (6) | **None** | **STILL MISSING** |

### Edge Runtime
Not used. Acceptable — badge/OG routes already cached at CDN, admin routes need DB access.

### Cron
Single job: `/api/cron/warm-cache` at 6 AM UTC daily. Cost: ~$0.005/month. Round-robin 50 handles/run.

### `tool_insights` Migration
Table created via SQL editor, not in migration system. Not reproducible on rebuild. Needs `015_create_tool_insights.sql`.

## Cost Projections

| Scale | Redis | Supabase | Vercel | Resend | Total/mo |
|-------|-------|----------|--------|--------|----------|
| 5K users | ~$2 | Free | ~$20 | ~$10 | ~$32 |
| 10K users | ~$10 | Free | ~$26 | ~$10 | ~$56 |
| 15K users | ~$10+ | $25 (Pro) | ~$26 | ~$10 | ~$71+ |
| 50K users | ~$30+ | $25+ | ~$76 | ~$20 | ~$151+ |

**Breakpoints**: Redis Pro limit (~15K DAU), Supabase free tier (~10K users without snapshot cleanup).

## Recommendations

### Priority 1 — HIGH (Carried, still open)

1. **Implement `dbCleanOldSnapshots()`** — Replicate pattern from `verification.ts:184`. Add to cron warm-cache route. Retain 365 days, batch delete 1,000 rows. Prevents Supabase storage cost escalation.

2. **Add `AbortSignal.timeout(5000)` to Resend API calls** — `fetchReceivedEmail()` and `forwardEmail()` in `lib/email/resend.ts`. Prevents hanging webhooks.

3. **Create `015_create_tool_insights.sql` migration** — Table exists only via SQL editor. Not reproducible on rebuild.

### Priority 2 — MEDIUM (Carried + repeated)

4. **Add ISR to 6 archetype pages** — Static content regenerating on every request. Add `export const revalidate = 604800` (7 days). Negligible cost savings but correct practice.

5. **Admin agent process timeout** — Add explicit 120s timeout and `.destroy()` on stdout/stderr streams in `app/api/admin/agents/run/route.ts`.

6. **Change `/api/insights` after() to `Promise.allSettled()`** — Consistency with badge route pattern.

### Priority 3 — LOW (Future planning)

7. **Plan OG image migration to blob storage** before 15K DAU — OG cache at 96% of Redis memory. Vercel Blob (included free) or S3 ($0.023/GB-month) would eliminate the Redis bottleneck entirely.

8. **Reduce OG image TTL from 7d to 48h** as interim measure — saves ~3.6 GB at 10K users.

## Changes vs. Previous Audit (2026-03-12)

| Item | Previous | Current | Delta |
|------|----------|---------|-------|
| Redis key families | 17 | 19 | +2 (found `stats:badges_generated`, `stats:unique_badges`) |
| Badge SVG `Promise.allSettled()` | RESOLVED | Confirmed resolved | No change |
| `metrics_snapshots` cleanup | Not implemented | Still not implemented | **No change** |
| Resend API timeouts | Missing | Still missing | **No change** |
| Admin agent process timeout | Missing | Still missing | **No change** |
| Archetype ISR | Missing (6 pages) | Still missing | **No change** |
| `tool_insights` migration | Missing | Still missing | **No change** |
| `/api/insights` Promise.all | Not flagged | New finding | NEW |
| Estimated cost @10K | ~$56/mo | ~$56/mo | No change |
