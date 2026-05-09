# Cost Analyst Report
> Generated: 2026-05-09 | Health status: green

## Executive Summary
Estimated monthly cost at 10K users remains **~$50–75/mo**, unchanged. The May 8 triage closed the long-standing badge `maxDuration` P2 (3 cycles) — `app/u/[handle]/badge.svg/route.ts:29` now sets `maxDuration = 35`, allowing the 30s GitHub `INFLIGHT_TIMEOUT_MS` to complete instead of being killed by Vercel's 10s default. No new cost surface, no resource leaks, no regressions.

## Redis Usage
- Key patterns audited (15 distinct prefixes confirmed in production code; 28 total when including operational/test-suite keys carried from prior audits):
  - `stats:`, `impact:`, `history:`, `craft:`, `snapshot:`, `config:`, `supplemental:`, `cli:`, `campaign:`, `quota:`, `counter:`, `sideeffects:`, `ratelimit:`, plus persistent singletons (`stats:badges_generated`, `stats:unique_badges`, `cron:warm-cache:offset`).
- TTL coverage: **89% (25/28)**. Three intentionally persistent keys: `stats:badges_generated` (INCR), `stats:unique_badges` (HLL ~12 KB), `cron:warm-cache:offset` (rotation pointer).
- Default `cacheSet` TTL is 21 600s (6h). Outliers: `config:<handle>` = 31 536 000s (1 year), `persistent:` = 0 (intentional).
- Growth risk: **LOW**. All time-series caches (stats, impact, history, snapshot, supplemental, craft, OG image, avatar) are bounded by per-user TTL ≤ 24h (config is per-user singleton, replaced on PUT — no growth per write).

## Database Usage
- **Tables: 11** (`users`, `metrics_snapshots`, `supplemental_stats`, `feature_flags`, `email_campaigns`, `campaign_sends`, `merge_operations`, `tool_insights`, `verification_records`, `user_platforms`, `admin_users`).
- Connection management: lazy singleton at `apps/web/lib/db/supabase.ts:14` — service role key, `persistSession: false`, single `SupabaseClient` reused across requests within a serverless instance.
- Query patterns: 0 N+1 patterns found. Cron `dbGetLatestSnapshotBatch()` uses single `IN()` query for batch reads. `dbGetCampaignStats()` issues 4 parallel `COUNT()` queries — threshold-gated; only matters at >5K sends/campaign (P2-1 carry, cycle 11).
- RLS: all tables have ENABLE + FORCE ROW LEVEL SECURITY with explicit deny-all for anon (per security agent 2026-04-20). Service role bypasses RLS server-side.

## External API Calls
| Route | External Service | Cached | Rate Limited | Risk |
|-------|------------------|--------|--------------|------|
| `/u/:handle/badge.svg` | GitHub GraphQL | Yes (6h fresh + 7d stale + in-flight dedup) | n/a (CDN s-maxage=21600) | Low |
| `/u/:handle/og-image` | none (composes cached badge) | Yes (`og:` cache) | Yes | Low |
| `/api/profile/:handle` | GitHub via `getStats()` | Yes | 60/60s | Low |
| `/api/history/:handle` | Supabase only | Yes (`history:` cache) | Yes | Low |
| `/api/refresh` | GitHub forced refresh | Bypasses cache | 5/hr per session | Medium (auth-gated, low ceiling) |
| `/api/health` | GitHub `/rate_limit` probe | No (intentional) | Yes | Low (1 cheap probe) |
| `/api/cron/warm-cache` | GitHub batched | Writes cache | n/a (cron bearer) | Low |
| `/api/cron/sync-audience` | Resend audience API | n/a | n/a (cron bearer) | Low |
| `/api/cron/process-campaigns` | Resend send API | n/a | Daily quota via `cacheIncr("quota:daily:emails", ttl=86400s)` | Low |
| `/api/auth/{github,bitbucket,codeberg}/callback` | OAuth token exchange | n/a | Yes | Low |
| `/api/insights` | none (writes Supabase) | n/a | Yes | Low |
| `/api/webhooks/resend` | Resend webhook (incoming) | n/a (HMAC verified, dedup via `cacheSetNx`) | n/a | Low |

All external `fetch()` calls use `AbortSignal.timeout()` or `withTimeout()` (per security agent: 100% timeout coverage). The badge route is the only high-volume external-call path; cache-first policy plus 6h CDN cache makes uncached origin hits rare.

## Resource Management
- No unclosed connections. Supabase + Upstash Redis both lazy singletons.
- All `setTimeout` paired with `clearTimeout()` in finally blocks (Bitbucket, Codeberg, GitHub, OG image fetchers).
- No server-side `setInterval`.
- In-memory bounded structures: `_inflight` Map in `lib/github/client.ts` (cleared via `.finally()` after 30s `INFLIGHT_TIMEOUT_MS`); `inflightBadgeRenders` Map in `badge-svg-cache.ts` (cleared in finally); `flagCache` (~5–20 entries, table size).
- Studio `config:<handle>` 1-year TTL writes are idempotent (PUT replaces existing key) — no per-write growth, only per-user.

## Vercel Cost Factors
- **Functions with explicit `maxDuration`**:
  - `badge.svg/route.ts:29` → 35s (NEW this cycle, fixes 3-cycle P2)
  - `cron/warm-cache`, `cron/sync-audience`, `cron/process-campaigns`, `admin/bulk-recalculate` → 300s
- All other routes use Vercel default (10s on Pro), which is correct given their workload.
- 86 routes total (4 static, 82 dynamic, per performance agent 2026-05-07).
- ISR regression closed Apr 30 — `lib/feature-flags.ts:84-94` wraps `dbGetFeatureFlag` in `unstable_cache()` (revalidate=300s). 13 archetype/about pages eligible for CDN caching.
- No oversized chunks (>500 KB). Bundle is +34.7% over 4 weeks (706.5 KB gzipped) per performance agent — slight serverless cold-start memory bump but no direct invocation cost impact.
- No edge functions (everything runs on Node.js serverless).

## Recommendations
1. **(P2-1, threshold-gated, cycle 11)** Move `dbGetCampaignStats()` 4-query parallel COUNT aggregation in `apps/web/lib/db/campaigns.ts:727-765` to a `GROUP BY status` RPC if any campaign exceeds 5K sends. Not yet triggered.
2. **(MONITOR, M7 carried)** Studio `config:` 1-year TTL — negligible at current scale; revisit if active studio user count grows beyond 10K.
3. **(MONITOR, M1–M5 carried)** Avatar cache (~300 MB @10K users), OG image cache (~200 MB @1K active/day), `metrics_snapshots` row growth (~3.65M rows/year @10K — cleanup wired), HLL (~12 KB), `withErrorCapture` PostHog spike risk (fire-and-forget, timeout-protected).
4. **(BUNDLE, watch)** Cross-agent — performance agent flagged sustained +34.7% bundle growth over 4 weeks. Run `ANALYZE=true pnpm run build` to identify the source. Memory implications for serverless cold-starts are minor at current scale but worth a baseline.

---

<!-- ENTRY:START agent=cost-analyst timestamp=2026-05-09T03:00:00Z -->
## Cost Analyst — 2026-05-09
- **Status**: GREEN
- Estimated monthly cost at 10K users: **~$50–75/mo**. Unchanged.
- Redis: **15 production prefixes + 3 persistent singletons** confirmed (28 audited including ops/test-suite keys). TTL coverage 89%. Growth risk: LOW.
- **P2 RESOLVED — Badge `maxDuration`**: closed in commit 6ffe5d01 (May 8 triage). `app/u/[handle]/badge.svg/route.ts:29` now declares `export const maxDuration = 35`. Cold-path badge renders no longer killed by Vercel 10s default. 3-cycle escalation cleared.
- **Commits this cycle** (1e9e8965, 6ffe5d01, 67a36541): triage docs + badge maxDuration fix + a11y aria-label addition + flaky test rewrite (`stripBadgeAnimations` extracted as pure function) + new coverage tests for archetypes/sanitizeUnknown branches. **Zero new Redis writes, zero new external API calls, zero new Supabase queries.** No cost surface change.
- **P2-1 CARRIED (cycle 11)**: `dbGetCampaignStats()` 4-query parallel COUNT aggregation (`lib/db/campaigns.ts:727-765`). Threshold-gated >5K sends/campaign. Not yet triggered.
- **MONITOR M7 CARRIED**: `config:` TTL 31 536 000s (1 year per user). Verified at `app/api/studio/config/route.ts:73`. PUT replaces existing key — no per-write growth. Negligible at current scale.
- GitHub API: cache-first unchanged. 100% fetch timeout coverage. `_inflight` Map bounded by 30s + `.finally()` clear (`lib/github/client.ts`).
- Supabase: **11 tables** confirmed via grep on `from('...')` calls. Singleton lazy client at `lib/db/supabase.ts:14`. 0 N+1 patterns. No new tables.
- Cron handlers: **3** (`warm-cache`, `sync-audience`, `process-campaigns`). All at maxDuration=300s. Prior memory of "4 cron handlers" was off — `bulk-recalculate` is admin, not cron. Updated count.
- Feature flags: `unstable_cache(revalidate=300s)` at `lib/feature-flags.ts:84-94` confirmed in place. ISR regression remains resolved.
- **P1s: NONE. P2s: 1 active (P2-1, threshold-gated).**
- **MONITORS M1–M5 CARRIED** unchanged.

**Cross-agent recommendations:**
- [Performance]: Badge `maxDuration` P2 closed — your 3-cycle P2 can be retired. Sustained bundle +34.7% over 4 weeks may be increasing Vercel cold-start memory; recommend `ANALYZE=true pnpm run build` to identify culprit packages before next cost cycle for joint review.
- [Security]: Fetch timeouts 100%. Fail-open rate limiter intact. Resend webhook 3-layer defense intact. Supabase singleton confirmed at `lib/db/supabase.ts:14`. No new cost-security conflicts.
- [Coverage]: `app/api` 97.5%, `lib/db` 96.5%, `lib/cache` 98.1% — stable. No cost-path coverage gaps this cycle. Studio `config:` 1-year TTL path has no dedicated cost-regression test (low priority).
<!-- ENTRY:END -->
