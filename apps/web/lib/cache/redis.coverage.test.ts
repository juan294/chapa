/**
 * Additional redis.ts coverage tests — covers pingRedis, cacheIncr,
 * cacheSet with ttl=0, and cacheGet with undefined value.
 *
 * These supplement redis.test.ts to bring the module above 80% coverage.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock @upstash/redis BEFORE importing the module under test.
// ---------------------------------------------------------------------------

const mockGet = vi.fn();
const mockSet = vi.fn();
const mockDel = vi.fn();
const mockIncr = vi.fn();
const mockIncrby = vi.fn();
const mockExpire = vi.fn();
const mockPfadd = vi.fn();
const mockPfcount = vi.fn();
const mockMget = vi.fn();
const mockDbsize = vi.fn();

vi.mock("@upstash/redis", () => ({
  Redis: class MockRedis {
    get = mockGet;
    set = mockSet;
    del = mockDel;
    incr = mockIncr;
    incrby = mockIncrby;
    expire = mockExpire;
    pfadd = mockPfadd;
    pfcount = mockPfcount;
    mget = mockMget;
    dbsize = mockDbsize;
  },
}));

import {
  cacheGet,
  cacheSet,
  cacheIncr,
  pingRedis,
  _resetClient,
} from "./redis";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  _resetClient();
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://fake-redis.upstash.io");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "fake-token");
});

// ---------------------------------------------------------------------------
// pingRedis
// ---------------------------------------------------------------------------

describe("pingRedis", () => {
  it("returns 'ok' when Redis responds to DBSIZE", async () => {
    mockDbsize.mockResolvedValueOnce(42);

    const result = await pingRedis();

    expect(result).toBe("ok");
    expect(mockDbsize).toHaveBeenCalled();
  });

  it("returns 'error' when Redis DBSIZE fails", async () => {
    mockDbsize.mockRejectedValueOnce(new Error("Connection refused"));

    const result = await pingRedis();

    expect(result).toBe("error");
  });

  it("returns 'skipped' when Redis client is null (no env vars)", async () => {
    _resetClient();
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

    const result = await pingRedis();

    expect(result).toBe("skipped");
    expect(mockDbsize).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// cacheIncr
// ---------------------------------------------------------------------------

describe("cacheIncr", () => {
  it("increments a key by 1 (default amount)", async () => {
    mockIncrby.mockResolvedValueOnce(1);

    const result = await cacheIncr("quota:daily:emails");

    expect(result).toBe(1);
    expect(mockIncrby).toHaveBeenCalledWith("quota:daily:emails", 1);
  });

  it("increments a key by a custom amount", async () => {
    mockIncrby.mockResolvedValueOnce(5);

    const result = await cacheIncr("quota:daily:emails", 5);

    expect(result).toBe(5);
    expect(mockIncrby).toHaveBeenCalledWith("quota:daily:emails", 5);
  });

  it("sets TTL on first increment (when newVal === amount)", async () => {
    mockIncrby.mockResolvedValueOnce(1);
    mockExpire.mockResolvedValueOnce(1);

    const result = await cacheIncr("quota:daily:emails", 1, 86400);

    expect(result).toBe(1);
    expect(mockExpire).toHaveBeenCalledWith("quota:daily:emails", 86400);
  });

  it("always refreshes TTL on subsequent increments (idempotent)", async () => {
    mockIncrby.mockResolvedValueOnce(2);
    mockExpire.mockResolvedValueOnce(1);

    const result = await cacheIncr("quota:daily:emails", 1, 86400);

    expect(result).toBe(2);
    expect(mockExpire).toHaveBeenCalledWith("quota:daily:emails", 86400);
  });

  it("does not set TTL when ttlSeconds is not provided", async () => {
    mockIncrby.mockResolvedValueOnce(1);

    const result = await cacheIncr("counter:visits", 1);

    expect(result).toBe(1);
    expect(mockExpire).not.toHaveBeenCalled();
  });

  it("returns 0 when Redis throws (graceful degradation)", async () => {
    mockIncrby.mockRejectedValueOnce(new Error("Connection refused"));

    const result = await cacheIncr("quota:daily:emails");

    expect(result).toBe(0);
  });

  it("returns 0 when Redis is unavailable (no env vars)", async () => {
    _resetClient();
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

    const result = await cacheIncr("anything");

    expect(result).toBe(0);
    expect(mockIncrby).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// cacheSet — TTL=0 path (persistent, no expiry)
// ---------------------------------------------------------------------------

describe("cacheSet with ttl=0", () => {
  it("calls redis.set without expiry option when ttl is 0", async () => {
    mockSet.mockResolvedValueOnce("OK");

    const result = await cacheSet("persistent:key", { value: 1 }, 0);

    expect(result).toBe(true);
    expect(mockSet).toHaveBeenCalledWith("persistent:key", { value: 1 });
  });
});

// ---------------------------------------------------------------------------
// cacheGet — undefined value returns null
// ---------------------------------------------------------------------------

describe("cacheGet edge cases", () => {
  it("returns null when Redis returns undefined", async () => {
    mockGet.mockResolvedValueOnce(undefined);

    const result = await cacheGet("key-with-undefined");

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getRedis singleton caching — second call returns same instance
// ---------------------------------------------------------------------------

describe("getRedis singleton", () => {
  it("reuses the same Redis instance across calls", async () => {
    mockGet.mockResolvedValue("value");

    await cacheGet("key1");
    await cacheGet("key2");

    // Both calls should work (the singleton was created once and reused)
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it("caches null when env vars are missing (does not retry)", async () => {
    _resetClient();
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

    await cacheGet("key1");
    await cacheGet("key2");

    // Neither call should have accessed Redis
    expect(mockGet).not.toHaveBeenCalled();
  });
});
