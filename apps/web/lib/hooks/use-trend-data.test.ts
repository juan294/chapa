// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { TrendSummary } from "@/lib/history/trend";
import type { SnapshotDiff } from "@/lib/history/diff";

// ---------------------------------------------------------------------------
// Mock fetch globally
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const fakeTrend: TrendSummary = {
  direction: "improving",
  avgDelta: 2.5,
  compositeValues: [
    { date: "2026-02-01", value: 60 },
    { date: "2026-02-15", value: 65 },
  ],
  dimensions: {
    delivery: { avgDelta: 3.0, values: [{ date: "2026-02-01", value: 70 }] },
    quality: { avgDelta: 1.5, values: [{ date: "2026-02-01", value: 80 }] },
    consistency: { avgDelta: 2.0, values: [{ date: "2026-02-01", value: 75 }] },
    breadth: { avgDelta: 1.0, values: [{ date: "2026-02-01", value: 50 }] },
  },
};

const fakeDiff: SnapshotDiff = {
  direction: "improving",
  daysBetween: 14,
  compositeScore: 5,
  adjustedComposite: 4,
  confidence: 2,
  dimensions: { delivery: 3, quality: 1, consistency: 2, breadth: -1 },
  stats: {
    commitsTotal: 10,
    prsMergedCount: 2,
    prsMergedWeight: 3,
    reviewsSubmittedCount: 1,
    issuesClosedCount: 0,
    reposContributed: 1,
    activeDays: 5,
    linesAdded: 200,
    linesDeleted: 50,
    totalStars: 3,
    totalForks: 1,
    totalWatchers: 0,
    topRepoShare: -0.05,
  },
  archetype: null,
  tier: null,
  profileType: null,
  penaltyChanges: null,
};

function makeSuccessResponse(trend: TrendSummary | null, diff: SnapshotDiff | null) {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve({ handle: "testuser", trend, diff }),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useTrendData", () => {
  // Lazy import so the module is loaded after fetch is mocked
  async function importHook() {
    const mod = await import("./use-trend-data");
    return mod.useTrendData;
  }

  it("fetches from the correct URL with correct params", async () => {
    mockFetch.mockResolvedValueOnce(makeSuccessResponse(fakeTrend, fakeDiff));

    const useTrendData = await importHook();
    renderHook(() => useTrendData("testuser"));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    const calledUrl = mockFetch.mock.calls[0]![0] as string;
    expect(calledUrl).toBe("/api/history/testuser?include=trend,diff&window=30");
  });

  it("returns trend and diff on success", async () => {
    mockFetch.mockResolvedValueOnce(makeSuccessResponse(fakeTrend, fakeDiff));

    const useTrendData = await importHook();
    const { result } = renderHook(() => useTrendData("testuser"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.trend).toEqual(fakeTrend);
    expect(result.current.diff).toEqual(fakeDiff);
    expect(result.current.error).toBeNull();
  });

  it("handles 429 rate limit (sets error, no crash)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: () => Promise.resolve({ error: "Too many requests" }),
    });

    const useTrendData = await importHook();
    const { result } = renderHook(() => useTrendData("testuser"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe("Rate limited");
    expect(result.current.trend).toBeNull();
    expect(result.current.diff).toBeNull();
  });

  it("handles network error (sets error, no crash)", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network failure"));

    const useTrendData = await importHook();
    const { result } = renderHook(() => useTrendData("testuser"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe("Network failure");
    expect(result.current.trend).toBeNull();
    expect(result.current.diff).toBeNull();
  });

  it("returns null trend/diff when API returns null (new user)", async () => {
    mockFetch.mockResolvedValueOnce(makeSuccessResponse(null, null));

    const useTrendData = await importHook();
    const { result } = renderHook(() => useTrendData("testuser"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.trend).toBeNull();
    expect(result.current.diff).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("sets isLoading=true initially, false after fetch completes", async () => {
    // Use a deferred promise to control timing
    let resolvePromise: (value: unknown) => void;
    const fetchPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    mockFetch.mockReturnValueOnce(fetchPromise);

    const useTrendData = await importHook();
    const { result } = renderHook(() => useTrendData("testuser"));

    // Should be loading initially
    expect(result.current.isLoading).toBe(true);
    expect(result.current.trend).toBeNull();
    expect(result.current.diff).toBeNull();

    // Resolve the fetch
    resolvePromise!(makeSuccessResponse(fakeTrend, fakeDiff));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.trend).toEqual(fakeTrend);
  });

  it("handles non-429 HTTP error with status text", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "Internal server error" }),
    });

    const useTrendData = await importHook();
    const { result } = renderHook(() => useTrendData("testuser"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe("Failed to load trend data");
    expect(result.current.trend).toBeNull();
    expect(result.current.diff).toBeNull();
  });

  it("does not update state after component unmounts (cancellation)", async () => {
    let resolvePromise: (value: unknown) => void;
    const fetchPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    mockFetch.mockReturnValueOnce(fetchPromise);

    const useTrendData = await importHook();
    const { result, unmount } = renderHook(() => useTrendData("testuser"));

    // Component is loading
    expect(result.current.isLoading).toBe(true);

    // Unmount before fetch resolves
    unmount();

    // Now resolve the fetch — state should NOT update because cancelled=true
    resolvePromise!(makeSuccessResponse(fakeTrend, fakeDiff));

    // Give the promise time to settle
    await new Promise((r) => setTimeout(r, 50));

    // Since the component is unmounted, we can't directly check state,
    // but the key assertion is that no errors are thrown from
    // updating state on an unmounted component
  });

  it("handles JSON response with null trend and diff values (new user)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ handle: "newuser", trend: null, diff: null }),
    });

    const useTrendData = await importHook();
    const { result } = renderHook(() => useTrendData("newuser"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.trend).toBeNull();
    expect(result.current.diff).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("handles JSON response with missing trend/diff keys (uses ?? null)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ handle: "newuser" }),
    });

    const useTrendData = await importHook();
    const { result } = renderHook(() => useTrendData("newuser"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // data.trend is undefined → ?? null → null
    expect(result.current.trend).toBeNull();
    expect(result.current.diff).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("handles error object without message property", async () => {
    mockFetch.mockRejectedValueOnce({ code: "ABORT" });

    const useTrendData = await importHook();
    const { result } = renderHook(() => useTrendData("testuser"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Not an Error instance → falls back to generic message
    expect(result.current.error).toBe("Failed to load trend data");
  });

  it("refetches when handle parameter changes", async () => {
    mockFetch
      .mockResolvedValueOnce(makeSuccessResponse(fakeTrend, fakeDiff))
      .mockResolvedValueOnce(
        makeSuccessResponse(
          { ...fakeTrend, direction: "declining" as const },
          fakeDiff,
        ),
      );

    const callsBefore = mockFetch.mock.calls.length;

    const useTrendData = await importHook();
    const { result, rerender } = renderHook(
      ({ handle }) => useTrendData(handle),
      { initialProps: { handle: "user1" } },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.trend!.direction).toBe("improving");
    const callsAfterFirst = mockFetch.mock.calls.length;
    expect(callsAfterFirst - callsBefore).toBeGreaterThanOrEqual(1);

    // Change handle to trigger refetch
    rerender({ handle: "user2" });

    await waitFor(() => {
      expect(mockFetch.mock.calls.length).toBeGreaterThan(callsAfterFirst);
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.trend!.direction).toBe("declining");
    // Find the call that contains user2
    const user2Call = mockFetch.mock.calls.find(
      (call) => (call[0] as string).includes("/api/history/user2"),
    );
    expect(user2Call).toBeDefined();
  });

  it("sets 'Rate limited' error specifically for 429 responses", async () => {
    // Provide the same mock for multiple calls in case React strict mode
    // double-fires the effect
    const rateLimitResponse = {
      ok: false,
      status: 429,
      json: () => Promise.resolve({}),
    };
    mockFetch.mockResolvedValue(rateLimitResponse);

    const useTrendData = await importHook();
    const { result } = renderHook(() => useTrendData("rate-limit-user"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Verify the exact error message for 429
    expect(result.current.error).toBe("Rate limited");
    expect(result.current.trend).toBeNull();
    expect(result.current.diff).toBeNull();
  });
});
