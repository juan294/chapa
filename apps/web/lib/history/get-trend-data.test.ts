import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — getTrendData is a thin server-side wrapper over
// readObservedScoringHistory (#1335 phase 5). Mock the history data layer so
// tests are deterministic and don't hit Redis/Supabase.
// ---------------------------------------------------------------------------

const mockReadObservedScoringHistory = vi.fn();

vi.mock("./observed-history", () => ({
  readObservedScoringHistory: (...args: unknown[]) => mockReadObservedScoringHistory(...args),
}));

import { getTrendData } from "./get-trend-data";

const observation = (overrides: Record<string, unknown> = {}) => ({
  policyVersion: "v7.2" as const,
  identity: { revisionId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" },
  window: { referenceDate: "2026-09-01", startInclusive: "2025-09-02", endExclusive: "2026-09-02" },
  composite: { exact: 50, display: 50 },
  dimensions: {},
  tier: "Solid",
  archetype: "Builder",
  craft: null,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getTrendData", () => {
  it("returns null history when the subject was never scored", async () => {
    mockReadObservedScoringHistory.mockResolvedValue({ status: "missing" });

    const result = await getTrendData("testuser");

    expect(result).toEqual({ history: null });
  });

  it("returns null history when the store is unavailable", async () => {
    mockReadObservedScoringHistory.mockResolvedValue({ status: "unavailable" });

    const result = await getTrendData("testuser");

    expect(result).toEqual({ history: null });
  });

  it("returns null history when fewer than 2 observations exist", async () => {
    mockReadObservedScoringHistory.mockResolvedValue({
      status: "found",
      history: { observations: [observation()], trend: [], comparisons: [] },
    });

    const result = await getTrendData("testuser");

    expect(result).toEqual({ history: null });
  });

  it("returns the history when at least 2 observations exist", async () => {
    const history = {
      observations: [observation({ composite: { exact: 50, display: 50 } }), observation({ composite: { exact: 60, display: 60 } })],
      trend: [],
      comparisons: [{ status: "comparable", composite: { exact: 10, display: 10 } }],
    };
    mockReadObservedScoringHistory.mockResolvedValue({ status: "found", history });

    const result = await getTrendData("testuser");

    expect(result).toEqual({ history });
  });

  it("degrades gracefully — returns null history when the underlying history store throws", async () => {
    mockReadObservedScoringHistory.mockRejectedValue(new Error("supabase down"));

    const result = await getTrendData("testuser");

    expect(result).toEqual({ history: null });
  });
});
