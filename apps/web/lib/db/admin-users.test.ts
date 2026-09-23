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
    current_revision_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    current_content_hash: "a".repeat(64),
    current_display_score: 65,
    current_exact_score: 64.5,
    current_tier: "Solid",
    current_archetype: "Builder",
    current_snapshot_date: "2025-06-01",
    current_fetched_at: "2025-06-01T12:00:00Z",
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
  it("always queries the admin_users_observed view", async () => {
    terminalResolve = { data: [], error: null, count: 0 };

    await dbGetAdminUsers(defaultQuery());

    expect(mockFrom).toHaveBeenCalledWith("admin_users_observed");
  });

  it("returns paginated users with correct range offsets", async () => {
    terminalResolve = {
      data: [makeAdminRow()],
      error: null,
      count: 50,
    };

    const result = await dbGetAdminUsers(defaultQuery({ page: 2, limit: 10 }));

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

  it("sorts by the current receipt's display score by default", async () => {
    terminalResolve = { data: [], error: null, count: 0 };

    await dbGetAdminUsers(defaultQuery());

    expect(mockOrder).toHaveBeenCalledWith("current_display_score", {
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

  it("sorts with nullsFirst false to push not-yet-scored subjects to the bottom", async () => {
    terminalResolve = { data: [], error: null, count: 0 };

    await dbGetAdminUsers(defaultQuery({ sort: "tier", dir: "desc" }));

    expect(mockOrder).toHaveBeenCalledWith(
      "current_tier",
      expect.objectContaining({ nullsFirst: false }),
    );
  });

  it("applies search filter with ILIKE on handle and display_name", async () => {
    terminalResolve = { data: [], error: null, count: 0 };

    await dbGetAdminUsers(defaultQuery({ search: "alice" }));

    expect(mockOr).toHaveBeenCalledWith("handle.ilike.%alice%,display_name.ilike.%alice%");
  });

  it("escapes underscore SQL wildcard in search terms (BE-H5)", async () => {
    terminalResolve = { data: [], error: null, count: 0 };

    await dbGetAdminUsers(defaultQuery({ search: "alice_b" }));

    // _ must be escaped so it matches a literal underscore, not any character
    expect(mockOr).toHaveBeenCalledWith(
      "handle.ilike.%alice\\_b%,display_name.ilike.%alice\\_b%",
    );
  });

  it("escapes backslash in search terms to prevent wildcard bypass (BE-H5)", async () => {
    terminalResolve = { data: [], error: null, count: 0 };

    await dbGetAdminUsers(defaultQuery({ search: "alice\\b" }));

    expect(mockOr).toHaveBeenCalledWith(
      "handle.ilike.%alice\\\\b%,display_name.ilike.%alice\\\\b%",
    );
  });

  it("strips PostgREST delimiter characters from search terms to prevent predicate injection (BE-H5)", async () => {
    terminalResolve = { data: [], error: null, count: 0 };

    // A crafted injection attempt: ,handle.eq.juan)
    await dbGetAdminUsers(defaultQuery({ search: ",handle.eq.juan)" }));

    // The delimiters , . ( ) must be stripped so no injection occurs
    const calls = mockOr.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const [filterString] = calls[0]!;
    expect(filterString).not.toContain("handle.eq.juan)");
    expect(filterString).not.toContain("(");
    expect(filterString).not.toContain(")");
  });

  it("applies tier filter against the current receipt projection", async () => {
    terminalResolve = { data: [], error: null, count: 0 };

    await dbGetAdminUsers(defaultQuery({ tier: "Elite" }));

    expect(mockEq).toHaveBeenCalledWith("current_tier", "Elite");
  });

  it("applies archetype filter against the current receipt projection", async () => {
    terminalResolve = { data: [], error: null, count: 0 };

    await dbGetAdminUsers(defaultQuery({ archetype: "Builder" }));

    expect(mockEq).toHaveBeenCalledWith("current_archetype", "Builder");
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

  it("maps a row with a current receipt to a v7.2 AdminUserEntry", async () => {
    const row = makeAdminRow({
      handle: "alice",
      display_name: "Alice Dev",
      avatar_url: "https://example.com/alice.png",
      registered_at: "2025-01-15T00:00:00Z",
      current_revision_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      current_content_hash: "b".repeat(64),
      current_display_score: 90,
      current_exact_score: 89.7,
      current_tier: "Elite",
      current_archetype: "Polymath",
      current_snapshot_date: "2025-06-01",
      current_fetched_at: "2025-06-01T12:00:00Z",
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
      commitsTotal: null,
      prsMergedCount: null,
      reviewsSubmittedCount: null,
      activeDays: null,
      reposContributed: null,
      totalStars: null,
      archetype: "Polymath",
      tier: "Elite",
      adjustedComposite: 90,
      rawScore: 90,
      confidence: null,
      policyVersion: "v7.2",
      exactScore: 89.7,
      identity: { revisionId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", contentHash: "b".repeat(64) },
    });
  });

  it("treats a subject with no current receipt as unscored, never the legacy fallback", async () => {
    const row = makeAdminRow({
      current_revision_id: null,
      current_content_hash: null,
      // These would be the legacy v6 CASE-fallback values on the
      // pre-contract-migration view; they must never surface.
      current_display_score: 42,
      current_tier: "Solid",
      current_archetype: "Builder",
      current_snapshot_date: "2024-01-01",
      current_fetched_at: "2024-01-01T00:00:00Z",
    });

    terminalResolve = { data: [row], error: null, count: 1 };

    const result = await dbGetAdminUsers(defaultQuery());
    const user = result.users[0]!;

    expect(user.policyVersion).toBeUndefined();
    expect(user.identity).toBeUndefined();
    expect(user.exactScore).toBeUndefined();
    expect(user.lastSnapshotDate).toBeNull();
    expect(user.fetchedAt).toBeNull();
    expect(user.archetype).toBeNull();
    expect(user.tier).toBeNull();
    expect(user.adjustedComposite).toBeNull();
    expect(user.rawScore).toBeNull();
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

    expect(mockOr).toHaveBeenCalledWith(
      "handle.ilike.%100\\%%,display_name.ilike.%100\\%%",
    );
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

  it("does not apply tier filter when tier is undefined", async () => {
    terminalResolve = { data: [], error: null, count: 0 };

    await dbGetAdminUsers(defaultQuery({ tier: undefined }));

    expect(mockEq).not.toHaveBeenCalledWith("current_tier", expect.anything());
  });

  it("does not apply archetype filter when archetype is undefined", async () => {
    terminalResolve = { data: [], error: null, count: 0 };

    await dbGetAdminUsers(defaultQuery({ archetype: undefined }));

    expect(mockEq).not.toHaveBeenCalledWith("current_archetype", expect.anything());
  });

  it("maps every sort field to a current-receipt-projection column, never a dropped admin_users column", async () => {
    const sortFields: Array<{ field: string; dbCol: string }> = [
      { field: "handle", dbCol: "handle" },
      { field: "adjustedComposite", dbCol: "current_display_score" },
      { field: "rawScore", dbCol: "current_display_score" },
      { field: "confidence", dbCol: "current_display_score" },
      { field: "commitsTotal", dbCol: "current_display_score" },
      { field: "prsMergedCount", dbCol: "current_display_score" },
      { field: "reviewsSubmittedCount", dbCol: "current_display_score" },
      { field: "activeDays", dbCol: "current_display_score" },
      { field: "totalStars", dbCol: "current_display_score" },
      { field: "tier", dbCol: "current_tier" },
      { field: "archetype", dbCol: "current_archetype" },
      { field: "registeredAt", dbCol: "registered_at" },
      { field: "lastSnapshotDate", dbCol: "current_snapshot_date" },
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
