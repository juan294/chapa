# Cost Analyst Report
> Generated: 2026-06-20 | Branch: `develop` @ `226e5528` | Health status: **green**

## Executive Summary
First cost cycle on **v2.11.0** (GitLab integration + 60-finding pre-launch remediation). The new GitLab platform client reuses the established cache-first, 6h-TTL, timeout-bounded pattern of the Bitbucket/Codeberg clients — zero new uncached external calls and no unbounded Redis growth. Estimated cost at 10K users holds at **~$50–75/mo**.

## Redis Usage
- **Key patterns** (per-entity, all TTL'd unless noted):
  | Pattern | TTL | Source |
  |---------|-----|--------|
  | `stats:v2:github:<handle>` | 6h | `lib/github/client.ts:15` |
  | `stats:v2:github:stale:<handle>` | 7d (SWR) | `lib/github/client.ts:16` |
  | `stats:v2:gitlab:<handle>` **(NEW v2.11.0)** | 6h | `lib/gitlab/client.ts:14` |
  | `stats:v2:bitbucket:<handle>` / `…:codeberg:<handle>` | 6h | bitbucket/codeberg `client.ts` |
  | `supplemental:<handle>` | 24h | `lib/github/client.ts:17`, `api/supplemental` |
  | `svg:<handle>:<theme>` | 24h + 0–2h jitter | `lib/render/badge-svg-cache.ts:25–26` |
  | `avatar:<…>` | 6h | `lib/render/avatar.ts:11` |
  | `history:<handle>` | 1h | `lib/history/history.ts:7` |
  | `craft:<…>` / `snapshot:<…>` | 1h / 24h | craft-cache / snapshot-cache |
  | `config:<login>` | 365d (overwrite) | `api/studio/config/route.ts:73` |
  | `badge:notified:<handle>` | 365d (overwrite) | `lib/email/notifications.ts:18` |
  | `events:dedup:*` / score-bump dedup | 7d | resend webhook / `score-bump.ts:33` |
  | `cli:device:<sessionId>` | 5m | cli auth poll/approve |
  | `ratelimit:*` | per-window | `rateLimit()` (INCR+EXPIRE) |
- **TTL coverage:** **24 non-test `cacheSet` sites; 23/24 carry an explicit positive TTL.** `cacheSet` default is 21600s with a `ttlSeconds > 0` guard (`redis.ts:69,75–76`). Client configured `retry: { retries: 0 }` (`redis.ts:36`) so a Redis blip can't pile up retries.
- **Growth risk: LOW.** Only 3 intentionally persistent (TTL-0) keys, all fixed cardinality: `cron:warm-cache:offset` rotation cursor (`warm-cache/route.ts:146`, single key, only advanced after batch completes), `stats:badges_generated` (single INCR counter, `redis.ts:259`), `stats:unique_badges` (single HyperLogLog, ~12KB fixed, `redis.ts:260`). The two 365d keys are overwrite-in-place and bounded by user count — no accumulation.

## Database Usage
- **Tables:** **10 base tables**, 26 migrations (latest `026_seed_integration_flags.sql`). RLS: **10/10 ENABLE + 10/10 FORCE** (12 ENABLE statements = 10 tables + 2 re-enables); deny-all-anon policies in 008/018.
- **Query patterns:** No N+1 in `lib/db/`. The two loops found (`parse-row.ts:35`, `snapshots.ts:353`) iterate in-memory rows, not awaited DB calls. Warm-cache cron batches snapshot pre-fetches. Migration 026 seeds 3 feature-flag rows (`bitbucket/codeberg/gitlab_integration`) so per-request flag checks read the cached `feature_flags` table instead of falling through to the env fallback + noisy null-row log — a small per-request efficiency win.
- **Connection management:** **Lazy singleton** service-role client (`supabase.ts:13–34`), `import "server-only"` (line 8), `persistSession: false`, 5s `withTimeout` on the health probe. One client instance per serverless container.

## External API Calls
| Route / Module | External Service | Cached | Rate Limited | Risk |
|----------------|-----------------|--------|-------------|------|
| `lib/github/client.ts` (badge/profile) | GitHub | ✅ 6h + 7d SWR + in-flight dedup + Redis lock | ✅ | Low |
| `lib/gitlab/client.ts` **(NEW)** | GitLab | ✅ 6h (`stats:v2:gitlab:`) | ✅ (badge path) | Low |
| `lib/bitbucket/client.ts` / `lib/codeberg/client.ts` | Bitbucket / Codeberg | ✅ 6h | ✅ | Low |
| `api/health` GitHub probe | GitHub | ✅ `unstable_cache` 60s | ✅ | Low |
| `api/feature-flags` | (DB) | ✅ ISR s-maxage 60 / SWR 300 | — | Low |
| `lib/email/resend.ts`, cron `sync-audience` | Resend | ✅ event-driven + daily quota (`cacheReserveQuota`) + 1h contacts cache | ✅ | Low |
| PostHog (client + server) | PostHog | batched / fire-and-forget | — | Low |
- **Uncached external calls: 0.** Every platform stats client checks Redis (`cacheGet`) and returns early before any live API call. The GitLab client additionally short-circuits when OAuth creds are unset (`client.ts:50`) to avoid wasted refresh round-trips.
- **Fetch-timeout coverage: 100%** of outbound server fetches carry `AbortSignal.timeout` or `withTimeout`. GitLab auth/query fetchers confirmed (`auth/gitlab.ts:149,189,222`; `gitlab/queries.ts` 8 signal refs). `fetch-retry.ts` itself adds no signal but forwards the caller's `init` (callers attach the timeout) and retries 5xx only, max 2 attempts — no thundering-herd amplification.

## Resource Management
- No unclosed connections: Redis + Supabase are lazy singletons reused across invocations; no per-request client construction.
- No unbounded in-memory buffers: OG image PNG buffer is base64'd and cached (48h TTL), not retained; badge SVG rendered to string and cached.
- Graceful degradation everywhere: Redis/Supabase failures return null / no-op, rate limiter fails open (accepted risk, `redis.ts:128–150`, #300). No leak vectors found.

## Vercel Cost Factors
- **Function durations:** badge `maxDuration=35` (`badge.svg/route.ts:29`); crons (`warm-cache`, `sync-audience`, `process-campaigns`) and `bulk-recalculate` at 300 — all batch/background jobs, appropriately bounded.
- **Caching headers:** badge success `s-maxage=21600 / SWR=86400`, error `s-maxage=300 / SWR=600` — CDN absorbs the embedded-badge fan-out.
- **ISR/SSG:** archetype guides, `/about*`, `/privacy`, `/verify`, share page all `force-static revalidate=3600` — static-ish pages served from CDN, not recomputed per request.
- **Bundle:** 1,950 KB raw / 623 KB gzipped, 0 routes >500 KB (performance 2026-06-18, flat) — no cold-start memory regression from the GitLab addition.

## Recommendations
- **P1: none.**
- **P2-1 (carry, threshold-gated):** `getCampaignStats` issues 4 parallel `count: exact, head: true` COUNT queries (`lib/db/campaigns/sends.ts:243,251`). `head:true` transfers no rows; only relevant at >5K sends/campaign. No action until that scale.
- **MONITOR (carry):** `config:<login>` and `badge:notified:<handle>` 365d TTL — overwrite-in-place, fixed cardinality. No action.
- **P3 (new, optional):** GitLab client does **not** cache the "not linked / disabled" negative result, so each cache-miss invocation for a non-linked user costs one flag read + one `dbGetLinkedPlatform` query. This is bounded by the badge/profile path's own 6h cache, but matches the same minor inefficiency in the Bitbucket/Codeberg clients — a shared negative-result short-cache (e.g. 1h) could trim redundant DB reads if platform adoption grows. Not cost-material today.
