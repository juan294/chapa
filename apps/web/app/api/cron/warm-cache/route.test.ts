import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/cache/redis", () => ({
  scanKeys: vi.fn(),
}));

vi.mock("@/lib/github/client", () => ({
  getStats: vi.fn(),
}));

import { scanKeys } from "@/lib/cache/redis";
import { getStats } from "@/lib/github/client";
import { GET } from "./route";

const mockedScanKeys = vi.mocked(scanKeys);
const mockedGetStats = vi.mocked(getStats);

function makeRequest(cronSecret?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (cronSecret) {
    headers["Authorization"] = `Bearer ${cronSecret}`;
  }
  return new NextRequest("http://localhost:3001/api/cron/warm-cache", {
    method: "GET",
    headers,
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  process.env.CRON_SECRET = "test-cron-secret";
});

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

describe("GET /api/cron/warm-cache", () => {
  describe("authentication", () => {
    it("returns 401 when no Authorization header is provided", async () => {
      const res = await GET(makeRequest());
      expect(res.status).toBe(401);
    });

    it("returns 401 when CRON_SECRET env var is not set", async () => {
      delete process.env.CRON_SECRET;
      const res = await GET(makeRequest("test-cron-secret"));
      expect(res.status).toBe(401);
    });

    it("returns 401 when token does not match CRON_SECRET", async () => {
      const res = await GET(makeRequest("wrong-secret"));
      expect(res.status).toBe(401);
    });

    it("accepts a valid CRON_SECRET token", async () => {
      mockedScanKeys.mockResolvedValue([]);
      const res = await GET(makeRequest("test-cron-secret"));
      expect(res.status).toBe(200);
    });
  });

  // ---------------------------------------------------------------------------
  // Handle discovery
  // ---------------------------------------------------------------------------

  describe("handle discovery", () => {
    it("scans both primary and stale cache keys", async () => {
      mockedScanKeys.mockResolvedValue([]);
      await GET(makeRequest("test-cron-secret"));

      expect(mockedScanKeys).toHaveBeenCalledWith("stats:v2:*");
      expect(mockedScanKeys).toHaveBeenCalledWith("stats:stale:*");
    });

    it("deduplicates handles from primary and stale keys", async () => {
      mockedScanKeys
        .mockResolvedValueOnce(["stats:v2:alice", "stats:v2:bob"]) // primary
        .mockResolvedValueOnce(["stats:stale:alice", "stats:stale:charlie"]); // stale

      mockedGetStats.mockResolvedValue(null);

      const res = await GET(makeRequest("test-cron-secret"));
      const body = await res.json();

      // alice appears in both — should only be warmed once
      expect(body.handles).toHaveLength(3);
      expect(new Set(body.handles)).toEqual(new Set(["alice", "bob", "charlie"]));
    });

    it("returns empty results when no cached handles exist", async () => {
      mockedScanKeys.mockResolvedValue([]);

      const res = await GET(makeRequest("test-cron-secret"));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.warmed).toBe(0);
      expect(body.handles).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // Cache warming
  // ---------------------------------------------------------------------------

  describe("cache warming", () => {
    it("calls getStats for each discovered handle", async () => {
      mockedScanKeys
        .mockResolvedValueOnce(["stats:v2:alice", "stats:v2:bob"])
        .mockResolvedValueOnce([]);

      mockedGetStats.mockResolvedValue({ handle: "mock" } as never);

      await GET(makeRequest("test-cron-secret"));

      expect(mockedGetStats).toHaveBeenCalledWith("alice", undefined);
      expect(mockedGetStats).toHaveBeenCalledWith("bob", undefined);
    });

    it("uses GITHUB_TOKEN when available", async () => {
      process.env.GITHUB_TOKEN = "ghp_test_token";
      mockedScanKeys
        .mockResolvedValueOnce(["stats:v2:alice"])
        .mockResolvedValueOnce([]);

      mockedGetStats.mockResolvedValue({ handle: "mock" } as never);

      await GET(makeRequest("test-cron-secret"));

      expect(mockedGetStats).toHaveBeenCalledWith("alice", "ghp_test_token");

      delete process.env.GITHUB_TOKEN;
    });

    it("reports warmed count (successful fetches only)", async () => {
      mockedScanKeys
        .mockResolvedValueOnce(["stats:v2:alice", "stats:v2:bob", "stats:v2:charlie"])
        .mockResolvedValueOnce([]);

      mockedGetStats
        .mockResolvedValueOnce({ handle: "alice" } as never) // success
        .mockResolvedValueOnce(null) // failure
        .mockResolvedValueOnce({ handle: "charlie" } as never); // success

      const res = await GET(makeRequest("test-cron-secret"));
      const body = await res.json();

      expect(body.warmed).toBe(2);
      expect(body.failed).toBe(1);
    });

    it("caps at 50 handles per run", async () => {
      const keys = Array.from({ length: 60 }, (_, i) => `stats:v2:user${i}`);
      mockedScanKeys
        .mockResolvedValueOnce(keys)
        .mockResolvedValueOnce([]);

      mockedGetStats.mockResolvedValue({ handle: "mock" } as never);

      const res = await GET(makeRequest("test-cron-secret"));
      const body = await res.json();

      expect(mockedGetStats).toHaveBeenCalledTimes(50);
      expect(body.handles).toHaveLength(50);
    });

    it("continues warming even if individual fetches fail", async () => {
      mockedScanKeys
        .mockResolvedValueOnce(["stats:v2:alice", "stats:v2:bob"])
        .mockResolvedValueOnce([]);

      mockedGetStats
        .mockRejectedValueOnce(new Error("network error"))
        .mockResolvedValueOnce({ handle: "bob" } as never);

      const res = await GET(makeRequest("test-cron-secret"));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.warmed).toBe(1);
      expect(body.failed).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Response shape
  // ---------------------------------------------------------------------------

  describe("response", () => {
    it("returns no-store cache control", async () => {
      mockedScanKeys.mockResolvedValue([]);
      const res = await GET(makeRequest("test-cron-secret"));
      expect(res.headers.get("Cache-Control")).toBe("no-store");
    });

    it("returns the expected JSON shape", async () => {
      mockedScanKeys
        .mockResolvedValueOnce(["stats:v2:alice"])
        .mockResolvedValueOnce([]);

      mockedGetStats.mockResolvedValue({ handle: "alice" } as never);

      const res = await GET(makeRequest("test-cron-secret"));
      const body = await res.json();

      expect(body).toMatchObject({
        warmed: 1,
        failed: 0,
        total: 1,
        handles: ["alice"],
      });
      expect(typeof body.durationMs).toBe("number");
    });
  });
});
