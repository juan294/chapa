# Cost Analyst Report
> Generated: 2026-04-13 | Health status: GREEN

## Executive Summary

Infrastructure costs remain stable and well-optimized at an estimated **~$60–70/mo at 10K users**. No production code changes since last cycle (2026-04-12) — only dev dependency bumps (vitest 4.1.4, @types/node 25.6.0, eslint 9.39.0) and cc-rpi blueprint sync (v1.15.0). **New finding**: 3 vite vulnerabilities (dev-only via vitest, no production exposure) — bump vite to 7.3.2 to resolve. All prior P1/P2s remain resolved. Carried items unchanged.

## Redis Usage

### Key Patterns (8 named patterns)

| Key Pattern | TTL | Approx. Size/User | Growth Risk |
|---|---|---|---|
| `stats:v2:merged:{handle}` | 6h (21,600s) | ~2–5 KB | LOW — auto-expires |
| `stats:v2:stale:{handle}` | 7d (604,800s) | ~2–5 KB | LOW — auto-expires |
| `snapshot:latest:{handle}` | 24h (86,400s) | ~1–5 KB | LOW — auto-expires |
| `craft:{handle}` | 1h (3,600s) | ~500 B | LOW — auto-expires |
| `avatar:{handle}` | 6h (21,600s) | ~30 KB (base64) | MEDIUM — largest per-user key |
| `ratelimit:{prefix}:{id}` | 60–86,400s | ~100 B | LOW — window-scoped |
| `campaign:daily-sends:{date}` | 24h (86,400s) | ~100 B | MINIMAL — daily rotation |
| `cron:warm-cache:offset` | None (persistent) | ~20 B | NONE — single integer |

### Persistent Keys (no TTL — 3 total)

| Key | Type | Size | Justification |
|---|---|---|---|
| `stats:badges_generated` | Integer counter | ~8 B | Monotonic counter, negligible |
| `stats:unique_badges` | HyperLogLog | ~12 KB | Bounded cardinality structure |
| `cron:warm-cache:offset` | Integer | ~20 B | Single rotation state value |

- **TTL coverage**: 100% on per-user keys. All 3 no-TTL keys are intentional and memory-bounded.
- **Estimated storage @10K users**: ~827 MB (91.7% headroom vs 10 GB Pro limit). Unchanged from 2026-04-12.
- **Unbounded growth patterns**: None. All data structures have TTLs or fixed sizes.

### Rate Limiter Inventory (13 endpoints)

All use fixed-window counter (INCR + EXPIRE). Fail-open when Redis unavailable.

| Endpoint | Limit | Window |
|---|---|---|
| Badge SVG | 100/IP | 60s |
| History API | 100/IP | 60s |
| Profile API | 60/IP | 60s |
| Generate | 10/handle | 3,600s |
| Recalculate | 20/handle | 3,600s |
| Platform OAuth (connect/callback/disconnect) | 10/IP | 900s |
| Platform Status | 120/IP | 900s |
| Supplemental | 10/handle | 86,400s |
| Telemetry | 10/handle | 60s |
| Webhook | 20/IP | 60s |
| Unsubscribe | 10/IP | 60s |

## Database Usage

- **Tables**: 9 + 2 views (unchanged from 2026-04-12)
- **RLS**: All 9 tables RLS-enabled + FORCE ROW LEVEL SECURITY + deny policies. 2 views with `security_invoker = true`.
- **Connection management**: Singleton lazy client (`lib/db/supabase.ts:10-31`). No per-request creation. `persistSession: false` (correct for serverless).
- **N+1 query patterns**: 0. Batch queries used where applicable (`dbGetLatestSnapshotBatch()` uses `.in("handle", handles)`).
- **Cleanup jobs**: 3 retention jobs in warm-cache cron — verification (30d), merge_operations (90d), snapshots (365d). All use 1000-row batches.

## External API Calls

| Route | External Service | Cached | Rate Limited | Timeout | Risk |
|---|---|---|---|---|---|
| `/api/refresh` | GitHub API | YES (6h + 7d stale) | YES (5/hr) | YES (15s) | LOW |
| `/api/generate` | GitHub API | YES (6h + 7d stale) | YES (10/hr) | YES (15s) | LOW |
| `/api/recalculate` | GitHub API | YES (6h + 7d stale) | YES (20/hr) | YES (15s) | LOW |
| `/api/profile/[handle]` | Supabase (no GitHub) | YES (s-maxage=300) | YES (60/min) | YES (db timeout) | LOW |
| `/api/cron/warm-cache` | GitHub API | YES (6h + 7d stale) | Bearer auth | YES (15s) | LOW |
| `/api/cron/sync-audience` | Resend API | Partial | Bearer auth | YES (30s) | LOW |
| `/api/cron/process-campaigns` | Resend API | N/A | Bearer auth + daily limit | N/A | LOW |
| `/api/admin/bulk-recalculate` | GitHub API | YES (6h + 7d stale) | YES (5/hr) | YES (15s) | LOW |
| `/api/auth/callback` | GitHub API | N/A | YES (10/15min) | YES (15s) | LOW |
| `/api/auth/{platform}/callback` | Bitbucket/Codeberg | N/A | YES (10/15min) | YES (15s) | LOW |
| `/api/notifications/unsubscribe` | Resend API | N/A | YES (10/min) | N/A | LOW |
| Badge SVG (`/u/[handle]/badge.svg`) | None (cache only) | YES (s-maxage=21600) | YES (100/min) | N/A | LOW |

- **GitHub API headroom**: Cache-first (6h + 7d stale) + in-flight dedup. ~50–150 calls/hr vs 5,000/hr limit (~97%+ headroom).
- **Fetch timeout coverage**: 100%. All external calls have `AbortSignal.timeout()`.
- **Fire-and-forget patterns**: 6 identified — all have proper error handling and timeouts.

## Resource Management

- **Global state**: 2 module-level Maps (`_inflight` in client.ts, `flagCache` in feature-flags.ts) — both bounded and self-cleaning. `_inflight` uses `.finally()` cleanup; `flagCache` has 5min TTL and ~10 entries max.
- **Agent run state**: Global `currentRun` in `admin/agents/run/route.ts:36` persists across container reuse. Admin-only, cleanup handlers in place. LOW risk.
- **Streaming responses**: None. All responses buffered. OG image route uses `Promise.race()` with 10s timeout.
- **AbortController cleanup**: Excellent — all uses have proper `.finally()` or built-in `AbortSignal.timeout()`.
- **In-memory buffers**: Agent logs bounded at 500 lines (`MAX_LOG_LINES`). No unbounded buffers.

## Vercel Cost Factors

- **Edge runtime**: Not used. All serverless (correct for DB/Redis workloads).
- **Middleware**: None. No per-request overhead.
- **Long-duration routes**: 3 crons at `maxDuration = 300` (5 min). Predictable cost — ~720 cron-seconds/day.
- **ISR/SSG**: Well-configured. Archetype pages (7d), static pages (24h), dynamic pages (1h). Homepage at 1h could go to 6h (minor optimization).
- **Bundle sizes**: No route exceeds 500KB first-load JS. Admin routes ~640KB server bundle (infrequent invocation).
- **Cron scheduling**: 3 daily jobs, non-overlapping (3:30am, 6am, 8am UTC).

## Dependency Audit

- **Production vulnerabilities**: 0 (unchanged)
- **Dev-only vulnerabilities**: 3 NEW — vite 7.3.1 (via vitest) has 2 HIGH + 1 MODERATE:
  - GHSA-v2wj-q39q-566r: `server.fs.deny` bypass with queries
  - GHSA-p9ff-h696-f583: Arbitrary file read via WebSocket
  - GHSA-4w7w-66w2-5vf9: Path traversal in optimized deps `.map` handling
  - **Patched in vite >=7.3.2**. Dev-only, no production exposure. Fix: add `pnpm.overrides` for `vite: ">=7.3.2"` or wait for vitest to bump peer.

## Recommendations

### Active Items

| ID | Priority | Description | Status |
|---|---|---|---|
| **P3-1** | P3 | Bump vite to >=7.3.2 (dev-only, 3 vulns). Override in `pnpm.overrides` or wait for vitest bump. | NEW |
| **P3-2** | P3 | Cache `listAllContacts()` in sync-audience cron (1–2h TTL). ~5 lines. | CARRIED from 2026-04-12 |

### Carried (future scale)

| ID | Priority | Description | Trigger |
|---|---|---|---|
| **P2-1** | P2 | `dbGetCampaignStats()` client-side aggregation → RPC | >5K sends/campaign |

### Monitors

| ID | Item | Current | Action Threshold |
|---|---|---|---|
| **M1** | Avatar cache Redis memory | ~300 MB max @10K users | If >500 MB, consider CDN-based avatar serving |
| **M2** | OG image Redis memory | Bounded by s-maxage=21600 | If Redis >80% capacity |
| **M3** | HyperLogLog size | ~12 KB | Track quarterly, no action needed |

### Closed This Cycle

None — no production code changes to evaluate.
