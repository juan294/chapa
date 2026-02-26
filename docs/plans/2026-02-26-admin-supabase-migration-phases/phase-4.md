# Phase 4: Update Admin Client — Pagination + Server-Side Sort/Filter

## Goal
Update the admin dashboard frontend to use the new paginated API. Move sorting and filtering from client-side to server-side. Add pagination controls. Remove the "data expired" concept.

## Changes

### 4.1 Update `apps/web/app/admin/admin-types.ts`

```pseudo
// REMOVE:
- statsExpired from AdminUser interface

// ADD:
- registeredAt: string
- lastSnapshotDate: string | null  // null = "never generated a badge"

// KEEP unchanged:
- SortField type (same fields, server now handles sorting)
- SortDir type
- tierBadgeClasses(), formatDate(), TIER_ORDER, ARCHETYPE_COLOR, TIER_COLOR

// REMOVE:
- sortUsers() function — sorting is now server-side

// ADD:
- Pagination response type:
  interface PaginatedResponse {
    users: AdminUser[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }
```

### 4.2 Rewrite `apps/web/app/admin/useAdminDashboard.ts`

Major changes: sorting and filtering become API parameters instead of client-side computation.

```pseudo
// State changes:
- REMOVE: filtered (useMemo) — server handles filtering
- REMOVE: sorted (useMemo) — server handles sorting
- ADD: page: number (default 1)
- ADD: total: number (from API response)
- ADD: totalPages: number (from API response)
- ADD: limit: number (default 25)

// fetchUsers becomes parameterized:
const fetchUsers = useCallback(async (opts?: { isRefresh?: boolean }) => {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    sort: sortField,
    dir: sortDir,
    ...(deferredSearch && { search: deferredSearch }),
  });

  const res = await fetch(`/api/admin/users?${params}`);
  const data: PaginatedResponse = await res.json();

  setUsers(data.users);
  setTotal(data.total);
  setTotalPages(data.totalPages);
}, [page, limit, sortField, sortDir, deferredSearch]);

// Re-fetch when sort/filter/page changes:
useEffect(() => {
  fetchUsers();
}, [fetchUsers]);

// Search resets to page 1:
const handleSearchChange = (value: string) => {
  setSearch(value);
  setPage(1);  // Reset to first page on new search
};

// Sort resets to page 1:
const handleSort = (field: SortField) => {
  if (field === sortField) {
    setSortDir(d => d === "asc" ? "desc" : "asc");
  } else {
    setSortField(field);
    setSortDir("desc");
  }
  setPage(1);  // Reset to first page on new sort
};

// Tier counts now computed from current page only
// OR: add a separate lightweight endpoint for global counts
// Decision: compute from current page — admin sees the page they're on
// For global counts, we can add a summary endpoint later

// Expose:
return {
  ...existing,
  page, setPage,
  total, totalPages, limit,
  users,  // Already sorted/filtered by server
  handleSearchChange,
  handleSort,
};
```

### 4.3 Update `apps/web/app/admin/AdminDashboardClient.tsx`

```pseudo
// Changes:
- Remove reference to state.filtered — use state.users directly
- Remove reference to state.sorted — use state.users directly
- Add pagination controls below the table
- Update user count display: show "Showing X–Y of Z users"
- Update search result count: use state.total instead of filtered.length

// Add pagination UI:
<div className="flex items-center justify-between border-t border-stroke px-4 py-3">
  <span className="text-xs text-text-secondary">
    Showing {((page-1)*limit)+1}–{Math.min(page*limit, total)} of {total}
  </span>
  <div className="flex gap-2">
    <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
      Previous
    </button>
    <span className="text-sm text-text-secondary">
      {page} / {totalPages}
    </span>
    <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
      Next
    </button>
  </div>
</div>
```

### 4.4 Update `apps/web/app/admin/AdminUserTable.tsx`

```pseudo
// Changes:
- Remove statsExpired conditional (opacity-60 class, "data expired" label)
- Add lastSnapshotDate display: show "no data yet" in text-text-secondary if null
- Keep all other columns unchanged

// Replace expired user styling:
// Before:
className={`... ${user.statsExpired ? "opacity-60" : ""}`}
// After:
className={`... ${user.lastSnapshotDate === null ? "opacity-60" : ""}`}

// Replace "data expired" label:
// Before:
{user.statsExpired ? <p className="text-terminal-yellow">data expired</p> : ...}
// After:
{user.lastSnapshotDate === null ? <p className="text-text-secondary">no data yet</p> : ...}
```

### 4.5 Update `apps/web/app/admin/AdminStatsCards.tsx`

```pseudo
// tierCounts now comes from the hook, computed from current page users.
// This is acceptable — admin sees tier distribution for their current view.
// A future enhancement could add a global summary endpoint.

// No structural changes needed — props interface stays the same.
```

### 4.6 Update `apps/web/app/admin/AdminSearchBar.tsx`

```pseudo
// Changes:
- resultCount now reflects server-side total (not client-side filtered count)
- No structural changes needed
- onSearchChange prop still works (hook handles the debounce + API call)
```

## Tests

### `apps/web/app/admin/useAdminDashboard.test.ts` — rewrite:

1. **Fetches with default params on mount** — page=1, limit=25, sort=adjustedComposite, dir=desc
2. **Re-fetches when sort changes** — verify new fetch with updated sort param
3. **Re-fetches when search changes** — verify new fetch with search param after debounce
4. **Resets to page 1 on search change** — page was 3, search typed, page becomes 1
5. **Resets to page 1 on sort change** — page was 2, sort clicked, page becomes 1
6. **Increments page** — setPage(2) triggers new fetch with page=2
7. **Decrements page** — setPage(1) triggers new fetch
8. **Stores total and totalPages from response** — verify state update
9. **Handles fetch error** — sets error state, clears users
10. **Manual refresh re-fetches current page** — fetchUsers({ isRefresh: true })
11. **Tab switching** — activeTab changes
12. **Tier counts computed from current page users** — verify aggregation

### `apps/web/app/admin/AdminUserTable.test.ts` — update:

13. **No statsExpired references** — verify removed from source
14. **Shows "no data yet" for null lastSnapshotDate** — verify label
15. **Applies opacity-60 for null lastSnapshotDate users** — verify class
16. **No opacity-60 for users with lastSnapshotDate** — verify absent

### `apps/web/app/admin/admin-types.test.ts` — update:

17. **sortUsers removed** — verify function no longer exported
18. **AdminUser has registeredAt** — verify type
19. **AdminUser has lastSnapshotDate** — verify type
20. **AdminUser does NOT have statsExpired** — verify removed

## Success Criteria

### Automated
- [x] All 3950 tests pass (including updated admin tests)
- [x] `pnpm run typecheck` — no type errors
- [x] `pnpm run lint` — clean
- [x] No references to `statsExpired` remain in admin components
- [x] No client-side `sortUsers()` calls remain

### Manual
- [ ] Open `/admin` in browser — table loads with pagination
- [ ] Click "Next" / "Previous" — pages change, data updates
- [ ] Click column headers — server-side sorting works
- [ ] Type in search — server-side filtering works, page resets to 1
- [ ] Users without snapshots show "no data yet" (not "data expired")
- [ ] Verify no "data expired" text appears anywhere
