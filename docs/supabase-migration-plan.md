# Supabase Migration Plan

> Migrate permanent/historical data from Upstash Redis to Supabase Postgres.
> Redis remains for caching, rate limiting, and ephemeral state.

**Status:** Draft
**Created:** 2026-02-17
**Target:** Incremental (no big-bang cutover)

---

## 1. What's Moving and What's Staying

### Moving to Supabase Postgres

| Data | Current Redis key | TTL | Why move |
|------|-------------------|-----|----------|
| Metric snapshots | `history:<handle>` (sorted set) | None (permanent) | Core historical data, needs indexing, querying, and unbounded retention |
| User registry | `user:registered:<handle>` (JSON) | None (permanent) | Permanent records, need relational queries (admin dashboard) |
| Verification records | `verify:<hash>`, `verify-handle:<handle>` | 30 days | Benefits from SQL queries; Postgres `TIMESTAMPTZ` + cron handles TTL |

### Staying in Redis (Upstash)

| Data | Redis key | Why keep |
|------|-----------|---------|
| Stats cache | `stats:v2:<handle>`, `stats:stale:<handle>` | Ephemeral, TTL-based, classic cache use case |
| Rate limiting | `ratelimit:*` | Fixed-window counters, needs atomic INCR+EXPIRE |
| Badge counters | `stats:badges_generated`, `stats:unique_badges` | HyperLogLog + INCR, Redis-native operations |
| Supplemental stats | `supplemental:<handle>` | Ephemeral, 6h TTL |

---

## 2. Database Schema

### `users` table

```sql
CREATE TABLE users (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  handle        TEXT NOT NULL UNIQUE,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_registered_at ON users (registered_at DESC);
```

**Notes:**
- `handle` is stored lowercase (matches current `toLowerCase()` behavior in `registerUser()`)
- `id` provides a stable FK target; `handle` is the natural key
- Replaces Redis keys `user:registered:<handle>`

### `metrics_snapshots` table

```sql
CREATE TABLE metrics_snapshots (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  handle              TEXT NOT NULL,
  date                DATE NOT NULL,
  captured_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Stats subset
  commits_total       INT NOT NULL,
  prs_merged_count    INT NOT NULL,
  prs_merged_weight   REAL NOT NULL,
  reviews_submitted   INT NOT NULL,
  issues_closed       INT NOT NULL,
  repos_contributed   INT NOT NULL,
  active_days         INT NOT NULL,
  lines_added         INT NOT NULL,
  lines_deleted       INT NOT NULL,
  total_stars         INT NOT NULL,
  total_forks         INT NOT NULL,
  total_watchers      INT NOT NULL,
  top_repo_share      REAL NOT NULL,

  -- Explanatory stats (optional)
  max_commits_in_10min INT,
  micro_commit_ratio   REAL,
  docs_only_pr_ratio   REAL,

  -- Impact dimensions & classification
  building            REAL NOT NULL,
  guarding            REAL NOT NULL,
  consistency         REAL NOT NULL,
  breadth             REAL NOT NULL,
  archetype           TEXT NOT NULL,
  profile_type        TEXT NOT NULL,
  composite_score     REAL NOT NULL,
  adjusted_composite  REAL NOT NULL,
  confidence          REAL NOT NULL,
  tier                TEXT NOT NULL,

  -- Confidence penalties (JSONB array, null when empty)
  confidence_penalties JSONB,

  CONSTRAINT uq_snapshot_per_day UNIQUE (handle, date)
);

-- Primary query: get snapshots for a handle in date range
CREATE INDEX idx_snapshots_handle_date ON metrics_snapshots (handle, date DESC);
```

**Notes:**
- `UNIQUE (handle, date)` enforces the existing one-snapshot-per-day dedup at the DB level
- No FK to `users` — snapshots can exist for handles that haven't gone through OAuth (public badge route)
- Flattened columns instead of JSONB blob — enables indexed queries on dimensions, archetype, tier
- `confidence_penalties` stays JSONB because it's a variable-length array rarely queried
- **No 365-row cap** — Postgres handles unbounded history cheaply. Add a retention policy later if needed

### `verification_records` table

```sql
CREATE TABLE verification_records (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  hash                TEXT NOT NULL UNIQUE,
  handle              TEXT NOT NULL,
  display_name        TEXT,
  adjusted_composite  REAL NOT NULL,
  confidence          REAL NOT NULL,
  tier                TEXT NOT NULL,
  archetype           TEXT NOT NULL,
  profile_type        TEXT NOT NULL,
  building            REAL NOT NULL,
  guarding            REAL NOT NULL,
  consistency         REAL NOT NULL,
  breadth             REAL NOT NULL,
  commits_total       INT NOT NULL,
  prs_merged_count    INT NOT NULL,
  reviews_submitted   INT NOT NULL,
  generated_at        DATE NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at          TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days')
);

CREATE INDEX idx_verification_handle ON verification_records (handle);
CREATE INDEX idx_verification_expires ON verification_records (expires_at);
```

**Notes:**
- `expires_at` replaces Redis TTL. Clean up with a daily cron: `DELETE FROM verification_records WHERE expires_at < now()`
- `hash` is UNIQUE — same as current Redis key structure
- Index on `handle` replaces the `verify-handle:<handle>` reverse lookup key

---

## 3. Implementation Phases

### Phase 1: Foundation (no behavioral changes)

**Goal:** Set up Supabase client, create tables, add tests. Nothing reads from or writes to Postgres yet in production paths.

#### Tasks

1. **Install Supabase client**
   - `pnpm add @supabase/supabase-js` (in `apps/web`)
   - Add env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server-side only, never `NEXT_PUBLIC_`)

2. **Create Supabase client module**
   - New file: `apps/web/lib/db/supabase.ts`
   - Lazy singleton pattern (matches current Redis approach)
   - Service role key for server-side operations (no RLS needed — all access is server-to-server)

3. **Run migrations in Supabase dashboard**
   - Create `users`, `metrics_snapshots`, `verification_records` tables using SQL above
   - Optionally store migration SQL in `supabase/migrations/` for version control

4. **Create data access layer**
   - New file: `apps/web/lib/db/users.ts` — `upsertUser()`, `getUsers()`, `getUserCount()`
   - New file: `apps/web/lib/db/snapshots.ts` — `insertSnapshot()`, `getSnapshots()`, `getLatestSnapshot()`, `getSnapshotCount()`
   - New file: `apps/web/lib/db/verification.ts` — `storeVerification()`, `getVerification()`, `cleanExpiredVerifications()`
   - All functions return the same types as their Redis counterparts (drop-in interface compatibility)

5. **Write tests for data access layer**
   - Mock `@supabase/supabase-js` at module level
   - Test insert, upsert-on-conflict, date-range queries, cleanup

#### Files created
```
apps/web/lib/db/supabase.ts
apps/web/lib/db/users.ts
apps/web/lib/db/snapshots.ts
apps/web/lib/db/verification.ts
apps/web/lib/db/users.test.ts
apps/web/lib/db/snapshots.test.ts
apps/web/lib/db/verification.test.ts
```

#### Files modified
```
apps/web/package.json   (add @supabase/supabase-js)
```

---

### Phase 2: Dual-write (write to both, read from Redis)

**Goal:** Start populating Postgres alongside Redis. No read paths change. If Postgres writes fail, nothing breaks (fire-and-forget, same as current Redis writes).

#### Tasks

1. **Update `recordSnapshot()` in `apps/web/lib/history/history.ts`**
   - After the Redis write, also call `insertSnapshot()` from the new DB layer
   - Fire-and-forget (`.catch(() => {})`) — Postgres failure must not affect badge serving

2. **Update `registerUser()` in `apps/web/lib/cache/redis.ts`**
   - After Redis write, also call `upsertUser()` from DB layer
   - Same fire-and-forget pattern

3. **Update `storeVerificationRecord()` in `apps/web/lib/verification/store.ts`**
   - After Redis writes, also call `storeVerification()` from DB layer

4. **Add verification cleanup to warm-cache cron**
   - Call `cleanExpiredVerifications()` at the end of the cron run
   - Replaces Redis TTL-based expiry for verification records

#### Files modified
```
apps/web/lib/history/history.ts         (dual-write snapshots)
apps/web/lib/cache/redis.ts             (dual-write user registration)
apps/web/lib/verification/store.ts      (dual-write verification)
apps/web/app/api/cron/warm-cache/route.ts (add verification cleanup)
```

---

### Phase 3: Backfill existing data

**Goal:** Migrate all existing Redis data into Postgres so both stores have identical records.

#### Tasks

1. **Write a one-time backfill script**
   - New file: `scripts/backfill-supabase.ts`
   - Scans all `history:<handle>` sorted sets via `SCAN` + `ZRANGE`
   - Scans all `user:registered:<handle>` keys
   - Scans all `verify:<hash>` keys
   - Batch-inserts into Postgres with `ON CONFLICT DO NOTHING`
   - Logs progress and errors

2. **Run the backfill**
   - Execute locally against production Redis + Supabase (with env vars)
   - Verify row counts match Redis key counts

3. **Validate data integrity**
   - Spot-check 10-20 handles: compare Redis snapshot count vs Postgres row count
   - Compare latest snapshot values for correctness

#### Files created
```
scripts/backfill-supabase.ts
```

---

### Phase 4: Switch reads to Postgres

**Goal:** All read paths now use Postgres. Redis writes continue temporarily as fallback.

#### Tasks

1. **Update `apps/web/lib/history/history.ts`**
   - `getSnapshots()` reads from Postgres instead of Redis `ZRANGE`
   - `getLatestSnapshot()` reads from Postgres instead of Redis `ZRANGE REV`
   - `getSnapshotCount()` reads from Postgres instead of Redis `ZCARD`
   - Keep Redis write in `recordSnapshot()` as fallback (removed in Phase 5)

2. **Update `apps/web/lib/verification/store.ts`**
   - `getVerificationRecord()` reads from Postgres instead of Redis `GET`

3. **Update admin users endpoint** (`apps/web/app/api/admin/users/route.ts`)
   - Query `users` table instead of scanning `user:registered:*` keys
   - This unlocks: sorting by registration date, pagination, count queries

4. **Update existing tests**
   - Tests for history, verification, and admin now mock Supabase instead of Redis
   - Redis mocks remain for cache/rate-limit tests

5. **Remove the 365-snapshot pruning** (`pruneSnapshots()`)
   - No longer needed — Postgres handles unbounded history

#### Files modified
```
apps/web/lib/history/history.ts          (read from Postgres)
apps/web/lib/history/history.test.ts     (update mocks)
apps/web/lib/verification/store.ts       (read from Postgres)
apps/web/lib/verification/store.test.ts  (update mocks)
apps/web/app/api/admin/users/route.ts    (query Postgres)
apps/web/app/api/admin/users/route.test.ts (update mocks)
```

---

### Phase 5: Remove Redis for migrated data

**Goal:** Clean up dual-write code and Redis keys for migrated data. Redis only handles caching, rate limiting, and ephemeral state.

#### Tasks

1. **Remove Redis writes for migrated data**
   - `recordSnapshot()` — remove Redis sorted set write, keep only Postgres
   - `registerUser()` — remove Redis key write, keep only Postgres
   - `storeVerificationRecord()` — remove Redis writes, keep only Postgres

2. **Remove Redis read functions that are no longer called**
   - `getRawRedis()` export (if no longer needed for sorted set ops)
   - Any dead helper functions in `redis.ts`

3. **Clean up Redis keys in production**
   - Script or manual: delete `history:*`, `user:registered:*`, `verify:*`, `verify-handle:*` keys
   - Do this **after** Phase 4 has been stable in production for at least 1 week

4. **Remove `pruneSnapshots()` function entirely**
   - Already unused after Phase 4, now delete the code

5. **Update `CLAUDE.md`**
   - Document Supabase as the store for permanent data
   - Update env var list with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
   - Update code ownership areas

#### Files modified
```
apps/web/lib/history/history.ts     (remove Redis writes + pruning)
apps/web/lib/cache/redis.ts         (remove registerUser, getRawRedis if unused)
apps/web/lib/verification/store.ts  (remove Redis writes)
CLAUDE.md                           (update docs)
```

---

## 4. Supabase Client Setup

```typescript
// apps/web/lib/db/supabase.ts
import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (client) return client;

  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !key) return null;

  client = createClient(url, key, {
    auth: { persistSession: false },
  });

  return client;
}

// Test helper
export function _resetClient(): void {
  client = null;
}
```

**Notes:**
- Service role key bypasses RLS — appropriate for server-side-only access
- Returns `null` when env vars are missing (graceful degradation, same as Redis)
- `persistSession: false` — no auth state needed for server-to-server

---

## 5. Interface Compatibility

The new Postgres functions must return the same types as the current Redis-backed functions. This makes the switchover in Phase 4 a matter of changing imports, not reshaping data.

| Current function | Current module | New module | Return type (unchanged) |
|-----------------|----------------|------------|------------------------|
| `recordSnapshot()` | `lib/history/history.ts` | `lib/db/snapshots.ts` | `Promise<boolean>` |
| `getSnapshots()` | `lib/history/history.ts` | `lib/db/snapshots.ts` | `Promise<MetricsSnapshot[]>` |
| `getLatestSnapshot()` | `lib/history/history.ts` | `lib/db/snapshots.ts` | `Promise<MetricsSnapshot \| null>` |
| `getSnapshotCount()` | `lib/history/history.ts` | `lib/db/snapshots.ts` | `Promise<number>` |
| `registerUser()` | `lib/cache/redis.ts` | `lib/db/users.ts` | `Promise<void>` |
| `storeVerificationRecord()` | `lib/verification/store.ts` | `lib/db/verification.ts` | `Promise<void>` |
| `getVerificationRecord()` | `lib/verification/store.ts` | `lib/db/verification.ts` | `Promise<VerificationRecord \| null>` |

---

## 6. Row-to-Type Mapping

Postgres rows use `snake_case`. TypeScript types use `camelCase`. The data access layer handles conversion:

```typescript
// Example: Postgres row → MetricsSnapshot
function rowToSnapshot(row: SnapshotRow): MetricsSnapshot {
  return {
    date: row.date,
    capturedAt: row.captured_at,
    commitsTotal: row.commits_total,
    prsMergedCount: row.prs_merged_count,
    prsMergedWeight: row.prs_merged_weight,
    reviewsSubmittedCount: row.reviews_submitted,
    issuesClosedCount: row.issues_closed,
    reposContributed: row.repos_contributed,
    activeDays: row.active_days,
    linesAdded: row.lines_added,
    linesDeleted: row.lines_deleted,
    totalStars: row.total_stars,
    totalForks: row.total_forks,
    totalWatchers: row.total_watchers,
    topRepoShare: row.top_repo_share,
    maxCommitsIn10Min: row.max_commits_in_10min ?? undefined,
    microCommitRatio: row.micro_commit_ratio ?? undefined,
    docsOnlyPrRatio: row.docs_only_pr_ratio ?? undefined,
    building: row.building,
    guarding: row.guarding,
    consistency: row.consistency,
    breadth: row.breadth,
    archetype: row.archetype,
    profileType: row.profile_type,
    compositeScore: row.composite_score,
    adjustedComposite: row.adjusted_composite,
    confidence: row.confidence,
    tier: row.tier,
    ...(row.confidence_penalties
      ? { confidencePenalties: row.confidence_penalties }
      : {}),
  };
}
```

---

## 7. Environment Variables

Add to `.env.local` and Vercel:

```bash
SUPABASE_URL=              # Supabase project URL (https://<ref>.supabase.co)
SUPABASE_SERVICE_ROLE_KEY= # Service role key (server-side only, never NEXT_PUBLIC_)
```

**Security:**
- Service role key is server-only — never expose via `NEXT_PUBLIC_` prefix
- `.trim()` both values (standard env var safety practice)
- Add to `.env.example` for documentation

---

## 8. Connection Pooling Strategy

The Supabase JS SDK communicates via REST (PostgREST), not direct Postgres connections. This means:

- **No connection pool exhaustion risk** — each request is a stateless HTTP call to PostgREST. There are no persistent database connections to manage or leak.
- **No Supavisor needed for the JS SDK** — Supavisor (Supabase's connection pooler) is only relevant for direct Postgres connections (e.g., backfill scripts using `pg`, Prisma, or migration tools).
- **Serverless-friendly by design** — Vercel serverless functions can spin up hundreds of instances without exhausting Postgres connection slots, because the JS SDK never opens a direct connection.

**When Supavisor matters:**
- Phase 3 backfill script (`scripts/backfill-supabase.ts`) — if it uses a direct Postgres client for bulk inserts, route it through Supavisor's pooled connection string.
- Any future direct-connection use (analytics dashboards, migration runners).

---

## 9. Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Supabase downtime during dual-write | Fire-and-forget writes — Postgres failures don't affect badge serving |
| Data mismatch after backfill | Validation script compares Redis vs Postgres counts and latest values |
| Latency increase on reads (Phase 4) | Supabase JS SDK uses REST (no connection pool needed); region-match Vercel |
| Breaking existing tests | Phase 1 adds new tests; Phase 4 updates existing tests; no test goes unmocked |
| Accidental Redis data deletion | Phase 5 cleanup happens 1+ week after Phase 4 is stable |
| Rollback needed | Until Phase 5, Redis still has all data — revert imports to Redis-backed functions |

---

## 10. Rollback Procedures & Incident Response

### Phase-by-phase rollback

| Phase | Rollback action | Time estimate | Data at risk |
|-------|----------------|---------------|--------------|
| Phase 1 | Remove `@supabase/supabase-js`, delete `lib/db/*` files | 5 min | None — no production paths use Supabase |
| Phase 2 | Revert dual-write imports; Redis still has all data | 10 min | None — Redis is still the primary store |
| Phase 3 | No rollback needed — backfill is additive (Postgres data can be truncated) | 2 min | None |
| Phase 4 | Revert read imports back to Redis-backed functions | 15 min | None — Redis writes continued during Phase 4 |
| Phase 5 | **Cannot easily rollback** — Redis keys have been deleted. Restore from backup or re-backfill from Postgres to Redis | 30-60 min | Depends on backup freshness |

### Data validation checklist (run after each phase)

```bash
# Compare user counts
redis-cli KEYS "user:registered:*" | wc -l
# vs Supabase: SELECT count(*) FROM users;

# Compare snapshot counts for a sample handle
redis-cli ZCARD "history:juan294"
# vs Supabase: SELECT count(*) FROM metrics_snapshots WHERE handle = 'juan294';

# Compare latest snapshot values
redis-cli ZRANGE "history:juan294" -1 -1
# vs Supabase: SELECT * FROM metrics_snapshots WHERE handle = 'juan294' ORDER BY date DESC LIMIT 1;
```

### Incident response

1. **Identify the phase** — Which phase is currently active? This determines which store is primary for reads.
2. **Check Supabase status** — Visit `status.supabase.com` or run `pingSupabase()` via `/api/health`.
3. **Verify fail-open behavior** — In Phases 1-3, Supabase failures should be invisible to users (all Supabase calls are fire-and-forget or optional). If users are affected, the issue is elsewhere.
4. **Phase 4 read failures** — If Supabase reads fail in Phase 4, revert the import to the Redis-backed function. This is a single-line change per affected module.
5. **Revert the deployment** — Use `vercel rollback` or revert the PR commit on `main`.

---

## 11. What This Unlocks

Once complete, these become trivial to build:

- **Cross-user queries**: "Top 10 Builders this month" — `SELECT ... ORDER BY building DESC LIMIT 10`
- **Unbounded history**: Remove the 365-day cap, keep years of data at negligible cost
- **Admin analytics**: User growth over time, archetype distribution, tier breakdown — all SQL
- **Leaderboards**: Indexed queries on `adjusted_composite`, `archetype`, `tier`
- **Data export**: `pg_dump`, CSV export from Supabase dashboard, or API
- **Retention policies**: `DELETE WHERE date < now() - INTERVAL '2 years'` (if ever needed)

---

## 12. Migration Checklist

- [ ] **Phase 1:** Install `@supabase/supabase-js`, create client module, create tables, write data access layer + tests
- [ ] **Phase 2:** Add dual-write to `recordSnapshot`, `registerUser`, `storeVerificationRecord`; add verification cleanup to cron
- [ ] **Phase 3:** Run backfill script, validate data integrity
- [ ] **Phase 4:** Switch reads to Postgres, update tests, remove 365-snapshot cap
- [ ] **Phase 5:** Remove Redis writes for migrated data, clean up Redis keys, update `CLAUDE.md`

---

## Appendix: Files Changed by Phase

| Phase | New files | Modified files |
|-------|-----------|---------------|
| 1 | `lib/db/supabase.ts`, `lib/db/users.ts`, `lib/db/snapshots.ts`, `lib/db/verification.ts`, `lib/db/*.test.ts` | `package.json` |
| 2 | — | `lib/history/history.ts`, `lib/cache/redis.ts`, `lib/verification/store.ts`, `api/cron/warm-cache/route.ts` |
| 3 | `scripts/backfill-supabase.ts` | — |
| 4 | — | `lib/history/history.ts`, `lib/history/history.test.ts`, `lib/verification/store.ts`, `lib/verification/store.test.ts`, `api/admin/users/route.ts`, `api/admin/users/route.test.ts` |
| 5 | — | `lib/history/history.ts`, `lib/cache/redis.ts`, `lib/verification/store.ts`, `CLAUDE.md` |
