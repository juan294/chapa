# Cost Analyst Report
> Generated: 2026-04-12 | Health status: green

## Executive Summary

Infrastructure costs remain stable at ~$60–70/mo projected for 10K users. All prior P1/P2/P3 items are resolved. This cycle completes the first full Redis key-pattern audit, revealing `avatar:{handle}` (base64 data URIs, ~30KB each) and `og-image:v1:{handle}:{date}` (PNG, ~200KB each) as the dominant Redis memory consumers — both bounded by TTL and CDN caching but now formally tracked. No new blockers.

---

## Redis Usage

### Key Patterns (full audit — first complete enumeration)

| Key Pattern | TTL | Storage per entry | Notes |
|---|---|---|---|
| `stats:v2:merged:{handle}` | 6h | ~5 KB | Primary GitHub+platform merged stats |
| `stats:stale:{handle}` | 7d | ~5 KB | Stale fallback on API failure |
| `stats:v2:bitbucket:{handle}` | 6h | ~3 KB | Bitbucket-only stats |
| `stats:v2:codeberg:{handle}` | 6h | ~3 KB | Codeberg-only stats |
| `snapshot:latest:{handle}` | 24h | ~2 KB | Latest metrics snapshot |
| `craft:{handle}` | 1h | ~0.5 KB | Tool insights / Craft score |
| `history:{handle}[:{from}[:{to}]]` | 1h | ~10 KB | Score history variants |
| `avatar:{handle}` | 6h | **~15–50 KB** | Base64 data URI — NEW to estimate |
| `og-image:v1:{handle}:{date}` | 48h | **~150–300 KB** | PNG base64 — dominant key by size |
| `config:{session.login}` | 365d | ~2 KB | Studio badge config |
| `badge:notified:{handle}` | 365d | ~0.1 KB | First-badge notification dedup |
| `score-bump:{handle}` | 7d | ~0.1 KB | Score-bump notification dedup |
| `campaign:daily-sends:{date}` | 24h | ~0.1 KB | Daily send counter |
| `campaign:active-engagement` | 1h | ~1 KB | Active campaign cache |
| `ff:all` | 1h | ~1 KB | All feature flags |
| `ff:key:{key}` | 1h | ~0.1 KB | Per-flag cache |
| `ratelimit:*:{ip\|handle}` | 1–60 min | ~0.1 KB | ~30 distinct patterns |
| `stats:badges_generated` | **None** | ~0.01 KB | HyperLogLog counter (intentional) |
| `stats:unique_badges` | **None** | ~12 KB | HyperLogLog unique devs (intentional) |

### TTL Coverage

- **Per-user keys**: 100% have TTLs.
- **No-TTL keys**: 2 — `stats:badges_generated` (HyperLogLog, ~0.01 KB) and `stats:unique_badges` (HyperLogLog, ~12 KB). Both intentional and memory-bounded by the HyperLogLog data structure. No growth risk.
- **365d keys**: `config:` + `badge:notified:` — effectively permanent, each ~2 KB. Bounded by user count.

### Storage Estimate (revised — avatar cache now included)

| Category | Per-user | @ 10K users |
|---|---|---|
| Stats + stale cache | ~13 KB | ~130 MB |
| Snapshot + craft + history | ~12.5 KB | ~125 MB |
| Avatar cache (base64 data URI) | ~30 KB avg | **~300 MB** |
| OG image cache (1 per active user/day) | ~200 KB | ~200 MB (1K active/day) |
| Config + dedup keys | ~2.2 KB | ~22 MB |
| Rate limit keys | ~3 KB | ~30 MB (transient) |
| Feature flags + campaign | ~2 KB | ~20 MB |
| **Total** | | **~827 MB** |

> **Previous estimate was ~1.52 GB** — avatar cache was not itemized in prior cycles. Current revised estimate is ~827 MB at 10K users (~8.3% of Upstash Pro 10 GB). Both OG image and avatar cache are TTL-bounded and CDN-assisted.

> **Headroom: ~91.7%** vs prior reported 85%. Upstash Pro 10 GB limit is not at risk.

### Growth Risk

- **Avatar cache**: 6h TTL, self-evicting. At peak 10K active users simultaneously = ~300 MB ceiling. LOW risk.
- **OG image cache**: 48h TTL, ~200 KB/entry. CDN caching (`s-maxage=21600`) means regeneration is rare. LOW risk.
- **No unbounded key patterns found.**

---

## Database Usage

- **Tables**: 10 (users, email_campaigns, campaign_sends, user_platforms, metrics_snapshots, verification_records, tool_insights, feature_flags, merge_operations) + 1 admin view joined with snapshots.
- **Views**: 2 (admin_users with LEFT JOIN to latest snapshot; view with `security_invoker = true`).

### Query Patterns

| Pattern | Location | Assessment |
|---|---|---|
| Platform login enrichment | `github/client.ts:80-82` | Uses `Promise.all()` — not N+1, 2 parallel DB calls max |
| Campaign stats aggregation | `campaigns.ts:425-463` | Client-side GROUP BY — P2-1, acceptable at <5K sends |
| Snapshot deduplication | `snapshots.ts:316-359` | Client-side JS dedup after ordered fetch — O(n), acceptable |
| Admin user table | `admin/users route` | Pre-joined view, paginated — no N+1 |
| Audience sync user fetch | `campaigns.ts:101` | Full table scan with email filter — acceptable at <100K users |

### Connection Management

**Lazy singleton per Node.js process** (`lib/db/supabase.ts`). Single `SupabaseClient` initialized once, reused across all requests. `persistSession: false` (stateless). Correct pattern for Vercel serverless — each invocation reuses the same process-level client, avoiding connection churn. No pooling layer needed at current scale.

### Carried: P2-1

`dbGetCampaignStats()` — client-side aggregation of `campaign_sends` rows by status. PostgREST does not support GROUP BY. Workaround is correct and efficient at current send volumes (<1K sends/campaign). Move to a Postgres RPC at >5K sends/campaign.

---

## External API Calls

| Route | External Service | Redis Cache | Rate Limited | Risk |
|---|---|---|---|---|
| `POST /api/refresh` | GitHub GraphQL | ✅ 6h TTL + 7d stale | ✅ 5 req/handle/hr | Low |
| `POST /api/generate` | GitHub GraphQL | ✅ 6h TTL + 7d stale + in-flight dedup | ✅ ~10 req/handle/hr | Low |
| `GET /api/cron/warm-cache` | GitHub GraphQL | ✅ Same cache-first | N/A (cron) | Low |
| `GET /api/cron/sync-audience` | Resend `contacts.list()` | ❌ No cache | ❌ No explicit limit | Medium |
| `POST /api/admin/campaigns/:id/send` | Resend `batch.send()` | ✅ Daily quota (Redis counter) | ✅ 95 emails/day | Low |
| `GET /api/cron/process-campaigns` | Resend `batch.send()` | ✅ Daily quota | ✅ 95 emails/day | Low |
| `POST /api/admin/campaigns/:id/test` | Resend `emails.send()` | ❌ No cache | ❌ No per-route limit | Low |
| `GET /api/notifications/unsubscribe` | Resend `markUnsubscribed()` | N/A | ✅ 10 req/IP/60s | Low |
| Platform stats (Bitbucket, Codeberg) | Platform APIs | ✅ 6h TTL per platform | ✅ Token refresh guards | Low |
| All routes | PostHog analytics | N/A (fire-and-forget) | N/A | Low |

### Notes

- **GitHub**: Cache-first with in-flight deduplication — thundering herd on cache miss is impossible. ~50–150 GitHub calls/hr baseline vs 5,000/hr limit (97%+ headroom). 7-day stale fallback means GitHub downtime is gracefully handled.
- **`sync-audience`** (medium risk): `listAllContacts()` paginates Resend's API on every cron run (3:30 AM daily) with no result caching. A Redis key with 1–2h TTL would eliminate all redundant API calls on reruns. Not urgent since it runs once daily with a 30s timeout backstop — but an easy win.
- **Campaign test route**: No per-route rate limit — guarded only by admin auth. Manual sends only, low-volume by design. Acceptable.
- **Fetch timeouts**: 100% — all external calls have `AbortSignal.timeout()`. P3 from 2026-04-09 (PostHog server-errors.ts) confirmed RESOLVED by triage 2026-04-10.

---

## Resource Management

### Serverless Runtime

- **All routes use Node.js serverless** (no `export const runtime = 'edge'`). Correct — image rendering, database access, and crypto operations require Node.js.
- **`maxDuration = 300`** on cron routes (`warm-cache`, `sync-audience`, `process-campaigns`, `bulk-recalculate`). Appropriate.
- **`@resvg/resvg-js`** marked as `serverExternalPackages` — keeps native binary out of the bundle. Correct.
- **Font TTF files** explicitly traced via `outputFileTracingIncludes` — required for SVG text rendering on Vercel. File size acceptable.

### ISR / SSG Configuration

| Route | Strategy | Revalidate |
|---|---|---|
| `/` (homepage) | ISR | 1 hour |
| `/u/[handle]` (share pages) | ISR | 1 hour |
| `/archetypes/*` (6 pages) | ISR | 7 days |
| `/about`, `/about/scoring`, `/about/verification` | ISR | 24 hours |
| `/privacy`, `/terms` | ISR | 24 hours |

ISR coverage is solid. Share pages benefit most from 1-hour revalidation — Vercel CDN serves cached HTML for the majority of embedded badge link visits, significantly reducing serverless invocations.

### Resource Leaks

None found.

- **Agent process spawning** (`/api/admin/agents/run`): Hard 5-min timeout (`PROCESS_TIMEOUT_MS = 300_000`), SIGTERM→SIGKILL escalation, 500-line circular log buffer, full stream cleanup on exit.
- **SVG→PNG conversion** (`og-image` route): 10s `Promise.race()` timeout, result cached 48h in Redis to prevent redundant renders.
- **Batch processing** (cron jobs): `Promise.allSettled()` with `BATCH_SIZE=5`, `MAX_HANDLES=50` ceiling on warm-cache. No unbounded loops.
- **`sync-audience` pagination**: `LIST_CONTACTS_TIMEOUT_MS = 30_000` backstop — even if Resend's `has_more` behaves unexpectedly, the loop terminates in 30s.
- **No `Buffer.alloc()` with unbounded sizes**, no unclosed streams, no missing AbortController patterns.

---

## Vercel Cost Factors

### Serverless Invocation Reduction

| Mechanism | Impact |
|---|---|
| Redis 6h stats cache | Badge views don't trigger GitHub API or DB queries |
| ISR on share pages (1h) | CDN serves cached HTML — no Lambda invocation |
| `s-maxage=21600` on badge SVG | 6h CDN cache per user/theme — minimal Lambda hits |
| OG image 48h Redis cache | Render-once-per-day per user |
| In-flight deduplication | Zero-cost duplicate requests on cache miss |

### Bundle Size

Last measured (2026-04-09): **1,682 KB total client JS** (gzipped ~522 KB). No chunk >500 KB. Next.js upgraded to 16.2.3 (GHSA-q4gf-8mx6-v5v3 security patch). No cost impact from upgrade.

---

## Recommendations

### Active Items

| # | Priority | Item | File | Action |
|---|---|---|---|---|
| P2-1 | Medium | `dbGetCampaignStats()` client-side aggregation | `lib/db/campaigns.ts:425-463` | Create Postgres RPC function at >5K sends/campaign |
| P3 | Low | Cache `listAllContacts()` in sync-audience cron | `app/api/cron/sync-audience/route.ts` | Add 1–2h Redis cache around Resend pagination; eliminates all repeat API calls. ~5 lines. |

### Monitors (no immediate action)

| # | Item | Current State | Threshold |
|---|---|---|---|
| M1 | Avatar cache Redis memory | ~300 MB max @ 10K simultaneous users | Re-evaluate if user base grows 5× |
| M2 | OG image Redis memory | ~200 MB @ 1K active/day | Re-evaluate if CDN cache-hit ratio drops |
| M3 | HyperLogLog keys | ~12 KB stable | Quarterly check |
