import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock @upstash/redis BEFORE importing the module under test.
// We control the mock Redis instance from this scope.
// ---------------------------------------------------------------------------

const mockGet = vi.fn();
const mockSet = vi.fn();
const mockDel = vi.fn();
const mockIncr = vi.fn();
const mockExpire = vi.fn();
const mockPfadd = vi.fn();
const mockPfcount = vi.fn();
const mockMget = vi.fn();
const mockIncrby = vi.fn();
const mockDbsize = vi.fn();
const mockPipelineGet = vi.fn();
const mockPipelineIncrby = vi.fn();
const mockPipelineExpire = vi.fn();
const mockPipelineExec = vi.fn();
const mockPipelineFactory = vi.fn(() => ({
  get: mockPipelineGet,
  incrby: mockPipelineIncrby,
  expire: mockPipelineExpire,
  exec: mockPipelineExec,
}));

vi.mock("@upstash/redis", () => ({
  Redis: class MockRedis {
    get = mockGet;
    set = mockSet;
    del = mockDel;
    incr = mockIncr;
    expire = mockExpire;
    pfadd = mockPfadd;
    pfcount = mockPfcount;
    mget = mockMget;
    incrby = mockIncrby;
    dbsize = mockDbsize;
    pipeline = mockPipelineFactory;
  },
}));

// Import after mock is set up
import {
  cacheGet,
  cacheSet,
  cacheDel,
  rateLimit,
  trackBadgeGenerated,
  getBadgeStats,
  cacheMGet,
  pingRedis,
  cacheIncr,
  cacheReserveQuota,
  _resetClient,
} from "./redis";

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
  it("returns true on successful write with default TTL", async () => {
    mockSet.mockResolvedValueOnce("OK");

    const result = await cacheSet("impact:test-user", { score: 42 });

    expect(result).toBe(true);
    expect(mockSet).toHaveBeenCalledWith(
      "impact:test-user",
      { score: 42 },
      { ex: 21600 },
    );
  });

  it("returns true on successful write with custom TTL", async () => {
    mockSet.mockResolvedValueOnce("OK");

    const result = await cacheSet("stats:test-user", { commits: 10 }, 3600);

    expect(result).toBe(true);
    expect(mockSet).toHaveBeenCalledWith(
      "stats:test-user",
      { commits: 10 },
      { ex: 3600 },
    );
  });

  it("returns false when Redis throws (graceful degradation)", async () => {
    mockSet.mockRejectedValueOnce(new Error("Connection refused"));

    const result = await cacheSet("impact:test-user", { score: 42 });

    expect(result).toBe(false);
  });

  it("returns false when Redis is unavailable (no env vars)", async () => {
    _resetClient();
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

    const result = await cacheSet("anything", { data: true });

    expect(result).toBe(false);
    expect(mockSet).not.toHaveBeenCalled();
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

  it("cacheSet returns false when env vars are missing", async () => {
    _resetClient();
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

    const result = await cacheSet("anything", { data: true });

    expect(result).toBe(false);
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

// ---------------------------------------------------------------------------
// rateLimit
// ---------------------------------------------------------------------------

describe("rateLimit", () => {
  it("allows request when under the limit", async () => {
    mockIncr.mockResolvedValueOnce(1);
    mockExpire.mockResolvedValueOnce(1);

    const result = await rateLimit("ratelimit:test", 10, 900);

    expect(result.allowed).toBe(true);
    expect(result.current).toBe(1);
    expect(result.limit).toBe(10);
    expect(mockIncr).toHaveBeenCalledWith("ratelimit:test");
    expect(mockExpire).toHaveBeenCalledWith("ratelimit:test", 900);
  });

  it("sets expire only on first increment (current === 1)", async () => {
    mockIncr.mockResolvedValueOnce(5);

    const result = await rateLimit("ratelimit:test", 10, 900);

    expect(result.allowed).toBe(true);
    expect(result.current).toBe(5);
    expect(mockExpire).not.toHaveBeenCalled();
  });

  it("denies request when at the limit", async () => {
    mockIncr.mockResolvedValueOnce(11);

    const result = await rateLimit("ratelimit:test", 10, 900);

    expect(result.allowed).toBe(false);
    expect(result.current).toBe(11);
  });

  it("allows exactly at the limit boundary", async () => {
    mockIncr.mockResolvedValueOnce(10);

    const result = await rateLimit("ratelimit:test", 10, 900);

    expect(result.allowed).toBe(true);
    expect(result.current).toBe(10);
  });

  it("fails open when Redis throws", async () => {
    mockIncr.mockRejectedValueOnce(new Error("Connection refused"));

    const result = await rateLimit("ratelimit:test", 10, 900);

    expect(result.allowed).toBe(true);
    expect(result.current).toBe(0);
  });

  it("fails open when Redis is unavailable (no env vars)", async () => {
    _resetClient();
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

    const result = await rateLimit("ratelimit:test", 10, 900);

    expect(result.allowed).toBe(true);
    expect(mockIncr).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// cacheReserveQuota
// ---------------------------------------------------------------------------

describe("cacheReserveQuota", () => {
  it("uses a single pipeline to read and reserve quota", async () => {
    mockPipelineExec.mockResolvedValueOnce([4, 7, 1]);

    const result = await cacheReserveQuota("quota:test", 3, 10, 86400);

    expect(result).toEqual({ allowed: true, current: 7, limit: 10 });
    expect(mockPipelineFactory).toHaveBeenCalled();
    expect(mockPipelineGet).toHaveBeenCalledWith("quota:test");
    expect(mockPipelineIncrby).toHaveBeenCalledWith("quota:test", 3);
    expect(mockPipelineExpire).toHaveBeenCalledWith("quota:test", 86400);
  });

  it("compensates and denies when the reservation would exceed the limit", async () => {
    mockPipelineExec.mockResolvedValueOnce([9, 12, 1]);
    mockIncrby.mockResolvedValueOnce(9);

    const result = await cacheReserveQuota("quota:test", 3, 10, 86400);

    expect(result).toEqual({ allowed: false, current: 9, limit: 10 });
    expect(mockIncrby).toHaveBeenCalledWith("quota:test", -3);
  });

  it("fails open when Redis is unavailable", async () => {
    _resetClient();
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

    const result = await cacheReserveQuota("quota:test", 2, 10, 86400);

    expect(result).toEqual({ allowed: true, current: 0, limit: 10 });
    expect(mockPipelineFactory).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// trackBadgeGenerated
// ---------------------------------------------------------------------------

describe("trackBadgeGenerated", () => {
  it("increments total counter and adds handle to HyperLogLog", async () => {
    mockIncr.mockResolvedValueOnce(5);
    mockPfadd.mockResolvedValueOnce(1);

    await trackBadgeGenerated("juan294");

    expect(mockIncr).toHaveBeenCalledWith("stats:badges_generated");
    expect(mockPfadd).toHaveBeenCalledWith("stats:unique_badges", "juan294");
  });

  it("lowercases the handle for HyperLogLog dedup", async () => {
    mockIncr.mockResolvedValueOnce(1);
    mockPfadd.mockResolvedValueOnce(1);

    await trackBadgeGenerated("Juan294");

    expect(mockPfadd).toHaveBeenCalledWith("stats:unique_badges", "juan294");
  });

  it("does not throw when Redis fails (fire-and-forget safe)", async () => {
    mockIncr.mockRejectedValueOnce(new Error("Connection refused"));

    await expect(trackBadgeGenerated("juan294")).resolves.toBeUndefined();
  });

  it("is a no-op when Redis is unavailable", async () => {
    _resetClient();
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

    await trackBadgeGenerated("juan294");

    expect(mockIncr).not.toHaveBeenCalled();
    expect(mockPfadd).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// getBadgeStats
// ---------------------------------------------------------------------------

describe("getBadgeStats", () => {
  it("returns total and unique counts", async () => {
    mockGet.mockResolvedValueOnce(42);
    mockPfcount.mockResolvedValueOnce(15);

    const result = await getBadgeStats();

    expect(result).toEqual({ total: 42, unique: 15 });
    expect(mockGet).toHaveBeenCalledWith("stats:badges_generated");
    expect(mockPfcount).toHaveBeenCalledWith("stats:unique_badges");
  });

  it("returns zeros when keys don't exist yet", async () => {
    mockGet.mockResolvedValueOnce(null);
    mockPfcount.mockResolvedValueOnce(0);

    const result = await getBadgeStats();

    expect(result).toEqual({ total: 0, unique: 0 });
  });

  it("returns zeros when Redis is unavailable", async () => {
    _resetClient();
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

    const result = await getBadgeStats();

    expect(result).toEqual({ total: 0, unique: 0 });
    expect(mockGet).not.toHaveBeenCalled();
    expect(mockPfcount).not.toHaveBeenCalled();
  });

  it("returns zeros when Redis throws (graceful degradation)", async () => {
    mockGet.mockRejectedValueOnce(new Error("Connection refused"));

    const result = await getBadgeStats();

    expect(result).toEqual({ total: 0, unique: 0 });
  });
});

// ---------------------------------------------------------------------------
// cacheMGet
// ---------------------------------------------------------------------------

describe("cacheMGet", () => {
  it("returns values for all keys", async () => {
    mockMget.mockResolvedValueOnce([{ handle: "user1" }, { handle: "user2" }]);

    const result = await cacheMGet<{ handle: string }>(["key1", "key2"]);

    expect(result).toEqual([{ handle: "user1" }, { handle: "user2" }]);
    expect(mockMget).toHaveBeenCalledWith("key1", "key2");
  });

  it("returns empty array when given no keys", async () => {
    const result = await cacheMGet([]);

    expect(result).toEqual([]);
    expect(mockMget).not.toHaveBeenCalled();
  });

  it("returns empty array when Redis is unavailable", async () => {
    _resetClient();
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

    const result = await cacheMGet(["key1"]);

    expect(result).toEqual([]);
    expect(mockMget).not.toHaveBeenCalled();
  });

  it("returns empty array when Redis throws", async () => {
    mockMget.mockRejectedValueOnce(new Error("Connection refused"));

    const result = await cacheMGet(["key1"]);

    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// pingRedis
// ---------------------------------------------------------------------------

describe("pingRedis", () => {
  it("returns 'ok' when dbsize succeeds", async () => {
    mockDbsize.mockResolvedValueOnce(42);

    const result = await pingRedis();

    expect(result).toBe("ok");
    expect(mockDbsize).toHaveBeenCalled();
  });

  it("returns 'skipped' when Redis is unavailable (no env vars)", async () => {
    _resetClient();
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

    const result = await pingRedis();

    expect(result).toBe("skipped");
    expect(mockDbsize).not.toHaveBeenCalled();
  });

  it("returns 'error' when dbsize throws", async () => {
    mockDbsize.mockRejectedValueOnce(new Error("Connection refused"));

    const result = await pingRedis();

    expect(result).toBe("error");
  });

  it("returns 'error' when dbsize times out", async () => {
    vi.useFakeTimers();

    // Query never resolves — setTimeout callback must fire
    mockDbsize.mockImplementation(() => new Promise(() => {}));

    const resultPromise = pingRedis();

    // Advance timers past the 5000ms timeout
    await vi.advanceTimersByTimeAsync(5001);

    const result = await resultPromise;
    expect(result).toBe("error");

    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// cacheIncr
// ---------------------------------------------------------------------------

describe("cacheIncr", () => {
  it("increments by default amount of 1", async () => {
    mockIncrby.mockResolvedValueOnce(5);

    const result = await cacheIncr("counter:test");

    expect(result).toBe(5);
    expect(mockIncrby).toHaveBeenCalledWith("counter:test", 1);
    expect(mockExpire).not.toHaveBeenCalled();
  });

  it("increments by a custom amount", async () => {
    mockIncrby.mockResolvedValueOnce(10);

    const result = await cacheIncr("counter:test", 3);

    expect(result).toBe(10);
    expect(mockIncrby).toHaveBeenCalledWith("counter:test", 3);
  });

  it("sets TTL when ttlSeconds is provided", async () => {
    mockIncrby.mockResolvedValueOnce(1);
    mockExpire.mockResolvedValueOnce(1);

    const result = await cacheIncr("counter:test", 1, 3600);

    expect(result).toBe(1);
    expect(mockExpire).toHaveBeenCalledWith("counter:test", 3600);
  });

  it("does not set TTL when ttlSeconds is undefined", async () => {
    mockIncrby.mockResolvedValueOnce(2);

    await cacheIncr("counter:test", 1);

    expect(mockExpire).not.toHaveBeenCalled();
  });

  it("returns 0 when Redis is unavailable (no env vars)", async () => {
    _resetClient();
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

    const result = await cacheIncr("counter:test");

    expect(result).toBe(0);
    expect(mockIncrby).not.toHaveBeenCalled();
  });

  it("returns 0 when Redis throws (graceful degradation)", async () => {
    mockIncrby.mockRejectedValueOnce(new Error("Connection refused"));

    const result = await cacheIncr("counter:test");

    expect(result).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// cacheSet with TTL=0 (no expiry)
// ---------------------------------------------------------------------------

describe("cacheSet with TTL=0", () => {
  it("calls set without expiry options when TTL is 0", async () => {
    mockSet.mockResolvedValueOnce("OK");

    const result = await cacheSet("persistent:key", { data: true }, 0);

    expect(result).toBe(true);
    expect(mockSet).toHaveBeenCalledWith("persistent:key", { data: true });
  });
});

// ---------------------------------------------------------------------------
// cacheSetNx
// ---------------------------------------------------------------------------

describe("cacheSetNx", () => {
  it("returns true when the key is newly set (first write)", async () => {
    mockSet.mockResolvedValueOnce("OK");

    const { cacheSetNx } = await import("./redis");
    const result = await cacheSetNx("sideeffects:done:testuser:2026-04-19", 86400);

    expect(result).toBe(true);
    expect(mockSet).toHaveBeenCalledWith(
      "sideeffects:done:testuser:2026-04-19",
      1,
      { ex: 86400, nx: true },
    );
  });

  it("returns false when the key already exists", async () => {
    mockSet.mockResolvedValueOnce(null);

    const { cacheSetNx } = await import("./redis");
    const result = await cacheSetNx("sideeffects:done:testuser:2026-04-19", 86400);

    expect(result).toBe(false);
  });

  it("returns false when Redis is unavailable (no env vars)", async () => {
    _resetClient();
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

    const { cacheSetNx } = await import("./redis");
    const result = await cacheSetNx("anything", 3600);

    expect(result).toBe(false);
    expect(mockSet).not.toHaveBeenCalled();
  });

  it("returns false when Redis throws (graceful degradation)", async () => {
    mockSet.mockRejectedValueOnce(new Error("Connection refused"));

    const { cacheSetNx } = await import("./redis");
    const result = await cacheSetNx("sideeffects:done:testuser:2026-04-19", 86400);

    expect(result).toBe(false);
  });
});

describe("cacheSetNxStatus", () => {
  it("returns acquired when the key is newly set", async () => {
    mockSet.mockResolvedValueOnce("OK");

    const { cacheSetNxStatus } = await import("./redis");
    const result = await cacheSetNxStatus(
      "sideeffects:done:testuser:2026-04-19",
      86400,
    );

    expect(result).toBe("acquired");
  });

  it("returns exists when the key already exists", async () => {
    mockSet.mockResolvedValueOnce(null);

    const { cacheSetNxStatus } = await import("./redis");
    const result = await cacheSetNxStatus(
      "sideeffects:done:testuser:2026-04-19",
      86400,
    );

    expect(result).toBe("exists");
  });

  it("returns unavailable when Redis is unavailable", async () => {
    _resetClient();
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

    const { cacheSetNxStatus } = await import("./redis");
    const result = await cacheSetNxStatus("anything", 3600);

    expect(result).toBe("unavailable");
    expect(mockSet).not.toHaveBeenCalled();
  });

  it("returns unavailable when Redis throws", async () => {
    mockSet.mockRejectedValueOnce(new Error("Connection refused"));

    const { cacheSetNxStatus } = await import("./redis");
    const result = await cacheSetNxStatus(
      "sideeffects:done:testuser:2026-04-19",
      86400,
    );

    expect(result).toBe("unavailable");
  });
});
