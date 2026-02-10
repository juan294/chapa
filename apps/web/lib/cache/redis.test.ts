import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock @upstash/redis BEFORE importing the module under test.
// We control the mock Redis instance from this scope.
// ---------------------------------------------------------------------------

const mockGet = vi.fn();
const mockSet = vi.fn();
const mockDel = vi.fn();

vi.mock("@upstash/redis", () => ({
  Redis: class MockRedis {
    get = mockGet;
    set = mockSet;
    del = mockDel;
  },
}));

// Import after mock is set up
import { cacheGet, cacheSet, cacheDel, _resetClient } from "./redis";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();

  // Reset the lazy singleton so each test gets a fresh client
  _resetClient();

  // Ensure env vars are set for tests (so getRedis() creates a client)
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://fake-redis.upstash.io");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "fake-token");
});

// ---------------------------------------------------------------------------
// cacheGet
// ---------------------------------------------------------------------------

describe("cacheGet", () => {
  it("returns cached value on cache hit", async () => {
    mockGet.mockResolvedValueOnce({ score: 42, tier: "Solid" });

    const result = await cacheGet<{ score: number; tier: string }>(
      "impact:test-user",
    );

    expect(result).toEqual({ score: 42, tier: "Solid" });
    expect(mockGet).toHaveBeenCalledWith("impact:test-user");
  });

  it("returns null on cache miss (key does not exist)", async () => {
    mockGet.mockResolvedValueOnce(null);

    const result = await cacheGet("impact:nonexistent");

    expect(result).toBeNull();
  });

  it("returns null when Redis throws (graceful degradation)", async () => {
    mockGet.mockRejectedValueOnce(new Error("Connection refused"));

    const result = await cacheGet("impact:test-user");

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// cacheSet
// ---------------------------------------------------------------------------

describe("cacheSet", () => {
  it("stores value with default TTL (86400s)", async () => {
    mockSet.mockResolvedValueOnce("OK");

    await cacheSet("impact:test-user", { score: 42 });

    expect(mockSet).toHaveBeenCalledWith(
      "impact:test-user",
      { score: 42 },
      { ex: 86400 },
    );
  });

  it("stores value with custom TTL", async () => {
    mockSet.mockResolvedValueOnce("OK");

    await cacheSet("stats:test-user", { commits: 10 }, 3600);

    expect(mockSet).toHaveBeenCalledWith(
      "stats:test-user",
      { commits: 10 },
      { ex: 3600 },
    );
  });

  it("does not throw when Redis is down (graceful degradation)", async () => {
    mockSet.mockRejectedValueOnce(new Error("Connection refused"));

    // Should not throw — just silently fail
    await expect(
      cacheSet("impact:test-user", { score: 42 }),
    ).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// cacheDel
// ---------------------------------------------------------------------------

describe("cacheDel", () => {
  it("deletes a key from Redis", async () => {
    mockDel.mockResolvedValueOnce(1);

    await cacheDel("impact:test-user");

    expect(mockDel).toHaveBeenCalledWith("impact:test-user");
  });

  it("does not throw when Redis is down (graceful degradation)", async () => {
    mockDel.mockRejectedValueOnce(new Error("Connection refused"));

    await expect(cacheDel("impact:test-user")).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Missing env vars — no-op fallback
// ---------------------------------------------------------------------------

describe("missing env vars (no-op fallback)", () => {
  it("cacheGet returns null when env vars are missing", async () => {
    // Reset singleton and clear env vars so getRedis() returns null
    _resetClient();
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

    const result = await cacheGet("anything");
    expect(result).toBeNull();

    // Verify Redis was never called (client was null)
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("cacheSet is a no-op when env vars are missing", async () => {
    _resetClient();
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

    await cacheSet("anything", { data: true });

    expect(mockSet).not.toHaveBeenCalled();
  });

  it("cacheDel is a no-op when env vars are missing", async () => {
    _resetClient();
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

    await cacheDel("anything");

    expect(mockDel).not.toHaveBeenCalled();
  });
});
