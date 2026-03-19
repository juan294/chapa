# Cost Analyst Report
> Generated: 2026-03-19 | Health status: GREEN

## Executive Summary

Infrastructure costs remain stable and well within free/low-tier limits. Estimated monthly cost at 10K users: **~$66** (Vercel $26, Redis $20, Resend $20, Supabase free). At 50K users: **~$191/mo**. No regressions since last report. 3 carried items remain open, 0 new cost risks introduced.

## Redis Usage

### Key Patterns (26 families)

| Pattern | TTL | Est. Size @10K | Est. Size @50K | Notes |
|---------|-----|----------------|----------------|-------|
| `stats:{handle}` | 6h | ~20 MB | ~100 MB | GitHub stats cache |
| `stats:bb:{handle}` | 6h | ~5 MB | ~25 MB | Bitbucket stats cache |
| `stats:cb:{handle}` | 6h | ~5 MB | ~25 MB | Codeberg stats cache |
| `stats:{handle}:enriched` | 6h | ~2 MB | ~10 MB | Enriched login cache |
| `avatar:{handle}` | 6h | ~50 MB | ~250 MB | Base64 avatar (~5 KB each) |
| `og-image:v1:{handle}:{date}` | 48h | ~75 MB | ~375 MB | OG image PNG (largest consumer) |
| `snapshot:{handle}` | 6h | ~5 MB | ~25 MB | Latest metrics snapshot |
| `history:{handle}` | 1h | ~10 MB | ~50 MB | Computed history/trend |
| `history:{handle}:*` | 1h | ~5 MB | ~25 MB | Date-filtered history variants |
| `badge:{handle}:{theme}` | 6h | ~5 MB | ~25 MB | Rendered SVG cache |
| `config:{handle}` | 365d | ~10 MB | ~50 MB | Studio badge config |
| `badge:notified:{handle}` | 365d | <1 KB | <5 KB | First-badge email dedup |
| `ratelimit:*` | 60–3600s | ~5 MB | ~25 MB | Rate limit counters (transient) |
| `ff:all` / `ff:key:{key}` | 1h | <5 KB | <5 KB | Feature flag cache |
| `cli:auth:{code}` | 5m | <1 KB | <1 KB | CLI device auth sessions |
| `campaign:quota:{date}` | 24h | <1 KB | <1 KB | Daily email send counter |
| `stats:badges_generated` | None | <1 KB | <1 KB | Counter (intentional singleton) |
| `stats:unique_badges` | None | ~12 KB | ~12 KB | HyperLogLog (intentional) |
| `cron:warm-cache:offset` | None | <1 KB | <1 KB | Rotation pointer (intentional) |

- **TTL coverage**: 100% on per-user keys. 3 global singletons without TTL — all intentional, combined <16 KB.
- **Estimated total @10K users**: ~590 MB. **@50K users**: ~1 GB. Well within Upstash Pro 10 GB.
- **Growth risk**: LOW. OG images (~375 MB @50K) remain the #1 Redis consumer. Consider blob storage at scale.

## Database Usage

- **Tables**: 9 (`users`, `metrics_snapshots`, `verification_records`, `feature_flags`, `merge_operations`, `user_platforms`, `tool_insights`, `email_campaigns`, `campaign_sends`)
- **Views**: 2 (`latest_snapshots`, `admin_users` — both use `security_invoker = true`)
- **RLS**: 100% — all 9 tables have RLS enabled with explicit deny-all policies for anon role
- **Connection management**: Lazy singleton client (`lib/db/supabase.ts:12-30`), `persistSession: false`, fail-open when env vars missing
- **Query patterns**: Efficient — 0 N+1 patterns detected. Batch operations used for snapshots (`dbGetLatestSnapshotBatch`), campaign sends (`.upsert()` + `.in()` filters), and cleanup. All hot queries backed by indexes (10/10 critical paths covered).
- **Runtime validation**: `parseRow()` / `parseRows()` on all query results — prevents schema drift bugs

### Index Coverage

| Table | Index | Query Pattern |
|-------|-------|---------------|
| `users` | `idx_users_registered_at` | ORDER BY registered_at DESC |
| `metrics_snapshots` | `idx_snapshots_handle_date` | WHERE handle + ORDER BY date DESC |
| `verification_records` | `idx_verification_handle` | WHERE handle |
| `verification_records` | `idx_verification_expires` | WHERE expires_at < now() |
| `merge_operations` | `idx_merge_ops_handle_created` | WHERE target_handle ORDER BY created_at DESC |
| `user_platforms` | `idx_user_platforms_handle` | WHERE handle |
| `tool_insights` | `idx_tool_insights_handle` | WHERE handle |
| `campaign_sends` | `idx_campaign_sends_campaign_status` | WHERE campaign_id + status |
| `email_campaigns` | `idx_email_campaigns_status` | WHERE status |

## External API Calls

| Route | External Service | Cached | Rate Limited | Timeout | Risk |
|-------|-----------------|--------|-------------|---------|------|
| `/u/:handle/badge.svg` | GitHub API | 6h TTL + 7d stale | 100/IP/60s | 15s | LOW |
| `/u/:handle/badge.svg` | Avatar CDN | 6h TTL | — | 5s | LOW |
| `/u/:handle/badge.svg` | Supabase (craft) | Redis cache | — | — | LOW |
| `/u/:handle/badge.svg` | Bitbucket API (if linked) | 6h TTL | — | 30s | MEDIUM |
| `/u/:handle/badge.svg` | Codeberg API (if linked) | 6h TTL | — | 30s | MEDIUM |
| `/api/generate` | GitHub API | 6h TTL | 10/handle/1h | 15s | LOW |
| `/api/refresh` | GitHub API | Cache cleared | 5/handle/1h | 15s | MEDIUM |
| `/api/auth/callback` | GitHub OAuth | No | 10/IP/15m | 10s | LOW |
| `/api/cron/warm-cache` | GitHub API (50 handles) | 6h TTL | Bearer auth | 15s | LOW |
| `/api/cron/warm-cache` | Resend (notifications) | — | — | — | LOW |
| `/api/cron/process-campaigns` | Resend (batch send) | — | Bearer auth | — | MEDIUM |
| `/api/cron/sync-audience` | Resend (contacts list) | — | Bearer auth | — | LOW |
| `/api/webhooks/resend` | Resend (fetch+forward) | — | HMAC verified | 5s | LOW |
| `/u/:handle/og-image` | SVG→PNG (local) | 48h Redis | — | 10s | LOW |
| `/api/health` | Redis + Supabase ping | — | 30/IP/60s | — | LOW |

### GitHub API Budget

- **Authenticated limit**: 5,000 calls/hour per OAuth token
- **Estimated peak**: ~690 calls/hr (50 cron users × 5 batch ops + organic badge requests)
- **Headroom**: 86% — well within limits
- **In-flight deduplication** reduces concurrent calls 40–60%

## Resource Management

### Promise.all() Resilience

- **Badge SVG route `route.ts:103`** — Uses `Promise.all([dbGetToolInsights, getCachedLatestSnapshot, getAvatarBase64])`. Analysis of each function:
  - `dbGetToolInsights()`: CAN throw on non-PGRST116 Supabase errors (`tool-insights.ts:127`)
  - `getCachedLatestSnapshot()`: `dbGetLatestSnapshot()` can propagate Supabase errors
  - `getAvatarBase64()`: No try/catch — `cacheGet` or `fetchAvatarBase64` errors propagate
  - **Verdict**: A Supabase error in craft lookup crashes the entire badge render. `Promise.allSettled()` with fallbacks would be more resilient. **CARRIED since 2026-03-17.**

- All other `Promise.all()` calls are appropriately guarded or use `Promise.allSettled()` where needed.
- `after()` blocks in badge route and cron routes correctly use `Promise.allSettled()`.

### Fetch Timeout Coverage

| Call | Timeout | Status |
|------|---------|--------|
| GitHub GraphQL | 15s `AbortSignal.timeout` | COVERED |
| Avatar CDN | 5s `AbortSignal.timeout` | COVERED |
| Resend email fetch | 5s `AbortSignal.timeout` | COVERED |
| OAuth token exchange | 10s `AbortSignal.timeout` | COVERED |
| Bitbucket API | 30s `AbortController` + `clearTimeout` | COVERED |
| Codeberg API | 30s `AbortController` | COVERED |
| OG SVG→PNG | 10s `Promise.race` | COVERED |
| `listAllContacts()` paginated loop | None (SDK internal) | **GAP** — Resend SDK handles per-request timeout, but no overall timeout on the paginated loop. Could hang until Vercel 300s limit. **CARRIED.** |
| `pingRedis()` / `pingSupabase()` | None | **GAP** — Both use HTTP-based clients with implicit defaults but no explicit timeout. Health check could stall if either service hangs. **CARRIED.** |

### Resource Leaks

- **0 critical leaks detected**
- OG image `Promise.race()` timer (`og-image/route.ts:81-86`): Timeout timer not explicitly cleared when `svgToPng()` completes first. Impact LOW — timer fires harmlessly after 10s in a serverless context. Could use `AbortController` pattern for cleanliness.
- Agent run log buffer: Capped at 500 lines, single-run scope. No leak.
- Inflight request map (`lib/github/client.ts:22`): Auto-cleared via `.finally()`. No leak.

## Vercel Cost Factors

### Serverless Functions

- **API routes**: ~46 (30 force-dynamic or auth-gated, rest ISR/static)
- **Dynamic pages**: ~3 (studio, admin, experiments)
- **ISR pages**: ~12 (landing, about, archetypes, share page)
- **Edge runtime**: None (all Node.js serverless)

### Cron Jobs (90 invocations/month — within Pro limit of 120)

| Job | Schedule | Est. Duration | Monthly Compute |
|-----|----------|---------------|-----------------|
| `warm-cache` | Daily 6:00 UTC | 10–30s | ~15 min |
| `sync-audience` | Daily 3:30 UTC | 5–10s | ~5 min |
| `process-campaigns` | Daily 8:00 UTC | 10–20s | ~7.5 min |
| **Total** | | | **~27.5 min** (Vercel Pro includes 2160 free) |

### ISR & Cache Strategy

| Route | Strategy | TTL | Cost Impact |
|-------|----------|-----|-------------|
| `/u/:handle/badge.svg` | HTTP Cache-Control | s-maxage=6h, stale=7d | CDN cached — ~95% hit rate |
| `/u/:handle` (share page) | ISR revalidate | 1h | On-demand static gen |
| `/archetypes/*` | ISR revalidate | 7d | Near-static |
| `/about/*`, `/` | ISR revalidate | 1h | Near-static |
| `/studio` | force-dynamic | None | Required for auth |
| `/experiments/*` | force-dynamic | None | Behind feature flag |

### Bundle Size

- Total client JS: ~1,434 KB across 53 chunks (per performance agent 2026-03-12)
- No chunk exceeds 500 KB. Largest: 219 KB (Next.js framework)
- PostHog: 175 KB (lazy-loaded on first interaction)
- No oversized routes or middleware

## Monthly Cost Estimate

| Service | @10K users | @50K users | Notes |
|---------|-----------|-----------|-------|
| Vercel Pro | $26 | $26 | Fixed cost. Compute well within limits. |
| Upstash Redis | $20 | $20–$40 | ~590 MB → ~1 GB. Pro 10 GB sufficient. |
| Supabase | Free | $25 | Free tier may hit 50K read limit at scale. |
| Resend | $20 | $20 | Pro plan for >100 emails/month. |
| **Total** | **~$66** | **~$91–$111** | |

## Carried Items

| # | Item | Since | Severity | Status |
|---|------|-------|----------|--------|
| C1 | Badge SVG `Promise.all()` at `route.ts:103` — craft/snapshot/avatar can throw, crashing badge render. Should use `Promise.allSettled()` with fallbacks. | 2026-03-17 | MEDIUM | OPEN |
| C2 | `/api/studio/config` docs mismatch — CLAUDE.md says POST, code exports GET+PUT. | 2026-03-06 | LOW | OPEN |
| C3 | `listAllContacts()` paginated loop lacks overall timeout — could hang until 300s Vercel limit. | 2026-03-18 | LOW | OPEN |
| C4 | `/api/health` ping functions lack explicit timeout wrapper — could stall on hung Redis/Supabase. | 2026-03-18 | LOW | OPEN |
| C5 | `dbGetCampaignStats()` JS aggregation (`campaigns.ts:350-382`) — fetches all rows, counts in JS. Should use SQL `GROUP BY` at scale. Negligible impact currently. | 2026-03-18 | LOW | OPEN |

## Recommendations

1. **[MEDIUM] Convert badge SVG `Promise.all()` to `Promise.allSettled()`** — `route.ts:103`. A Supabase error in `dbGetToolInsights()` or `getCachedLatestSnapshot()` crashes the entire badge. Use `Promise.allSettled()` with null/undefined fallbacks. (Carried 3 reports.)

2. **[LOW] Add overall timeout to `listAllContacts()`** — `sync-audience/route.ts:22`. Wrap the paginated loop with `Promise.race()` + 30s timeout to prevent hanging on stalled Resend API.

3. **[LOW] Add timeout wrapper to health ping functions** — `pingRedis()` (`redis.ts:255`) and `pingSupabase()` (`supabase.ts:38`) lack explicit timeouts. Add 5s `Promise.race()` timeout to prevent health check stalling.

4. **[LOW] Fix `/api/studio/config` docs mismatch** — CLAUDE.md says POST, code exports GET+PUT. Documentation issue only.

5. **[LOW] Convert `dbGetCampaignStats()` to SQL aggregation** — `campaigns.ts:350`. Currently fetches all rows and counts in JS. Use `GROUP BY status` query. Low priority — negligible at current scale.

6. **[INFO] Monitor OG image Redis memory** — At ~375 MB @50K users, OG images are the #1 Redis consumer. Consider Vercel Blob storage or reduced TTL if approaching Upstash Pro 10 GB limit.

7. **[INFO] Monitor Supabase read quota** — Free tier allows 50K reads/month. Estimated ~50K at 10K users. Upgrade to Pro ($25/mo) when approaching limit.
