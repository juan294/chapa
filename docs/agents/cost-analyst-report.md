# Cost Analyst Report
> Generated: 2026-05-22 | Health status: green

## Executive Summary
Pure carry/audit cycle — zero commits to cost surface (`apps/web/lib/cache/**`, `lib/db/**`, `lib/github/**`, `app/api/**`, `lib/feature-flags.ts`, `lib/env.ts`) since 2026-05-14 (`cf595a86`). All prior cost guarantees hold: 16 production Redis prefixes with 89% TTL coverage, 11/11 Supabase tables FORCE-RLS, singleton lazy clients, ISR active on feature-flag reads, badge `maxDuration=35`. Estimated monthly cost at 10K users: **~$50–75/mo**.

## Redis Usage
- **Key patterns** (16 production prefixes + 3 persistent singletons): `stats:*`, `svg:*` (per-theme), `profile:*`, `history:*`, `rate:*`, `inflight:*`, `oauth:state:*`, `oauth:nonce:*`, `cli:device:*`, `cli:approval:*`, `config:*` (Studio), `flag:*` (data-layer), `supplemental:*`, `stats:dirty:*`, `notification:*`, `health:*`, plus persistent `oauth:secret`, `metrics:lifetime:singleton`, `audience:sync:lock`.
- **TTL coverage**: 25/28 keys with TTLs (89%). All `cacheSet(..., ttl)` call sites pass explicit TTL; the 3 unbounded are intentional persistent singletons.
- **Growth risk**: LOW. No unbounded fan-out. `stats:dirty:<handle>` capped 1h. `config:` TTL 31,536,000s (1y) per-user — PUT replaces, no accumulation.

## Database Usage
- **Tables**: 11 (latest migration `025_force_supplemental_stats_rls.sql`). All have ENABLE RLS + FORCE RLS + deny-all anon (security report 2026-05-11 + remediation cycle).
- **Query patterns**: efficient. No N+1 in hot paths. `dbGetCampaignStats()` at `lib/db/campaigns.ts:727-765` uses 4 parallel COUNT queries (carry P2-1, threshold-gated >5K sends/campaign; not triggered).
- **Connection management**: singleton lazy client at `lib/db/supabase.ts:14`, guarded by `import "server-only"` at line 8. No per-request client construction.

## External API Calls
| Route | External Service | Cached | Rate Limited | Risk |
|-------|-----------------|--------|-------------|------|
| `/u/[handle]/badge.svg` | GitHub GraphQL | 6h primary + 7d stale fallback | yes (60/60s) | LOW |
| `/api/refresh` | GitHub GraphQL | bypass-on-demand | yes | LOW (auth + rate-limited) |
| `/api/profile/[handle]` | (Redis only) | 24h | yes (60/60s) | LOW |
| `/api/verify/[hash]` | (Redis only) | n/a | yes (30/60s) | LOW |
| `/api/health` | GitHub `api.github.com/rate_limit` | **none** | yes | P3 carry — ~5–10 calls/hr, well inside 60/hr unauth limit |
| `/api/webhooks/resend` | (none) | n/a | n/a (HMAC verified) | LOW |
| `/api/cron/*` | Supabase + Redis + (Resend) | n/a | bearer auth | LOW |
| `/og-image`, `/u/[handle]/og-image` | (none, server-generated) | route-level | n/a | LOW |
| PostHog (client) | analytics endpoint | n/a | client-side batched | LOW |

All `fetch()` call sites in `lib/github/**` use `withTimeout()` (100% coverage). `_inflight` dedup Map is bounded by request lifetime.

## Resource Management
- **Connection management**: lazy singletons for both Redis (`lib/cache/redis.ts:22-38`) and Supabase (`lib/db/supabase.ts:14`) — no per-request construction, no leaks.
- **Fetch timeouts**: 100% of external `fetch` calls wrapped with `withTimeout()` — no unbounded waits.
- **In-flight dedup map**: bounded by request lifetime in `lib/github/client.ts` — entries cleared on resolve/reject.
- **No unbounded buffers**: SVG rendering streams react-to-string; no large in-memory accumulators.
- **Badge `maxDuration=35`** at `app/u/[handle]/badge.svg/route.ts:29` — prevents Vercel 10s default killing the 30s `INFLIGHT_TIMEOUT_MS` cold path (8th cycle hold).

## Vercel Cost Factors
- **Function sizes**: no oversized routes — performance agent confirms 0 chunks ≥500 KB (bundle 2,266 KB raw / 706 KB gzipped, flat 6 cycles).
- **ISR active**: `lib/feature-flags.ts:49-58` wraps `dbGetFeatureFlag` in `unstable_cache(revalidate=300)`. 13 archetype/about pages CDN-eligible.
- **Edge vs serverless**: all routes are Node serverless (correct — `@upstash/redis` + Supabase SDK need Node runtime).
- **Bundle monitor**: 2,266 KB raw / 706 KB gzipped — flat vs Apr 30 cycles; sustained +34.7% over 4 weeks vs Apr 9 baseline (1,682 KB). `ANALYZE=true pnpm run build` still needs an interactive run to localize source (monitor only — no cold-start memory pressure).

## Recommendations
1. **P3 (carry, cycle 10)** — Cache `/api/health` GitHub probe with `unstable_cache(revalidate=60)` at `app/api/health/route.ts:31`. Low priority: ~5–10 calls/hr, well inside 60/hr unauth limit. GitHub's own rate limits provide secondary protection.
2. **P2-1 (carry, cycle 22, threshold-gated)** — Replace `dbGetCampaignStats()` 4-query parallel COUNT aggregation with a single GROUP BY RPC at `lib/db/campaigns.ts:727-765`. Activate only when any campaign exceeds 5K sends. Not yet triggered.
3. **Bundle monitor (carry)** — Run `ANALYZE=true pnpm run build` interactively to identify the source of the 4-week +34.7% bundle growth. Bundle has been flat 6 consecutive cycles; no cold-start memory regression observed.
4. **Documentation hint** — `lib/db/campaigns.ts:727-765` should carry a comment explaining the 5K-send threshold for the GROUP BY RPC migration, so the trigger is reviewable in PRs touching the file.
