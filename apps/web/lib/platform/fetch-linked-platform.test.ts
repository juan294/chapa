import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCacheMGet, mockCacheSet } = vi.hoisted(() => ({
  mockCacheMGet: vi.fn(),
  mockCacheSet: vi.fn(),
}));

vi.mock("@/lib/cache/redis", () => ({
  cacheMGet: mockCacheMGet,
  cacheSet: mockCacheSet,
}));

import {
  fetchLinkedPlatformStats,
  CACHE_TTL,
  NEG_CACHE_TTL,
  type FetchLinkedPlatformConfig,
  type LinkedPlatformRecord,
} from "./fetch-linked-platform";
import { makeStats } from "../test-helpers/fixtures";

const PLATFORM = "testplatform";
const LOWER = "test-user";
const CACHE_KEY = `stats:v2:${PLATFORM}:${LOWER}`;
const NEG_KEY = `${CACHE_KEY}:neg`;

const linkedRecord: LinkedPlatformRecord = {
  remoteLogin: "remote-user",
  tokens: {
    accessToken: "token",
    refreshToken: "refresh",
    expiresAt: new Date("2099-12-31"),
  },
};

function makeConfig(
  overrides: Partial<FetchLinkedPlatformConfig> = {},
): FetchLinkedPlatformConfig {
  return {
    platform: PLATFORM,
    lowerHandle: LOWER,
    isEnabled: vi.fn().mockResolvedValue(true),
    getLinkedPlatform: vi.fn().mockResolvedValue(linkedRecord),
    resolveAccessToken: vi.fn().mockResolvedValue("token"),
    fetchStats: vi.fn().mockResolvedValue(makeStats({ commitsTotal: 5 })),
    ...overrides,
  };
}

describe("fetchLinkedPlatformStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCacheMGet.mockResolvedValue([null, null]);
    mockCacheSet.mockResolvedValue(undefined);
  });

  it("looks up positive + negative cache in a single cacheMGet round-trip", async () => {
    const config = makeConfig();

    await fetchLinkedPlatformStats(config);

    expect(mockCacheMGet).toHaveBeenCalledTimes(1);
    expect(mockCacheMGet).toHaveBeenCalledWith([CACHE_KEY, NEG_KEY]);
  });

  it("returns cached stats on positive cache hit without any other work", async () => {
    const cached = makeStats({ commitsTotal: 42 });
    mockCacheMGet.mockResolvedValueOnce([cached, null]);
    const config = makeConfig();

    const result = await fetchLinkedPlatformStats(config);

    expect(result).toEqual(cached);
    expect(config.isEnabled).not.toHaveBeenCalled();
    expect(config.getLinkedPlatform).not.toHaveBeenCalled();
    expect(config.resolveAccessToken).not.toHaveBeenCalled();
    expect(config.fetchStats).not.toHaveBeenCalled();
  });

  it("returns null on negative cache hit without flag/db reads", async () => {
    mockCacheMGet.mockResolvedValueOnce([null, true]);
    const config = makeConfig();

    const result = await fetchLinkedPlatformStats(config);

    expect(result).toBeNull();
    expect(config.isEnabled).not.toHaveBeenCalled();
    expect(config.getLinkedPlatform).not.toHaveBeenCalled();
  });

  it("treats an empty array from cacheMGet (Redis unavailable) as a full cache miss and falls through to a live fetch", async () => {
    // cacheMGet returns [] (not [null, null]) when Redis is unreachable —
    // destructuring/indexing must not throw or misread this as a cache hit.
    mockCacheMGet.mockResolvedValueOnce([]);
    const stats = makeStats({ commitsTotal: 7 });
    const config = makeConfig({ fetchStats: vi.fn().mockResolvedValue(stats) });

    const result = await fetchLinkedPlatformStats(config);

    expect(result).toEqual(stats);
    expect(config.isEnabled).toHaveBeenCalled();
    expect(config.getLinkedPlatform).toHaveBeenCalled();
    expect(config.fetchStats).toHaveBeenCalled();
    expect(mockCacheSet).toHaveBeenCalledWith(CACHE_KEY, stats, CACHE_TTL);
  });

  it("sets neg cache and returns null when not enabled", async () => {
    const config = makeConfig({ isEnabled: vi.fn().mockResolvedValue(false) });

    const result = await fetchLinkedPlatformStats(config);

    expect(result).toBeNull();
    expect(mockCacheSet).toHaveBeenCalledWith(NEG_KEY, true, NEG_CACHE_TTL);
    expect(config.getLinkedPlatform).not.toHaveBeenCalled();
  });

  it("sets neg cache and returns null when not linked", async () => {
    const config = makeConfig({
      getLinkedPlatform: vi.fn().mockResolvedValue(null),
    });

    const result = await fetchLinkedPlatformStats(config);

    expect(result).toBeNull();
    expect(mockCacheSet).toHaveBeenCalledWith(NEG_KEY, true, NEG_CACHE_TTL);
    expect(config.resolveAccessToken).not.toHaveBeenCalled();
  });

  it("short-circuits without fetching when token resolution returns null", async () => {
    const config = makeConfig({
      resolveAccessToken: vi.fn().mockResolvedValue(null),
    });

    const result = await fetchLinkedPlatformStats(config);

    expect(result).toBeNull();
    expect(config.fetchStats).not.toHaveBeenCalled();
    expect(mockCacheSet).not.toHaveBeenCalled();
  });

  it("happy path: resolves token, fetches, caches, and returns stats", async () => {
    const stats = makeStats({ commitsTotal: 99 });
    const config = makeConfig({
      resolveAccessToken: vi.fn().mockResolvedValue("resolved-token"),
      fetchStats: vi.fn().mockResolvedValue(stats),
    });

    const result = await fetchLinkedPlatformStats(config);

    expect(result).toEqual(stats);
    expect(config.resolveAccessToken).toHaveBeenCalledWith(linkedRecord);
    expect(config.fetchStats).toHaveBeenCalledWith(linkedRecord, "resolved-token");
    expect(mockCacheSet).toHaveBeenCalledWith(CACHE_KEY, stats, CACHE_TTL);
  });

  it("does not cache when fetchStats returns null", async () => {
    const config = makeConfig({
      fetchStats: vi.fn().mockResolvedValue(null),
    });

    const result = await fetchLinkedPlatformStats(config);

    expect(result).toBeNull();
    expect(mockCacheSet).not.toHaveBeenCalled();
  });

  it("returns null and does not cache when the live fetch exceeds its deadline", async () => {
    vi.useFakeTimers();
    const slowFetch: NonNullable<FetchLinkedPlatformConfig["fetchStats"]> = () =>
      new Promise((resolve) => {
        setTimeout(() => resolve(makeStats({ commitsTotal: 10 })), 9_000);
      });
    const config = makeConfig({
      fetchStats: vi.fn(slowFetch),
    });

    const promise = fetchLinkedPlatformStats(config);
    await vi.advanceTimersByTimeAsync(8_001);

    await expect(promise).resolves.toBeNull();
    expect(mockCacheSet).not.toHaveBeenCalled();

    vi.useRealTimers();
  });
});
