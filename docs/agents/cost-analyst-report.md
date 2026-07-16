# Cost Analyst Report
> Generated: 2026-07-16 | Health status: green

## Executive Summary
Estimated infrastructure cost stays in the **~$50–75/mo bracket at 10K users**. This cycle covers a large delta (HEAD `9bfb9a6c` → `a45ae765`, 65 commits, v2.18.0 released) — including the warm-cache cron moving from daily to hourly (#1010), a new daily latency-check synthetic monitor (#974), badge critical-path perf work (#1029), OAuth fail-closed hardening (#1027), and a full i18n RSC rearchitecture (#1023) — but none of it moves the cost needle: the cron frequency change is explicitly rate-limit-budgeted in-code, and the RSC migration actually *reduced* the client bundle by shifting 9 pages to static rendering.

## Redis Usage
- Key patterns: `stats:*` / `stats:stale:*` (6h/7d GitHub cache), `svg:*` (badge SVG cache), `history:*`, `rateLimit:*`, `avatar:*`, `supplemental:*`, `cli:device:*`, `cron:*:heartbeat` (4, one per cron), `cron:warm-cache:offset` (rotation cursor), `stats:dirty:*`, `notif:*`/dedup markers, `og:*`.
- **43 non-test cache-write call sites across 22 production files** (`cacheSet`/`cacheIncr`/`cacheReserveQuota`/`cacheSetNx`) — up from 38/22 files on 2026-07-15, growth fully attributable to the new `latency-check` cron's heartbeat write and `process-campaigns` round-robin changes, not uncontrolled sprawl.
- TTL coverage: default TTL 21,600s (`redis.ts:82`). **Exactly 1 intentional TTL-0 key** — `cron:warm-cache:offset` (`warm-cache/route.ts:169`), a small bounded rotation cursor (single integer), not unbounded growth. Every other write site passes an explicit TTL (avatar 6h, supplemental 24h, CLI device sessions bounded, cron heartbeats bounded, snapshot/craft/history caches all TTL'd).
- Growth risk: **low, unchanged.** The hourly warm-cache bump (#1010) increases *cron invocation count* 24x/day but each run still writes/refreshes the same bounded per-handle key set (≤50 handles/run) — no new unbounded key pattern introduced.

## Database Usage
- Tables: **11 tables + 2 views, 28 migrations** (latest `028_grant_service_role_access.sql`) — unchanged since 2026-07-13; no new tables in this cycle's 65-commit delta.
- Query patterns: no N+1 introduced. `dbGetCampaignStats` (`lib/db/campaigns/sends.ts`) 4-parallel-COUNT pattern carried as previously flagged — bounded, admin-only, threshold-gated (P2, unchanged).
- Connection management: lazy singleton (`lib/db/supabase.ts:13`, `let _client`), `server-only`, `persistSession:false`, 5s `withTimeout` — unchanged.
- Snapshot-write reliability (#1015/#1016/#1009): `reconcileSnapshotWrite` (`lib/profile/snapshot-write.ts`, 142 lines) tracks tri-state write outcomes (inserted/duplicate/failed) rather than adding new query volume — a correctness/observability change, not a cost driver.

## External API Calls
| Route | External Service | Cached | Rate Limited | Risk |
|-------|-----------------|--------|-------------|------|
| `/u/:handle/badge.svg` | GitHub | Yes (6h + 7d SWR, in-flight dedup, Redis lock) | fail-open (public read) | Low |
| `/api/cron/warm-cache` | GitHub | Writes cache | CRON_SECRET, 50 handles/hr (#1010 math documented in-code) | Low |
| `/api/cron/latency-check` | Internal badge route (synthetic) | N/A | CRON_SECRET | Low — new in this cycle, adds 1 lightweight daily HTTP call |
| `/api/cron/sync-audience` | Resend | Cached contacts | CRON_SECRET | Low |
| `/api/cron/process-campaigns` | Resend | N/A | CRON_SECRET | Low |
| `/api/auth/callback`, `/api/auth/*/callback` (Bitbucket/Codeberg/GitLab) | GitHub/platform OAuth | N/A | **fail-closed** (`rateLimitStrict`, #1027) | Low |
| `/api/challenge` | Resend (email) | N/A | fail-closed, IP 5/hr + handle 3/day | Low |
| `/api/refresh`, `/api/auth/session`, `/api/insights`, `/api/supplemental` | GitHub / internal | Mixed | fail-closed (`rateLimitStrict`) | Low |
| PostHog server events | PostHog | N/A | fire-and-forget | Low |

- **0 uncached external calls found.** All GitHub-facing paths route through `getStats()`'s cache-first + stale-fallback + in-flight-dedup pipeline.

## Resource Management
- No unclosed connections or missing cleanup found. Supabase client is a lazy module-level singleton reused across invocations.
- Fire-and-forget writes (`fireAndForget`, `void cacheSet`) used in **18 files** for non-blocking cache refresh — all target TTL'd keys, no buildup risk.
- Avatar fetch: `AbortSignal.timeout(2000)` (`lib/render/avatar.ts:33`) — **note:** CLAUDE.md's "Badge latency SLO" section states this is capped at 1000ms; the actual code (confirmed via `git log`, last touched by #961 `7dcf9aea`) uses a 2000ms ceiling. This is a doc/code mismatch, not a cost or leak issue — flagged for documentation agent, not actionable here.
- No large in-memory buffers found; badge SVG/PNG rendering is per-request, discarded after response.

## Recommendations
1. **No action required this cycle** — the 65-commit delta (v2.18.0) is cost-neutral to cost-positive (bundle shrank via static RSC migration; warm-cache hourly bump was pre-budgeted against GitHub's rate limit in-code comments).
2. **Doc fix (low priority, hand to documentation agent):** CLAUDE.md's badge-latency-SLO section says avatar fetch is capped at "1000ms" — actual value is 2000ms (`avatar.ts:33`, unchanged since #961). Update the doc line, no code change needed.
3. Carry forward: `dbGetCampaignStats`'s 4-parallel-COUNT pattern (P2, bounded/admin-only) — convert to a single `GROUP BY status` aggregate only if this endpoint's traffic grows; not urgent.

SHARED_CONTEXT_START
## Cost Analyst — 2026-07-16
- **Status**: GREEN
- Redis key growth risk: low
- Uncached external calls: 0
- Resource leak risks: 0

**Cross-agent recommendations:**
- [Performance]: Bundle actually **shrank** on gzip (672 KB → 638 KB, 77→73 chunks) despite the i18n RSC rearchitecture (#1023) landing 9 pages under `app/[locale]/...` with build-time `generateStaticParams` for both locales — worth confirming in your next bundle-size cycle since it contradicts the usual "more pages = bigger bundle" assumption (these pages moved server-side/static instead).
- [Security]: OAuth platform connect/callback/disconnect routes (Bitbucket/Codeberg/GitLab) confirmed on fail-closed `rateLimitStrict()` post-#1027, alongside the existing replay-resistant per-platform state cookie — no cost-driven rate-limit gap found.
- [Coverage]: No cost-critical path regressions found in this delta; `reconcileSnapshotWrite`'s tri-state outcome tracking and the new `latency-check` cron are both new surfaces worth a coverage spot-check if not already covered.
- [Documentation]: CLAUDE.md's badge-latency-SLO section states the avatar fetch timeout is "1000ms" — actual code (`avatar.ts:33`) is 2000ms, unchanged since #961 (predates the #1029 doc language). One-line doc fix, no behavior change.
SHARED_CONTEXT_END
