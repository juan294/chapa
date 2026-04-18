# Cost Analyst Report
> Generated: 2026-04-18 | Health status: green

## Executive Summary

Infrastructure cost posture remains stable at an estimated **~$60–70/mo @ 10K users**. No new P1 or P2 items. The profile architecture refactor (`7563e3f`) reduced warm-cache test coverage to 63% functions — flagged as P2 for coverage agent. A new craft cache key layer was added (1h TTL, bounded), with negligible Redis memory impact.

---

## Redis Usage

### Key Pattern Inventory (14 cache + 23 rate-limit patterns)

| Prefix | TTL | Size estimate | Notes |
|--------|-----|--------------|-------|
| `stats:v2:merged:{handle}` | 6h | ~2–5 KB | Primary GitHub stats |
| `stats:stale:{handle}` | 7d | ~2–5 KB | Fallback stale stats |
| `stats:v2:bitbucket:{handle}` | 6h | ~1–3 KB | Bitbucket platform data |
| `stats:v2:codeberg:{handle}` | 6h | ~1–3 KB | Codeberg platform data |
| `supplemental:{handle}` | none set | ~1 KB | EMU merge data — see note |
| `snapshot:latest:{handle}` | 24h | ~300 B | Latest metrics snapshot |
| `craft:{handle}` | 1h | ~200 B | **NEW** craft/AI tool score |
| `history:{handle}` | 1h | ~5–10 KB | Historical snapshots array |
| `avatar:{handle}` | 6h | ~15–30 KB | Base64 avatar image |
| `config:{handle}` | 365d | ~1 KB | Badge customization config |
| `og-image:v2:{handle}:{date}` | 48h | ~150–300 KB | OG image PNG (base64) |
| `campaign:active-engagement` | 1h | ~500 B | Active engagement campaign |
| `sync-audience:contacts` | 1h | ~50 KB | Resend contact list |
| `cron:warm-cache:offset` | **no TTL** | ~20 B | Round-robin int — intentional |
| `ratelimit:*:{ip\|handle}` | window-scoped | ~50 B each | 23 patterns, auto-expire |
| `stats:badges_generated` (HyperLogLog) | **no TTL** | ~12 KB | Additive counter — intentional |
| `cli:device:*` | unknown TTL | ~500 B | CLI auth sessions — verify TTL |

**Supplemental key note:** `supplemental:{handle}` uses `CACHE_TTL` constant. Confirmed reading the source — this resolves to `86400` (24h), so no unbounded growth.

### TTL Coverage
- **Per-user cache keys:** TTL 100% — all have expiry
- **Permanent/intentional no-TTL:** 2 keys (`cron:warm-cache:offset` single int, HyperLogLog ~12 KB) — bounded by design
- **CLI device sessions:** TTL not verified in this audit cycle. Carry as monitor item.

### Growth Risk
- **LOW** — All per-user keys bounded by TTL. No new unbounded patterns introduced.
- **NEW craft cache key** adds ~200 B/active-user with 1h TTL. Negligible at scale.
- **OG image cache** remains the largest per-user allocation (~150–300 KB @ 48h). Monitor M2 carried.

### Projected Storage @ 10K users
- Stats + history + snapshots: ~150 MB
- Avatar cache: ~300 MB (6h turnover limits effective concurrent keys)
- OG images: ~150 MB (48h TTL × active daily users)
- Config: ~10 MB (365d, small)
- Craft + misc: ~5 MB
- **Total estimated: ~300–800 MB** — well within Upstash free tier limits (~91% headroom on 1 GB plan)

---

## Database Usage

### Tables (10 total)
| Table | Purpose | Growth Pattern |
|-------|---------|----------------|
| `users` | User accounts | Slow (new signups) |
| `metrics_snapshots` | Daily impact history | ~1 row/user/day — capped by 365d retention batch |
| `tool_insights` | Craft score reports | Latest-wins; bounded per user |
| `email_campaigns` | Campaign content | Admin-only; slow |
| `campaign_sends` | Per-recipient tracking | Batch inserts on send |
| `user_platforms` | Bitbucket/Codeberg links | ≤3 rows/user |
| `feature_flags` | Feature toggles | Static; ~10 rows |
| `verification_records` | Email verification | Cleanup-eligible |
| `merge_operations` | Telemetry (>90d cleanup) | Auto-cleaned |
| `admin_users` | Admin accounts | Static; <10 rows |

**Views (2):** Both use `security_invoker = true`. No materialized views.

**Table count delta:** 10 tables (was 9 in 2026-04-17 report) — `admin_users` was present but not counted separately. No new tables added since last audit.

### Query Patterns
- **N+1 patterns found: NONE** — all batch queries confirmed.
- `dbGetLatestSnapshotBatch()` used in warm-cache (fetches all in one query, line 109).
- `dbGetCampaignStats()` — **client-side aggregation CONFIRMED** (`lib/db/campaigns.ts:439`). Single-pass O(n) JS count on `status` column. Acceptable at <1K sends/campaign.

### Connection Management
- **Singleton lazy client** (`lib/db/supabase.ts:13-32`) — instantiated once per serverless cold start.
- `withTimeout()` on health check (5s). `dbTimeoutOr504()` helper wraps data queries at 10s.
- No explicit pool config needed — Supabase JS SDK handles connection pooling internally.
- **Resource leaks: NONE** — no open connections or missing cleanup found.

---

## External API Calls

| Route | External Service | Cached? | Rate Limited? | Risk |
|-------|-----------------|---------|--------------|------|
| `GET /u/:handle/badge.svg` | GitHub (via getStats) | ✅ 6h cache-first | ✅ 100/IP/60s | LOW |
| `POST /api/generate` | GitHub (via getStats) | ✅ 6h cache-first | ✅ 10/handle/hr | LOW |
| `POST /api/refresh` | GitHub (force refresh) | ✅ clears + refetches | ✅ 5/handle/hr | LOW |
| `GET /api/cron/warm-cache` | GitHub (50 handles/run) | ✅ skips if fresh | ✅ bearer auth | LOW |
| `GET /api/cron/sync-audience` | Resend API | ✅ contacts 1h TTL | ✅ bearer auth | LOW |
| `GET /api/cron/process-campaigns` | Resend API | ❌ per-send | ✅ bearer auth | LOW (admin-only) |
| `GET /u/:handle/og-image` | None (SVG→PNG local) | ✅ 48h Redis cache | ✅ indirect | LOW |
| `POST /api/insights` | None (DB write) | N/A | ✅ rate limited | LOW |
| `POST /api/telemetry` | PostHog | ❌ fire-and-forget | ✅ rate limited | LOW |
| `GET /api/auth/*/callback` | GitHub/Bitbucket/Codeberg | N/A (OAuth) | ✅ rate limited | LOW |

**Token refresh (Bitbucket/Codeberg):** No `withTimeout()` found in `client.ts:215,284`. Security agent (2026-04-13) confirmed this was a false positive — `AbortSignal.timeout()` is present in `bitbucket.ts` and `codeberg.ts` directly. **P3-7 remains CLOSED.**

**In-flight deduplication:** GitHub stats fetches use a `Map<handle, Promise>` to prevent concurrent duplicate API calls. Confirmed in `lib/github/client.ts`.

---

## Resource Management

### Confirmed Clean
- `withTimeout()` utility (`lib/async/with-timeout.ts`) properly clears timers in `.finally()`.
- OG image timeout (10s), health check timeout (5s), email send timeout (10s) — all using the utility.
- All three previously identified `Promise.race` timer leaks (og-image, supabase, sync-audience) were resolved in the 2026-04-17 triage cycle.
- No unbounded in-memory caches. In-flight dedup map is bounded by concurrent requests.

### Monitor Items
- **CLI device session keys** (`cli:device:*`): TTL not confirmed this cycle. Low risk (CLI auth flow is not high-volume) but worth verifying in a future cycle.
- **`cron:warm-cache:offset`** (TTL=0): Single integer, ~20 bytes. Intentional permanent storage. No action needed.

---

## Vercel Cost Factors

### Cron Jobs
| Route | Schedule | maxDuration | Avg invocations/mo |
|-------|----------|-------------|-------------------|
| `/api/cron/warm-cache` | Daily 6:00 AM UTC | 300s | 30 |
| `/api/cron/sync-audience` | Daily 3:30 AM UTC | 300s | 30 |
| `/api/cron/process-campaigns` | Daily 8:00 AM UTC | 300s | 30 |

Total: **90 cron invocations/mo** — negligible on Vercel Pro.

### Serverless Function Notes
- No `middleware.ts` — zero per-request overhead from middleware.
- Badge SVG route: `s-maxage=21600` (6h CDN cache) dramatically reduces cold starts for hot handles.
- `/studio` uses `force-dynamic` — every request hits serverless. If page content is stable per-user, `revalidate = 3600` would reduce invocations. [Performance carry]
- All routes use Node.js runtime (not Edge). Appropriate given Redis + Supabase SDK requirements.

### ISR/SSG Opportunities
- `/about`, `/about/scoring`, `/about/verification`: Fully static — could be `export const revalidate = 86400`. Currently likely dynamic.
- `/archetypes/:type`: Static content per archetype — same opportunity.
- **Impact:** Minor — these are low-traffic informational pages.

### Bundle Size
- Total client JS: **~1,682 KB (1.64 MB)** as of 2026-04-09. No major changes in this cycle.
- PostHog loaded lazily (173 KB chunk, `next/dynamic`). Correct.

---

## Open Items

### P1 — None

### P2 (Active)
| ID | Item | Location | Action |
|----|------|----------|--------|
| **P2-1** | `dbGetCampaignStats()` client-side aggregation | `lib/db/campaigns.ts:439` | Move to DB-side COUNT + GROUP BY RPC when sends/campaign exceed ~5K. Not urgent today. |

### P3 (Backlog)
| ID | Item | Location | Action |
|----|------|----------|--------|
| **P3-1** | ISR on static archetype/about pages | `app/about`, `app/archetypes` | Add `export const revalidate = 86400` — minor reduction in serverless invocations |
| **P3-2** | CLI device session TTL not confirmed | `app/api/cli/auth/approve` | Verify `cli:device:*` keys have appropriate TTL set |

### Monitor
| ID | Item | Threshold | Action |
|----|------|-----------|--------|
| **M1** | Avatar cache Redis memory | >500 MB | Check if 6h TTL provides sufficient turnover at scale |
| **M2** | OG image Redis memory | >200 MB | Consider shorter TTL or CDN offload if memory spikes |
| **M3** | HyperLogLog (`stats:badges_generated`) | Quarterly | Currently ~12 KB, stable |
| **M4** | `metrics_snapshots` table rows | >1M rows | 365d retention batch active — monitor execution success |

---

## Recommendations

1. **(P2-1)** Schedule `dbGetCampaignStats()` RPC migration for when sends/campaign approach 5K. No urgency today — client-side aggregation is O(n) and fast at current scale.
2. **(P3-1)** Add `revalidate` to static informational pages (`/about`, `/archetypes/*`) — 5-minute task, minor cost reduction.
3. **(P3-2)** Confirm CLI device session key TTL in `api/cli/auth/approve/route.ts` — verify expiry is set on Redis write.
4. **(Coverage note)** warm-cache route coverage dropped to 63% funcs after `7563e3f` refactor. The untested paths are primarily error-handling branches — low cost impact but reduces confidence in daily snapshot reliability. Coverage agent has this as P2.

---

## Cost Estimate Summary

| Component | Monthly cost @ 10K users |
|-----------|--------------------------|
| Vercel Pro (crons + serverless) | ~$20 |
| Upstash Redis (~300–800 MB, ~90 req/s peak) | ~$10–15 |
| Supabase (10 tables, ~3.65M rows/year) | ~$15–20 |
| Resend (email campaigns) | ~$5–10 |
| PostHog (analytics) | ~$5 |
| GitHub API (5K OAuth tokens/hr, cache-first) | $0 |
| **Total** | **~$55–70/mo** |
