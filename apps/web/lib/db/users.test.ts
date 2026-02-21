import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock Supabase client — tracks arguments for every chain method
// ---------------------------------------------------------------------------

const mockUpsert = vi.fn();
const mockSelect = vi.fn();
const mockOrder = vi.fn();
const mockRange = vi.fn();
const mockEq = vi.fn();
const mockUpdate = vi.fn();
const mockMaybeSingle = vi.fn();

let listResolve: { data: unknown; error: unknown };
let singleResolve: { data: unknown; error: unknown };
let updateResolve: { error: unknown };

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
const mockFrom = vi.fn((_table: string): any => ({
  upsert: mockUpsert,
  update: (...args: unknown[]) => {
    mockUpdate(...args);
    return {
      eq: (...eqArgs: unknown[]) => {
        mockEq(...eqArgs);
        return Promise.resolve(updateResolve);
      },
    };
  },
  select: (...args: unknown[]) => {
    mockSelect(...args);
    // List query (.select("handle, registered_at"))
    return {
      eq: (...eqArgs: unknown[]) => {
        mockEq(...eqArgs);
        return {
          maybeSingle: () => {
            mockMaybeSingle();
            return Promise.resolve(singleResolve);
          },
        };
      },
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
import {
  dbUpsertUser,
  dbGetUsers,
  dbGetUserEmail,
  dbUpdateEmailNotifications,
} from "./users";

beforeEach(() => {
  vi.clearAllMocks();
  listResolve = { data: [], error: null };
  singleResolve = { data: null, error: null };
  updateResolve = { error: null };
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

  it("upserts user with email when provided", async () => {
    mockUpsert.mockResolvedValue({ error: null });

    await dbUpsertUser("TestUser", "test@example.com");

    expect(mockUpsert).toHaveBeenCalledWith(
      { handle: "testuser", email: "test@example.com" },
      { onConflict: "handle", ignoreDuplicates: false },
    );
  });

  it("upserts without email field when email is undefined", async () => {
    mockUpsert.mockResolvedValue({ error: null });

    await dbUpsertUser("TestUser");

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
// dbGetUserEmail
// ---------------------------------------------------------------------------

describe("dbGetUserEmail", () => {
  it("returns email and notification preference for a user", async () => {
    singleResolve = {
      data: { email: "dev@example.com", email_notifications: true },
      error: null,
    };

    const result = await dbGetUserEmail("testuser");

    expect(mockFrom).toHaveBeenCalledWith("users");
    expect(mockSelect).toHaveBeenCalledWith("email, email_notifications");
    expect(mockEq).toHaveBeenCalledWith("handle", "testuser");
    expect(result).toEqual({
      email: "dev@example.com",
      emailNotifications: true,
    });
  });

  it("returns null when user not found", async () => {
    singleResolve = { data: null, error: null };

    const result = await dbGetUserEmail("unknown");
    expect(result).toBeNull();
  });

  it("returns null when email is null", async () => {
    singleResolve = {
      data: { email: null, email_notifications: true },
      error: null,
    };

    const result = await dbGetUserEmail("testuser");
    expect(result).toBeNull();
  });

  it("returns null when DB unavailable", async () => {
    vi.mocked(getSupabase).mockReturnValueOnce(null);

    const result = await dbGetUserEmail("testuser");
    expect(result).toBeNull();
  });

  it("returns null on query error", async () => {
    singleResolve = { data: null, error: new Error("query failed") };

    const result = await dbGetUserEmail("testuser");
    expect(result).toBeNull();
  });

  it("lowercases handle for lookup", async () => {
    singleResolve = {
      data: { email: "dev@example.com", email_notifications: true },
      error: null,
    };

    await dbGetUserEmail("TestUser");
    expect(mockEq).toHaveBeenCalledWith("handle", "testuser");
  });
});

// ---------------------------------------------------------------------------
// dbUpdateEmailNotifications
// ---------------------------------------------------------------------------

describe("dbUpdateEmailNotifications", () => {
  it("updates email_notifications for a user", async () => {
    updateResolve = { error: null };

    await dbUpdateEmailNotifications("testuser", false);

    expect(mockFrom).toHaveBeenCalledWith("users");
    expect(mockUpdate).toHaveBeenCalledWith({ email_notifications: false });
    expect(mockEq).toHaveBeenCalledWith("handle", "testuser");
  });

  it("lowercases handle", async () => {
    updateResolve = { error: null };

    await dbUpdateEmailNotifications("TestUser", true);
    expect(mockEq).toHaveBeenCalledWith("handle", "testuser");
  });

  it("does not throw when DB unavailable", async () => {
    vi.mocked(getSupabase).mockReturnValueOnce(null);

    await expect(
      dbUpdateEmailNotifications("testuser", false),
    ).resolves.toBeUndefined();
  });

  it("does not throw on update error", async () => {
    updateResolve = { error: new Error("update failed") };

    await expect(
      dbUpdateEmailNotifications("testuser", false),
    ).resolves.toBeUndefined();
  });
});

