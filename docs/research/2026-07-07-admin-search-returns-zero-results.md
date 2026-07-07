# Research: Admin dashboard search returns 0 results for existing users

**Date:** 2026-07-07
**Reported symptom:** Searching the admin users table (`/admin`) for `ganga90` returns "0 results" / "No users match your search", even though `ganga90` is visibly present in the unfiltered table (archetype "Emerging", tier "Emerging", score 24, 3,074 commits, 106 active days).

## Request flow (client → server)

1. **Search input** — `apps/web/app/admin/AdminSearchBar.tsx:11-32` is a controlled `<input>` that calls `onSearchChange(e.target.value)` on every keystroke; it has no filtering logic of its own — it's a pure display/input component.
2. **State + debounce** — `apps/web/app/admin/useAdminDashboard.ts:54-55` holds the raw `search` string in state and derives `deferredSearch` via `useDebouncedValue(search, SEARCH_DEBOUNCE_MS)` (400ms debounce, `useAdminDashboard.ts:8`).
3. **Fetch** — `fetchUsers` (`useAdminDashboard.ts:66-100`) builds query params and, if `deferredSearch.trim()` is non-empty, sets `params.set("search", deferredSearch.trim())` (`useAdminDashboard.ts:76-78`), then calls `GET /api/admin/users?...&search=...`. Filtering/sorting/pagination all happen server-side — the client never filters the `users` array locally, and `resultCount` shown in `AdminSearchBar` (`AdminDashboardClient.tsx`, wired via `total`) reflects the server's count, not a client-side computation.
4. **API route** — `apps/web/app/api/admin/users/route.ts:44` reads `search` from the query string and passes it straight through to `dbGetAdminUsers({ page, limit, sort, dir, search, tier, archetype })` (`route.ts:66`). No transformation happens here — case, whitespace, and value are passed unmodified (trimming already happened client-side in step 3).
5. **DB query** — `apps/web/lib/db/admin-users.ts:193-258` (`dbGetAdminUsers`) is where the filter is actually applied, against the Supabase `admin_users` view.

## The filter predicate (root cause)

`apps/web/lib/db/admin-users.ts:212-215`:

```ts
if (query.search?.trim()) {
  const term = escapeIlike(query.search.trim());
  q = q.ilike("handle", `%${term}%`).ilike("display_name", `%${term}%`);
}
```

Two `.ilike()` calls are chained on the same Supabase/PostgREST query builder (`q`). Each additional builder call **adds another filter condition**, and PostgREST combines multiple chained filter calls with **AND**, not OR. So this line requires, simultaneously:

- `handle ILIKE '%ganga90%'` **AND**
- `display_name ILIKE '%ganga90%'`

For a row to match the search, both the `handle` and the `display_name` columns must contain the search term. `display_name` is a separate, nullable column on `users` (`supabase/migrations/013_create_admin_users_view.sql:9`, `SELECT ... u.display_name ...`) that stores a person's real display name (e.g., "Juan Gonzalez"), not their GitHub handle. For a user like `ganga90` whose `display_name` is null or is a real name that doesn't literally contain the substring "ganga90", the `display_name ILIKE '%ganga90%'` condition is false, and in SQL `NULL ILIKE anything` and non-matching-string `ILIKE` both evaluate to not-true — so the AND-combined row is excluded entirely from the result set, even though the `handle` condition alone would have matched.

This reproduces the exact symptom: the row is visibly present in the unfiltered/full table (screenshot 2, where `ganga90` appears with archetype "Emerging"), but is filtered out entirely as soon as any search term is typed that doesn't also happen to appear in the `display_name` field — the two screenshots show `0 results` for the search vs. the same row present when scrolling the unfiltered table.

## History of the predicate — how it regressed

`git log -S'.ilike("handle"' -- apps/web/lib/db/admin-users.ts` isolates a single commit:

```
8b882cd8 fix: [remediate] admin user search uses ILIKE for case-insensitive filtering (BE-H5)
```

Diff (`git show 8b882cd8`):

```diff
-    // Search filter: ILIKE on handle or display_name
+    // Search filter: ILIKE on handle and display_name.
+    // Uses chained .ilike() builder calls (parameterized) instead of raw
+    // .or() string interpolation to prevent SQL wildcard abuse (_ and %)
+    // and PostgREST delimiter injection (, . ( )).
     if (query.search?.trim()) {
-      const term = query.search.trim().replace(/%/g, "\\%");
-      q = q.or(`handle.ilike.%${term}%,display_name.ilike.%${term}%`);
+      const term = escapeIlike(query.search.trim());
+      q = q.ilike("handle", `%${term}%`).ilike("display_name", `%${term}%`);
     }
```

Before this commit, the filter used a single `.or("handle.ilike.%term%,display_name.ilike.%term%")` call — a raw PostgREST filter-string with comma-separated OR conditions, which correctly matched on handle **or** display name. This commit (labeled `BE-H5`, a security remediation) replaced the raw `.or()` string-interpolation with parameterized `escapeIlike()` + chained `.ilike()` calls specifically to prevent PostgREST predicate injection via unescaped commas/parens/wildcards in the search term (see `escapeIlike` doc comment, `admin-users.ts:156-174`). The security motivation (avoiding string interpolation into an `.or()` filter expression) was addressed, but the two chained `.ilike()` calls changed the boolean combination from OR to AND as a side effect — the commit message itself ("uses ILIKE for case-insensitive filtering") does not mention this semantic change, suggesting it was not the intended effect.

## Why existing tests didn't catch it

`apps/web/lib/db/admin-users.test.ts:14-40` mocks the Supabase query builder with a `chainBuilder()` stub: each of `.select/.or/.ilike/.eq/.order/.range` just records its call arguments (via `mockIlike`, `mockOr`, etc.) and returns the same `chain` object for further chaining — it does not simulate real PostgREST/Postgres filter-combination semantics (AND vs. OR) against any actual row data.

The relevant test, `admin-users.test.ts:179` (`"applies search filter with ILIKE on handle and display_name"`), and the three `BE-H5`-labeled tests at lines 188, 198, 207 all assert that `mockIlike` (or `mockOr`, pre-fix) was called with the expected escaped arguments — they verify *what filter calls were made*, not *what rows the combined filter would actually return*. This class of mock verifies call shape, not query-result correctness, so a call-order/combinator change (OR → AND) that preserves the same individual `.ilike()` arguments is invisible to it.

## Files involved

| File | Role |
|---|---|
| `apps/web/app/admin/AdminSearchBar.tsx` | Search input UI (no filtering logic) |
| `apps/web/app/admin/useAdminDashboard.ts` | Client state, 400ms debounce (`useDebouncedValue`), builds `search` query param |
| `apps/web/app/api/admin/users/route.ts` | API route — passes `search` param through to `dbGetAdminUsers` unchanged |
| `apps/web/lib/db/admin-users.ts` | `dbGetAdminUsers` — builds and executes the Supabase query; contains the AND-chained `.ilike()` filter (lines 212-215) and `escapeIlike()` sanitizer (lines 156-174) |
| `supabase/migrations/013_create_admin_users_view.sql` | Defines the `admin_users` view (`handle`, `display_name` as separate, independently-nullable columns from `users`) |
| `apps/web/lib/db/admin-users.test.ts` | Unit tests — mock-based, assert on filter-call arguments only; do not exercise real AND/OR combinator semantics |
