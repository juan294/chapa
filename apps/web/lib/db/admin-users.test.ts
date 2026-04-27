import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock Supabase client — builder pattern stubs
// ---------------------------------------------------------------------------

const mockSelect = vi.fn();
const mockOr = vi.fn();
const mockIlike = vi.fn();
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
  chain.ilike = (...args: unknown[]) => {
    mockIlike(...args);
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

    expect(mockIlike).toHaveBeenCalledWith("handle", "%alice%");
    expect(mockIlike).toHaveBeenCalledWith("display_name", "%alice%");
  });

  it("escapes underscore SQL wildcard in search terms (BE-H5)", async () => {
    terminalResolve = { data: [], error: null, count: 0 };

    await dbGetAdminUsers(defaultQuery({ search: "alice_b" }));

    // _ must be escaped so it matches a literal underscore, not any character
    expect(mockIlike).toHaveBeenCalledWith("handle", "%alice\\_b%");
    expect(mockIlike).toHaveBeenCalledWith("display_name", "%alice\\_b%");
  });

  it("escapes backslash in search terms to prevent wildcard bypass (BE-H5)", async () => {
    terminalResolve = { data: [], error: null, count: 0 };

    await dbGetAdminUsers(defaultQuery({ search: "alice\\b" }));

    expect(mockIlike).toHaveBeenCalledWith("handle", "%alice\\\\b%");
    expect(mockIlike).toHaveBeenCalledWith("display_name", "%alice\\\\b%");
  });

  it("strips PostgREST delimiter characters from search terms to prevent predicate injection (BE-H5)", async () => {
    terminalResolve = { data: [], error: null, count: 0 };

    // A crafted injection attempt: ,handle.eq.juan)
    await dbGetAdminUsers(defaultQuery({ search: ",handle.eq.juan)" }));

    // The delimiters , . ( ) must be stripped so no injection occurs
    const calls = mockIlike.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    for (const [, pattern] of calls) {
      expect(pattern).not.toContain(",");
      expect(pattern).not.toContain("(");
      expect(pattern).not.toContain(")");
    }
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

  it("falls back to GitHub avatar URL when avatar_url is null", async () => {
    const row = makeAdminRow({
      handle: "alice",
      avatar_url: null,
    });

    terminalResolve = { data: [row], error: null, count: 1 };

    const result = await dbGetAdminUsers(defaultQuery());

    expect(result.users[0]!.avatarUrl).toBe(
      "https://avatars.githubusercontent.com/alice",
    );
  });

  it("uses stored avatar_url when present", async () => {
    const row = makeAdminRow({
      handle: "bob",
      avatar_url: "https://avatars.githubusercontent.com/u/123",
    });

    terminalResolve = { data: [row], error: null, count: 1 };

    const result = await dbGetAdminUsers(defaultQuery());

    expect(result.users[0]!.avatarUrl).toBe(
      "https://avatars.githubusercontent.com/u/123",
    );
  });

  it("escapes percent signs in search terms", async () => {
    terminalResolve = { data: [], error: null, count: 0 };

    await dbGetAdminUsers(defaultQuery({ search: "100%" }));

    expect(mockIlike).toHaveBeenCalledWith("handle", "%100\\%%");
    expect(mockIlike).toHaveBeenCalledWith("display_name", "%100\\%%");
  });

  it("skips search filter when search is whitespace-only", async () => {
    terminalResolve = { data: [], error: null, count: 0 };

    await dbGetAdminUsers(defaultQuery({ search: "   " }));

    expect(mockOr).not.toHaveBeenCalled();
  });

  it("clamps limit to minimum 1", async () => {
    terminalResolve = { data: [], error: null, count: 0 };

    const result = await dbGetAdminUsers(defaultQuery({ limit: 0 }));

    expect(result.limit).toBe(1);
    expect(mockRange).toHaveBeenCalledWith(0, 0); // 1 item range
  });

  it("clamps negative limit to 1", async () => {
    terminalResolve = { data: [], error: null, count: 0 };

    const result = await dbGetAdminUsers(defaultQuery({ limit: -5 }));

    expect(result.limit).toBe(1);
  });

  it("defaults total to 0 when count is null", async () => {
    terminalResolve = { data: [makeAdminRow()], error: null, count: null };

    const result = await dbGetAdminUsers(defaultQuery());

    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(0);
  });

  it("calculates totalPages correctly from count", async () => {
    terminalResolve = { data: [], error: null, count: 27 };

    const result = await dbGetAdminUsers(defaultQuery({ limit: 10 }));

    expect(result.totalPages).toBe(3); // ceil(27 / 10)
  });

  it("clamps negative page to 1", async () => {
    terminalResolve = { data: [], error: null, count: 0 };

    const result = await dbGetAdminUsers(defaultQuery({ page: -3 }));

    expect(result.page).toBe(1);
    expect(mockRange).toHaveBeenCalledWith(0, 24);
  });

  it("maps null snapshot fields correctly in admin user entry", async () => {
    const rowWithNulls = makeAdminRow({
      display_name: null,
      snapshot_date: null,
      snapshot_captured_at: null,
      commits_total: null,
      prs_merged_count: null,
      reviews_submitted: null,
      repos_contributed: null,
      active_days: null,
      total_stars: null,
      archetype: null,
      tier: null,
      adjusted_composite: null,
      composite_score: null,
      confidence: null,
    });

    terminalResolve = { data: [rowWithNulls], error: null, count: 1 };

    const result = await dbGetAdminUsers(defaultQuery());

    expect(result.users[0]!.displayName).toBeNull();
    expect(result.users[0]!.lastSnapshotDate).toBeNull();
    expect(result.users[0]!.fetchedAt).toBeNull();
    expect(result.users[0]!.commitsTotal).toBeNull();
    expect(result.users[0]!.archetype).toBeNull();
    expect(result.users[0]!.tier).toBeNull();
    expect(result.users[0]!.adjustedComposite).toBeNull();
    expect(result.users[0]!.rawScore).toBeNull();
    expect(result.users[0]!.confidence).toBeNull();
  });

  it("does not apply tier filter when tier is undefined", async () => {
    terminalResolve = { data: [], error: null, count: 0 };

    await dbGetAdminUsers(defaultQuery({ tier: undefined }));

    // mockEq should not be called for tier
    expect(mockEq).not.toHaveBeenCalledWith("tier", expect.anything());
  });

  it("does not apply archetype filter when archetype is undefined", async () => {
    terminalResolve = { data: [], error: null, count: 0 };

    await dbGetAdminUsers(defaultQuery({ archetype: undefined }));

    // mockEq should not be called for archetype
    expect(mockEq).not.toHaveBeenCalledWith("archetype", expect.anything());
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
