import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock Supabase client — tracks arguments for all chain methods
// ---------------------------------------------------------------------------

const mockInsert = vi.fn();
const mockDelete = vi.fn();
const mockSelect = vi.fn();
const mockLt = vi.fn();
const mockLimit = vi.fn();

let terminalResolve: { data: unknown; error: unknown };

const { mockGetSupabase } = vi.hoisted(() => ({
  mockGetSupabase: vi.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFrom = vi.fn((): any => {
  const chain: Record<string, unknown> = {};
  chain.insert = mockInsert;
  chain.select = (...args: unknown[]) => {
    mockSelect(...args);
    return chain;
  };
  chain.lt = (...args: unknown[]) => {
    mockLt(...args);
    return chain;
  };
  chain.limit = (...args: unknown[]) => {
    mockLimit(...args);
    return chain;
  };
  chain.delete = () => {
    mockDelete();
    return chain;
  };
  // Terminal .then for delete().lt().limit().select() chain
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
  getSupabase: mockGetSupabase,
}));

import {
  dbInsertTelemetry,
  dbCleanExpiredMergeOperations,
  MERGE_OPS_RETENTION_DAYS,
  MERGE_OPS_CLEANUP_BATCH_SIZE,
} from "./telemetry";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const validPayload = {
  operationId: "550e8400-e29b-41d4-a716-446655440000",
  targetHandle: "juan294",
  sourceHandle: "juan_corp",
  success: true,
  stats: {
    commitsTotal: 30,
    reposContributed: 3,
    prsMergedCount: 5,
    activeDays: 20,
    reviewsSubmittedCount: 10,
  },
  timing: {
    fetchMs: 1200,
    uploadMs: 300,
    totalMs: 1500,
  },
  cliVersion: "0.3.1",
};

// ---------------------------------------------------------------------------
// Tests — dbInsertTelemetry
// ---------------------------------------------------------------------------

describe("dbInsertTelemetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    terminalResolve = { data: null, error: null };
  });

  it("returns false when Supabase is unavailable", async () => {
    mockGetSupabase.mockReturnValue(null);
    const result = await dbInsertTelemetry(validPayload);
    expect(result).toBe(false);
  });

  it("inserts into merge_operations table with snake_case columns", async () => {
    mockInsert.mockResolvedValue({ error: null });
    mockGetSupabase.mockReturnValue({ from: mockFrom });

    await dbInsertTelemetry(validPayload);

    expect(mockFrom).toHaveBeenCalledWith("merge_operations");
    expect(mockInsert).toHaveBeenCalledWith({
      operation_id: "550e8400-e29b-41d4-a716-446655440000",
      target_handle: "juan294",
      source_handle: "juan_corp",
      success: true,
      error_category: null,
      commits_total: 30,
      repos_contributed: 3,
      prs_merged_count: 5,
      active_days: 20,
      reviews_submitted_count: 10,
      fetch_ms: 1200,
      upload_ms: 300,
      total_ms: 1500,
      cli_version: "0.3.1",
    });
  });

  it("maps errorCategory to snake_case when present", async () => {
    mockInsert.mockResolvedValue({ error: null });
    mockGetSupabase.mockReturnValue({ from: mockFrom });

    await dbInsertTelemetry({ ...validPayload, success: false, errorCategory: "network" });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        error_category: "network",
        success: false,
      }),
    );
  });

  it("returns true on successful insert", async () => {
    mockInsert.mockResolvedValue({ error: null });
    mockGetSupabase.mockReturnValue({ from: mockFrom });

    const result = await dbInsertTelemetry(validPayload);
    expect(result).toBe(true);
  });

  it("returns false on Supabase error (fail-open)", async () => {
    mockInsert.mockResolvedValue({ error: { message: "unique violation" } });
    mockGetSupabase.mockReturnValue({ from: mockFrom });

    const result = await dbInsertTelemetry(validPayload);
    expect(result).toBe(false);
  });

  it("returns false on thrown exception (fail-open)", async () => {
    mockInsert.mockRejectedValue(new Error("connection timeout"));
    mockGetSupabase.mockReturnValue({ from: mockFrom });

    const result = await dbInsertTelemetry(validPayload);
    expect(result).toBe(false);
  });

  it("lowercases targetHandle for storage", async () => {
    mockInsert.mockResolvedValue({ error: null });
    mockGetSupabase.mockReturnValue({ from: mockFrom });

    await dbInsertTelemetry({ ...validPayload, targetHandle: "Juan294" });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ target_handle: "juan294" }),
    );
  });
});

// ---------------------------------------------------------------------------
// Tests — dbCleanExpiredMergeOperations
// ---------------------------------------------------------------------------

describe("dbCleanExpiredMergeOperations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    terminalResolve = { data: null, error: null };
  });

  it("exports MERGE_OPS_RETENTION_DAYS as 90", () => {
    expect(MERGE_OPS_RETENTION_DAYS).toBe(90);
  });

  it("exports MERGE_OPS_CLEANUP_BATCH_SIZE as 1000", () => {
    expect(MERGE_OPS_CLEANUP_BATCH_SIZE).toBe(1000);
  });

  it("returns count of deleted rows", async () => {
    terminalResolve = { data: [{ id: 1 }, { id: 2 }, { id: 3 }], error: null };
    mockGetSupabase.mockReturnValue({ from: mockFrom });

    const result = await dbCleanExpiredMergeOperations();

    expect(result).toBe(3);
    expect(mockFrom).toHaveBeenCalledWith("merge_operations");
    expect(mockDelete).toHaveBeenCalled();
  });

  it("filters rows older than 90 days using .lt(created_at, ...)", async () => {
    terminalResolve = { data: [], error: null };
    mockGetSupabase.mockReturnValue({ from: mockFrom });

    await dbCleanExpiredMergeOperations();

    expect(mockLt).toHaveBeenCalledWith(
      "created_at",
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    );

    // Verify the cutoff date is approximately 90 days ago
    const cutoffArg = mockLt.mock.calls[0]![1] as string;
    const cutoffDate = new Date(cutoffArg);
    const expectedCutoff = new Date();
    expectedCutoff.setDate(expectedCutoff.getDate() - 90);
    // Allow 5 seconds of drift for test execution time
    expect(Math.abs(cutoffDate.getTime() - expectedCutoff.getTime())).toBeLessThan(5000);
  });

  it("applies MERGE_OPS_CLEANUP_BATCH_SIZE limit", async () => {
    terminalResolve = { data: [], error: null };
    mockGetSupabase.mockReturnValue({ from: mockFrom });

    await dbCleanExpiredMergeOperations();

    expect(mockLimit).toHaveBeenCalledWith(MERGE_OPS_CLEANUP_BATCH_SIZE);
  });

  it("selects id column to get deleted count", async () => {
    terminalResolve = { data: [], error: null };
    mockGetSupabase.mockReturnValue({ from: mockFrom });

    await dbCleanExpiredMergeOperations();

    expect(mockSelect).toHaveBeenCalledWith("id");
  });

  it("returns 0 when Supabase is unavailable", async () => {
    mockGetSupabase.mockReturnValue(null);

    const result = await dbCleanExpiredMergeOperations();

    expect(result).toBe(0);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns 0 on Supabase error without throwing (fail-open)", async () => {
    terminalResolve = { data: null, error: new Error("delete failed") };
    mockGetSupabase.mockReturnValue({ from: mockFrom });

    const result = await dbCleanExpiredMergeOperations();

    expect(result).toBe(0);
  });

  it("returns 0 when data is null (no rows deleted)", async () => {
    terminalResolve = { data: null, error: null };
    mockGetSupabase.mockReturnValue({ from: mockFrom });

    const result = await dbCleanExpiredMergeOperations();

    expect(result).toBe(0);
  });

  it("does not delete recent rows (cutoff is 90 days, not more)", async () => {
    terminalResolve = { data: [], error: null };
    mockGetSupabase.mockReturnValue({ from: mockFrom });

    await dbCleanExpiredMergeOperations();

    // The .lt() filter ensures only rows with created_at < cutoff are deleted.
    // Rows created within the last 90 days have created_at >= cutoff, so they
    // won't match the filter. We verify the cutoff is exactly 90 days ago.
    const cutoffArg = mockLt.mock.calls[0]![1] as string;
    const cutoffDate = new Date(cutoffArg);
    const now = new Date();
    const diffDays = (now.getTime() - cutoffDate.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThanOrEqual(89.9);
    expect(diffDays).toBeLessThanOrEqual(90.1);
  });
});
