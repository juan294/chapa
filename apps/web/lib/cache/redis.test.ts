import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock @upstash/redis BEFORE importing the module under test.
// We control the mock Redis instance from this scope.
// ---------------------------------------------------------------------------

const mockGet = vi.fn();
const mockSet = vi.fn();
const mockEval = vi.fn();
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
    eval = mockEval;
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
  cacheSetVersioned,
  cacheMergeJson,
  cacheDel,
  rateLimit,
  rateLimitStrict,
  trackBadgeGenerated,
  getBadgeStats,
  cacheMGet,
  pingRedis,
  cacheIncr,
  cacheReserveQuota,
  isRedisConfigured,
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
// isRedisConfigured
// ---------------------------------------------------------------------------

describe("isRedisConfigured", () => {
  it("returns true when both URL and token are present", () => {
    expect(isRedisConfigured()).toBe(true);
  });

  it("returns false when the URL is missing", () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    expect(isRedisConfigured()).toBe(false);
  });

  it("returns false when the token is missing", () => {
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    expect(isRedisConfigured()).toBe(false);
  });
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

describe("cacheSetVersioned", () => {
  it("atomically stores an entry when no newer revision exists", async () => {
    mockEval.mockResolvedValueOnce(1);
    const entry = { kind: "studio-config", revision: 42, config: { background: "aurora" } };

    await expect(cacheSetVersioned("config:juan294", entry, 42, 3600)).resolves.toBe("stored");

    expect(mockEval).toHaveBeenCalledOnce();
    const [script, keys, args] = mockEval.mock.calls[0]!;
    expect(script).toContain('redis.call("GET", KEYS[1])');
    expect(script).toContain("current.revision");
    expect(script).toContain('redis.call("SET", KEYS[1]');
    expect(keys).toEqual(["config:juan294"]);
    expect(args).toEqual([JSON.stringify(entry), "42", "3600"]);
  });

  it("reports stale when Redis keeps a newer revision", async () => {
    mockEval.mockResolvedValueOnce(0);

    await expect(
      cacheSetVersioned("config:juan294", { revision: 41 }, 41, 3600),
    ).resolves.toBe("stale");
  });

  it("fails open when the atomic versioned write fails", async () => {
    mockEval.mockRejectedValueOnce(new Error("Connection refused"));

    await expect(
      cacheSetVersioned("config:juan294", { revision: 42 }, 42, 3600),
    ).resolves.toBe("failed");
  });
});

// ---------------------------------------------------------------------------
// cacheMergeJson
// ---------------------------------------------------------------------------

describe("cacheMergeJson", () => {
  it("runs the JSON merge and TTL refresh atomically in Redis", async () => {
    mockEval.mockResolvedValueOnce(1);

    const result = await cacheMergeJson(
      "cli:device:session",
      { status: "approved", handle: "octocat" },
      300,
    );

    expect(result).toBe(true);
    expect(mockEval).toHaveBeenCalledOnce();
    const [script, keys, args] = mockEval.mock.calls[0]!;
    expect(script).toContain('redis.call("GET", KEYS[1])');
    expect(script).toContain('redis.call("SET", KEYS[1]');
    expect(keys).toEqual(["cli:device:session"]);
    expect(args).toEqual([
      JSON.stringify({ status: "approved", handle: "octocat" }),
      "300",
    ]);
  });

  it("returns false when the atomic merge fails", async () => {
    mockEval.mockRejectedValueOnce(new Error("Connection refused"));

    await expect(
      cacheMergeJson("cli:device:session", { deviceCodeConfirmed: true }, 300),
    ).resolves.toBe(false);
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
    mockEval.mockResolvedValueOnce(1);

    const result = await rateLimit("ratelimit:test", 10, 900);

    expect(result.allowed).toBe(true);
    expect(result.current).toBe(1);
    expect(result.limit).toBe(10);
    expect(mockEval).toHaveBeenCalledOnce();
    const [script, keys, args] = mockEval.mock.calls[0]!;
    expect(script).toContain('redis.call("INCR", KEYS[1])');
    expect(script).toContain('redis.call("TTL", KEYS[1])');
    expect(script).toContain('redis.call("EXPIRE", KEYS[1]');
    expect(keys).toEqual(["ratelimit:test"]);
    expect(args).toEqual(["900"]);
  });

  // BE-M3 regression: the old implementation issued INCR and EXPIRE as two
  // separate REST round-trips, guarded in JS by `if (current === 1)`. If the
  // EXPIRE call failed or the request was killed between the two, the key
  // was left with a counter and NO ttl, and since `current === 1` never
  // recurs, no future call would ever retry the EXPIRE — a permanent,
  // never-resetting bucket. The fix issues a single atomic Lua script per
  // check, so the raw incr/expire client methods must never be called
  // directly from rateLimit()/rateLimitStrict().
  it("BE-M3: increments and checks/sets TTL atomically in one round trip (no bare incr/expire calls)", async () => {
    mockEval.mockResolvedValueOnce(5);

    const result = await rateLimit("ratelimit:test", 10, 900);

    expect(result.allowed).toBe(true);
    expect(result.current).toBe(5);
    expect(mockIncr).not.toHaveBeenCalled();
    expect(mockExpire).not.toHaveBeenCalled();
  });

  it("denies request when at the limit", async () => {
    mockEval.mockResolvedValueOnce(11);

    const result = await rateLimit("ratelimit:test", 10, 900);

    expect(result.allowed).toBe(false);
    expect(result.current).toBe(11);
  });

  it("allows exactly at the limit boundary", async () => {
    mockEval.mockResolvedValueOnce(10);

    const result = await rateLimit("ratelimit:test", 10, 900);

    expect(result.allowed).toBe(true);
    expect(result.current).toBe(10);
  });

  it("fails open when Redis throws", async () => {
    mockEval.mockRejectedValueOnce(new Error("Connection refused"));

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
    expect(mockEval).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// rateLimitStrict (fail-closed — for auth and write routes)
// ---------------------------------------------------------------------------

describe("rateLimitStrict", () => {
  it("allows request when under the limit", async () => {
    mockEval.mockResolvedValueOnce(1);

    const result = await rateLimitStrict("ratelimit:auth:test", 10, 900);

    expect(result.allowed).toBe(true);
    expect(result.current).toBe(1);
    expect(result.limit).toBe(10);
    expect(mockEval).toHaveBeenCalledOnce();
    const [script, keys, args] = mockEval.mock.calls[0]!;
    expect(script).toContain('redis.call("INCR", KEYS[1])');
    expect(script).toContain('redis.call("TTL", KEYS[1])');
    expect(script).toContain('redis.call("EXPIRE", KEYS[1]');
    expect(keys).toEqual(["ratelimit:auth:test"]);
    expect(args).toEqual(["900"]);
  });

  it("BE-M3: increments and checks/sets TTL atomically in one round trip (no bare incr/expire calls)", async () => {
    mockEval.mockResolvedValueOnce(5);

    const result = await rateLimitStrict("ratelimit:auth:test", 10, 900);

    expect(result.allowed).toBe(true);
    expect(result.current).toBe(5);
    expect(mockIncr).not.toHaveBeenCalled();
    expect(mockExpire).not.toHaveBeenCalled();
  });

  it("denies request when over the limit", async () => {
    mockEval.mockResolvedValueOnce(11);

    const result = await rateLimitStrict("ratelimit:auth:test", 10, 900);

    expect(result.allowed).toBe(false);
    expect(result.current).toBe(11);
  });

  it("allows exactly at the limit boundary", async () => {
    mockEval.mockResolvedValueOnce(10);

    const result = await rateLimitStrict("ratelimit:auth:test", 10, 900);

    expect(result.allowed).toBe(true);
    expect(result.current).toBe(10);
  });

  it("FAILS CLOSED when Redis throws (security-critical: no bypass on error)", async () => {
    mockEval.mockRejectedValueOnce(new Error("Connection refused"));

    const result = await rateLimitStrict("ratelimit:auth:test", 10, 900);

    // Unlike rateLimit(), rateLimitStrict must block on Redis failure
    expect(result.allowed).toBe(false);
    expect(result.current).toBe(0);
  });

  it("FAILS CLOSED when Redis is unavailable (no env vars)", async () => {
    _resetClient();
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

    const result = await rateLimitStrict("ratelimit:auth:test", 10, 900);

    // Auth routes must block when Redis cannot enforce limits
    expect(result.allowed).toBe(false);
    expect(mockEval).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// BE-M3 regression: a rate-limit key stranded without a TTL (e.g. by the
// historical two-call INCR-then-EXPIRE race) must self-heal on the very next
// check instead of growing forever with no reset. This simulates the atomic
// script's semantics against a tiny in-memory store — the real script lives
// in apps/web/lib/cache/redis.ts and is asserted verbatim above.
// ---------------------------------------------------------------------------

describe("rate limit TTL self-healing (BE-M3)", () => {
  it("acquires a TTL on the next request even if an earlier request left the key without one", async () => {
    let counter = 1; // A prior request already incremented this key...
    let ttl = -1; //  ...but its EXPIRE call was lost, so it never got a TTL.

    mockEval.mockImplementation(
      async (_script: string, _keys: string[], args: string[]) => {
        counter += 1;
        const windowSeconds = Number(args[0]);
        if (ttl === -1) {
          ttl = windowSeconds;
        }
        return counter;
      },
    );

    expect(ttl).toBe(-1); // confirms the key starts stranded

    const result = await rateLimit("ratelimit:stranded", 10, 900);

    expect(result.current).toBe(2);
    expect(ttl).toBe(900); // healed: the bucket can now reset
  });

  it("never re-extends the TTL while the key already has one (fixed-window semantics preserved)", async () => {
    let ttl = 900;
    const observedTtls: number[] = [];

    mockEval.mockImplementation(
      async (_script: string, _keys: string[], args: string[]) => {
        const windowSeconds = Number(args[0]);
        if (ttl === -1) {
          ttl = windowSeconds;
        }
        observedTtls.push(ttl);
        return 2;
      },
    );

    await rateLimit("ratelimit:continuous", 10, 900);
    await rateLimit("ratelimit:continuous", 10, 900);
    await rateLimit("ratelimit:continuous", 10, 900);

    // Every call sees the same TTL — continuous traffic does not keep
    // pushing the window out, so a client that trips the limit still resets
    // after windowSeconds.
    expect(observedTtls).toEqual([900, 900, 900]);
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
