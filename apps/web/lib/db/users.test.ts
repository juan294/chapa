import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock Supabase client
// ---------------------------------------------------------------------------

const mockUpsert = vi.fn();
const mockSelect = vi.fn();
const mockOrder = vi.fn();

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
const mockFrom = vi.fn((_table: string): any => ({
  upsert: mockUpsert,
  select: (...args: unknown[]) => {
    mockSelect(...args);
    return {
      order: (...orderArgs: unknown[]) => {
        mockOrder(...orderArgs);
        return Promise.resolve({ data: [], error: null });
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

    mockFrom.mockReturnValueOnce({
      select: () => ({
        order: () => Promise.resolve({ data: rows, error: null }),
      }),
    });

    const result = await dbGetUsers();

    expect(result).toEqual([
      { handle: "alice", registeredAt: "2025-06-15T10:00:00Z" },
      { handle: "bob", registeredAt: "2025-06-14T10:00:00Z" },
    ]);
  });

  it("returns empty array when DB is unavailable", async () => {
    vi.mocked(getSupabase).mockReturnValueOnce(null);

    const result = await dbGetUsers();
    expect(result).toEqual([]);
  });

  it("returns empty array on query error", async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({
        order: () =>
          Promise.resolve({ data: null, error: new Error("query failed") }),
      }),
    });

    const result = await dbGetUsers();
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// dbGetUserCount
// ---------------------------------------------------------------------------

describe("dbGetUserCount", () => {
  it("returns the count from a head query", async () => {
    mockFrom.mockReturnValueOnce({
      select: () => Promise.resolve({ count: 42, error: null }),
    });

    const result = await dbGetUserCount();
    expect(result).toBe(42);
  });

  it("returns 0 when DB is unavailable", async () => {
    vi.mocked(getSupabase).mockReturnValueOnce(null);

    const result = await dbGetUserCount();
    expect(result).toBe(0);
  });

  it("returns 0 on query error", async () => {
    mockFrom.mockReturnValueOnce({
      select: () =>
        Promise.resolve({ count: null, error: new Error("query failed") }),
    });

    const result = await dbGetUserCount();
    expect(result).toBe(0);
  });
});
