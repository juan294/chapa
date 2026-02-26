import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock Supabase client — builder pattern stubs
// ---------------------------------------------------------------------------

const mockSelect = vi.fn();
const mockOr = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockRange = vi.fn();

function chainBuilder() {
  const chain: Record<string, unknown> = {};
  chain.select = (...args: unknown[]) => {
    mockSelect(...args);
    return chain;
  };
  chain.or = (...args: unknown[]) => {
    mockOr(...args);
    return chain;
  };
  chain.eq = (...args: unknown[]) => {
    mockEq(...args);
    return chain;
  };
  chain.order = (...args: unknown[]) => {
    mockOrder(...args);
    return chain;
  };
  chain.range = (...args: unknown[]) => {
    mockRange(...args);
    return chain;
  };
  // Terminal — resolved by then
  chain.then = undefined;
  return chain;
}

let terminalResolve: { data: unknown; error: unknown; count?: number | null };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFrom = vi.fn((): any => {
  const chain = chainBuilder();
  chain.then = (
    resolve: (v: unknown) => void,
    reject: (e: unknown) => void,
  ) => {
    if (terminalResolve.error) reject(terminalResolve.error);
    else resolve(terminalResolve);
  };
  return chain;
});

vi.mock("./supabase", () => ({
  getSupabase: vi.fn(() => ({ from: mockFrom })),
}));

import { getSupabase } from "./supabase";
import { dbGetAdminUsers } from "./admin-users";
import type { AdminUserQuery } from "./admin-users";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaultQuery(overrides: Partial<AdminUserQuery> = {}): AdminUserQuery {
  return {
    page: 1,
    limit: 25,
    sort: "adjustedComposite",
    dir: "desc",
    ...overrides,
  };
}

function makeAdminRow(overrides: Record<string, unknown> = {}) {
  return {
    handle: "testuser",
    registered_at: "2025-06-01T00:00:00Z",
    display_name: "Test User",
    avatar_url: "https://example.com/avatar.png",
    snapshot_date: "2025-06-01",
    snapshot_captured_at: "2025-06-01T12:00:00Z",
    commits_total: 100,
    prs_merged_count: 20,
    reviews_submitted: 15,
    repos_contributed: 8,
    active_days: 180,
    total_stars: 50,
    archetype: "Builder",
    tier: "Solid",
    adjusted_composite: 65,
    composite_score: 60,
    confidence: 85,
    building: 70,
    guarding: 60,
    consistency_score: 80,
    breadth: 50,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  terminalResolve = { data: [], error: null, count: 0 };
});

// ---------------------------------------------------------------------------
// dbGetAdminUsers
// ---------------------------------------------------------------------------

describe("dbGetAdminUsers", () => {
  it("returns paginated users with correct range offsets", async () => {
    terminalResolve = {
      data: [makeAdminRow()],
      error: null,
      count: 50,
    };

    const result = await dbGetAdminUsers(defaultQuery({ page: 2, limit: 10 }));

    expect(mockFrom).toHaveBeenCalledWith("admin_users");
    expect(mockRange).toHaveBeenCalledWith(10, 19); // page 2, limit 10
    expect(result.page).toBe(2);
    expect(result.limit).toBe(10);
    expect(result.total).toBe(50);
    expect(result.totalPages).toBe(5);
    expect(result.users).toHaveLength(1);
  });

  it("returns total count using exact count mode", async () => {
    terminalResolve = { data: [], error: null, count: 42 };

    const result = await dbGetAdminUsers(defaultQuery());

    expect(mockSelect).toHaveBeenCalledWith("*", { count: "exact" });
    expect(result.total).toBe(42);
  });

  it("sorts by adjusted_composite desc by default", async () => {
    terminalResolve = { data: [], error: null, count: 0 };

    await dbGetAdminUsers(defaultQuery());

    expect(mockOrder).toHaveBeenCalledWith("adjusted_composite", {
      ascending: false,
      nullsFirst: false,
    });
  });

  it("sorts by handle asc when requested", async () => {
    terminalResolve = { data: [], error: null, count: 0 };

    await dbGetAdminUsers(defaultQuery({ sort: "handle", dir: "asc" }));

    expect(mockOrder).toHaveBeenCalledWith("handle", {
      ascending: true,
      nullsFirst: false,
    });
  });

  it("sorts with nullsFirst false to push users without snapshots to bottom", async () => {
    terminalResolve = { data: [], error: null, count: 0 };

    await dbGetAdminUsers(defaultQuery({ sort: "totalStars", dir: "desc" }));

    expect(mockOrder).toHaveBeenCalledWith(
      "total_stars",
      expect.objectContaining({ nullsFirst: false }),
    );
  });

  it("applies search filter with ILIKE on handle and display_name", async () => {
    terminalResolve = { data: [], error: null, count: 0 };

    await dbGetAdminUsers(defaultQuery({ search: "alice" }));

    expect(mockOr).toHaveBeenCalledWith(
      "handle.ilike.%alice%,display_name.ilike.%alice%",
    );
  });

  it("applies tier filter", async () => {
    terminalResolve = { data: [], error: null, count: 0 };

    await dbGetAdminUsers(defaultQuery({ tier: "Elite" }));

    expect(mockEq).toHaveBeenCalledWith("tier", "Elite");
  });

  it("applies archetype filter", async () => {
    terminalResolve = { data: [], error: null, count: 0 };

    await dbGetAdminUsers(defaultQuery({ archetype: "Builder" }));

    expect(mockEq).toHaveBeenCalledWith("archetype", "Builder");
  });

  it("clamps page to minimum 1", async () => {
    terminalResolve = { data: [], error: null, count: 0 };

    const result = await dbGetAdminUsers(defaultQuery({ page: 0 }));

    expect(mockRange).toHaveBeenCalledWith(0, 24); // page 1 offset
    expect(result.page).toBe(1);
  });

  it("clamps limit to maximum 100", async () => {
    terminalResolve = { data: [], error: null, count: 0 };

    const result = await dbGetAdminUsers(defaultQuery({ limit: 500 }));

    expect(mockRange).toHaveBeenCalledWith(0, 99); // limit clamped to 100
    expect(result.limit).toBe(100);
  });

  it("returns empty result when DB is unavailable", async () => {
    vi.mocked(getSupabase).mockReturnValueOnce(null);

    const result = await dbGetAdminUsers(defaultQuery());

    expect(result.users).toEqual([]);
    expect(result.total).toBe(0);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns empty result on query error (fail-open)", async () => {
    terminalResolve = { data: null, error: new Error("query failed"), count: null };

    const result = await dbGetAdminUsers(defaultQuery());

    expect(result.users).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.page).toBe(1);
  });

  it("maps row fields to AdminUserEntry correctly", async () => {
    const row = makeAdminRow({
      handle: "alice",
      display_name: "Alice Dev",
      avatar_url: "https://example.com/alice.png",
      registered_at: "2025-01-15T00:00:00Z",
      snapshot_date: "2025-06-01",
      snapshot_captured_at: "2025-06-01T12:00:00Z",
      commits_total: 200,
      prs_merged_count: 30,
      reviews_submitted: 25,
      repos_contributed: 12,
      active_days: 220,
      total_stars: 100,
      archetype: "Polymath",
      tier: "Elite",
      adjusted_composite: 90,
      composite_score: 85,
      confidence: 95,
    });

    terminalResolve = { data: [row], error: null, count: 1 };

    const result = await dbGetAdminUsers(defaultQuery());

    expect(result.users[0]).toEqual({
      handle: "alice",
      displayName: "Alice Dev",
      avatarUrl: "https://example.com/alice.png",
      registeredAt: "2025-01-15T00:00:00Z",
      lastSnapshotDate: "2025-06-01",
      fetchedAt: "2025-06-01T12:00:00Z",
      commitsTotal: 200,
      prsMergedCount: 30,
      reviewsSubmittedCount: 25,
      activeDays: 220,
      reposContributed: 12,
      totalStars: 100,
      archetype: "Polymath",
      tier: "Elite",
      adjustedComposite: 90,
      rawScore: 85,
      confidence: 95,
    });
  });

  it("escapes percent signs in search terms", async () => {
    terminalResolve = { data: [], error: null, count: 0 };

    await dbGetAdminUsers(defaultQuery({ search: "100%" }));

    expect(mockOr).toHaveBeenCalledWith(
      "handle.ilike.%100\\%%,display_name.ilike.%100\\%%",
    );
  });

  it("skips search filter when search is whitespace-only", async () => {
    terminalResolve = { data: [], error: null, count: 0 };

    await dbGetAdminUsers(defaultQuery({ search: "   " }));

    expect(mockOr).not.toHaveBeenCalled();
  });

  it("maps all sort fields to valid DB columns", async () => {
    const sortFields: Array<{ field: string; dbCol: string }> = [
      { field: "handle", dbCol: "handle" },
      { field: "adjustedComposite", dbCol: "adjusted_composite" },
      { field: "rawScore", dbCol: "composite_score" },
      { field: "confidence", dbCol: "confidence" },
      { field: "commitsTotal", dbCol: "commits_total" },
      { field: "prsMergedCount", dbCol: "prs_merged_count" },
      { field: "reviewsSubmittedCount", dbCol: "reviews_submitted" },
      { field: "activeDays", dbCol: "active_days" },
      { field: "totalStars", dbCol: "total_stars" },
      { field: "tier", dbCol: "tier" },
      { field: "archetype", dbCol: "archetype" },
      { field: "registeredAt", dbCol: "registered_at" },
      { field: "lastSnapshotDate", dbCol: "snapshot_date" },
    ];

    for (const { field, dbCol } of sortFields) {
      vi.clearAllMocks();
      terminalResolve = { data: [], error: null, count: 0 };

      await dbGetAdminUsers(
        defaultQuery({ sort: field as AdminUserQuery["sort"] }),
      );

      expect(mockOrder).toHaveBeenCalledWith(
        dbCol,
        expect.any(Object),
      );
    }
  });
});
