// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

// Reset the module-level cache between tests by re-importing
let useSession: typeof import("./useSession").useSession;
let clearSessionCache: typeof import("./useSession").clearSessionCache;

beforeEach(async () => {
  vi.restoreAllMocks();
  // Reset the module to clear the module-level promise cache
  vi.resetModules();
  const mod = await import("./useSession");
  useSession = mod.useSession;
  clearSessionCache = mod.clearSessionCache;
});

afterEach(() => {
  vi.restoreAllMocks();
});

function mockFetchSession(user: { login: string; name?: string | null; avatar_url?: string } | null) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ user }),
    }),
  );
}

function mockFetchSessionFailure() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockRejectedValue(new Error("Network error")),
  );
}

describe("useSession", () => {
  describe("initial state", () => {
    it("starts with session = null and loading = true", () => {
      mockFetchSession({ login: "testuser", name: "Test", avatar_url: "https://example.com/avatar.png" });

      const { result } = renderHook(() => useSession());
      expect(result.current.session).toBeNull();
      expect(result.current.loading).toBe(true);
    });
  });

  describe("successful fetch", () => {
    it("returns session data after fetch resolves", async () => {
      const user = { login: "testuser", name: "Test User", avatar_url: "https://example.com/avatar.png" };
      mockFetchSession(user);

      const { result } = renderHook(() => useSession());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.session).toEqual(user);
    });

    it("returns session = null when user is not logged in", async () => {
      mockFetchSession(null);

      const { result } = renderHook(() => useSession());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.session).toBeNull();
    });
  });

  describe("fetch failure", () => {
    it("returns session = null when fetch fails", async () => {
      mockFetchSessionFailure();

      const { result } = renderHook(() => useSession());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.session).toBeNull();
    });
  });

  describe("deduplication", () => {
    it("only calls fetch once for multiple concurrent hook instances", async () => {
      const user = { login: "testuser", name: "Test", avatar_url: "https://example.com/avatar.png" };
      mockFetchSession(user);

      const { result: result1 } = renderHook(() => useSession());
      const { result: result2 } = renderHook(() => useSession());
      const { result: result3 } = renderHook(() => useSession());

      await waitFor(() => {
        expect(result1.current.loading).toBe(false);
      });
      await waitFor(() => {
        expect(result2.current.loading).toBe(false);
      });
      await waitFor(() => {
        expect(result3.current.loading).toBe(false);
      });

      // All three should have the same session
      expect(result1.current.session).toEqual(user);
      expect(result2.current.session).toEqual(user);
      expect(result3.current.session).toEqual(user);

      // fetch should have been called only once
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith("/api/auth/session");
    });
  });

  describe("invalidation", () => {
    it("re-fetches when invalidate is called", async () => {
      const user1 = { login: "user1", name: "User 1", avatar_url: "https://example.com/1.png" };
      const user2 = { login: "user2", name: "User 2", avatar_url: "https://example.com/2.png" };

      let callCount = 0;
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation(() => {
          callCount++;
          const user = callCount === 1 ? user1 : user2;
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ user }),
          });
        }),
      );

      const { result } = renderHook(() => useSession());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.session).toEqual(user1);

      // Invalidate and re-fetch
      act(() => {
        result.current.invalidate();
      });

      await waitFor(() => {
        expect(result.current.session).toEqual(user2);
      });

      expect(callCount).toBe(2);
    });
  });
});

describe("clearSessionCache", () => {
  it("is exported from useSession module", () => {
    expect(typeof clearSessionCache).toBe("function");
  });

  it("clears the module-level cache so the next hook render re-fetches", async () => {
    const user1 = { login: "userA", name: "User A", avatar_url: "https://example.com/a.png" };
    const user2 = { login: "userB", name: "User B", avatar_url: "https://example.com/b.png" };

    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        callCount++;
        const user = callCount === 1 ? user1 : user2;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ user }),
        });
      }),
    );

    // First render — populates the cache with user1
    const { result: result1 } = renderHook(() => useSession());
    await waitFor(() => {
      expect(result1.current.loading).toBe(false);
    });
    expect(result1.current.session?.login).toBe("userA");
    expect(callCount).toBe(1);

    // clearSessionCache — wipes both cachedPromise and cachedResult
    clearSessionCache();

    // Second render — cache is gone, must re-fetch and get user2
    const { result: result2 } = renderHook(() => useSession());
    await waitFor(() => {
      expect(result2.current.loading).toBe(false);
    });
    expect(result2.current.session?.login).toBe("userB");
    expect(callCount).toBe(2);
  });
});
