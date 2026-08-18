import { describe, it, expect, vi } from "vitest";
import { fetchAllPages, SUPABASE_MAX_ROWS } from "./paginate";

/** Build a fetchPage function backed by an in-memory array, mimicking Supabase's inclusive .range(). */
function makeFetcher<T>(rows: T[]) {
  return vi.fn((from: number, to: number) => {
    return Promise.resolve({ data: rows.slice(from, to + 1), error: null });
  });
}

describe("fetchAllPages", () => {
  it("returns every row past a single page's worth (regression for #1079 1000-row truncation)", async () => {
    const rows = Array.from({ length: 2500 }, (_, i) => ({ id: i }));
    const fetchPage = makeFetcher(rows);

    const result = await fetchAllPages(fetchPage, 1000);

    expect(result).toHaveLength(2500);
    expect(result).toEqual(rows);
  });

  it("calls fetchPage with correct inclusive, zero-based range bounds per page", async () => {
    const rows = Array.from({ length: 2500 }, (_, i) => ({ id: i }));
    const fetchPage = makeFetcher(rows);

    await fetchAllPages(fetchPage, 1000);

    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(fetchPage).toHaveBeenNthCalledWith(1, 0, 999);
    expect(fetchPage).toHaveBeenNthCalledWith(2, 1000, 1999);
    expect(fetchPage).toHaveBeenNthCalledWith(3, 2000, 2999);
  });

  it("stops after a single page when fewer rows than pageSize are returned", async () => {
    const rows = Array.from({ length: 42 }, (_, i) => ({ id: i }));
    const fetchPage = makeFetcher(rows);

    const result = await fetchAllPages(fetchPage, 1000);

    expect(result).toHaveLength(42);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it("returns an empty array when the first page is empty", async () => {
    const fetchPage = makeFetcher<{ id: number }>([]);

    const result = await fetchAllPages(fetchPage, 1000);

    expect(result).toEqual([]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it("issues one extra empty-page call when total rows are an exact multiple of pageSize", async () => {
    const rows = Array.from({ length: 1000 }, (_, i) => ({ id: i }));
    const fetchPage = makeFetcher(rows);

    const result = await fetchAllPages(fetchPage, 1000);

    expect(result).toHaveLength(1000);
    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(fetchPage).toHaveBeenNthCalledWith(2, 1000, 1999);
  });

  it("treats null data as an empty page instead of throwing", async () => {
    const fetchPage = vi.fn().mockResolvedValue({ data: null, error: null });

    const result = await fetchAllPages(fetchPage, 1000);

    expect(result).toEqual([]);
  });

  it("propagates the page error and stops paging", async () => {
    const err = new Error("query failed");
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({ data: [{ id: 1 }], error: null })
      .mockResolvedValueOnce({ data: null, error: err });

    await expect(fetchAllPages(fetchPage, 1)).rejects.toBe(err);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it("defaults pageSize to SUPABASE_MAX_ROWS (matches supabase/config.toml max_rows)", async () => {
    const fetchPage = makeFetcher<{ id: number }>([]);

    await fetchAllPages(fetchPage);

    expect(fetchPage).toHaveBeenCalledWith(0, SUPABASE_MAX_ROWS - 1);
  });
});
