# Cost Analyst Report
> Generated: 2026-03-24 | Branch: `develop` | Health status: **GREEN**

## Executive Summary

Infrastructure costs remain stable and well-controlled. Estimated monthly cost at 10K users: **~$40–60** (Vercel $20, Redis $20, Resend $0–20, Supabase free). At 50K users: ~$65–150/mo. TTL coverage is 100% for per-user keys (2 global singletons intentionally persistent, combined <16 KB). All external `fetch()` calls have timeouts on the critical path (1 fire-and-forget PostHog call has no timeout — acceptable). No critical resource leaks. Badge SVG route confirmed using `Promise.allSettled()`. Two monitor items carried forward unchanged.

---

## Redis Usage

### Key Pattern Families (17 families)

| # | Key Pattern | TTL | Est. Size | Notes |
|---|------------|-----|-----------|-------|
| 1 | `stats:v2:merged:{handle}` | 6h (21,600s) | ~2–5 KB | Primary stats cache |
| 2 | `stats:v2:merged:{handle}:stale` | 7d (604,800s) | ~2–5 KB | Stale fallback for rate-limit errors |
| 3 | `stats:v2:bitbucket:{handle}` | 6h (21,600s) | ~2–5 KB | Bitbucket stats cache |
| 4 | `stats:v2:codeberg:{handle}` | 6h (21,600s) | ~2–5 KB | Codeberg stats cache |
| 5 | `supplemental:{handle}` | 6h (21,600s default) | ~1 KB | EMU supplemental data |
| 6 | `config:{login}` | 365d (31,536,000s) | ~1–2 KB | Studio badge config (persistent) |
| 7 | `og-image:v1:{handle}:{date}` | 48h (172,800s) | ~50–100 KB | OG PNG as base64 — **#1 memory consumer** |
| 8 | `avatar:{handle}` | 6h (21,600s) | ~10–30 KB | Avatar data URI |
| 9 | `history:{handle}[:{from}:{to}]` | 1h (3,600s) | ~1–5 KB | History snapshots cache |
| 10 | `snapshot:{handle}` | 24h (86,400s) | ~0.5 KB | Latest metrics snapshot |
| 11 | `ff:all` / `ff:key:{key}` | 1h (3,600s) | <1 KB | Feature flags cache |
| 12 | `engagement:active` | 1h (3,600s) | ~1 KB | Active engagement campaign |
| 13 | `badge:notified:{handle}` | 365d (31,536,000s) | <0.1 KB | First-badge email dedup |
| 14 | `score-bump:{handle}` | 7d (604,800s) | <0.1 KB | Score bump email dedup |
| 15 | `campaign:quota:{date}` | 24h (86,400s) | <0.1 KB | Daily email send counter |
| 16 | `cli:device:{sessionId}` | 5min (300s) | <0.5 KB | CLI device auth sessions |
| 17 | `ratelimit:*:{identifier}` | 60s–86,400s | <0.1 KB each | Rate limit counters (36 call sites, 17+ key variants) |

### Global Singletons (No TTL — Intentional)

| Key | Type | Est. Size | Rationale |
|-----|------|-----------|-----------|
| `stats:badges_generated` | Counter (INCR) | <16 bytes | Lifetime counter, intentionally persistent |
| `stats:unique_badges` | HyperLogLog (PFADD) | <12 KB | Approximate unique developer count |

**TTL coverage: 100% per-user keys.** Only 2 global singletons lack TTL — intentional, combined <16 KB. Growth risk: **LOW**.

### Memory Estimates at Scale

| Users | User Keys | OG Images | Avatars | Total Est. |
|-------|-----------|-----------|---------|------------|
| 1K | ~16 MB | ~75 MB | ~25 MB | ~120 MB |
| 10K | ~160 MB | ~375 MB | ~250 MB | ~535 MB (Upstash Pro 10 GB) |
| 50K | ~800 MB | ~1.9 GB | ~1.25 GB | ~4 GB |

---

## Database Usage

### Tables (9 tables + 1 view)

| Table | Operations | Access Pattern |
|-------|-----------|---------------|
| `users` | upsert, select, update | Registration, profile lookup, email prefs |
| `metrics_snapshots` | upsert, select, delete | Daily score snapshots, history, cleanup |
| `tool_insights` | upsert, select | Craft score storage and retrieval |
| `verification_records` | upsert, select, delete | Badge HMAC verification |
| `merge_operations` | insert, delete | Telemetry for EMU merges |
| `email_campaigns` | insert, select, update, delete | Campaign CRUD |
| `campaign_sends` | upsert, select, update | Campaign recipient tracking |
| `user_platforms` | upsert, select, delete | Bitbucket/Codeberg linked accounts |
| `feature_flags` | select, update | Feature flag management |
| `admin_users` (view) | select (with count) | Admin dashboard user list |

### Connection Management

- **Lazy singleton** via `getSupabase()` — one client per serverless function lifetime
- PostgREST REST API — no direct Postgres connections, no connection pool needed
- `auth: { persistSession: false }` — no session overhead
- Health check with 5s timeout via `Promise.race()`

### Query Efficiency

- **0 N+1 patterns** — all queries are single-table with appropriate filters
- **Batch operations** use `upsert()` with `onConflict` for idempotent writes
- **JS aggregation**: `dbGetCampaignStats()` aggregates campaign send statuses in JS — **ACCEPTED** (PostgREST lacks GROUP BY; confirmed correct by triage 2026-03-22)
- **Row validation**: `parseRow()`/`parseRows()` runtime validation on all DB reads
- RLS enabled on all 9 tables with explicit deny policies

---

## External API Calls

### Service Call Matrix

| Route / Module | Service | Timeout | Cached | Rate Limited | Risk |
|----------------|---------|---------|--------|-------------|------|
| `lib/github/queries.ts` | GitHub GraphQL | 15s (AbortSignal) | 6h + 7d stale | Upstream 5K/hr | LOW |
| `lib/bitbucket/queries.ts` | Bitbucket REST | AbortController + 30s | 6h | Yes | LOW |
| `lib/codeberg/queries.ts` | Codeberg REST | AbortController + 30s | 6h | Yes | LOW |
| `lib/auth/github.ts` | GitHub OAuth | 10s (AbortSignal) | N/A (auth flow) | 20/900s | LOW |
| `lib/auth/bitbucket.ts` | Bitbucket OAuth | 10s (AbortSignal) | N/A | 10/900s | LOW |
| `lib/auth/codeberg.ts` | Codeberg OAuth | 10s (AbortSignal) | N/A | 10/900s | LOW |
| `lib/render/avatar.ts` | GitHub CDN | 5s (AbortSignal) | 6h | N/A | LOW |
| `lib/email/resend.ts` | Resend API | 5s (AbortSignal) | N/A | 95/day quota | LOW |
| `lib/analytics/server-errors.ts` | PostHog `/capture/` | **None** | N/A | N/A | LOW (fire-and-forget) |
| `app/u/[handle]/og-image` | Internal (getStats + render) | 10s (svgToPng race) | 48h Redis | CDN cached | LOW |
| Cron: `warm-cache` | GitHub + Supabase | Via getStats | 6h | Bearer auth | LOW |
| Cron: `sync-audience` | Resend contacts API | 30s (Promise.race) | N/A | Bearer auth | **MONITOR** |
| Cron: `process-campaigns` | Resend batch send | 5s | N/A | 95/day + batch 50 | LOW |

### GitHub API Budget

- **Authenticated**: 5,000 requests/hour
- At 10K users (50% cache hit rate): ~420 calls/hr → **91.6% headroom**
- In-flight deduplication (`_inflight` Map in `client.ts:22`) reduces concurrent calls 40–60%
- Stale cache (7d TTL) provides fallback when rate-limited

### Rate Limiting Coverage

**36 `rateLimit()` call sites** across all API routes — comprehensive coverage. All fail-open by design.

| Route Group | Window | Limit | Key Pattern |
|-------------|--------|-------|-------------|
| Auth (login, callback, logout, session) | 60s–900s | 10–60 | `ratelimit:{auth-type}:{ip}` |
| Bitbucket auth (connect/disconnect/callback/status) | 900s | 10–20 | `ratelimit:bb:{action}:{ip}` |
| Codeberg auth (connect/disconnect/callback/status) | 900s | 10–20 | `ratelimit:cb:{action}:{ip}` |
| Badge generation | 3,600s | 3 | `ratelimit:generate:{handle}` |
| Refresh | 3,600s | 5 | `ratelimit:refresh:{handle}` |
| Recalculate | 3,600s | 20 | `ratelimit:recalculate:{handle}` |
| History | 60s | 100 | `ratelimit:history:{ip}` |
| Verify | 60s | 30 | `ratelimit:verify:{ip}` |
| Health | 60s | 30 | `ratelimit:health:{ip}` |
| Feature flags | 60s | 30 | `ratelimit:feature-flags:{ip}` |
| Insights | 60s | 60 | `ratelimit:insights:{ip}` |
| Admin routes (6 endpoints) | 60s | 10–30 | `ratelimit:admin-*:{ip}` |
| Supplemental | 86,400s | 10 | `ratelimit:supplemental:{handle}` |
| Telemetry | 60s | 10 | `ratelimit:telemetry:{handle}` |
| Studio config | 3,600s | 30 | `ratelimit:config:{login}` |
| CLI (poll/approve) | 60s | 10–30 | `ratelimit:cli-*:{ip}` |
| Webhooks | 60s | 20 | `ratelimit:webhook:{ip}` |
| Unsubscribe | 60s | 10 | `ratelimit:unsubscribe:{ip}` |
| Campaign email quota | 86,400s | 95 | `campaign:quota:{date}` (Redis counter) |

---

## Resource Management

### Fetch Timeout Coverage: **100% on critical path**

Every server-side `fetch()` call has an `AbortSignal.timeout()` or equivalent `Promise.race()` with timeout:

| Module | Fetch calls | Timeout mechanism |
|--------|-------------|-------------------|
| `lib/auth/github.ts` | 3 | `AbortSignal.timeout(10_000)` |
| `lib/auth/bitbucket.ts` | 3 | `AbortSignal.timeout(10_000)` |
| `lib/auth/codeberg.ts` | 3 | `AbortSignal.timeout(10_000)` |
| `lib/github/queries.ts` | 1 | `AbortSignal.timeout(15_000)` |
| `lib/bitbucket/queries.ts` | 2+ | `AbortController` + `setTimeout(30_000)` per-request |
| `lib/codeberg/queries.ts` | 5+ | `AbortController` + `setTimeout(30_000)` per-request |
| `lib/render/avatar.ts` | 1 | `AbortSignal.timeout(5_000)` |
| `lib/email/resend.ts` | 1 | `AbortSignal.timeout(5_000)` |
| `app/u/[handle]/og-image/route.ts` | 0 (uses `@resvg/resvg-js`) | `Promise.race()` with 10s timeout |
| `lib/cache/redis.ts` (ping) | 0 (uses SDK) | `Promise.race()` with 5s timeout |
| `lib/db/supabase.ts` (ping) | 0 (uses SDK) | `Promise.race()` with 5s timeout |
| `api/cron/sync-audience/route.ts` | 0 (uses Resend SDK) | `Promise.race()` with 30s timeout |

**Exception**: `captureServerError` at `server-errors.ts:106` — PostHog capture call has no `AbortSignal.timeout()`. Intentional: fire-and-forget (void'd, never awaited on critical path), wrapped in try/catch that swallows all errors. Adding a timeout would be defensive but not materially impactful.

### Promise.all vs Promise.allSettled

| Location | Type | Status |
|----------|------|--------|
| `badge.svg/route.ts:104` | `Promise.allSettled` | CORRECT — craft/snapshot/avatar errors don't crash badge |
| `badge.svg/route.ts:170` | `Promise.allSettled` | CORRECT — post-response `after()` ops |
| `u/[handle]/page.tsx:172` | `Promise.allSettled` | CORRECT — post-response `after()` ops |
| `u/[handle]/page.tsx:102` | `Promise.all` | ACCEPTABLE — all callees have internal try/catch, return null on failure |
| `insights/route.ts:65` | `Promise.allSettled` | CORRECT — cache invalidation in `after()` |
| `github/client.ts:117` | `Promise.allSettled` | CORRECT — Bitbucket + Codeberg fetch |
| `github/client.ts:80,147` | `Promise.all` | ACCEPTABLE — callees have internal error handling |
| `health/route.ts:22` | `Promise.all` | ACCEPTABLE — ping functions return status strings, never throw |
| `recalculate/route.ts:45` | `Promise.all` | ACCEPTABLE — both callees handle errors internally |
| `sync-audience/route.ts:95` | `Promise.all` | ACCEPTABLE — both callees handle errors internally |

### Timer Cleanup

All client-side timers properly cleaned up:

| Component | Timer type | Cleanup | Status |
|-----------|-----------|---------|--------|
| `Toast.tsx` | `setTimeout` (2x) | `useEffect` return clears both | OK |
| `GlobalCommandBar.tsx` | `setTimeout` | `useEffect` return clears via ref | OK |
| `AuthorTypewriter.tsx` | `setTimeout` chain | `cancelled` flag + `useEffect` return | OK |
| `GeneratingProgress.tsx` | `setTimeout` (staggered) | `cancelled=true` on unmount | ACCEPTABLE |
| `BadgeToolbar.tsx` | `setTimeout` (4x) | Fire-and-forget UI (500ms-3s, setState only) | ACCEPTABLE |
| `CopyButton.tsx` | `setTimeout` | Fire-and-forget (2s, setState only) | ACCEPTABLE |
| `terminal-display.tsx` | `setInterval` (2x) + `setTimeout` | All cleared in `useEffect` returns | OK |
| `PostHogProvider.tsx` | `setTimeout` | `useEffect` return clears it | OK |
| `TerminalInput.tsx` | `setTimeout` | `useEffect` return clears it | OK |
| `BadgePreviewCard.tsx` | `setTimeout` | `useEffect` return clears it | OK |
| `agents/run/route.ts` | `setTimeout` (2x) | `cleanupProcess()` clears both via refs | OK |

Server-side timers:

| Location | Timer | Cleanup | Status |
|----------|-------|---------|--------|
| `lib/codeberg/queries.ts` | `setTimeout` (abort) | `clearTimeout` in finally block | OK |
| `lib/bitbucket/queries.ts` | `setTimeout` (abort) | `clearTimeout` in finally block | OK |
| `lib/cache/redis.ts` (ping) | `setTimeout` (race) | GC'd after Promise.race settles | OK |
| `lib/db/supabase.ts` (ping) | `setTimeout` (race) | Same pattern | OK |
| `api/cron/sync-audience` | `setTimeout` (race) | `.finally(() => clearTimeout(timer))` | OK |

### In-Memory Buffers

| Location | Type | Size control | Status |
|----------|------|-------------|--------|
| `github/client.ts:22` | `_inflight` Map | Auto-cleared via `.finally()` after each request | OK |
| `render/avatar.ts` | `ArrayBuffer` | Bounded by 5s timeout, temporary | OK |
| `agents/run/route.ts` | `activeRuns` Map + log lines | `MAX_LOG_LINES` cap, 5m hard timeout | OK |

### Resource Leak Summary

**0 critical, 0 warnings.**

---

## Vercel Cost Factors

### ISR/Revalidation Coverage

| Route | Revalidate | Strategy |
|-------|-----------|----------|
| `/` (landing) | 3,600s (1h) | ISR |
| `/about`, `/about/scoring`, `/about/verification` | 3,600s (1h) | ISR |
| `/archetypes/*` (7 pages) | 604,800s (7d) | ISR |
| `/u/[handle]` (share page) | 3,600s (1h) | ISR |
| `/privacy`, `/terms` | 86,400s (24h) | ISR |
| `/studio` | `force-dynamic` | Dynamic (imports `headers()`) |
| `/experiments/*` | `force-dynamic` (layout) | Dynamic (feature-flagged) |

ISR on all high-traffic public pages means Vercel serves from CDN cache. Optimal.

### Infrastructure

- **No edge runtime** — all serverless (Node.js)
- **No middleware** — zero per-request edge compute cost
- **42+ API routes** — all serverless functions
- **`serverExternalPackages: ["@resvg/resvg-js"]`** — correctly externalized native binary
- **`maxDuration = 300`** — only on `sync-audience` cron route

### Cron Job Analysis

| Cron | Schedule | Monthly Runs | Est. Duration | Monthly Compute |
|------|----------|-------------|---------------|-----------------|
| `/api/cron/warm-cache` | Daily 6 AM UTC | ~30 | ~30–60s | ~15–30 min |
| `/api/cron/sync-audience` | Daily 3:30 AM UTC | ~30 | ~10–30s | ~5–15 min |
| `/api/cron/process-campaigns` | Daily 8 AM UTC | ~30 | ~5–15s | ~2.5–7.5 min |
| **Total** | | **~90** | | **~0.25–0.9 hr/mo** (vs 2,160 free) |

### Cache Headers

Badge SVG endpoint: `Cache-Control: public, s-maxage=21600, stale-while-revalidate=604800`
Error fallback: `s-maxage=300` (5 min) — correct, doesn't cache errors for long.
OG image: 48h Redis cache + response `Cache-Control`.

---

## Cost Projections

| Service | @10K users/mo | @50K users/mo |
|---------|--------------|---------------|
| Vercel (Pro) | ~$20 | ~$20–40 |
| Upstash Redis | ~$20 | ~$30–50 |
| Resend | $0–20 | $20–40 |
| Supabase | Free tier | Free–$25 |
| **Total** | **~$40–60** | **~$70–150** |

---

## Monitor Items (Future Scale)

### MONITOR: OG Image Redis Memory (50K+ users)
- **Status**: CARRIED (no change)
- At 50K users, OG images could consume ~1.9 GB (base64 PNG, 48h TTL). Combined with other keys (~4 GB total), approaches Upstash Pro 10 GB ceiling.
- **Action at scale**: Consider Vercel Blob or Cloudflare R2 for OG image storage.

### MONITOR: `sync-audience` Contact Pagination (10K+ contacts)
- **Status**: CARRIED (no change)
- Currently fetches all Resend contacts from page 1 each run, bounded by 30s timeout.
- **Action at scale**: Implement cursor caching for incremental sync.

---

## Changes Since Last Report (2026-03-23)

| Item | Previous | Current | Change |
|------|----------|---------|--------|
| Resource leaks | 0 critical | 0 critical | Stable |
| Fetch timeout coverage | 100% critical path | 100% critical path | Stable |
| Timer cleanup | All clean | All clean | Stable |
| Badge SVG Promise.allSettled | Verified line 104 | Re-verified line 104 | Stable |
| Redis key families | 16 | 17 (added `cli:device`) | Minor addition |
| Rate limit call sites | 14+ | 36 (precise count) | More precise count |
| ISR routes | 14 | 14 | Stable |
| Cron executions/month | ~90 | ~90 | Stable |
| Edge runtime / middleware | None | None | Stable |

**Delta: No material changes.** Infrastructure costs remain well-controlled and stable.
