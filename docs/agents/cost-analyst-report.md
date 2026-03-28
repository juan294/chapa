# Cost Analyst Report
> Generated: 2026-03-28 | Health status: GREEN

## Executive Summary

Infrastructure costs remain stable and well-optimized. No new cost risks since last audit. All external calls have timeouts. Redis memory is bounded by TTLs. 43 API routes, all properly dynamic. OG image Redis memory remains the #1 monitor item for future scale. One minor finding: `sync-audience` cron uses `Promise.all()` instead of `Promise.allSettled()` — a resilience concern, not a cost concern.

## Redis Usage

### Key Pattern Families: 24

| # | Pattern | TTL | Growth Risk | Notes |
|---|---------|-----|-------------|-------|
| 1 | `stats:v2:merged:${handle}` | 6h | Medium | Per-user merged stats |
| 2 | `stats:v2:stale:${handle}` | 7d | Medium | Stale fallback |
| 3 | `stats:v2:github:${handle}` | 6h | Medium | GitHub platform stats |
| 4 | `stats:v2:bitbucket:${handle}` | 6h | Medium | Bitbucket platform stats |
| 5 | `stats:v2:codeberg:${handle}` | 6h | Medium | Codeberg platform stats |
| 6 | `supplemental:${handle}` | 6h | Medium | EMU supplemental data |
| 7 | `avatar:${handle}` | 6h | Medium | Base64 avatar (~10-30 KB each) |
| 8 | `craft:${handle}` | 1h | Medium | Tool insights score |
| 9 | `snapshot:latest:${handle}` | 24h | Medium | Latest metrics snapshot |
| 10 | `og-image:v1:${handle}:${date}` | 48h | **Medium-High** | Base64 PNG (~50-200 KB each) |
| 11 | `ratelimit:badge:${IP}` | 60s | Low | Badge rate limit counter |
| 12 | `ratelimit:cli-poll:${IP}` | 60s | Low | CLI poll rate limit |
| 13 | `ratelimit:cli-approve:${IP}` | 60s | Low | CLI approve rate limit |
| 14 | `cli:device:${sessionId}` | 5m | Low | CLI device auth sessions |
| 15 | `ff:all` | 1h | Low | All feature flags |
| 16 | `ff:key:${flagKey}` | 1h | Low | Individual feature flag |
| 17 | `campaign:active-engagement` | 1h | Minimal | Single key |
| 18 | `campaign:daily-sends:${date}` | 24h | Low | Daily email quota counter |
| 19 | `score-bump:${handle}` | 7d | Medium | Email dedup marker |
| 20 | `badge:notified:${handle}` | 365d | Medium | First-badge dedup |
| 21 | `first-badge:${handle}` | 365d | Medium | First-badge alert dedup |
| 22 | `stats:badges_generated` | **None** | Minimal | Global counter (~8 bytes) |
| 23 | `stats:unique_badges` | **None** | Minimal | HyperLogLog (~12 KB max) |
| 24 | `cron:warm-cache:offset` | **None** | Minimal | Single integer |

### TTL Coverage
- **Per-user keys**: 100% (all have explicit TTLs from 1h to 365d)
- **Global singletons without TTL**: 3 (badges_generated counter, unique_badges HyperLogLog, warm-cache offset) — intentional, combined <16 KB
- **Overall TTL coverage**: ~100% for growth-relevant keys

### Estimated Redis Memory @ Scale

| Users | User Data | Avatars | OG Images | Total | Upstash Pro (10 GB) |
|-------|-----------|---------|-----------|-------|---------------------|
| 1K | ~8 MB | ~1.5 MB | ~15 MB | ~25 MB | 99.8% headroom |
| 10K | ~78 MB | ~15 MB | ~150 MB | ~243 MB | 97.6% headroom |
| 50K | ~390 MB | ~75 MB | ~750 MB | ~1.2 GB | 88% headroom |
| 100K | ~780 MB | ~150 MB | ~1.5 GB | ~2.4 GB | 76% headroom |

OG images remain #1 consumer at 62% of Redis memory @10K users. Consider blob storage migration at 50K+.

## Database Usage

### Tables: 9 + 2 Views

| Table | RLS | Indexes | Notes |
|-------|-----|---------|-------|
| `users` | deny_anon_all | 1 | User profiles |
| `metrics_snapshots` | deny_anon_all | 1 | Time-series history |
| `verification_records` | deny_anon_all | 2 | 30-day TTL |
| `feature_flags` | deny_anon_mutations + public SELECT | 0 | Config |
| `merge_operations` | deny_anon_all | 2 | 90-day retention |
| `user_platforms` | deny_anon_all | 1 | Linked accounts |
| `email_campaigns` | deny_anon_all | 1 | Campaign metadata |
| `campaign_sends` | deny_anon_all | 1 | Per-recipient tracking |
| `tool_insights` | deny_anon_all | 1 | AI tool scores |
| `latest_snapshots` (view) | security_invoker | — | DISTINCT ON optimized |
| `admin_users` (view) | security_invoker | — | LEFT JOIN for admin |

### Query Patterns
- **Connection management**: Lazy singleton (`getSupabase()`) — appropriate for serverless
- **N+1 patterns**: 0 found. Batch operations used throughout (`dbGetLatestSnapshotBatch`, `.in("id", ids)`)
- **Unbounded queries**: 0 critical. All paginated or bounded by campaign/handle scope
- **JS aggregation**: 1 case (`dbGetCampaignStats`) — PostgREST limitation, <1K rows, accepted
- **Index coverage**: 11 indexes covering all join/filter columns
- **Retention policies**: Automatic cleanup for snapshots, merge_operations, verification_records

## External API Calls

| Route | External Service | Cached | Rate Limited | Risk |
|-------|-----------------|--------|-------------|------|
| `/u/[handle]/badge.svg` | GitHub, Supabase, Redis | Y (6h) | Y (100/60s) | Low — aggressive caching + dedup |
| `/u/[handle]/og-image` | GitHub, Supabase, resvg | Y (48h Redis) | N | Medium — CPU-heavy SVG-to-PNG |
| `/api/auth/callback` | GitHub (3 calls), Supabase, Resend | Partial | Y (10/900s) | Medium — sequential GitHub calls |
| `/api/cron/warm-cache` | GitHub (up to 50), Supabase, Resend | Y (6h) | CRON_SECRET | Medium — batch of 50, cache-first |
| `/api/cron/sync-audience` | Supabase, Resend (paginated) | N | CRON_SECRET | Medium — Resend pagination |
| `/api/cron/process-campaigns` | Supabase, Resend (batch) | N | CRON_SECRET | Medium — 95/day email quota |
| `/api/webhooks/resend` | Resend (2 calls) | N | Y (20/60s) | Low — HMAC-verified webhook |
| `/api/generate` | GitHub | Y (6h) | Y (10/3600s) | Low — cache-first |
| `/api/refresh` | GitHub, Supabase | Y (clears+refetch) | Y (5/3600s) | Low — strict rate limit |
| `/api/recalculate` | GitHub, Supabase | Y (6h) | Y (20/3600s) | Low — cache-first |
| `/api/admin/agents/run` | Node.js subprocess | N | Admin auth | Low — admin only, 5min timeout |
| All other routes | Supabase/Redis only | Varies | Y | Low |

### GitHub API Budget
- Authenticated rate limit: 5,000 req/hr
- Estimated usage @10K users: ~57 calls/hr (1.1% of limit)
- 6h cache + 7d stale fallback + in-flight dedup = safe until 500K+ users

### Fetch Timeout Coverage: 100%
All external calls have `AbortSignal.timeout()` or `withTimeout()`:
- GitHub GraphQL: 15s
- GitHub avatar: 5s
- SVG-to-PNG: 10s
- Resend contacts: 30s
- Resend email sends: 10s (`withTimeout(EMAIL_SEND_TIMEOUT_MS)`)

## Resource Management

### Resource Leaks: 0 Critical, 1 Minor

**Minor — `sync-audience` uses `Promise.all()` instead of `Promise.allSettled()`** (`apps/web/app/api/cron/sync-audience/route.ts:95`)
- If `listAllContacts()` fails, the entire cron job short-circuits
- Not a resource leak per se, but reduces resilience
- Impact: audience sync skipped for that day; retries next day

**Previously Flagged — All Resolved:**
- `_inflight` Map: properly cleaned via `.finally()`, bounded by upstream timeouts
- Global `currentRun` in agents/run: properly cleaned by `cleanupProcess()`, SIGTERM/SIGKILL escalation
- `after()` callbacks: all use `Promise.allSettled()` — verified
- Child process streams: properly destroyed with listener cleanup
- Log buffer: bounded at 500 lines (MAX_LOG_LINES)
- All timers: cleaned via `.finally()` or `clearTimeout`
- Lazy singletons: Redis and Supabase both have `_resetClient()` for tests

### Positive Patterns
- All `after()` callbacks use `Promise.allSettled()` (not `Promise.all()`)
- Fail-open design on all cache/rate-limit operations
- Bounded batch processing (warm-cache: 50 users, campaigns: 95/day)
- No unbounded in-memory caches (all Redis-backed with TTLs)

## Vercel Cost Factors

### Build Output
- **43 API routes**, all correctly dynamic (`ƒ`)
- **71 JS chunks**, 1.8 MB total client JS
- **Largest chunk**: 227 KB (Next.js framework). No chunk exceeds 500 KB
- **5 static pages**: `_not-found`, `apple-icon`, `coming-soon`, `icon`, `robots.txt`, `sitemap.xml`
- **0 edge runtime** — all serverless (appropriate for this workload)
- **No middleware** — cost-positive (no per-request overhead)

### ISR/SSG Strategy: Optimal
| Page Type | Revalidation | Count |
|-----------|-------------|-------|
| Archetype pages | 7 days | 7 |
| Legal pages (privacy, terms) | 24 hours | 2 |
| Share pages (`/u/[handle]`) | 1 hour | Dynamic |
| About pages | 1 hour | 3 |
| Home page | 1 hour | 1 |
| Studio | force-dynamic | 1 |
| Experiments | force-dynamic | 13 |

### Cron Jobs: 3 daily
| Route | Schedule | Max Duration | Cost Driver |
|-------|----------|-------------|-------------|
| `warm-cache` | Daily 6:00 UTC | 300s | Heavy — up to 50 GitHub API calls |
| `sync-audience` | Daily 3:30 UTC | 300s | Medium — Resend pagination |
| `process-campaigns` | Daily 8:00 UTC | 300s | Variable — depends on batch |

~90 invocations/month — <0.01% of free-tier compute.

### Estimated Monthly Cost

| Component | 1K Users | 10K Users | 50K Users |
|-----------|----------|-----------|-----------|
| Vercel Pro | $20 | $20 | $20 |
| Upstash Redis | $0-5 | $10-20 | $30-50 |
| Supabase | Free | Free | $25 |
| Resend | $0-10 | $0-20 | $20-50 |
| PostHog | Free | Free | $0-25 |
| **Total** | **~$20-35** | **~$40-60** | **~$95-170** |

## Recommendations

### MONITOR Items (Carried)

1. **OG image Redis memory** — 62% of Redis at 10K users. At 50K+ consider migrating to Vercel Blob or Cloudflare R2. No action needed now.

2. **`sync-audience` pagination** — `listAllContacts()` paginates Resend API at 100/page. If contact list grows to 10K+, consider chunking or background processing. No action needed now.

### NEW Findings

3. **`sync-audience` `Promise.all()` resilience** (`apps/web/app/api/cron/sync-audience/route.ts:95`) — Uses `Promise.all()` for the initial data fetch. If `listAllContacts()` fails, the entire cron job fails. Consider `Promise.allSettled()` for fault tolerance so user sync can proceed even if contact list fetch fails. **Priority: Low** — retries daily, no data loss.

### Previously Resolved (No Action)

- Resend email timeouts: RESOLVED (10s via `withTimeout`)
- Badge SVG `Promise.allSettled`: RESOLVED
- All `after()` callbacks: VERIFIED using `Promise.allSettled`
- Fetch timeout coverage: 100%
- Rate limiting: 30/43 routes explicit + remaining 13 use admin auth/bearer token/internal
- Campaign email quota: 95/day enforced via Redis counter

## Delta vs Previous Report (2026-03-27)

| Metric | Previous | Current | Change |
|--------|----------|---------|--------|
| API routes | 42 | 43 | +1 (`/api/admin/agents-summary`) |
| JS chunks | 71 | 71 | Stable |
| Client JS total | 1,800 KB | 1,800 KB | Stable |
| Redis key families | 24 | 24 | Stable |
| TTL coverage | 100% | 100% | Stable |
| Fetch timeout coverage | 100% | 100% | Stable |
| Resource leaks | 0 | 0 | Stable |
| Tables + views | 9+2 | 9+2 | Stable |
| Cron jobs | 3 | 3 | Stable |
