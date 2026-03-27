// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor, cleanup } from "@testing-library/react";
import { useAdminDashboard } from "./useAdminDashboard";
import type { PaginatedResponse } from "./admin-types";

afterEach(cleanup);

// ---------------------------------------------------------------------------
// Fetch mock helpers
// ---------------------------------------------------------------------------

const mockUsers = [
  {
    handle: "alice", displayName: "Alice", tier: "Elite", archetype: "Builder",
    adjustedComposite: 90, rawScore: 85, confidence: 95,
    registeredAt: "2025-01-01T00:00:00Z", lastSnapshotDate: "2025-06-01",
    fetchedAt: "2025-06-01T12:00:00Z", commitsTotal: 100, prsMergedCount: 20,
    reviewsSubmittedCount: 15, activeDays: 180, reposContributed: 8, totalStars: 50,
    avatarUrl: null,
  },
  {
    handle: "bob", displayName: "Bob", tier: "High", archetype: "Marathoner",
    adjustedComposite: 72, rawScore: 68, confidence: 80,
    registeredAt: "2025-02-01T00:00:00Z", lastSnapshotDate: "2025-05-15",
    fetchedAt: "2025-05-15T12:00:00Z", commitsTotal: 80, prsMergedCount: 10,
    reviewsSubmittedCount: 5, activeDays: 120, reposContributed: 4, totalStars: 20,
    avatarUrl: null,
  },
  {
    handle: "charlie", displayName: null, tier: "Solid", archetype: null,
    adjustedComposite: 50, rawScore: 48, confidence: 70,
    registeredAt: "2025-03-01T00:00:00Z", lastSnapshotDate: null,
    fetchedAt: null, commitsTotal: null, prsMergedCount: null,
    reviewsSubmittedCount: null, activeDays: null, reposContributed: null, totalStars: null,
    avatarUrl: null,
  },
];

function makePaginatedResponse(overrides: Partial<PaginatedResponse> = {}): PaginatedResponse {
  return {
    users: mockUsers,
    total: 50,
    page: 1,
    limit: 25,
    totalPages: 2,
    ...overrides,
  };
}

function mockFetchSuccess(response?: Partial<PaginatedResponse>) {
  vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(makePaginatedResponse(response)),
  } as Response);
}

function mockFetchError(status = 500) {
  vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.resolve({ error: `HTTP ${status}` }),
  } as Response);
}

beforeEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useAdminDashboard", () => {
  describe("initial state", () => {
    it("starts with loading=true and empty users", () => {
      mockFetchSuccess();
      const { result } = renderHook(() => useAdminDashboard());
      expect(result.current.loading).toBe(true);
      expect(result.current.users).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it("starts with default sort field and direction", () => {
      mockFetchSuccess();
      const { result } = renderHook(() => useAdminDashboard());
      expect(result.current.sortField).toBe("adjustedComposite");
      expect(result.current.sortDir).toBe("desc");
    });

    it("starts with empty search", () => {
      mockFetchSuccess();
      const { result } = renderHook(() => useAdminDashboard());
      expect(result.current.search).toBe("");
    });

    it("starts with users tab active", () => {
      mockFetchSuccess();
      const { result } = renderHook(() => useAdminDashboard());
      expect(result.current.activeTab).toBe("users");
    });

    it("starts with page=1", () => {
      mockFetchSuccess();
      const { result } = renderHook(() => useAdminDashboard());
      expect(result.current.page).toBe(1);
    });
  });

  describe("fetch users with server-side params", () => {
    it("fetches with default params on mount", async () => {
      mockFetchSuccess();
      const { result } = renderHook(() => useAdminDashboard());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("page=1"),
      );
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("limit=25"),
      );
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("sort=adjustedComposite"),
      );
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("dir=desc"),
      );
    });

    it("stores users, total, and totalPages from response", async () => {
      mockFetchSuccess({ total: 150, page: 1, totalPages: 6 });
      const { result } = renderHook(() => useAdminDashboard());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.users).toEqual(mockUsers);
      expect(result.current.total).toBe(150);
      expect(result.current.totalPages).toBe(6);
      expect(result.current.error).toBeNull();
      expect(result.current.lastRefreshed).not.toBeNull();
    });

    it("sets error state on fetch failure", async () => {
      mockFetchError(500);
      const { result } = renderHook(() => useAdminDashboard());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe("HTTP 500");
      expect(result.current.users).toEqual([]);
    });

    it("sets refreshing=true during manual refresh", async () => {
      mockFetchSuccess();
      const { result } = renderHook(() => useAdminDashboard());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let refreshPromise: Promise<void>;
      act(() => {
        refreshPromise = result.current.fetchUsers(true);
      });

      expect(result.current.refreshing).toBe(true);

      await act(async () => {
        await refreshPromise!;
      });

      expect(result.current.refreshing).toBe(false);
    });
  });

  describe("pagination", () => {
    it("re-fetches when page changes", async () => {
      mockFetchSuccess();
      const { result } = renderHook(() => useAdminDashboard());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      vi.mocked(globalThis.fetch).mockClear();
      mockFetchSuccess({ page: 2 });

      act(() => {
        result.current.setPage(2);
      });

      await waitFor(() => {
        expect(globalThis.fetch).toHaveBeenCalledWith(
          expect.stringContaining("page=2"),
        );
      });
    });
  });

  describe("sort handling", () => {
    it("toggles sort direction when clicking the same field", async () => {
      mockFetchSuccess();
      const { result } = renderHook(() => useAdminDashboard());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.sortDir).toBe("desc");

      act(() => {
        result.current.handleSort("adjustedComposite");
      });

      expect(result.current.sortDir).toBe("asc");
    });

    it("resets to desc when clicking a different field", async () => {
      mockFetchSuccess();
      const { result } = renderHook(() => useAdminDashboard());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.handleSort("adjustedComposite");
      });
      expect(result.current.sortDir).toBe("asc");

      act(() => {
        result.current.handleSort("handle");
      });

      expect(result.current.sortField).toBe("handle");
      expect(result.current.sortDir).toBe("desc");
    });

    it("resets to page 1 on sort change", async () => {
      mockFetchSuccess();
      const { result } = renderHook(() => useAdminDashboard());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.setPage(3);
      });

      act(() => {
        result.current.handleSort("handle");
      });

      expect(result.current.page).toBe(1);
    });

    it("re-fetches with updated sort param", async () => {
      mockFetchSuccess();
      const { result } = renderHook(() => useAdminDashboard());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      vi.mocked(globalThis.fetch).mockClear();
      mockFetchSuccess();

      act(() => {
        result.current.handleSort("handle");
      });

      await waitFor(() => {
        expect(globalThis.fetch).toHaveBeenCalledWith(
          expect.stringContaining("sort=handle"),
        );
      });
    });
  });

  describe("search handling", () => {
    it("resets to page 1 on search change", async () => {
      mockFetchSuccess();
      const { result } = renderHook(() => useAdminDashboard());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.setPage(3);
      });

      act(() => {
        result.current.setSearch("alice");
      });

      expect(result.current.page).toBe(1);
    });
  });

  describe("tab switching", () => {
    it("switches active tab", async () => {
      mockFetchSuccess();
      const { result } = renderHook(() => useAdminDashboard());

      act(() => {
        result.current.setActiveTab("agents");
      });

      expect(result.current.activeTab).toBe("agents");
    });
  });

  describe("tier counts", () => {
    it("computes tier counts from current page users", async () => {
      mockFetchSuccess();
      const { result } = renderHook(() => useAdminDashboard());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.tierCounts.Elite).toBe(1);
      expect(result.current.tierCounts.High).toBe(1);
      expect(result.current.tierCounts.Solid).toBe(1);
      expect(result.current.tierCounts.Emerging).toBe(0);
    });
  });

  describe("does not expose client-side filtered/sorted", () => {
    it("has no filtered or sorted properties", async () => {
      mockFetchSuccess();
      const { result } = renderHook(() => useAdminDashboard());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current).not.toHaveProperty("filtered");
      expect(result.current).not.toHaveProperty("sorted");
    });
  });

  describe("JSON parse failure on error response", () => {
    it("falls back to HTTP status when res.json() rejects", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: false,
        status: 502,
        json: () => Promise.reject(new Error("invalid json")),
      } as Response);

      const { result } = renderHook(() => useAdminDashboard());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // The catch inside fetchUsers does: body?.error ?? `HTTP ${res.status}`
      // When json() rejects, body is null, so fallback is `HTTP 502`
      expect(result.current.error).toBe("HTTP 502");
      expect(result.current.users).toEqual([]);
    });
  });

  describe("custom event: chapa:admin-refresh", () => {
    it("triggers a re-fetch when dispatched", async () => {
      mockFetchSuccess();
      const { result } = renderHook(() => useAdminDashboard());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Clear fetch mock and set up a new response
      vi.mocked(globalThis.fetch).mockClear();
      mockFetchSuccess({ total: 99, totalPages: 4 });

      // Dispatch the custom event
      act(() => {
        window.dispatchEvent(new Event("chapa:admin-refresh"));
      });

      await waitFor(() => {
        expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      });

      await waitFor(() => {
        expect(result.current.total).toBe(99);
      });
    });
  });

  describe("custom event: chapa:admin-tab", () => {
    it("switches tab when dispatched with valid tab detail", async () => {
      mockFetchSuccess();
      const { result } = renderHook(() => useAdminDashboard());

      expect(result.current.activeTab).toBe("users");

      act(() => {
        window.dispatchEvent(
          new CustomEvent("chapa:admin-tab", { detail: { tab: "agents" } }),
        );
      });

      expect(result.current.activeTab).toBe("agents");
    });

    it("switches to engagement tab", async () => {
      mockFetchSuccess();
      const { result } = renderHook(() => useAdminDashboard());

      act(() => {
        window.dispatchEvent(
          new CustomEvent("chapa:admin-tab", { detail: { tab: "engagement" } }),
        );
      });

      expect(result.current.activeTab).toBe("engagement");
    });

    it("switches to campaigns tab", async () => {
      mockFetchSuccess();
      const { result } = renderHook(() => useAdminDashboard());

      act(() => {
        window.dispatchEvent(
          new CustomEvent("chapa:admin-tab", { detail: { tab: "campaigns" } }),
        );
      });

      expect(result.current.activeTab).toBe("campaigns");
    });

    it("ignores invalid tab values", async () => {
      mockFetchSuccess();
      const { result } = renderHook(() => useAdminDashboard());

      expect(result.current.activeTab).toBe("users");

      act(() => {
        window.dispatchEvent(
          new CustomEvent("chapa:admin-tab", { detail: { tab: "invalid" } }),
        );
      });

      expect(result.current.activeTab).toBe("users");
    });
  });

  describe("custom event: chapa:admin-sort", () => {
    it("sets sort field and direction when both provided", async () => {
      mockFetchSuccess();
      const { result } = renderHook(() => useAdminDashboard());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        window.dispatchEvent(
          new CustomEvent("chapa:admin-sort", {
            detail: { field: "handle", dir: "asc" },
          }),
        );
      });

      expect(result.current.sortField).toBe("handle");
      expect(result.current.sortDir).toBe("asc");
    });

    it("uses handleSort when only field provided (no dir)", async () => {
      mockFetchSuccess();
      const { result } = renderHook(() => useAdminDashboard());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Default is adjustedComposite desc. Sort same field toggles direction.
      act(() => {
        window.dispatchEvent(
          new CustomEvent("chapa:admin-sort", {
            detail: { field: "adjustedComposite" },
          }),
        );
      });

      expect(result.current.sortField).toBe("adjustedComposite");
      expect(result.current.sortDir).toBe("asc");
    });

    it("ignores event when field is missing", async () => {
      mockFetchSuccess();
      const { result } = renderHook(() => useAdminDashboard());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        window.dispatchEvent(
          new CustomEvent("chapa:admin-sort", { detail: {} }),
        );
      });

      // Should remain at defaults
      expect(result.current.sortField).toBe("adjustedComposite");
      expect(result.current.sortDir).toBe("desc");
    });
  });

  describe("tier nullish coalescing", () => {
    it("handles users with null/undefined tier gracefully", async () => {
      const usersWithMissingTier = [
        {
          handle: "alice", displayName: "Alice", tier: "Elite", archetype: "Builder",
          adjustedComposite: 90, rawScore: 85, confidence: 95,
          registeredAt: "2025-01-01T00:00:00Z", lastSnapshotDate: "2025-06-01",
          fetchedAt: "2025-06-01T12:00:00Z", commitsTotal: 100, prsMergedCount: 20,
          reviewsSubmittedCount: 15, activeDays: 180, reposContributed: 8, totalStars: 50,
          avatarUrl: null,
        },
        {
          handle: "norank", displayName: "No Rank", tier: null, archetype: null,
          adjustedComposite: 10, rawScore: 5, confidence: 50,
          registeredAt: "2025-04-01T00:00:00Z", lastSnapshotDate: null,
          fetchedAt: null, commitsTotal: null, prsMergedCount: null,
          reviewsSubmittedCount: null, activeDays: null, reposContributed: null, totalStars: null,
          avatarUrl: null,
        },
      ];

      mockFetchSuccess({ users: usersWithMissingTier });
      const { result } = renderHook(() => useAdminDashboard());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // The null-tier user should not cause a crash
      expect(result.current.users).toHaveLength(2);
      // Elite count from alice
      expect(result.current.tierCounts.Elite).toBe(1);
      // Defaults should still be 0
      expect(result.current.tierCounts.High).toBe(0);
      expect(result.current.tierCounts.Solid).toBe(0);
      expect(result.current.tierCounts.Emerging).toBe(0);
    });
  });

  describe("loading state during refresh vs initial load", () => {
    it("does not set loading=true during a refresh (only refreshing)", async () => {
      mockFetchSuccess();
      const { result } = renderHook(() => useAdminDashboard());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // At this point loading is false. Trigger a refresh.
      let refreshPromise: Promise<void>;
      act(() => {
        refreshPromise = result.current.fetchUsers(true);
      });

      // refreshing should be true, loading should remain false
      expect(result.current.refreshing).toBe(true);
      expect(result.current.loading).toBe(false);

      await act(async () => {
        await refreshPromise!;
      });

      expect(result.current.refreshing).toBe(false);
    });
  });

  describe("error cleared on successful retry", () => {
    it("clears error after a successful fetch following a failure", async () => {
      // Start with a failing fetch
      mockFetchError(503);
      const { result } = renderHook(() => useAdminDashboard());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe("HTTP 503");

      // Now mock a successful response
      vi.mocked(globalThis.fetch).mockClear();
      mockFetchSuccess({ total: 10, totalPages: 1 });

      // Trigger a refresh
      await act(async () => {
        await result.current.fetchUsers(true);
      });

      // Error should be cleared
      expect(result.current.error).toBeNull();
      expect(result.current.users).toEqual(mockUsers);
      expect(result.current.total).toBe(10);
    });
  });
});
