# Phase 2: New `dbGetAdminUsers()` Function

## Goal
Create a new Supabase query function that returns paginated, sorted, filtered admin user data by joining the `users` table with the `latest_snapshots` view. This replaces the Redis MGET approach.

## Changes

### 2.1 New file: `apps/web/lib/db/admin-users.ts`

Dedicated data access module for admin dashboard queries. Separating from `users.ts` because admin queries have different complexity (joins, sorting, filtering) and different consumers.

```pseudo
// Types
interface AdminUserRow {
  // From users table
  handle: string;
  registered_at: string;
  display_name: string | null;
  avatar_url: string | null;
  // From latest_snapshots view (all nullable — user may have no snapshot)
  snapshot_date: string | null;
  captured_at: string | null;
  commits_total: number | null;
  prs_merged_count: number | null;
  reviews_submitted: number | null;
  repos_contributed: number | null;
  active_days: number | null;
  total_stars: number | null;
  archetype: string | null;
  tier: string | null;
  adjusted_composite: number | null;
  composite_score: number | null;
  confidence: number | null;
  building: number | null;
  guarding: number | null;
  consistency_score: number | null;  // aliased to avoid keyword collision
  breadth: number | null;
}

interface AdminUserQuery {
  page: number;         // 1-based
  limit: number;        // items per page (default 25, max 100)
  sort: AdminSortField; // column to sort by
  dir: "asc" | "desc";
  search?: string;      // substring match on handle or display_name
  tier?: string;        // filter by tier
  archetype?: string;   // filter by archetype
}

interface AdminUserResult {
  users: AdminUserEntry[];
  total: number;        // total matching rows (for pagination UI)
  page: number;
  limit: number;
  totalPages: number;
}

// Allowed sort fields mapped to DB columns
const SORT_COLUMN_MAP: Record<AdminSortField, string> = {
  handle: "users.handle",
  adjustedComposite: "latest_snapshots.adjusted_composite",
  rawScore: "latest_snapshots.composite_score",
  confidence: "latest_snapshots.confidence",
  commitsTotal: "latest_snapshots.commits_total",
  prsMergedCount: "latest_snapshots.prs_merged_count",
  reviewsSubmittedCount: "latest_snapshots.reviews_submitted",
  activeDays: "latest_snapshots.active_days",
  totalStars: "latest_snapshots.total_stars",
  tier: "latest_snapshots.tier",
  archetype: "latest_snapshots.archetype",
  registeredAt: "users.registered_at",
  lastSnapshotDate: "latest_snapshots.date",
};
```

### 2.2 Implementation: `dbGetAdminUsers(query)`

The Supabase JS SDK doesn't natively support JOINs, so we use `.rpc()` with a PostgreSQL function, or we use two queries. Given the project's pattern of avoiding RPC calls, I'll use a **PostgreSQL view that pre-joins the data**:

**Updated migration (extend `012_create_latest_snapshots_view.sql`):**

Actually, the cleaner approach is a second view that joins users + latest snapshots:

**New migration: `supabase/migrations/013_create_admin_users_view.sql`**

```sql
-- Admin dashboard view: users LEFT JOIN their latest snapshot.
-- Users without any snapshot still appear (LEFT JOIN).
-- Sortable and filterable via Supabase SDK.

CREATE OR REPLACE VIEW admin_users AS
SELECT
  u.handle,
  u.registered_at,
  u.display_name,
  u.avatar_url,
  ls.date          AS snapshot_date,
  ls.captured_at   AS snapshot_captured_at,
  ls.commits_total,
  ls.prs_merged_count,
  ls.reviews_submitted,
  ls.repos_contributed,
  ls.active_days,
  ls.total_stars,
  ls.archetype,
  ls.tier,
  ls.adjusted_composite,
  ls.composite_score,
  ls.confidence,
  ls.building,
  ls.guarding,
  ls.consistency   AS consistency_score,
  ls.breadth
FROM users u
LEFT JOIN latest_snapshots ls ON ls.handle = u.handle;
```

This view can be queried directly with the Supabase SDK — `.from("admin_users").select(...)` with all normal filters, ordering, and pagination.

### 2.3 Function: `dbGetAdminUsers(query)`

```pseudo
export async function dbGetAdminUsers(
  query: AdminUserQuery
): Promise<AdminUserResult> {
  const db = getSupabase();
  if (!db) return { users: [], total: 0, page: 1, limit: 25, totalPages: 0 };

  // Clamp inputs
  const page = Math.max(1, query.page);
  const limit = Math.min(Math.max(1, query.limit), 100);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  try {
    // Build query on admin_users view
    let q = db
      .from("admin_users")
      .select("*", { count: "exact" });  // count: "exact" returns total rows

    // Search filter: ILIKE on handle or display_name
    if (query.search?.trim()) {
      const term = `%${query.search.trim()}%`;
      q = q.or(`handle.ilike.${term},display_name.ilike.${term}`);
    }

    // Tier filter
    if (query.tier) {
      q = q.eq("tier", query.tier);
    }

    // Archetype filter
    if (query.archetype) {
      q = q.eq("archetype", query.archetype);
    }

    // Sorting — nulls last for snapshot columns
    const sortCol = mapSortField(query.sort);
    q = q.order(sortCol, {
      ascending: query.dir === "asc",
      nullsFirst: false,  // Users without snapshots sort to bottom
    });

    // Pagination
    q = q.range(from, to);

    const { data, error, count } = await q;
    if (error) throw error;

    const total = count ?? 0;
    const rows = parseRows<AdminUserRow>(data, ADMIN_REQUIRED_KEYS, "admin_users");

    return {
      users: rows.map(rowToAdminUser),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  } catch (error) {
    console.error("[db] dbGetAdminUsers failed:", (error as Error).message);
    return { users: [], total: 0, page, limit, totalPages: 0 };
  }
}
```

### 2.4 Row-to-type mapper: `rowToAdminUser()`

```pseudo
function rowToAdminUser(row: AdminUserRow): AdminUserEntry {
  return {
    handle: row.handle,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    registeredAt: row.registered_at,
    lastSnapshotDate: row.snapshot_date,
    fetchedAt: row.captured_at,
    commitsTotal: row.commits_total,
    prsMergedCount: row.prs_merged_count,
    reviewsSubmittedCount: row.reviews_submitted,
    activeDays: row.active_days,
    reposContributed: row.repos_contributed,
    totalStars: row.total_stars,
    archetype: row.archetype,
    tier: row.tier,
    adjustedComposite: row.adjusted_composite,
    rawScore: row.composite_score,
    confidence: row.confidence,
  };
}
```

## Tests

### `apps/web/lib/db/admin-users.test.ts` — new test file:

Follow the Supabase chain mock pattern from `snapshots.test.ts`.

1. **Returns paginated users** — verify `.range(from, to)` called with correct offsets
2. **Returns total count** — verify `{ count: "exact" }` passed to `.select()`
3. **Sorts by adjusted_composite desc** (default) — verify `.order()` args
4. **Sorts by handle asc** — verify sort column mapping
5. **Sorts with nullsFirst: false** — users without snapshots at bottom
6. **Search filters with ILIKE** — verify `.or()` called with handle + display_name pattern
7. **Tier filter** — verify `.eq("tier", "Elite")` called
8. **Archetype filter** — verify `.eq("archetype", "Builder")` called
9. **Clamps page to minimum 1** — page=0 becomes page=1
10. **Clamps limit to maximum 100** — limit=500 becomes limit=100
11. **Returns empty result when DB unavailable** — `getSupabase()` returns null
12. **Returns empty result on query error** — fail-open pattern

## Success Criteria

### Automated
- [x] All 16 new tests pass (exceeded plan's 12 — added percent-escape, whitespace-search, field-mapping, and row-mapping tests)
- [x] `pnpm run typecheck` — no type errors
- [x] `pnpm run lint` — clean
- [x] Migration SQL is valid

### Manual
- [ ] Run migration `013` against Supabase
- [ ] Verify `admin_users` view returns joined data: `SELECT * FROM admin_users LIMIT 5`
- [ ] Verify users without snapshots appear with null snapshot fields
