// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor, cleanup } from "@testing-library/react";
import { useAdminDashboard } from "./useAdminDashboard";

afterEach(cleanup);

// ---------------------------------------------------------------------------
// Fetch mock
// ---------------------------------------------------------------------------

const mockUsers = [
  { handle: "alice", displayName: "Alice", tier: "Elite", archetype: "Builder", adjustedComposite: 90, rawScore: 85, confidence: 95 },
  { handle: "bob", displayName: "Bob", tier: "High", archetype: "Marathoner", adjustedComposite: 72, rawScore: 68, confidence: 80 },
  { handle: "charlie", displayName: null, tier: "Solid", archetype: null, adjustedComposite: 50, rawScore: 48, confidence: 70 },
];

function mockFetchSuccess() {
  vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ users: mockUsers }),
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
      // Before fetch resolves, loading should be true
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
  });

  describe("fetch users", () => {
    it("fetches users on mount and updates state", async () => {
      mockFetchSuccess();
      const { result } = renderHook(() => useAdminDashboard());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.users).toEqual(mockUsers);
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

      // Trigger a manual refresh
      let refreshPromise: Promise<void>;
      act(() => {
        refreshPromise = result.current.fetchUsers(true);
      });

      // refreshing should be true while fetch is in-flight
      expect(result.current.refreshing).toBe(true);

      await act(async () => {
        await refreshPromise!;
      });

      expect(result.current.refreshing).toBe(false);
    });
  });

  describe("search filtering", () => {
    it("returns all users when search is empty", async () => {
      mockFetchSuccess();
      const { result } = renderHook(() => useAdminDashboard());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.filtered).toHaveLength(3);
    });

    it("filters users by handle", async () => {
      mockFetchSuccess();
      const { result } = renderHook(() => useAdminDashboard());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.setSearch("ali");
      });

      // useDeferredValue may lag; wait for the filtered list to update
      await waitFor(() => {
        expect(result.current.filtered).toHaveLength(1);
      });

      expect(result.current.filtered[0]!.handle).toBe("alice");
    });

    it("filters users by display name", async () => {
      mockFetchSuccess();
      const { result } = renderHook(() => useAdminDashboard());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.setSearch("Bob");
      });

      await waitFor(() => {
        expect(result.current.filtered).toHaveLength(1);
      });

      expect(result.current.filtered[0]!.handle).toBe("bob");
    });

    it("returns empty array when no users match", async () => {
      mockFetchSuccess();
      const { result } = renderHook(() => useAdminDashboard());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.setSearch("nonexistent");
      });

      await waitFor(() => {
        expect(result.current.filtered).toHaveLength(0);
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

      // Toggle to asc first
      act(() => {
        result.current.handleSort("adjustedComposite");
      });
      expect(result.current.sortDir).toBe("asc");

      // Click a different field
      act(() => {
        result.current.handleSort("handle");
      });

      expect(result.current.sortField).toBe("handle");
      expect(result.current.sortDir).toBe("desc");
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
    it("computes tier counts from users", async () => {
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
});
