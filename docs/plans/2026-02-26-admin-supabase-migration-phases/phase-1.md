# Phase 1: DB Migration + View + Persist Profile Fields

## Goal
Add `display_name` and `avatar_url` to the `users` table, create a `latest_snapshots` PostgreSQL view, and update existing code to persist profile fields on login and badge render.

## Changes

### 1.1 New migration: `supabase/migrations/011_add_user_profile_fields.sql`

```sql
-- Add profile display fields to users table.
-- Updated on OAuth login and badge render so admin dashboard
-- always has the latest known profile data.

ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
```

### 1.2 New migration: `supabase/migrations/012_create_latest_snapshots_view.sql`

```sql
-- Materialized-style view using DISTINCT ON for efficient
-- "latest snapshot per user" queries. The existing index
-- idx_snapshots_handle_date (handle, date DESC) covers this.

CREATE OR REPLACE VIEW latest_snapshots AS
SELECT DISTINCT ON (handle)
  handle,
  date,
  captured_at,
  commits_total,
  prs_merged_count,
  reviews_submitted,
  issues_closed,
  repos_contributed,
  active_days,
  lines_added,
  lines_deleted,
  total_stars,
  total_forks,
  total_watchers,
  top_repo_share,
  building,
  guarding,
  consistency,
  breadth,
  archetype,
  profile_type,
  composite_score,
  adjusted_composite,
  confidence,
  tier
FROM metrics_snapshots
ORDER BY handle, date DESC;
```

Note: excludes `confidence_penalties`, `max_commits_in_10min`, `micro_commit_ratio`, `docs_only_pr_ratio`, `prs_merged_weight` — not needed by admin dashboard. Keeps the view lean.

### 1.3 Modify `apps/web/lib/db/users.ts` — update `dbUpsertUser()`

Add `displayName` and `avatarUrl` parameters. Update the upsert to always write profile fields when provided.

```pseudo
// Current signature:
dbUpsertUser(handle: string, email?: string): Promise<void>

// New signature:
dbUpsertUser(handle: string, opts?: {
  email?: string;
  displayName?: string;
  avatarUrl?: string;
}): Promise<void>

// Implementation:
const row: Record<string, string> = { handle: handle.toLowerCase() };
if (opts?.email) row.email = opts.email;
if (opts?.displayName !== undefined) row.display_name = opts.displayName;
if (opts?.avatarUrl !== undefined) row.avatar_url = opts.avatarUrl;

// Change ignoreDuplicates logic:
// If ANY field besides handle is provided, update existing row
const hasUpdateFields = opts?.email || opts?.displayName !== undefined || opts?.avatarUrl !== undefined;
await db.from("users").upsert(row, {
  onConflict: "handle",
  ignoreDuplicates: !hasUpdateFields,
});
```

### 1.4 Modify `apps/web/app/api/auth/callback/route.ts` — pass profile fields on login

Currently calls `dbUpsertUser(handle, email)`. Update to pass display name and avatar:

```pseudo
// Current (line ~101):
dbUpsertUser(login, primaryEmail ?? undefined);

// New:
dbUpsertUser(login, {
  email: primaryEmail ?? undefined,
  displayName: userData.name ?? null,
  avatarUrl: userData.avatar_url ?? null,
});
```

### 1.5 Modify `apps/web/app/u/[handle]/badge.svg/route.ts` — persist profile on badge render

In the `after()` hook where snapshots are recorded, also update user profile:

```pseudo
// In the after() callback, after dbInsertSnapshot:
if (stats.displayName || stats.avatarUrl) {
  dbUpsertUser(handle, {
    displayName: stats.displayName ?? undefined,
    avatarUrl: stats.avatarUrl ?? undefined,
  });
}
```

This is fire-and-forget (no await needed for the response).

### 1.6 Update `dbGetUsers()` return type

Add optional `displayName` and `avatarUrl` to the query and return type:

```pseudo
// Current query: .select("handle, registered_at")
// New query: .select("handle, registered_at, display_name, avatar_url")

// Current return: { handle: string; registeredAt: string }[]
// New return: { handle: string; registeredAt: string; displayName: string | null; avatarUrl: string | null }[]
```

## Tests

### `apps/web/lib/db/users.test.ts` — add/update tests:
1. `dbUpsertUser` with displayName and avatarUrl — verify row contains `display_name`, `avatar_url`
2. `dbUpsertUser` with only email (backwards compat) — verify no `display_name` field in row
3. `dbUpsertUser` with displayName=null — verify `display_name: null` is set (explicit null clears)
4. `dbGetUsers` returns displayName and avatarUrl fields
5. `dbGetUsers` handles null displayName/avatarUrl gracefully

### Existing tests to update:
6. Any test calling `dbUpsertUser(handle, email)` — update to new signature `dbUpsertUser(handle, { email })`
7. `route.test.ts` for auth callback — verify profile fields passed
8. Badge route test — verify `dbUpsertUser` called in `after()` with profile fields

## Success Criteria

### Automated
- [x] `pnpm run test` — all existing + new tests pass (3936/3936)
- [x] `pnpm run typecheck` — no type errors
- [x] `pnpm run lint` — clean
- [x] Migration SQL is syntactically valid

### Manual
- [ ] Run migration against Supabase (via dashboard or CLI)
- [ ] Verify `latest_snapshots` view returns data: `SELECT * FROM latest_snapshots LIMIT 5`
- [ ] Verify `users` table has new columns: `SELECT handle, display_name, avatar_url FROM users LIMIT 5`
