# Cost Analyst Report
> Generated: 2026-05-06 | Health status: GREEN

## Executive Summary

Infrastructure footprint is unchanged from the 2026-05-05 cycle. The 5 recent commits (i18n command descriptions, Spanish share-menu labels, triage P2 coverage fixes) added zero Redis writes, zero external API calls, and zero Supabase queries. All monitors and P2-1 carry status are stable.

---

## Redis Usage

### Key Prefixes (28 distinct patterns, all confirmed in code)

| Prefix | TTL | File | Notes |
|--------|-----|------|-------|
| `stats:v2:merged:<handle>` | 21600s (6h) | `lib/github/client.ts:212` | Primary stats cache |
| `stats:v2:<platform>:<handle>` | 21600s (6h) | `lib/bitbucket/client.ts:68`, `lib/codeberg/client.ts:80` | Per-platform stats |
| `stats:v2:stale:<handle>` | 604800s (7d) | `lib/github/client.ts:213` | Stale-while-revalidate |
| `supplemental:<handle>` | 86400s (24h) | `lib/github/client.ts:169` | EMU supplemental data |
| `stats:dirty:<handle>` | 3600s (1h) | `lib/cache/dirty-stats.ts:22` | Mid-day refresh signal |
| `badge:<version>:<handle>:warm-amber:<date>` | 86400s (24h) | `lib/render/badge-svg-cache.ts:43` | Full SVG response cache |
| `badge-lock:<version>:<handle>:warm-amber:<date>` | 30s | `app/u/[handle]/badge.svg/route.ts:29` | Render dedup lock |
| `avatar:<handle>` | 21600s (6h) | `lib/render/avatar.ts:71` | Base64 avatar cache |
| `snapshot:<version>:latest:<handle>` | 86400s (24h) | `lib/cache/snapshot-cache.ts:18` | Latest MetricsSnapshot |
| `craft:<version>:<handle>` | 3600s (1h) | `lib/cache/craft-cache.ts:19` | Craft/tool insights cache |
| `sideeffects:done:<handle>:<date>` | 86400s (24h) | `lib/profile/public-profile.ts:73` | Once-per-day badge side-effects guard |
| `config:<login>` | 31536000s (1yr) | `app/api/studio/config/route.ts:73` | Studio badge config per user |
| `ff:all` | 3600s (1h) | `lib/db/feature-flags.ts:98` | All feature flags cache |
| `ff:key:<key>` | 3600s (1h) | `lib/db/feature-flags.ts:140` | Single feature flag cache |
| `cli:device:<sessionId>` | 300s (5min) | `app/api/cli/auth/approve/route.ts:44` | CLI device auth token |
| `campaign:active-engagement` | 3600s (1h) | `lib/db/campaigns.ts:527` | Active engagement campaign cache |
| `sync-audience:contacts` | 3600s (1h) | `app/api/cron/sync-audience/route.ts:21` | Resend contacts list cache |
| `score-bump:<handle>` | 604800s (7d) | `lib/email/score-bump.ts:74,160` | Score-bump notification dedup |
| `badge:notified:<handle>` | 31536000s (1yr) | `lib/email/notifications.ts:29,106` | First-badge email dedup (prod-only) |
| `webhook:resend:svix:<svixId>` | 604800s (7d) | `app/api/webhooks/resend/route.ts:97-98` | Resend webhook idempotency dedup |
| `cron:warm-cache:offset` | **persistent (TTL=0)** | `app/api/cron/warm-cache/route.ts:145` | Rotation offset singleton |
| `stats:badges_generated` | **persistent (TTL=0)** | `lib/cache/redis.ts:243` | Total badge count (INCR singleton) |
| `stats:unique_badges` | **persistent (TTL=0)** | `lib/cache/redis.ts:244` | Unique handle HLL (~12 KB, singleton) |
| `history:<handle>` | 3600s (1h) | `lib/history/history.ts:61` | Score history cache |
| `ratelimit:badge:<ip>:<handle>` | 60s | `app/u/[handle]/badge.svg/route.ts:136` | Badge rate limit |
| `ratelimit:<route>:<ip>` | 60–3600s | various `app/api/**` routes | Per-route IP rate limits |
| `ratelimit:cli-poll-session:<sessionId>` | 300s | `app/api/cli/auth/poll/route.ts:21` | CLI poll session rate limit |
| `quota:send:<campaignId>:<date>` | 86400s (24h) | `lib/email/campaigns.ts:212` | Daily campaign send quota |

### TTL Coverage

- **Total key patterns**: 28
- **With explicit TTL**: 25 (89%)
- **Persistent (TTL=0)**: 3 — bounded singletons: `cron:warm-cache:offset` (single int), `stats:badges_generated` (INCR counter), `stats:unique_badges` (HLL ~12 KB)
- **Coverage**: 25/28 = **89%** (unchanged from prior cycle)

### Growth Risk

- **LOW overall.** All per-user keys are bounded by TTLs of 1h to 24h.
- **MONITOR M7 (carried)**: `config:<login>` TTL = 31536000s (1 year). Studio configs accumulate ~1 key per registered user. At 10K users = ~10K keys, each ~200–400 bytes (BadgeConfig JSON). Total: ~2–4 MB. Acceptable at current scale, watch if studio adoption grows significantly.
- **MONITOR M1 (carried)**: `avatar:<handle>` ~300 MB @10K users (6h TTL, rotates).
- **MONITOR M3 (carried)**: `stats:unique_badges` HLL ~12 KB — effectively static size regardless of user count.
- **No new unbounded patterns** in this cycle's commits.

---

## Database Usage

### Tables: 11

| Table | Access Pattern | File |
|-------|---------------|------|
| `users` | upsert on login, select all for cron | `lib/db/users.ts` |
| `metrics_snapshots` | insert/replace daily, batch-read, cleanup >90d | `lib/db/snapshots.ts` |
| `email_campaigns` | CRUD + status filter | `lib/db/campaigns.ts` |
| `campaign_sends` | insert batch, count by status (P2-1), update | `lib/db/campaigns.ts` |
| `supplemental_stats` | upsert on CLI upload, select by handle | `lib/db/supplemental.ts` |
| `tool_insights` | upsert on upload, select latest by handle | `lib/db/tool-insights.ts` |
| `user_platforms` | select/upsert/delete on OAuth connect/disconnect | `lib/db/user-platforms.ts` |
| `feature_flags` | select all / select by key, update via admin | `lib/db/feature-flags.ts` |
| `verification_records` | insert on badge generate, cleanup expired | `lib/db/verification.ts` |
| `merge_operations` | insert on telemetry, cleanup >90d | `lib/db/telemetry.ts` |
| `email_notifications` | insert unsubscribe | `lib/db/users.ts` (inferred from notifications route) |

### Query Patterns

- **0 N+1 patterns** detected. Cron warm-cache uses `dbGetLatestSnapshotBatch()` (single `IN()` query for all handles before batch processing).
- **P2-1 CARRIED (9th cycle)**: `dbGetCampaignStats()` at `lib/db/campaigns.ts:734-751` fires 4 parallel `COUNT` queries (`sent`, `pending`, `processing`, `failed`). Should be consolidated into a single `GROUP BY status` RPC when campaign sends exceed 5K rows. Threshold not yet triggered.

### Connection Management

- **Singleton lazy client** at `lib/db/supabase.ts:11-33`. Initialized once on first use, `null` if env vars missing. `persistSession: false` (server-side, no auth state). Fail-open on missing config.

---

## External API Calls

| Route | External Service | Cached | Rate Limited | Risk |
|-------|-----------------|--------|-------------|------|
| `lib/github/queries.ts` | GitHub GraphQL API | Yes (6h fresh + 7d stale) | Implicit (GitHub 5K/hr auth) | LOW — in-flight dedup + 30s timeout |
| `lib/bitbucket/queries.ts` | Bitbucket REST API | Yes (6h TTL) | `ratelimit:bitbucket:*` 10/15min | LOW — AbortController timeout, `clearTimeout` in finally |
| `lib/codeberg/queries.ts` | Codeberg REST API | Yes (6h TTL) | `ratelimit:codeberg:*` 10/15min | LOW — AbortController timeout, `clearTimeout` in finally |
| `lib/email/resend.ts` | Resend email API | Partial (contacts: 1h) | `ratelimit:webhook:*`, campaign quota | LOW — all sends rate-limited + quota-guarded |
| `lib/analytics/server-errors.ts` | PostHog | No (fire-and-forget) | Timeout-protected | LOW — fail-open, non-blocking |
| `app/api/health/route.ts` | GitHub API (rate_limit probe) | No (intentional) | `ratelimit:health:*` 30/60s | LOW — health check only, no user data |
| `app/api/cron/sync-audience/route.ts` | Resend (contacts.list) | Yes (1h TTL) | Cron bearer auth | LOW — 30s timeout, paginated with break condition |

All external calls have explicit timeouts (`withTimeout()` or `AbortController`). No uncached external calls on hot paths.

---

## Resource Management

### setTimeout / setInterval

- **API routes**: `app/api/admin/agents/run/route.ts` uses two `setTimeout` instances (`processTimer`, `killTimer`) for process hard-timeout. Both are cleared via `cleanupProcess()` which is called in all exit paths (`close`, `error`, `DELETE` stop). No leak.
- **Platform queries**: `lib/bitbucket/queries.ts:34` and `lib/codeberg/queries.ts:30` use `setTimeout` with `AbortController`. Both `clearTimeout(timeout)` in `finally` blocks — confirmed at lines 153 and 115 respectively.
- **`lib/async/with-timeout.ts`**: `timer` cleared with `clearTimeout` in `finally` after race. Clean.
- **Client-side `BadgeToolbar`**: Three `setTimeout` calls (refresh status reset, copy reset, router refresh). All are UI-only with no server impact. No cleanup needed (React unmount safety ensured by `mountedRef.current` guard).
- **No `setInterval` anywhere in server code.**

### In-Memory Structures

- `_inflight` Map in `lib/github/client.ts`: bounded by 30s `INFLIGHT_TIMEOUT_MS` + `.finally()` cleanup. Max concurrent handles = transient only.
- `inflightBadgeRenders` Map in badge route: cleared in `finally` block. Bounded by concurrent requests.
- `flagCache` Map in `lib/feature-flags.ts`: bounded by feature flags table size (~5–20 entries). 5-min in-process TTL.
- `warmSet` in cron: max 50 handles per run (`MAX_HANDLES`), ephemeral.

### Unclosed Connections

- No unclosed HTTP connections, streams, or database connections detected. All streams in the agents/run route are destroyed via `cleanupProcess()`.

---

## Vercel Cost Factors

### Badge Route (`/u/[handle]/badge.svg`)

- **Runtime**: Node.js (serverless) — Redis + Supabase SDKs require Node runtime.
- **No `maxDuration` set** — defaults to Vercel's platform default (10s for Pro). Badge render with GitHub API fetch is well within this limit.
- **Cache headers**: `public, s-maxage=21600, stale-while-revalidate=86400` (success), `public, s-maxage=300, stale-while-revalidate=600` (error fallback).
- **SVG full-response cache**: 24h TTL in Redis. CDN s-maxage=6h. After initial render, subsequent requests within 6h are served from CDN edge with no function invocation.

### Cron Routes

| Route | `maxDuration` | Schedule | Cost Profile |
|-------|--------------|----------|-------------|
| `/api/cron/warm-cache` | 300s | Daily | Batches 50 handles, 5 concurrent. ~50 GitHub API calls. Bulk snapshot read (1 `IN()` query). |
| `/api/cron/process-campaigns` | 300s | Daily | 1 DB query to find active campaigns, processes first only. |
| `/api/cron/sync-audience` | 300s | Daily | 1 DB query + Resend contacts.list (cached 1h). |

- All cron routes use `maxDuration=300` (Vercel Pro limit), bearer-auth via `CRON_SECRET`.
- No edge runtime routes (Redis + Supabase require Node).
- ISR `revalidate` values (confirmed stable from prior cycle): `/about*`→86400, `/archetypes/*`→604800, `/`→3600, `/u/[handle]`→3600, `/privacy`+`/terms`→86400. `/studio`, `/admin/*` `force-dynamic` (intentional, auth-gated).

---

## Delta Since Last Cycle (Commits 1396fda5, 25573aba, 8f6fe87a)

### i18n Changes (1396fda5, 25573aba)

- Files changed: `lib/i18n/dictionaries/en.ts`, `lib/i18n/dictionaries/es.ts`, `components/BadgeToolbar.tsx`, `components/GlobalCommandBar.tsx`, `components/terminal/command-registry.ts`
- **Zero Redis writes**: i18n uses browser cookies only (`chapa-locale`, `maxAge=1yr`, `httpOnly: false`). No Redis involvement in locale detection, storage, or switching.
- **Zero external API calls**: `server.ts` resolves dictionaries from static in-memory objects (`en.ts`, `es.ts`). `set-locale-action.ts` calls only `writeLocaleCookie()` + `revalidatePath()` — no network.
- **Zero Supabase queries**: i18n is entirely client-cookie + in-memory dictionary resolution.
- **`BadgeToolbar.tsx`**: Changes are purely i18n label additions (calls `t('badgeToolbar.*')`). The existing `fetch('/api/refresh')` and `fetch('/u/.../badge.svg')` calls are unchanged from prior cycles. No new Redis or API surface.
- **`command-registry.ts`**: Adds `description` lookups via `t('commands.descriptions.*')`. Pure in-memory dictionary lookups.
- **Cost surface delta: ZERO.**

### Coverage/Test Fixes (8f6fe87a)

- Affected: test files only (`BadgeToolbar.render.test.tsx`, `GlobalCommandBar.test.tsx`, `command-registry.test.ts`, `detect.test.ts`, `client-ip.test.ts`, archetype page tests).
- **Zero production code changes** — test infrastructure only.
- **Cost surface delta: ZERO.**

---

## Recommendations

### P2-1 (Carried — 9th cycle, threshold-gated)

**`dbGetCampaignStats()` 4-query aggregation** (`lib/db/campaigns.ts:734-751`): Four parallel `COUNT` queries fire when the admin campaign UI loads stats. This is efficient at current scale but will degrade past ~5K rows in `campaign_sends`. Consolidate into a single `GROUP BY status` Supabase RPC. **Do not implement until the threshold is reached — premature optimization at current campaign scale.**

### Monitor M7 (Carried)

**`config:` key TTL = 1 year per user.** Studio badge configs accumulate at ~200–400 bytes/user. At current scale: negligible. If studio adoption grows to 10K+ users: re-evaluate. No action needed now.

### Monitors M1–M5 (Carried, no action needed)

- M1: Avatar cache ~300 MB @10K users (6h TTL, naturally bounded)
- M2: OG image cache ~200 MB @1K active/day (not measured this cycle — no change expected)
- M3: HLL `stats:unique_badges` ~12 KB (bounded by HLL algorithm)
- M4: `metrics_snapshots` row growth ~3.65M rows/year @10K — cleanup cron wired and verified
- M5: `withErrorCapture` PostHog spike risk at high error rate — fire-and-forget, timeout-protected

### No new recommendations this cycle.

All 5 recent commits are i18n-only with zero infrastructure impact.

---

## Estimated Monthly Cost (10K users, unchanged)

| Component | Estimate |
|-----------|----------|
| Vercel Pro compute (serverless) | ~$20–30/mo |
| Upstash Redis | ~$10–15/mo |
| Supabase | ~$10–15/mo |
| Resend email | ~$5–10/mo |
| PostHog | ~$5/mo |
| **Total** | **~$50–75/mo** |
