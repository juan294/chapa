# Cost Analyst Report
> Generated: 2026-08-25 | Health status: GREEN

## Executive Summary

Chapa demonstrates excellent infrastructure cost discipline with a multi-layered caching strategy, aggressive GitHub API rate-limit management, atomic quota enforcement, and zero resource leaks. Redis is properly configured with TTL coverage on 93.6% of cache writes, all three no-TTL keys are fixed-cardinality singletons. Database batch operations prevent N+1 queries. Vercel function budgets are well-tuned against their workloads. Bundle size holds steady at ~1.99 MB raw / 639 KB gzip. No cost-critical path lacks testing or monitoring.

---

## Redis Usage

### Key Patterns & Cardinality

| Pattern | TTL | Per-Handle? | Count | Risk |
|---------|-----|------------|-------|------|
| `stats:v2:merged:*` | 6h (21,600s) | Yes | ~2,000–5,000 | LOW — auto-purge on TTL |
| `stats:stale:v2:*` | 7d (604,800s) | Yes | ~2,000–5,000 | LOW — fallback only, 7d bound |
| `svg:badge:*:*` | 24h jittered | Yes | ~10,000–20,000 | LOW — theme variant, auto-purge |
| `history:*` | 7d | Yes | ~2,000–5,000 | LOW — immutable snapshots |
| `rateLimit:*` | 60–3,600s | No (IP/handle) | ~10,000 sliding | LOW — fixed window, auto-purge |
| `supplemental:*` | 24h | Yes | ~1,000–2,000 | LOW — optional merge data |
| `campaign:daily-sends:YYYY-MM-DD` | 24h | No | 1–2/day | LOW — rotates daily |
| `cron:warm-cache:offset` | 0 (no-TTL) | No | 1 | NONE — fixed value, manual cleanup |
| `stats:badges_generated` | 0 (no-TTL) | No | 1 | NONE — HyperLogLog counter |
| `stats:unique_badges` | 0 (no-TTL) | No | 1 | NONE — HyperLogLog cardinality |

### TTL Coverage Analysis

- **Total cache-write call sites**: 47 (26 files)
- **Strictly-production sites** (excl. test infra): 41 sites
- **TTL coverage**: 44/47 (93.6%) — 3 no-TTL calls intentional singletons
- **Default TTL**: 21,600s (6 hours) per `redis.ts:82`
- **Supplemental fallback TTL**: 86,400s (24h) per `client.ts:21`
- **Stale baseline fallback**: 604,800s (7 days) per `client.ts:20`

### Growth Risk Assessment

**No unbounded growth patterns detected.** All per-handle keys are bound by TTL (≤7d), and quota counters rotate daily. The `stats:stale:v2:*` baseline is meant to be long-lived for degraded-fetch fallback, but it's only populated once per cache miss and expires naturally — it is not actively maintained or refreshed on every request. The largest population spike would be during a GitHub outage when every cache-miss falls back to the baseline, but that is transient.

---

## Database Usage

### Schema & Isolation

| Item | Value |
|------|-------|
| Tables | 11 |
| Migrations | 34 |
| Row-Level Security | 11/11 tables ENABLE FORCE (100%) |
| Connection model | Lazy singleton (`supabase.ts:15,30`) |
| Pool mode | `persistSession: false` — service-role auth per request |

### Query Patterns

1. **Batch pre-fetch** — `warm-cache` reads all ~50 prior snapshots in ONE query, not N
2. **Campaign stats aggregation** — single `.select("status")` + JS reduce, not 4 separate COUNT queries (`sends.ts:233-264`)
3. **No N+1 patterns detected** — all DB reads are either single-row or batch-scoped
4. **Atomic RPC usage** — Postgres RPC for campaign lease claims (prevent double-claiming) and supplemental upserts

### Connection Management

- **Lazy singleton** — `getSupabase()` pattern with `_supabaseInstance` cache
- **No per-request allocation** — connections are reused across all requests in the same instance
- **Session persistence disabled** — `persistSession: false` means each request authenticates with service role key (smaller credential overhead)

---

## External API Calls

| Route | Service | Cached? | Rate Limited? | Risk | Budget Impact |
|-------|---------|---------|---------------|------|---------------|
| `/api/profile/:handle` | GitHub (public) | Yes, 6h | Yes (fail-open IP limit) | LOW | ~0.1% /5k/hr |
| `/api/history/:handle` | Supabase + cache | Yes, 7d | Yes (fail-open IP limit) | LOW | 0% (cached) |
| `/api/verify/:hash` | Supabase only | Yes (verified record) | Yes (fail-open IP limit) | LOW | ~0.1% per hash |
| `/u/:handle/badge.svg` | GitHub + avatar CDN | Yes, 24h | Yes (fail-open IP limit) | LOW | ~1% /5k/hr |
| `/api/cron/warm-cache` | GitHub (50/hr) | Yes, 6h | No (private token) | LOW | ~1% /5k/hr |
| `/api/cron/sync-audience` | Resend | Yes (quota-reserved) | Yes (daily cap) | LOW | Quota-aware |
| `/api/cron/process-campaigns` | Resend | Yes (quota-reserved) | Yes (daily cap) | LOW | Quota-aware |
| OAuth callbacks | GitHub/Bitbucket/Codeberg/GitLab | N/A | Yes (fail-closed) | LOW | <<0.1% /5k/hr |

### GitHub Rate-Limit Math

**Worst-case warm-cache load**: 50 handles/hour (hourly cron, `MAX_HANDLES=50`) × 1 GraphQL call per miss ≈ **50 calls/hour ÷ 5,000/hr budget = 1%**. Leaves 99% headroom for user traffic. See `warm-cache/route.ts:44-60` for full rate-limit budget analysis.

### Uncached External Calls

**Zero.** All GitHub queries go through `cacheGet()` first (6h primary TTL, 7d fallback); cache misses trigger a fetch only when needed. Resend quota is atomically reserved via Redis pipeline before sending. PostHog events are fire-and-forget (non-critical). Platform integrations (Bitbucket/Codeberg/GitLab) are only fetched if linked and use the same 6h cache window.

---

## Resource Management

### In-Memory Structures

| Resource | Lifetime | Cleanup | Risk |
|----------|----------|---------|------|
| `_inflight` (GitHub fetch dedup) | ~30s timeout | `finally()` on timeout | LOW — per-request + auto-expire |
| `_redis` singleton | App lifecycle | Lazy init | LOW — no per-request allocation |
| `inflightBadgeRenders` (badge render dedup) | Per-instance | Redis render-lock (30s TTL) + local coalesce | LOW — cross-instance is Redis-backed |

### Async Cleanup Patterns

1. **Avatar fetch race** — wrapped in `withTimeout()` with 1000ms deadline; promise cleanup fires on timeout
2. **Badge render polling** — poll schedule limited to ~950ms (see `badge.svg/route.ts:67-74`), render-lock enforces 30s TTL
3. **Campaign lease expiry** — atomic claim/release via `claim_campaign_sends()` + `acknowledge_campaign_sends()` RPC; orphaned leases expire in Postgres (auto-cleanup)
4. **Supplemental stats fetch** — fire-and-forget Redis cache rehydration on miss, no blocking on caller

### Connection Lifecycle

- **Supabase**: Lazy singleton, no per-request connections
- **Redis**: Lazy singleton with graceful degradation (fail-open/fail-closed by route type)
- **Avatar fetches**: Timeout-wrapped, non-blocking, cache miss doesn't break response

### Potential Leak Sources

**NONE detected.** All async operations are either:
- Wrapped in `finally()` cleanup
- Timeout-guarded
- Fire-and-forget (PostHog) with no cleanup requirement
- Managed by platform (Vercel cold-start cleanup)

---

## Vercel-Specific Cost Factors

### Function Budgets & Timeouts

| Route | Max Duration | Workload | Budget Margin |
|-------|-------------|----------|-----------------|
| `/u/:handle/badge.svg` | 35s | Cache hit (800ms) + cache miss (3000ms) + SLO buffer | ~31s buffer |
| `/api/cron/warm-cache` | 300s | Batch 50 handles × 5 concurrent + polling | TIME_BUDGET_MS=270s (30s buffer) |
| `/api/cron/sync-audience` | 300s | Resend audience sync | TIME_BUDGET_MS implicit |
| `/api/cron/process-campaigns` | 300s | Round-robin active campaigns, quota-aware batching | TIME_BUDGET_MS=270s (30s buffer) |
| `/api/cron/latency-check` | 60s | Synthetic SLO probe + alert | Single probe, no buffer needed |

### ISR & SSG Opportunities

- **9 locale-segmented content pages** (`/[locale]/*`) are SSG (pre-rendered at build time for both `en` + `es`)
- **Share page** (`/u/:handle`) is ISR with revalidation on badge update (via `revalidatePath()`)
- **Badge endpoint** is not ISR — always dynamic (cache headers handle freshness)

### Bundle Size & Chunks

| Metric | Value |
|--------|-------|
| Total First Load JS (raw) | 1,999–2,013 KB |
| Total First Load JS (gzip) | 639–644 KB |
| Chunk count | 73 |
| Routes >500 KB | 0 |
| Routes >350 KB (CI gate) | 0 |
| Largest chunks | 228 / 192 / 112 / 108 / 92 KB (raw) |

**No cost concerns.** Bundle is well-optimized, no oversized routes, all framework/vendor chunks are standard Next.js architecture.

---

## Monitoring & Observability

### Cost-Path Telemetry

| Event | Trigger | Monitoring |
|-------|---------|------------|
| `warm_cache_ceiling_approached` | ≥90% of MAX_HANDLES used | Operational alert |
| `warm_cache_high_failure_rate` | >20% handle failures | Operational alert |
| `github_degraded_pr_fetch` | Scope-blind session token miss | Telemetry counter |
| `snapshot_skipped_incomplete_stats` | Stats fetch rejected | Telemetry counter |
| `badge_latency_slo_breach` | p95 >800ms (cache) or >3000ms (miss) | Operational alert (P2) |
| `cron_failure` | Cron route threw or timed out | Operational alert |
| `insufficient_scope` | Server `GITHUB_TOKEN` lost `repo` scope | `/api/health` status |

### Health Check Coverage

**`/api/health` endpoint** polls:
- Redis dbsize (data access, not just connectivity)
- Supabase connection pool status
- GitHub API (probes server `GITHUB_TOKEN` scopes)
- Cron heartbeats (all 4 crons) — staleness window monitored

All three services degrade gracefully (heartbeat omitted if unconfigured, response status indicates degradation).

---

## Cost Optimization Summary

### Green Flags ✅
1. **Default TTL universally applied** — 93.6% of cache writes include TTLs
2. **GitHub API budget well-managed** — warm-cache uses ~1% of quota, headroom for traffic spikes
3. **No N+1 queries** — batch pre-fetch for snapshots, single aggregation query for campaigns
4. **Atomic quota enforcement** — Resend sends are reserved via Redis pipeline before Resend API call
5. **Rate-limiting fail-safe** — public reads fail-open (availability first), auth routes fail-closed (security first)
6. **Zero resource leaks** — all async operations cleanup via `finally()` or timeout
7. **Bundle well-optimized** — 639 KB gzip, all chunks under gate limits
8. **Vercel timeouts well-tuned** — 30s buffer on critical paths

### Yellow Flags ⚠️
**NONE.** No cost-critical areas identified with performance or correctness gaps. All per-handle operations scale linearly; all global singletons are either fixed-cardinality or auto-rotating.

### P1 / P2 Action Items
**NONE.** All cost paths are working as designed. No P1s or P2s open.

---

## Recommendations

1. **Monitor warm-cache ceiling** — Track `warm_cache_ceiling_approached` alerts. If ≥90% of MAX_HANDLES used consistently, consider:
   - Raising `MAX_HANDLES` (currently 50, leaving 90% of GitHub budget unused)
   - Switching to 2x/day warm-cache runs (CLAUDE.md allows 5,000/hr; daily 50×2 = 100/day ≈ 4/hr, <<5k)
   - Note: Currently not needed — vast headroom — but recommend monitoring as user base grows

2. **Snapshot write reconciliation** — `reconcileSnapshotWrite()` logs both successful and failed writes. Continue monitoring for `snapshot_write_failed` alerts — if one appears, escalate immediately (durable write failure is always a bug).

3. **Campaign send quota** — `cacheReserveQuota()` is atomic and idempotent. Monitor `campaign:daily-sends:` Redis key just before cron runs to confirm quota counter resets at midnight (date rotation).

4. **Avatar cache effectiveness** — Track the ratio of avatar fetches (external CDN) vs. placeholder renders (1000ms timeout). Aim for >85% cache hit rate; if below 80%, avatar CDN latency may be degraded.

5. **Rate-limit fail-open observability** — `/api/health` can report Redis unavailability. Add external monitoring of the health endpoint to catch Redis outages early — fail-open is good for availability, but you want to know it happened.

---

## Cross-Agent Context

**Prev. Cost Analyst cycle (2026-08-24):** GREEN. All metrics re-confirmed. Bundle canonical at 1,999 KB raw / 639 KB gzip as of HEAD `5a45569f`. No regressions, no new cost risks.

**Coverage (2026-08-19):** All cost-path modules ≥96% stmts (lib/cache 98.2%, lib/db 97.2%, app/api 97.4%). Cost-critical functions are tested.

**Security (2026-08-24):** No security-cost tradeoffs. CORS wildcard scoped to 2 read-only routes. Rate-limit fail-safe is intentional. Quota enforcement atomic.

**Performance (2026-08-20):** Bundle stable, badge latency SLO met (p95 <800ms cache-hit, <3000ms cache-miss). Avatar race and render-lock budgets verified.

**Recommendation to other agents:** Cost discipline is excellent. Focus audits on feature correctness and test coverage rather than cost optimization — there is no low-hanging fruit here.
