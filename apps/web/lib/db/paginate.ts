/**
 * Pagination helper for Supabase selects.
 *
 * PostgREST enforces `max_rows = 1000` (supabase/config.toml:18) on every
 * request — a select with no `.range()` silently truncates at that cap
 * instead of erroring. Any accessor that must return *every* matching row
 * (not just a UI page) has to page through results explicitly with
 * `.range()` and keep going until a page comes back short of `pageSize`.
 * See #1079.
 */

/** Matches PostgREST's `max_rows` in supabase/config.toml. */
export const SUPABASE_MAX_ROWS = 1000;

export interface PageResult<T> {
  data: T[] | null;
  error: unknown;
}

/**
 * Repeatedly calls `fetchPage(from, to)` with inclusive, zero-based bounds
 * (matching Supabase's `.range()` semantics), accumulating rows across pages
 * until a page returns fewer than `pageSize` rows — the signal that the
 * table is exhausted. Throws the first page's error immediately so callers
 * can fail open the same way a single unpaginated select would.
 *
 * @param fetchPage - Issues one `.range(from, to)` select and resolves with
 *   its `{ data, error }`. Typed as `PromiseLike` (not `Promise`) so a
 *   Supabase `PostgrestFilterBuilder` — thenable, but missing `catch`/
 *   `finally` — can be returned directly without an extra wrapper.
 * @param pageSize - Rows requested per page. Defaults to `SUPABASE_MAX_ROWS`
 *   so a caller never has to remember the PostgREST cap.
 */
export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
  pageSize: number = SUPABASE_MAX_ROWS,
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;

  for (;;) {
    const to = from + pageSize - 1;
    const { data, error } = await fetchPage(from, to);
    if (error) throw error;

    const page = data ?? [];
    all.push(...page);

    if (page.length < pageSize) break;
    from += pageSize;
  }

  return all;
}
