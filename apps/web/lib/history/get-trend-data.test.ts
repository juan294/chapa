import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeSnapshot } from "../test-helpers/fixtures";

// ---------------------------------------------------------------------------
// Mocks — getTrendData is a thin server-side wrapper over getSnapshots +
// computeTrend + compareSnapshots. Mock the history data layer so tests are
// deterministic and don't hit Redis/Supabase.
// ---------------------------------------------------------------------------

const mockGetSnapshots = vi.fn();

vi.mock("./history", () => ({
  getSnapshots: (...args: unknown[]) => mockGetSnapshots(...args),
}));

import { getTrendData } from "./get-trend-data";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getTrendData", () => {
  it("returns null trend/diff when fewer than 2 snapshots exist", async () => {
    mockGetSnapshots.mockResolvedValue([makeSnapshot()]);

    const result = await getTrendData("testuser");

    expect(result).toEqual({ trend: null, diff: null });
  });

  it("returns null trend/diff when there are no snapshots (new/unavailable history)", async () => {
    mockGetSnapshots.mockResolvedValue([]);

    const result = await getTrendData("testuser");

    expect(result).toEqual({ trend: null, diff: null });
  });

  it("computes trend and diff from the two most recent snapshots when available", async () => {
    const older = makeSnapshot({
      date: "2025-06-01",
      adjustedComposite: 50,
      compositeScore: 55,
    });
    const newer = makeSnapshot({
      date: "2025-06-08",
      adjustedComposite: 60,
      compositeScore: 65,
    });
    mockGetSnapshots.mockResolvedValue([older, newer]);

    const result = await getTrendData("testuser");

    expect(result.trend).not.toBeNull();
    expect(result.trend?.compositeValues.length).toBe(2);
    expect(result.diff).not.toBeNull();
    expect(result.diff?.adjustedComposite).toBe(10);
  });

  it("degrades gracefully — returns null trend/diff when the underlying history store throws", async () => {
    mockGetSnapshots.mockRejectedValue(new Error("supabase down"));

    const result = await getTrendData("testuser");

    expect(result).toEqual({ trend: null, diff: null });
  });
});
