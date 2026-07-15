import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeSnapshot } from "../test-helpers/fixtures";
import type { MetricsSnapshot } from "../history/types";

// ---------------------------------------------------------------------------
// Mock Supabase client — builder pattern stubs
// ---------------------------------------------------------------------------

const mockUpsert = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockIn = vi.fn();
const mockGte = vi.fn();
const mockLte = vi.fn();
const mockLt = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockMaybeSingle = vi.fn();
const mockDelete = vi.fn();

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
  chain.in = (...args: unknown[]) => {
    mockIn(...args);
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
  chain.lt = (...args: unknown[]) => {
    mockLt(...args);
    return chain;
  };
  chain.delete = () => {
    mockDelete();
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
  chain.upsert = (...args: unknown[]) => {
    mockUpsert(...args);
    return chain;
  };
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
  dbReplaceSnapshot,
  dbGetSnapshots,
  dbGetLatestSnapshot,
  dbGetLatestSnapshotBatch,
  dbCleanOldSnapshots,
  SNAPSHOT_RETENTION_DAYS,
  SNAPSHOT_CLEANUP_BATCH_SIZE,
} from "./snapshots";

beforeEach(() => {
  vi.clearAllMocks();
  terminalResolve = { data: [], error: null };
});

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------

/** Builds a DB row with sensible defaults; override only what the test cares about. */
function makeRow(overrides: Record<string, unknown> = {}) {
  return {
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
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// dbInsertSnapshot
// ---------------------------------------------------------------------------

describe("dbInsertSnapshot", () => {
  it("calls upsert with snake_case row data and selects id for presence-based detection (#1016)", async () => {
    terminalResolve = { data: [{ id: 1 }], error: null };
    const snapshot = makeSnapshot();

    const result = await dbInsertSnapshot("TestUser", snapshot);

    expect(result).toBe("inserted");
    expect(mockFrom).toHaveBeenCalledWith("metrics_snapshots");
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        handle: "testuser",
        date: snapshot.date,
        commits_total: snapshot.commitsTotal,
        building: snapshot.delivery,
        archetype: snapshot.archetype,
      }),
      { onConflict: "handle,date", ignoreDuplicates: true },
    );
    expect(mockSelect).toHaveBeenCalledWith("id");
  });

  it("returns 'duplicate' when the row already existed (empty data array, not a status code)", async () => {
    terminalResolve = { data: [], error: null };
    const result = await dbInsertSnapshot("testuser", makeSnapshot());
    expect(result).toBe("duplicate");
  });

  it("returns 'duplicate' when data is null (defensive — no error, no rows)", async () => {
    terminalResolve = { data: null, error: null };
    const result = await dbInsertSnapshot("testuser", makeSnapshot());
    expect(result).toBe("duplicate");
  });

  it("returns 'failed' when DB is unavailable", async () => {
    vi.mocked(getSupabase).mockReturnValueOnce(null);
    const result = await dbInsertSnapshot("testuser", makeSnapshot());
    expect(result).toBe("failed");
  });

  it("returns 'failed' on error without throwing", async () => {
    terminalResolve = { data: null, error: new Error("conflict") };
    const result = await dbInsertSnapshot("testuser", makeSnapshot());
    expect(result).toBe("failed");
  });

  it("does not send captured_at when inserting — DB default populates it", async () => {
    terminalResolve = { data: [{ id: 1 }], error: null };

    await dbInsertSnapshot("testuser", makeSnapshot());

    const row = mockUpsert.mock.calls[0]![0];
    expect(row.captured_at).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// dbReplaceSnapshot
// ---------------------------------------------------------------------------

describe("dbReplaceSnapshot", () => {
  it("inserts a new snapshot when none exists for today", async () => {
    terminalResolve = { data: { id: 1 }, error: null, status: 201 };
    const result = await dbReplaceSnapshot("testuser", makeSnapshot());
    expect(result).toBe(true);
  });

  it("replaces existing same-day snapshot (returns true)", async () => {
    terminalResolve = { data: { id: 1 }, error: null, status: 200 };
    const result = await dbReplaceSnapshot(
      "testuser",
      makeSnapshot({ adjustedComposite: 65 }),
    );
    expect(result).toBe(true); // true even on "update" (status 200)
  });

  it("does NOT use ignoreDuplicates", async () => {
    terminalResolve = { data: { id: 1 }, error: null, status: 201 };
    await dbReplaceSnapshot("testuser", makeSnapshot());
    const upsertArgs = mockUpsert.mock.calls[0]!;
    expect(upsertArgs[1]).toEqual({ onConflict: "handle,date" });
    expect(upsertArgs[1]).not.toHaveProperty("ignoreDuplicates");
  });

  it("selects one written row so zero-row writes do not look successful", async () => {
    terminalResolve = { data: { id: 1 }, error: null, status: 200 };

    await dbReplaceSnapshot("testuser", makeSnapshot());

    expect(mockSelect).toHaveBeenCalledWith("id");
    expect(mockMaybeSingle).toHaveBeenCalled();
  });

  it("returns false when Supabase returns no written row", async () => {
    terminalResolve = { data: null, error: null, status: 200 };
    const result = await dbReplaceSnapshot("testuser", makeSnapshot());
    expect(result).toBe(false);
  });

  it("returns false when Supabase is unavailable", async () => {
    vi.mocked(getSupabase).mockReturnValueOnce(null);
    const result = await dbReplaceSnapshot("testuser", makeSnapshot());
    expect(result).toBe(false);
  });

  it("returns false on error", async () => {
    terminalResolve = { data: null, error: new Error("DB error"), status: 500 };
    const result = await dbReplaceSnapshot("testuser", makeSnapshot());
    expect(result).toBe(false);
  });

  it("lowercases handle", async () => {
    terminalResolve = { data: { id: 1 }, error: null, status: 201 };
    await dbReplaceSnapshot("TestUser", makeSnapshot());
    expect(mockUpsert.mock.calls[0]![0].handle).toBe("testuser");
  });
});

// ---------------------------------------------------------------------------
// dbGetSnapshots
// ---------------------------------------------------------------------------

describe("dbGetSnapshots", () => {
  it("returns mapped snapshots ordered by date asc", async () => {
    terminalResolve = { data: [makeRow()], error: null };

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
    terminalResolve = { data: makeRow(), error: null };

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
// rowToSnapshot edge cases
// ---------------------------------------------------------------------------

describe("rowToSnapshot edge cases", () => {
  it("maps null max_commits_in_10min to 0", async () => {
    terminalResolve = {
      data: makeRow({ max_commits_in_10min: null }),
      error: null,
    };

    const result = await dbGetLatestSnapshot("testuser");
    expect(result!.maxCommitsIn10Min).toBe(0);
  });

  it("omits confidencePenalties when array is empty", async () => {
    terminalResolve = {
      data: makeRow({ confidence_penalties: [] }),
      error: null,
    };

    const result = await dbGetLatestSnapshot("testuser");
    expect(result!.confidencePenalties).toBeUndefined();
  });

  it("includes confidencePenalties when array is non-empty", async () => {
    const penalties = [{ flag: "low_activity", penalty: 10 }];
    terminalResolve = {
      data: makeRow({ confidence_penalties: penalties }),
      error: null,
    };

    const result = await dbGetLatestSnapshot("testuser");
    expect(result!.confidencePenalties).toEqual(penalties);
  });
});

// ---------------------------------------------------------------------------
// Runtime row validation (parseRow integration)
// ---------------------------------------------------------------------------

describe("runtime row validation", () => {
  it("dbGetLatestSnapshot returns null for a malformed row (missing required key)", async () => {
    // Simulate a row missing the "tier" field
    const row = makeRow();
    delete (row as Record<string, unknown>)["tier"];
    terminalResolve = { data: row, error: null };

    const result = await dbGetLatestSnapshot("testuser");
    expect(result).toBeNull();
  });

  it("dbGetSnapshots filters out malformed rows from the array", async () => {
    const validRow = makeRow();
    const incompleteRow = makeRow({ date: "2025-06-16" });
    delete (incompleteRow as Record<string, unknown>)["archetype"];
    terminalResolve = { data: [validRow, incompleteRow], error: null };

    const result = await dbGetSnapshots("testuser");
    expect(result).toHaveLength(1);
    expect(result[0]!.date).toBe("2025-06-15");
  });

  it("dbGetSnapshots returns empty array when all rows are malformed", async () => {
    terminalResolve = { data: [{ bad: "data" }], error: null };

    const result = await dbGetSnapshots("testuser");
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// dbGetLatestSnapshotBatch
// ---------------------------------------------------------------------------

describe("dbGetLatestSnapshotBatch", () => {
  it("returns empty Map for empty handles array", async () => {
    const result = await dbGetLatestSnapshotBatch([]);
    expect(result).toEqual(new Map());
    // Should short-circuit — no DB call
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns a Map keyed by lowercase handle with latest snapshot", async () => {
    terminalResolve = {
      data: [
        { handle: "alice", ...makeRow({ date: "2025-06-16" }) },
        { handle: "alice", ...makeRow({ date: "2025-06-15" }) },
        { handle: "bob", ...makeRow({ date: "2025-06-14" }) },
      ],
      error: null,
    };

    const result = await dbGetLatestSnapshotBatch(["Alice", "Bob"]);

    expect(result.size).toBe(2);
    expect(result.get("alice")!.date).toBe("2025-06-16");
    expect(result.get("bob")!.date).toBe("2025-06-14");
    // Uses .in() with lowercased handles
    expect(mockIn).toHaveBeenCalledWith("handle", ["alice", "bob"]);
    // Ordered by handle ASC, date DESC
    expect(mockOrder).toHaveBeenCalledWith("handle", { ascending: true });
    expect(mockOrder).toHaveBeenCalledWith("date", { ascending: false });
  });

  it("handles with no snapshots are absent from Map", async () => {
    terminalResolve = {
      data: [
        { handle: "alice", ...makeRow({ date: "2025-06-16" }) },
      ],
      error: null,
    };

    const result = await dbGetLatestSnapshotBatch(["alice", "bob"]);

    expect(result.size).toBe(1);
    expect(result.has("alice")).toBe(true);
    expect(result.has("bob")).toBe(false);
  });

  it("returns empty Map when DB is unavailable", async () => {
    vi.mocked(getSupabase).mockReturnValueOnce(null);
    const result = await dbGetLatestSnapshotBatch(["alice"]);
    expect(result).toEqual(new Map());
  });

  it("returns empty Map on query error", async () => {
    terminalResolve = { data: null, error: new Error("timeout") };
    const result = await dbGetLatestSnapshotBatch(["alice"]);
    expect(result).toEqual(new Map());
  });

  it("lowercases handles before querying", async () => {
    terminalResolve = { data: [], error: null };

    await dbGetLatestSnapshotBatch(["UPPER", "MiXeD"]);

    expect(mockIn).toHaveBeenCalledWith("handle", ["upper", "mixed"]);
  });
});

// ---------------------------------------------------------------------------
// dbCleanOldSnapshots
// ---------------------------------------------------------------------------

describe("dbCleanOldSnapshots", () => {
  it("exports retention and batch size constants", () => {
    expect(SNAPSHOT_RETENTION_DAYS).toBe(365);
    expect(SNAPSHOT_CLEANUP_BATCH_SIZE).toBe(1000);
  });

  it("deletes old snapshots and returns count", async () => {
    terminalResolve = {
      data: [{ id: 1 }, { id: 2 }, { id: 3 }],
      error: null,
    };

    const result = await dbCleanOldSnapshots();

    expect(result).toBe(3);
    expect(mockFrom).toHaveBeenCalledWith("metrics_snapshots");
    expect(mockDelete).toHaveBeenCalled();
    expect(mockLt).toHaveBeenCalledWith(
      "captured_at",
      expect.any(String),
    );
    expect(mockLimit).toHaveBeenCalledWith(SNAPSHOT_CLEANUP_BATCH_SIZE);
    expect(mockSelect).toHaveBeenCalledWith("id");
  });

  it("returns 0 when DB is unavailable", async () => {
    vi.mocked(getSupabase).mockReturnValueOnce(null);
    const result = await dbCleanOldSnapshots();
    expect(result).toBe(0);
  });

  it("returns 0 on query error", async () => {
    terminalResolve = { data: null, error: new Error("timeout") };
    const result = await dbCleanOldSnapshots();
    expect(result).toBe(0);
  });

  it("returns 0 when data is null (no rows matched)", async () => {
    terminalResolve = { data: null, error: null };
    const result = await dbCleanOldSnapshots();
    expect(result).toBe(0);
  });

  /**
   * Temporarily override `mockFrom` to resolve a sequence of `.from()` calls
   * (or a single repeating response), then restore the prior implementation —
   * even if `run()` throws — so an assertion failure can't leak the override
   * into later tests.
   */
  async function withFromResponses<T>(
    responses: { data: unknown; error: unknown }[] | { data: unknown; error: unknown },
    run: () => Promise<T>,
  ): Promise<T> {
    const originalImpl = mockFrom.getMockImplementation();
    let call = 0;
    mockFrom.mockImplementation((): unknown => {
      const response = Array.isArray(responses) ? responses[call]! : responses;
      call += 1;
      const chain = chainBuilder();
      chain.then = (
        resolve: (v: unknown) => void,
        reject: (e: unknown) => void,
      ) => {
        if (response.error) reject(response.error);
        else resolve(response);
      };
      return chain;
    });

    try {
      return await run();
    } finally {
      mockFrom.mockImplementation(originalImpl!);
    }
  }

  it("loops until a batch returns fewer rows than the batch size", async () => {
    const fullBatch = Array.from({ length: SNAPSHOT_CLEANUP_BATCH_SIZE }, (_, i) => ({
      id: i,
    }));
    const partialBatch = [{ id: 9999 }, { id: 10000 }];
    const result = await withFromResponses(
      [
        { data: fullBatch, error: null },
        { data: fullBatch, error: null },
        { data: partialBatch, error: null },
      ],
      () => dbCleanOldSnapshots(),
    );

    expect(result).toBe(SNAPSHOT_CLEANUP_BATCH_SIZE * 2 + partialBatch.length);
    expect(mockFrom).toHaveBeenCalledTimes(3);
  });

  it("caps the number of batch iterations to avoid an unbounded loop", async () => {
    const fullBatch = Array.from({ length: SNAPSHOT_CLEANUP_BATCH_SIZE }, (_, i) => ({
      id: i,
    }));
    const result = await withFromResponses(
      { data: fullBatch, error: null },
      () => dbCleanOldSnapshots(),
    );

    expect(mockFrom.mock.calls.length).toBeLessThanOrEqual(20);
    expect(result).toBe(SNAPSHOT_CLEANUP_BATCH_SIZE * mockFrom.mock.calls.length);
  });
});

// ---------------------------------------------------------------------------
// snapshotToRow edge cases (via dbInsertSnapshot/dbReplaceSnapshot)
// ---------------------------------------------------------------------------

describe("snapshotToRow edge cases", () => {
  it("serializes confidencePenalties to non-null when present", async () => {
    const penalties = [{ flag: "low_activity", penalty: 10 }];
    terminalResolve = { data: [{ id: 1 }], error: null };

    await dbInsertSnapshot(
      "testuser",
      makeSnapshot({
        confidencePenalties: penalties as MetricsSnapshot["confidencePenalties"],
      }),
    );

    const row = mockUpsert.mock.calls[0]![0];
    expect(row.confidence_penalties).toEqual(penalties);
  });

  it("serializes confidencePenalties to null when empty array", async () => {
    terminalResolve = { data: [{ id: 1 }], error: null };

    await dbInsertSnapshot(
      "testuser",
      makeSnapshot({ confidencePenalties: [] }),
    );

    const row = mockUpsert.mock.calls[0]![0];
    expect(row.confidence_penalties).toBeNull();
  });

  it("serializes confidencePenalties to null when undefined", async () => {
    terminalResolve = { data: [{ id: 1 }], error: null };

    await dbInsertSnapshot(
      "testuser",
      makeSnapshot({ confidencePenalties: undefined }),
    );

    const row = mockUpsert.mock.calls[0]![0];
    expect(row.confidence_penalties).toBeNull();
  });

  it("serializes microCommitRatio when present", async () => {
    terminalResolve = { data: [{ id: 1 }], error: null };

    await dbInsertSnapshot(
      "testuser",
      makeSnapshot({ microCommitRatio: 0.42 }),
    );

    const row = mockUpsert.mock.calls[0]![0];
    expect(row.micro_commit_ratio).toBe(0.42);
  });

  it("serializes microCommitRatio to null when undefined", async () => {
    terminalResolve = { data: [{ id: 1 }], error: null };

    await dbInsertSnapshot("testuser", makeSnapshot());

    const row = mockUpsert.mock.calls[0]![0];
    expect(row.micro_commit_ratio).toBeNull();
  });

  it("serializes docsOnlyPrRatio when present", async () => {
    terminalResolve = { data: [{ id: 1 }], error: null };

    await dbInsertSnapshot(
      "testuser",
      makeSnapshot({ docsOnlyPrRatio: 0.15 }),
    );

    const row = mockUpsert.mock.calls[0]![0];
    expect(row.docs_only_pr_ratio).toBe(0.15);
  });

  it("serializes docsOnlyPrRatio to null when undefined", async () => {
    terminalResolve = { data: [{ id: 1 }], error: null };

    await dbInsertSnapshot("testuser", makeSnapshot());

    const row = mockUpsert.mock.calls[0]![0];
    expect(row.docs_only_pr_ratio).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Craft dimension persistence
// ---------------------------------------------------------------------------

describe("craft dimension persistence", () => {
  it("serializes craft score to row when present", async () => {
    terminalResolve = { data: [{ id: 1 }], error: null };

    await dbInsertSnapshot(
      "testuser",
      makeSnapshot({ craft: 75 }),
    );

    const row = mockUpsert.mock.calls[0]![0];
    expect(row.craft).toBe(75);
  });

  it("serializes craft to null when undefined", async () => {
    terminalResolve = { data: [{ id: 1 }], error: null };

    await dbInsertSnapshot("testuser", makeSnapshot());

    const row = mockUpsert.mock.calls[0]![0];
    expect(row.craft).toBeNull();
  });

  it("reads craft from DB row when non-null", async () => {
    terminalResolve = {
      data: makeRow({ craft: 82 }),
      error: null,
    };

    const result = await dbGetLatestSnapshot("testuser");
    expect(result!.craft).toBe(82);
  });

  it("omits craft when DB row has null value", async () => {
    terminalResolve = {
      data: makeRow({ craft: null }),
      error: null,
    };

    const result = await dbGetLatestSnapshot("testuser");
    expect(result!.craft).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// rowToSnapshot additional edge cases
// ---------------------------------------------------------------------------

describe("rowToSnapshot additional edge cases", () => {
  it("includes microCommitRatio when DB row has non-null value", async () => {
    terminalResolve = {
      data: makeRow({ micro_commit_ratio: 0.35 }),
      error: null,
    };

    const result = await dbGetLatestSnapshot("testuser");
    expect(result!.microCommitRatio).toBe(0.35);
  });

  it("omits microCommitRatio when DB row has null value", async () => {
    terminalResolve = {
      data: makeRow({ micro_commit_ratio: null }),
      error: null,
    };

    const result = await dbGetLatestSnapshot("testuser");
    expect(result!.microCommitRatio).toBeUndefined();
  });

  it("includes docsOnlyPrRatio when DB row has non-null value", async () => {
    terminalResolve = {
      data: makeRow({ docs_only_pr_ratio: 0.2 }),
      error: null,
    };

    const result = await dbGetLatestSnapshot("testuser");
    expect(result!.docsOnlyPrRatio).toBe(0.2);
  });

  it("omits docsOnlyPrRatio when DB row has null value", async () => {
    terminalResolve = {
      data: makeRow({ docs_only_pr_ratio: null }),
      error: null,
    };

    const result = await dbGetLatestSnapshot("testuser");
    expect(result!.docsOnlyPrRatio).toBeUndefined();
  });

  it("maps non-null max_commits_in_10min correctly", async () => {
    terminalResolve = {
      data: makeRow({ max_commits_in_10min: 5 }),
      error: null,
    };

    const result = await dbGetLatestSnapshot("testuser");
    expect(result!.maxCommitsIn10Min).toBe(5);
  });

  it("omits confidencePenalties when null in DB", async () => {
    terminalResolve = {
      data: makeRow({ confidence_penalties: null }),
      error: null,
    };

    const result = await dbGetLatestSnapshot("testuser");
    expect(result!.confidencePenalties).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// dbGetLatestSnapshot additional error paths
// ---------------------------------------------------------------------------

describe("dbGetLatestSnapshot error paths", () => {
  it("returns null on query error and logs", async () => {
    terminalResolve = { data: null, error: new Error("connection refused") };
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await dbGetLatestSnapshot("testuser");

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(
      "[db] dbGetLatestSnapshot failed:",
      "connection refused",
    );
    consoleSpy.mockRestore();
  });
});
