# Cost Analyst Report
> Generated: 2026-04-03 | Health status: yellow

## Executive Summary
Infrastructure costs remain stable and well within Upstash Pro and Vercel limits at current scale. One P1 survives: the refresh endpoint comment says 5/hr but the code enforces 15/hr — a debugging artifact that should be reverted before the next release. One P3 carry: `supplemental:*` Redis keys are not cleaned up on OAuth disconnect.

## Redis Usage

### Key Patterns & TTLs
| Key Pattern | TTL | Notes |
|---|---|---|
| `stats:v2:merged:{handle}` | 6h | Primary merged stats cache |
| `stats:stale:{handle}` | 7d | Stale fallback if GitHub API unavailable |
| `stats:v2:bitbucket:{handle}` | 6h | Bitbucket platform stats |
| `stats:v2:codeberg:{handle}` | 6h | Codeberg platform stats |
| `og-image:v1:{handle}:{date}` | 48h | OG image PNG (base64, ~133 KB/key) |
| `ratelimit:*` | Window-based | Sliding-window rate counters |
| `supplemental:{handle}` | **None** | EMU data — no TTL, orphans possible |
| `stats:badges_generated` | **None** | HyperLogLog counter — intentional singleton |
| `stats:unique_badges` | **None** | HyperLogLog counter — intentional singleton |
| `cron:warm-cache:offset` | **None** | Cron rotation offset — intentional singleton |

- **TTL coverage**: 100% of per-user keys. 3 intentional no-TTL singletons + 1 potentially orphaned pattern (`supplemental:*`).
- **OG image storage dominates**: ~133 KB/key × 2 keys/active-user/day = ~130 MB at 1K active users/day, ~1.3 GB at 10K. CDN `s-maxage=21600` bounds real generation cost. Still within Upstash Pro 10 GB.
- **In-flight dedup**: `github/client.ts` maintains a `Map` of in-progress fetches — thundering herd prevented.
- **Growth risk**: `supplemental:*` keys accumulate silently if user disconnects a platform without re-uploading EMU data. Orphaned entries will re-merge if user re-links. P3 only — no unbounded growth (one key per handle).

## Database Usage

- **Tables**: 9 + 2 views. All 9 tables with `FORCE ROW LEVEL SECURITY` + explicit deny policies (unchanged from previous audit).
- **Singleton client**: `lib/db/supabase.ts` — lazy global `_client`, initialized once, reused for process lifetime. Appropriate for serverless.
- **Query patterns**: No N+1 patterns found. `dbGetLatestSnapshotBatch()` used for bulk warm-cache operations. DB write in cron: one `upsert` per handle (daily dedup via UNIQUE constraint on handle+date).
- **Connection management**: Supabase JS v2 uses HTTP (REST + PostgREST), not persistent TCP — no connection pool exhaustion risk in serverless.

## External API Calls

| Route | External Service | Cached Before Call | Rate Limited | Risk |
|---|---|---|---|---|
| `GET /u/[handle]/badge.svg` | GitHub GraphQL | ✅ 6h stats cache | ✅ fail-open | LOW |
| `POST /api/generate` | GitHub GraphQL | ✅ 6h stats cache | ✅ fail-open | LOW |
| `POST /api/refresh` | GitHub GraphQL | ❌ clears cache intentionally | ✅ **15/hr** (comment says 5) | MEDIUM — P1 |
| `GET /api/cron/warm-cache` | GitHub GraphQL ×50 | ✅ per-handle 6h cache | ✅ GITHUB_TOKEN 5K/hr | LOW |
| `GET /u/[handle]/og-image` | GitHub → Supabase → Resend | ✅ 48h PNG cache | ✅ none needed | LOW |
| `GET /api/cron/sync-audience` | Resend (contacts) | ❌ full Resend contact scan | ✅ Resend quota | LOW |
| `GET /api/cron/process-campaigns` | Resend (send) | N/A — send path | ✅ 95/day quota | LOW |
| `POST /api/supplemental` | None | N/A | ✅ session auth | LOW |

### GitHub API Budget
- **Warm-cache**: 50 handles × 1 call = 50 calls/run × 1 run/day = **50 calls/day**
- **Badge views (cache miss)**: ~5 min cold start window per handle per 6h
- **Refresh abuse ceiling**: 15/hr per handle × N users ≈ bounded per-user
- **Total estimated**: 50–300 calls/day at current scale. GitHub 5K/hr limit gives ample headroom.

## Resource Management

- **No resource leaks detected**: No unclosed HTTP connections, no unbounded in-memory buffers found.
- **Fetch timeouts**: 100% coverage — all external calls use `AbortSignal.timeout()` or `withTimeout()` wrapper. GitHub GraphQL: 15s. OG image resvg: 10s. Supabase health: 5s. Resend SDK: wrapped.
- **Turbopack NFT warning** (LOW, cosmetic): `lib/render/svg-to-png.ts:36-37` uses `path.join(process.cwd(), ...)` causing full-project file tracing for OG route. Can be resolved with `/*turbopackIgnore*/` comment.
- **`supplemental:*` orphan risk** (P3): Keys not deleted on Bitbucket/Codeberg OAuth disconnect (`platform-oauth.ts` `createDisconnectHandler` clears `stats:v2:merged:*` and `stats:v2:{platform}:*` but not `supplemental:*`). Silent accumulation, one key per handle max.

## Vercel-Specific Factors

- **Cron function timeout**: All three cron routes declare `export const maxDuration = 300` (5 min, Vercel Pro required). All other routes use default (10–60s depending on plan).
- **Function bundling**: Font TTF files explicitly traced for `/og-image` and `/u/[handle]/og-image` and `/u/[handle]/badge.svg` via `outputFileTracingIncludes`. Correct.
- **Edge runtime**: None declared — all routes use Node.js serverless. Appropriate given Supabase/Redis dependencies.
- **ISR opportunities**: Static-ish pages (`/about`, `/about/scoring`, archetype pages) have ISR `revalidate=86400` already applied (confirmed in 2026-03-30 triage). No additional ISR candidates.
- **Bundle size**: 1,663 KB total client JS (down -137 KB from 2026-03-26). No chunk > 500 KB. Stable.

## Recommendations

| Priority | Item | File | Action |
|---|---|---|---|
| **P1** | Refresh rate limit comment/code mismatch | `app/api/refresh/route.ts:47` | Change `15` → `5` to match JSDoc comment "Rate limited: 5 refreshes per handle per hour" |
| **P3** | `supplemental:*` keys orphaned on disconnect | `lib/auth/platform-oauth.ts` `createDisconnectHandler()` | Add `void cacheDel(\`supplemental:${handle.toLowerCase()}\`)` alongside existing cache clears |
| **MONITOR** | OG image Redis memory | `app/u/[handle]/og-image/route.ts` | ~1.3 GB at 10K active users. CDN bounds generation cost. No action until 5K+ users. |
| **MONITOR** | `sync-audience` Resend pagination | `app/api/cron/sync-audience/route.ts` | `listAllContacts()` paginates until empty page. Future risk only at >10K contacts. |

**Estimated monthly cost at 10K users:** ~$15–70 (Vercel $10–20, Redis $5–15, Resend $0–10, Supabase $0–25). Unchanged from prior period.
