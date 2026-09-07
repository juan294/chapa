// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { StrictMode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { useOwnerCacheWarm, clearCacheWarmState, markCacheWarmed } from "./useOwnerCacheWarm";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetchOk() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true }),
  );
}

function mockFetchFail(status = 429) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: false, status }),
  );
}

function mockFetchReject() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockRejectedValue(new Error("Network error")),
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useOwnerCacheWarm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mockFetchOk();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls POST /api/refresh when isOwner is true", () => {
    renderHook(() => useOwnerCacheWarm("testuser", true));

    expect(fetch).toHaveBeenCalledWith(
      "/api/refresh?handle=testuser",
      { method: "POST" },
    );
  });

  it("does NOT call refresh when isOwner is false", () => {
    renderHook(() => useOwnerCacheWarm("testuser", false));

    expect(fetch).not.toHaveBeenCalled();
  });

  it("skips refresh if sessionStorage flag is already set", () => {
    sessionStorage.setItem("chapa:refreshed:testuser", "1");

    renderHook(() => useOwnerCacheWarm("testuser", true));

    expect(fetch).not.toHaveBeenCalled();
  });

  it("sets sessionStorage flag after successful refresh", async () => {
    renderHook(() => useOwnerCacheWarm("testuser", true));

    await waitFor(() => {
      expect(sessionStorage.getItem("chapa:refreshed:testuser")).toBe("1");
    });
  });

  it("calls router.refresh() after successful refresh", async () => {
    renderHook(() => useOwnerCacheWarm("testuser", true));

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it("does not re-render on a failed refresh (429)", async () => {
    mockFetchFail(429);

    renderHook(() => useOwnerCacheWarm("testuser", true));

    // Wait for the fetch to complete
    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });

    // Give microtasks time to settle
    await new Promise((r) => setTimeout(r, 10));

    expect(mockRefresh).not.toHaveBeenCalled();
  });

  // LE-5-2 — a 429 means the hourly refresh budget is spent. The next mount
  // in this tab (a client navigation back to the page, a router.refresh from
  // the toolbar) must not spend a request it already knows will be refused.
  it("does not post again in the same tab session after a 429", async () => {
    mockFetchFail(429);

    const first = renderHook(() => useOwnerCacheWarm("testuser", true));
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1);
    });
    await new Promise((r) => setTimeout(r, 10));
    first.unmount();

    renderHook(() => useOwnerCacheWarm("testuser", true));
    await new Promise((r) => setTimeout(r, 10));

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  // LE-5-2 — React StrictMode runs the effect twice on mount (mount, cleanup,
  // mount). The second run used to find no flag because the first attempt had
  // not settled yet, and posted a second refresh 7 ms after the first.
  it("posts once when the effect re-runs before the first attempt settles", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));

    renderHook(() => useOwnerCacheWarm("testuser", true), { wrapper: StrictMode });

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("does not throw on network error", async () => {
    mockFetchReject();

    // Should not throw
    renderHook(() => useOwnerCacheWarm("testuser", true));

    // Wait for the rejected promise to settle
    await new Promise((r) => setTimeout(r, 10));

    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("encodes special characters in handle", () => {
    renderHook(() => useOwnerCacheWarm("user name", true));

    expect(fetch).toHaveBeenCalledWith(
      "/api/refresh?handle=user%20name",
      { method: "POST" },
    );
  });
});

describe("markCacheWarmed", () => {
  beforeEach(() => {
    sessionStorage.clear();
    mockFetchOk();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // LE-5-2 — /generating just fetched with the same session token the warm
  // would use, so the visit that follows it must not spend a refresh.
  it("makes the next owner visit skip the refresh", () => {
    markCacheWarmed("testuser");

    renderHook(() => useOwnerCacheWarm("testuser", true));

    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not throw when sessionStorage is unavailable", () => {
    const original = Object.getOwnPropertyDescriptor(window, "sessionStorage");
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      get() { throw new Error("blocked"); },
    });
    try {
      expect(() => markCacheWarmed("testuser")).not.toThrow();
    } finally {
      if (original) Object.defineProperty(window, "sessionStorage", original);
    }
  });
});

describe("clearCacheWarmState", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it("is exported from useOwnerCacheWarm module", () => {
    expect(typeof clearCacheWarmState).toBe("function");
  });

  it("removes all chapa:refreshed: keys from sessionStorage", () => {
    sessionStorage.setItem("chapa:refreshed:userA", "1");
    sessionStorage.setItem("chapa:refreshed:userB", "1");
    sessionStorage.setItem("unrelated-key", "keep");

    clearCacheWarmState();

    expect(sessionStorage.getItem("chapa:refreshed:userA")).toBeNull();
    expect(sessionStorage.getItem("chapa:refreshed:userB")).toBeNull();
    // Unrelated keys must not be removed
    expect(sessionStorage.getItem("unrelated-key")).toBe("keep");
  });

  it("does nothing when sessionStorage has no chapa:refreshed: entries", () => {
    sessionStorage.setItem("other-app-key", "value");

    expect(() => clearCacheWarmState()).not.toThrow();
    expect(sessionStorage.getItem("other-app-key")).toBe("value");
  });

  it("does nothing when sessionStorage is empty", () => {
    expect(() => clearCacheWarmState()).not.toThrow();
  });
});
