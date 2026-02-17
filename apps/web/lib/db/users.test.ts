import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock Supabase client — tracks arguments for every chain method
// ---------------------------------------------------------------------------

const mockUpsert = vi.fn();
const mockSelect = vi.fn();
const mockOrder = vi.fn();
const mockRange = vi.fn();

let listResolve: { data: unknown; error: unknown };
let countResolve: { count: unknown; error: unknown };

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
const mockFrom = vi.fn((_table: string): any => ({
  upsert: mockUpsert,
  select: (...args: unknown[]) => {
    mockSelect(...args);
    // Head count query (.select("*", { count: "exact", head: true }))
    if (args.length === 2 && (args[1] as any)?.head === true) {
      return Promise.resolve(countResolve);
    }
    // List query (.select("handle, registered_at"))
    return {
      order: (...orderArgs: unknown[]) => {
        mockOrder(...orderArgs);
        return {
          range: (...rangeArgs: unknown[]) => {
            mockRange(...rangeArgs);
            return Promise.resolve(listResolve);
          },
          then: (
            resolve: (v: unknown) => void,
            reject: (e: unknown) => void,
          ) => {
            if (listResolve.error) reject(listResolve.error);
            else resolve(listResolve);
          },
        };
      },
    };
  },
}));

vi.mock("./supabase", () => ({
  getSupabase: vi.fn(() => ({ from: mockFrom })),
}));

import { getSupabase } from "./supabase";
import { dbUpsertUser, dbGetUsers, dbGetUserCount } from "./users";

beforeEach(() => {
  vi.clearAllMocks();
  listResolve = { data: [], error: null };
  countResolve = { count: 0, error: null };
});

// ---------------------------------------------------------------------------
// dbUpsertUser
// ---------------------------------------------------------------------------

describe("dbUpsertUser", () => {
  it("upserts user with lowercase handle", async () => {
    mockUpsert.mockResolvedValue({ error: null });

    await dbUpsertUser("TestUser");

    expect(mockFrom).toHaveBeenCalledWith("users");
    expect(mockUpsert).toHaveBeenCalledWith(
      { handle: "testuser" },
      { onConflict: "handle", ignoreDuplicates: true },
    );
  });

  it("does not throw when upsert fails", async () => {
    mockUpsert.mockRejectedValue(new Error("DB down"));

    await expect(dbUpsertUser("testuser")).resolves.toBeUndefined();
  });

  it("returns void when DB is unavailable", async () => {
    vi.mocked(getSupabase).mockReturnValueOnce(null);

    await expect(dbUpsertUser("testuser")).resolves.toBeUndefined();
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// dbGetUsers
// ---------------------------------------------------------------------------

describe("dbGetUsers", () => {
  it("returns mapped user rows ordered by registered_at desc", async () => {
    const rows = [
      { handle: "alice", registered_at: "2025-06-15T10:00:00Z" },
      { handle: "bob", registered_at: "2025-06-14T10:00:00Z" },
    ];

    listResolve = { data: rows, error: null };

    const result = await dbGetUsers();

    expect(result).toEqual([
      { handle: "alice", registeredAt: "2025-06-15T10:00:00Z" },
      { handle: "bob", registeredAt: "2025-06-14T10:00:00Z" },
    ]);
    expect(mockSelect).toHaveBeenCalledWith("handle, registered_at");
    expect(mockOrder).toHaveBeenCalledWith("registered_at", {
      ascending: false,
    });
  });

  it("returns empty array when DB is unavailable", async () => {
    vi.mocked(getSupabase).mockReturnValueOnce(null);

    const result = await dbGetUsers();
    expect(result).toEqual([]);
  });

  it("returns empty array on query error", async () => {
    listResolve = { data: null, error: new Error("query failed") };

    const result = await dbGetUsers();
    expect(result).toEqual([]);
  });

  it("applies limit and offset via .range() when provided", async () => {
    listResolve = {
      data: [{ handle: "alice", registered_at: "2025-06-15T10:00:00Z" }],
      error: null,
    };

    await dbGetUsers({ limit: 10, offset: 20 });

    expect(mockRange).toHaveBeenCalledWith(20, 29); // range is inclusive
  });

  it("applies limit with default offset 0 when only limit provided", async () => {
    listResolve = { data: [], error: null };

    await dbGetUsers({ limit: 10 });

    expect(mockRange).toHaveBeenCalledWith(0, 9);
  });

  it("returns all rows when no options provided (backward compat)", async () => {
    listResolve = { data: [], error: null };

    await dbGetUsers();

    expect(mockRange).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// dbGetUserCount
// ---------------------------------------------------------------------------

describe("dbGetUserCount", () => {
  it("returns the count from a head query", async () => {
    countResolve = { count: 42, error: null };

    const result = await dbGetUserCount();
    expect(result).toBe(42);
    expect(mockSelect).toHaveBeenCalledWith("*", {
      count: "exact",
      head: true,
    });
  });

  it("returns 0 when DB is unavailable", async () => {
    vi.mocked(getSupabase).mockReturnValueOnce(null);

    const result = await dbGetUserCount();
    expect(result).toBe(0);
  });

  it("returns 0 on query error", async () => {
    countResolve = { count: null, error: new Error("query failed") };

    const result = await dbGetUserCount();
    expect(result).toBe(0);
  });
});
