import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeSnapshot } from "../test-helpers/fixtures";

// ---------------------------------------------------------------------------
// Mock Supabase client — builder pattern stubs
// ---------------------------------------------------------------------------

const mockUpsert = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockGte = vi.fn();
const mockLte = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockMaybeSingle = vi.fn();

function chainBuilder() {
  const chain: Record<string, unknown> = {};
  chain.select = (...args: unknown[]) => {
    mockSelect(...args);
    return chain;
  };
  chain.eq = (...args: unknown[]) => {
    mockEq(...args);
    return chain;
  };
  chain.gte = (...args: unknown[]) => {
    mockGte(...args);
    return chain;
  };
  chain.lte = (...args: unknown[]) => {
    mockLte(...args);
    return chain;
  };
  chain.order = (...args: unknown[]) => {
    mockOrder(...args);
    return chain;
  };
  chain.limit = (...args: unknown[]) => {
    mockLimit(...args);
    return chain;
  };
  chain.maybeSingle = () => {
    mockMaybeSingle();
    return chain;
  };
  chain.upsert = mockUpsert;
  // Terminal — resolves as a thenable
  chain.then = undefined;
  return chain;
}

let terminalResolve: { data: unknown; error: unknown; status?: number };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFrom = vi.fn((): any => {
  const chain = chainBuilder();
  // Make the chain thenable so await works
  chain.then = (
    resolve: (v: unknown) => void,
    reject: (e: unknown) => void,
  ) => {
    if (terminalResolve.error) reject(terminalResolve.error);
    else resolve(terminalResolve);
  };
  // maybeSingle also returns thenable
  chain.maybeSingle = () => {
    mockMaybeSingle();
    return {
      then: (
        resolve: (v: unknown) => void,
        reject: (e: unknown) => void,
      ) => {
        if (terminalResolve.error) reject(terminalResolve.error);
        else resolve(terminalResolve);
      },
    };
  };
  return chain;
});

vi.mock("./supabase", () => ({
  getSupabase: vi.fn(() => ({ from: mockFrom })),
}));

import { getSupabase } from "./supabase";
import {
  dbInsertSnapshot,
  dbGetSnapshots,
  dbGetLatestSnapshot,
  dbGetSnapshotCount,
} from "./snapshots";

beforeEach(() => {
  vi.clearAllMocks();
  terminalResolve = { data: [], error: null };
});

// ---------------------------------------------------------------------------
// dbInsertSnapshot
// ---------------------------------------------------------------------------

describe("dbInsertSnapshot", () => {
  it("calls upsert with snake_case row data", async () => {
    mockUpsert.mockResolvedValue({ error: null, status: 201 });
    const snapshot = makeSnapshot();

    const result = await dbInsertSnapshot("TestUser", snapshot);

    expect(result).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith("metrics_snapshots");
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        handle: "testuser",
        date: snapshot.date,
        commits_total: snapshot.commitsTotal,
        building: snapshot.building,
        archetype: snapshot.archetype,
      }),
      { onConflict: "handle,date", ignoreDuplicates: true },
    );
  });

  it("returns false for duplicate (status 200)", async () => {
    mockUpsert.mockResolvedValue({ error: null, status: 200 });
    const result = await dbInsertSnapshot("testuser", makeSnapshot());
    expect(result).toBe(false);
  });

  it("returns false when DB is unavailable", async () => {
    vi.mocked(getSupabase).mockReturnValueOnce(null);
    const result = await dbInsertSnapshot("testuser", makeSnapshot());
    expect(result).toBe(false);
  });

  it("returns false on error without throwing", async () => {
    mockUpsert.mockResolvedValue({
      error: new Error("conflict"),
      status: 409,
    });
    const result = await dbInsertSnapshot("testuser", makeSnapshot());
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// dbGetSnapshots
// ---------------------------------------------------------------------------

describe("dbGetSnapshots", () => {
  it("returns mapped snapshots ordered by date asc", async () => {
    const row = {
      date: "2025-06-15",
      captured_at: "2025-06-15T14:30:00.000Z",
      commits_total: 150,
      prs_merged_count: 30,
      prs_merged_weight: 45,
      reviews_submitted: 20,
      issues_closed: 10,
      repos_contributed: 8,
      active_days: 200,
      lines_added: 5000,
      lines_deleted: 2000,
      total_stars: 100,
      total_forks: 25,
      total_watchers: 50,
      top_repo_share: 0.4,
      max_commits_in_10min: 3,
      micro_commit_ratio: null,
      docs_only_pr_ratio: null,
      building: 75,
      guarding: 60,
      consistency: 80,
      breadth: 55,
      archetype: "Builder",
      profile_type: "collaborative",
      composite_score: 67.5,
      adjusted_composite: 60.75,
      confidence: 90,
      tier: "High",
      confidence_penalties: null,
    };

    terminalResolve = { data: [row], error: null };

    const result = await dbGetSnapshots("TestUser", "2025-06-14", "2025-06-16");

    expect(result).toHaveLength(1);
    expect(result[0]!.commitsTotal).toBe(150);
    expect(result[0]!.archetype).toBe("Builder");
    expect(mockEq).toHaveBeenCalledWith("handle", "testuser");
    expect(mockGte).toHaveBeenCalledWith("date", "2025-06-14");
    expect(mockLte).toHaveBeenCalledWith("date", "2025-06-16");
  });

  it("omits date filters when not provided", async () => {
    terminalResolve = { data: [], error: null };

    await dbGetSnapshots("testuser");

    expect(mockGte).not.toHaveBeenCalled();
    expect(mockLte).not.toHaveBeenCalled();
  });

  it("returns empty array when DB is unavailable", async () => {
    vi.mocked(getSupabase).mockReturnValueOnce(null);
    const result = await dbGetSnapshots("testuser");
    expect(result).toEqual([]);
  });

  it("returns empty array on query error", async () => {
    terminalResolve = { data: null, error: new Error("timeout") };
    const result = await dbGetSnapshots("testuser");
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// dbGetLatestSnapshot
// ---------------------------------------------------------------------------

describe("dbGetLatestSnapshot", () => {
  it("returns the latest snapshot via order desc + limit 1", async () => {
    const row = {
      date: "2025-06-15",
      captured_at: "2025-06-15T14:30:00.000Z",
      commits_total: 150,
      prs_merged_count: 30,
      prs_merged_weight: 45,
      reviews_submitted: 20,
      issues_closed: 10,
      repos_contributed: 8,
      active_days: 200,
      lines_added: 5000,
      lines_deleted: 2000,
      total_stars: 100,
      total_forks: 25,
      total_watchers: 50,
      top_repo_share: 0.4,
      max_commits_in_10min: 3,
      micro_commit_ratio: null,
      docs_only_pr_ratio: null,
      building: 75,
      guarding: 60,
      consistency: 80,
      breadth: 55,
      archetype: "Builder",
      profile_type: "collaborative",
      composite_score: 67.5,
      adjusted_composite: 60.75,
      confidence: 90,
      tier: "High",
      confidence_penalties: null,
    };

    terminalResolve = { data: row, error: null };

    const result = await dbGetLatestSnapshot("TestUser");

    expect(result).not.toBeNull();
    expect(result!.date).toBe("2025-06-15");
    expect(mockOrder).toHaveBeenCalledWith("date", { ascending: false });
    expect(mockLimit).toHaveBeenCalledWith(1);
    expect(mockMaybeSingle).toHaveBeenCalled();
  });

  it("returns null when no snapshots exist", async () => {
    terminalResolve = { data: null, error: null };
    const result = await dbGetLatestSnapshot("testuser");
    expect(result).toBeNull();
  });

  it("returns null when DB is unavailable", async () => {
    vi.mocked(getSupabase).mockReturnValueOnce(null);
    const result = await dbGetLatestSnapshot("testuser");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// dbGetSnapshotCount
// ---------------------------------------------------------------------------

describe("dbGetSnapshotCount", () => {
  it("returns count from head query", async () => {
    terminalResolve = { data: null, error: null };
    // Override the chain to return count
    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: () =>
          Promise.resolve({ count: 42, error: null }),
      }),
    });

    const result = await dbGetSnapshotCount("TestUser");
    expect(result).toBe(42);
  });

  it("returns 0 when DB is unavailable", async () => {
    vi.mocked(getSupabase).mockReturnValueOnce(null);
    const result = await dbGetSnapshotCount("testuser");
    expect(result).toBe(0);
  });

  it("returns 0 on query error", async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: () =>
          Promise.resolve({ count: null, error: new Error("query failed") }),
      }),
    });

    const result = await dbGetSnapshotCount("testuser");
    expect(result).toBe(0);
  });
});
