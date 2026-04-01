// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useOwnerCacheWarm } from "./useOwnerCacheWarm";

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

  it("does not set sessionStorage on failed refresh (429)", async () => {
    mockFetchFail(429);

    renderHook(() => useOwnerCacheWarm("testuser", true));

    // Wait for the fetch to complete
    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });

    // Give microtasks time to settle
    await new Promise((r) => setTimeout(r, 10));

    expect(sessionStorage.getItem("chapa:refreshed:testuser")).toBeNull();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("does not throw on network error", async () => {
    mockFetchReject();

    // Should not throw
    renderHook(() => useOwnerCacheWarm("testuser", true));

    // Wait for the rejected promise to settle
    await new Promise((r) => setTimeout(r, 10));

    expect(sessionStorage.getItem("chapa:refreshed:testuser")).toBeNull();
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
