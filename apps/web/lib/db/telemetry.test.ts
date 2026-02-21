import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock Supabase client
// ---------------------------------------------------------------------------

const mockInsert = vi.fn();
const mockFrom = vi.fn(() => ({ insert: mockInsert }));

const { mockGetSupabase } = vi.hoisted(() => ({
  mockGetSupabase: vi.fn(),
}));

vi.mock("./supabase", () => ({
  getSupabase: mockGetSupabase,
}));

import { dbInsertTelemetry } from "./telemetry";

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
// Tests
// ---------------------------------------------------------------------------

describe("dbInsertTelemetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
