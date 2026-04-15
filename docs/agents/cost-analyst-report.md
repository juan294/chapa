# Cost Analyst Report
> Generated: 2026-04-15 | Health status: GREEN

## Executive Summary

Infrastructure costs remain stable at **~$60-70/mo at 10K users**. No production code changes since 2026-04-12 (only agent report updates and dev dep bumps). All Redis per-user keys have TTLs, all external API calls are cached and timeout-protected. Two minor timer leaks in `Promise.race()` patterns persist (P3, cosmetic). Dev-only vite vulns can be resolved by bumping to 7.3.2. Upgrading `vitest` to 4.1.4 and `@vitest/coverage-v8` to 4.1.4 would also close the outdated dev deps.

## Redis Usage

### Key Pattern Inventory (18 patterns)

| Key Pattern | TTL | ~Value Size | Purpose |
|---|---|---|---|
| `stats:v2:merged:{handle}` | 6h (21,600s) | 3-5 KB | Primary GitHub+Bitbucket+Codeberg merged stats cache |
| `stats:v2:bitbucket:{handle}` | 6h (21,600s) | 1-3 KB | Per-user Bitbucket stats before merge |
| `stats:v2:codeberg:{handle}` | 6h (21,600s) | 1-3 KB | Per-user Codeberg stats before merge |
| `stats:stale:{handle}` | 7d (604,800s) | 3-5 KB | Stale fallback for API failures |
| `supplemental:{handle}` | 24h (86,400s) | 1-2 KB | EMU supplemental stats |
| `snapshot:latest:{handle}` | 24h (86,400s) | 300-500 B | Latest metrics snapshot |
| `craft:{handle}` | 1h (3,600s) | 200-400 B | Tool insights / Craft dimension |
| `avatar:{handle}` | 6h (21,600s) | 5-50 KB | Base64 avatar data URIs |
| `og-image:v1:{handle}:{date}` | 48h (172,800s) | 50-150 KB | Rendered badge PNG for OG |
| `score-bump:{handle}` | 7d (604,800s) | ~1 B | Score-bump email dedup marker |
| `badge:notified:{handle}` | 365d (31,536,000s) | ~1 B | First-badge notification dedup |
| `campaign:daily-sends:{date}` | 24h (86,400s) | ~8 B | Resend daily email quota counter |
| `ratelimit:{action}:{identifier}` | Window-based (60s-86,400s) | ~8 B | Sliding window rate limiters |
| `stats:badges_generated` | **No TTL** | ~8 B | Global badge count (INCR) |
| `stats:unique_badges` | **No TTL** | ~12 KB max | HyperLogLog unique badge count |

### TTL Coverage

- **100% of per-user keys** have TTLs (6h-365d depending on pattern).
- **3 keys without TTL** (all intentional, bounded):
  - `stats:badges_generated` — single counter (~8 bytes).
  - `stats:unique_badges` — HyperLogLog, capped at ~12 KB by algorithm.
  - Rate limit keys use EXPIRE on first increment — auto-cleanup after window.

### Storage Estimate (10K users)

| Category | Keys | Size Estimate |
|---|---|---|
| Stats caches (merged+stale+platform) | ~40K | 120-200 MB |
| Avatar cache | ~10K | 50-300 MB (peak) |
| OG image cache | ~10K (2 days) | 100-300 MB (peak) |
| Snapshots + craft + supplemental | ~20K | 5-15 MB |
| Rate limit keys | variable | 1-10 MB |
| Email dedup + counters | ~10K | <1 MB |
| **Total estimate** | | **~300-800 MB** |

Upstash Pro plan provides 10 GB. Headroom: **~91%+** at 10K users.

### Growth Risk: LOW

Rate limit keys accumulate per unique IP but auto-expire after window. Under traffic spikes, temporary accumulation is possible but bounded by TTL. Upstash LRU eviction provides secondary protection.

## Database Usage

### Tables: 9 + Views: 2

| Table | Key Index | RLS | Notes |
|---|---|---|---|
| `users` | `idx_users_registered_at` | DENY ALL | Core user registry |
| `metrics_snapshots` | `idx_snapshots_handle_date` | DENY ALL | Daily metric snapshots (UNIQUE handle+date) |
| `verification_records` | `idx_verification_handle`, `idx_verification_expires` | DENY ALL | 30-day verification tokens |
| `feature_flags` | — | Public READ | DB-backed feature toggles |
| `user_platforms` | `idx_user_platforms_handle` | DENY ALL | Linked OAuth accounts |
| `merge_operations` | `idx_merge_ops_handle_created`, `idx_merge_ops_failed` | DENY ALL | CLI telemetry (90-day retention) |
| `tool_insights` | `idx_tool_insights_handle` | DENY ALL | AI tool insights / Craft scoring |
| `email_campaigns` | `idx_email_campaigns_status`, `idx_email_campaigns_type` | DENY ALL | Campaign metadata |
| `campaign_sends` | `idx_campaign_sends_campaign_status` | DENY ALL | Per-recipient send tracking |

**Views:** `latest_snapshots` (DISTINCT ON), `admin_users` (LEFT JOIN). Both `security_invoker = true`.

### Query Patterns: EFFICIENT

- **0 N+1 patterns** — all queries are single-query-per-operation.
- **Batch fetching**: `dbGetLatestSnapshotBatch(handles)` uses `.in()` for multi-handle queries.
- **Server-side pagination**: `.range()` on user/admin queries.
- **Batch writes**: Campaign sends upserted in single `.upsert()` call.
- **Connection model**: Lazy singleton via `getSupabase()`. Service role key only (bypasses RLS). Supabase JS client manages connection pooling internally.
- **11 indexes** covering all hot queries. No missing indexes detected for current query patterns.

### Minor Optimization Opportunities

- **P2-1 CARRIED**: `dbGetCampaignStats()` does client-side aggregation. Move to Supabase RPC at >5K sends/campaign.
- **P3-NEW**: Consider adding partial index `idx_users_email_notifications ON users (email_notifications) WHERE email IS NOT NULL` for `dbGetUsersWithEmail()`.

## External API Calls

| Route | External Service | Cached | Rate Limited | Timeout | Risk |
|---|---|---|---|---|---|
| `POST /api/generate` | GitHub GraphQL | 6h + 7d stale + in-flight dedup | 10/handle/hr | 15s | LOW |
| `POST /api/refresh` | GitHub GraphQL | Cache cleared, re-fetched | 5/handle/hr | 15s | LOW |
| `POST /api/recalculate` | GitHub GraphQL | 6h + 7d stale | 20/handle/hr | 15s | LOW |
| `GET /api/auth/callback` | GitHub OAuth | Single-use | 10/IP/15min | — | LOW |
| `GET /api/cron/warm-cache` | GitHub GraphQL (batch) | 6h cache, 50 handles/run | Cron-protected | 15s | LOW |
| `POST /api/admin/bulk-recalculate` | GitHub GraphQL (batch) | 6h cache | Admin auth | 15s | LOW |
| `GET /api/cron/sync-audience` | Resend Contacts API | No cache | Cron-protected | 30s | MEDIUM |
| `GET /api/cron/process-campaigns` | Resend Batch Send | Quota tracking | Cron-protected | 10s | MEDIUM |
| `POST /api/admin/campaigns/*/send` | Resend Batch Send | Quota tracking | Admin auth | 10s | MEDIUM |
| `POST /api/admin/campaigns/*/test` | Resend Send | No cache | Admin auth | 10s | LOW |
| `POST /api/webhooks/resend` | Resend Fetch | No cache | 20/IP/60s | — | LOW |

### GitHub API Budget

- Cache-first pattern: 6h primary + 7d stale fallback + in-flight deduplication.
- Warm-cache cron: 50 handles/day with rotation.
- At 10K users, estimated ~3% of 5,000 req/hr authenticated limit used. **~97%+ headroom**.

### Fetch Timeout Coverage: 100%

All external calls have `AbortSignal.timeout()` or equivalent: GitHub (15s), Bitbucket (30s), Codeberg (30s), Resend (10s), Supabase DB (10s via `dbTimeoutOr504`), PostHog server errors (5s).

## Resource Management

### Timer Leaks (P3 — cosmetic, no production impact)

1. **`lib/db/supabase.ts:43-48`** — `pingSupabase()` uses `Promise.race()` with a setTimeout that isn't cleared on success. The orphan timer fires harmlessly after 5s. Called only by `/api/health` (rate-limited 30 req/60s).

2. **`app/u/[handle]/og-image/route.ts:81-86`** — `svgToPng()` timeout in `Promise.race()` lacks timer cleanup on success. Orphan timer fires harmlessly after `SVG_TO_PNG_TIMEOUT_MS`. Mitigated by 48h Redis cache (most requests hit cache).

**Fix for both**: Use `withTimeout()` from `lib/async/with-timeout.ts` (already correctly implements `.finally(() => clearTimeout(timer))`), or add manual cleanup.

### Other Resource Findings

- **No middleware.ts** — zero per-request overhead. Rate limiting done per-route.
- **In-memory feature flag cache**: Bounded Map (~5-6 keys), 5-minute TTL. Safe.
- **`after()` callbacks**: All use `Promise.allSettled()` to isolate failures. No leaked promises.
- **Agent process streams** (`admin/agents/run`): Proper cleanup (timers, listeners, streams). Well-designed.

## Vercel Configuration

### Build: Healthy

- Next.js 16.x (Turbopack), compiled in 3.0s, 0 TypeScript errors, 0 lint errors.
- 64 static pages, 84 routes (5 static, 79 dynamic).
- Total client JS: **~1.8 MB** (68 chunks). No chunk >500 KB. Largest: 232 KB (framework).

### ISR Strategy: Optimal

| Page | Revalidate | Assessment |
|---|---|---|
| `/u/[handle]` | 3600s (1h) | Appropriate for profile pages |
| `/` (home) | 3600s (1h) | Reasonable |
| `/about/*` | 86400s (24h) | Good for static docs |
| `/terms`, `/privacy` | 86400s (24h) | Good |
| `/archetypes/*` | 604800s (7d) | Excellent for static marketing |
| `/studio` | `force-dynamic` | Correct (user-specific state) |
| `/experiments/*` | `force-dynamic` | Correct |

### Cron Jobs

| Path | Schedule | maxDuration | Purpose |
|---|---|---|---|
| `/api/cron/warm-cache` | Daily 06:00 UTC | 300s | Cache warming (50 handles/run) |
| `/api/cron/sync-audience` | Daily 03:30 UTC | 300s | Resend audience sync |
| `/api/cron/process-campaigns` | Daily 08:00 UTC | 300s | Campaign batch processing |

All run once daily. Appropriate cost.

### Edge vs Serverless

No edge runtime declarations. All routes use default Node.js serverless runtime — appropriate for this workload (DB queries, Redis, SVG rendering).

## Dependency Health

### Outdated Packages (dev-only)

| Package | Current | Latest | Type |
|---|---|---|---|
| `vitest` | 4.1.2 | 4.1.4 | dev |
| `@vitest/coverage-v8` | 4.1.2 | 4.1.4 | dev |
| `jsdom` | 29.0.1 | 29.0.2 | dev |

### Vulnerabilities

- **Production: 0**
- **Dev-only: 3** (2 HIGH + 1 MODERATE) — all in vite 7.3.1 (via vitest peer dep). No production exposure. Fix: bump vite to >=7.3.2 via `pnpm.overrides` or upgrade vitest to 4.1.4.

## Estimated Monthly Cost (10K users)

| Service | Estimate | Notes |
|---|---|---|
| Vercel Pro | $20/mo | Serverless functions, ISR, crons |
| Upstash Redis | $10-20/mo | ~300-800 MB, rate limiting |
| Supabase Free/Pro | $0-25/mo | 9 tables, singleton client |
| Resend Free | $0/mo | 100 emails/day (quota-aware) |
| PostHog Free | $0/mo | Client analytics |
| **Total** | **~$60-70/mo** | Unchanged from prior report |

## Recommendations

### P1 (None)

No blocking issues.

### P2 (Carried)

1. **P2-1**: `dbGetCampaignStats()` client-side aggregation. Move to Supabase RPC at >5K sends/campaign.

### P3

1. **P3-1 CARRIED**: Cache `listAllContacts()` in sync-audience cron (1-2h TTL) to reduce Resend API calls.
2. **P3-2 CARRIED**: Fix `Promise.race()` timer leak in `og-image/route.ts:81-86`.
3. **P3-3 NEW**: Fix `Promise.race()` timer leak in `supabase.ts:43-48` (same pattern as P3-2).
4. **P3-4 CARRIED**: Bump vite to >=7.3.2 to resolve 3 dev-only vulnerabilities.
5. **P3-5 NEW**: Bump vitest 4.1.2->4.1.4, @vitest/coverage-v8 4.1.2->4.1.4, jsdom 29.0.1->29.0.2 (dev dep freshness).
6. **P3-6 NEW**: Consider partial index for `dbGetUsersWithEmail()` query pattern.

### Monitor

1. **M1 CARRIED**: Avatar cache Redis memory (~300 MB max at 10K users).
2. **M2 CARRIED**: OG image Redis memory (~150 MB max at 1K active/day).
3. **M3 CARRIED**: HyperLogLog `stats:unique_badges` ~12 KB. Track quarterly.
4. **M4 CARRIED**: `metrics_snapshots` table growth (~3.65M rows/year at 10K users, 365-day retention).

## Test & Build Verification

- Tests: **7001/7001 passed** (390 files), 0 failed, 0 skipped.
- TypeScript: 0 errors.
- Lint: 0 issues.
- Build: successful, 3.0s compile, 64 static pages generated.
