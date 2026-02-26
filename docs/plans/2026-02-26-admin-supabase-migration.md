# Plan: Admin Dashboard — Migrate Data Layer from Redis to Supabase

> Date: 2026-02-26
> Research: `docs/research/2026-02-26-admin-data-layer.md`
> Status: Draft — awaiting approval

---

## Problem

The admin dashboard loads user display data from Redis cache (`stats:v2:*` and `stats:stale:*`). When both cache layers expire (after 7 days with no activity), users show as "data expired" with no score, tier, archetype, or stats. This makes the admin dashboard unreliable as an operational tool and prevents future features that depend on complete user data (trends, notifications for all users, filtering by tier/archetype).

## Goal

Replace the Redis-dependent admin data layer with Supabase as the primary source. Every registered user always shows their **last known data**. Add server-side pagination, sorting, and filtering to handle growth. Fix cron to cover all users.

## Scope

### In scope
1. New Supabase migration: add `display_name`, `avatar_url` to `users` table
2. New PostgreSQL view: `latest_snapshots` using `DISTINCT ON` for efficient latest-per-user queries
3. New DB function: `dbGetAdminUsers()` — paginated, sorted, filtered query joining `users` + `latest_snapshots`
4. Rewrite `GET /api/admin/users` to use Supabase instead of Redis MGET
5. Update admin client: server-side pagination, delegate sort/filter to API
6. Update `AdminUser` type: remove `statsExpired`, add `registeredAt`, `lastSnapshotDate`
7. Persist `display_name` + `avatar_url` on login and badge render
8. Fix cron rotation to process all users, not just first 50

### Out of scope
- Per-platform data provenance (confirmed not needed)
- Admin write operations (edit/delete users)
- New admin features (trend charts, user detail pages)

## Architecture

### Current flow
```
Client → GET /api/admin/users
  → dbGetUsers() [Supabase: handle list only]
  → cacheMGet(stats:v2:*, stats:stale:*) [Redis: display data]
  → computeImpactV4(stats) [recompute on every request]
  → return all users, no pagination
```

### New flow
```
Client → GET /api/admin/users?page=1&limit=25&sort=adjustedComposite&dir=desc&search=juan
  → dbGetAdminUsers({ page, limit, sort, dir, search }) [Supabase: everything]
  → return paginated users + total count
```

### Key changes
- **No more Redis dependency** for admin data — Supabase is the source of truth
- **No more `computeImpactV4()` on every admin request** — snapshots already store computed scores
- **Server-side pagination** — API returns one page at a time
- **Server-side sort/filter** — PostgreSQL handles ordering and text search
- **`statsExpired` replaced by `lastSnapshotDate`** — null means "never generated a badge", not "cache expired"

## Phases

| Phase | Description | Files changed | Estimated tests |
|-------|-------------|---------------|-----------------|
| 1 | DB migration + view + persist profile fields | 4 new, 3 modified | 8 |
| 2 | New `dbGetAdminUsers()` function | 1 new function in existing file | 12 |
| 3 | Rewrite admin API route | 1 modified | 15 |
| 4 | Update admin client (pagination, server-side sort/filter) | 5 modified | 20 |
| 5 | Cron rotation for all users | 1 modified | 6 |

**Total estimated: ~61 tests across 5 phases**

## Risks

| Risk | Mitigation |
|------|-----------|
| `DISTINCT ON` view performance at scale | Existing `(handle, date DESC)` index covers it. Monitor with `EXPLAIN ANALYZE` if user count exceeds 1000. |
| Supabase unavailable → admin dashboard blank | Fail-open: return empty list with error message (matches existing pattern). |
| Profile fields stale (user changes GitHub avatar) | Updated on every login + badge render. Acceptable staleness. |
| Cron rotation offset lost (Redis flush) | Offset defaults to 0 on miss — restarts from beginning. No data loss, just temporary re-processing. |

## Dependencies

- Supabase dashboard access for running migration (or Supabase CLI)
- No new environment variables needed
- No new dependencies needed
