import { afterEach, describe, expect, it, vi } from "vitest";

const { mockCacheGet, mockCacheSet, mockCacheDel } = vi.hoisted(() => ({
  mockCacheGet: vi.fn(),
  mockCacheSet: vi.fn(),
  mockCacheDel: vi.fn(),
}));

vi.mock("./redis", () => ({
  cacheGet: (...args: unknown[]) => mockCacheGet(...args),
  cacheSet: (...args: unknown[]) => mockCacheSet(...args),
  cacheDel: (...args: unknown[]) => mockCacheDel(...args),
}));

import {
  DIRTY_STATS_TTL,
  dirtyStatsKey,
  markStatsDirty,
  isStatsDirty,
  clearStatsDirty,
} from "./dirty-stats";

afterEach(() => {
  vi.clearAllMocks();
});

describe("dirtyStatsKey", () => {
  it("lowercases the handle", () => {
    expect(dirtyStatsKey("Octocat")).toBe("stats:dirty:octocat");
  });
});

describe("markStatsDirty", () => {
  it("writes the marker with the 1h TTL", async () => {
    mockCacheSet.mockResolvedValue(true);

    await markStatsDirty("Octocat");

    expect(mockCacheSet).toHaveBeenCalledWith(
      "stats:dirty:octocat",
      1,
      DIRTY_STATS_TTL,
    );
  });
});

describe("isStatsDirty", () => {
  it("returns true when the marker exists", async () => {
    mockCacheGet.mockResolvedValue(1);

    await expect(isStatsDirty("octocat")).resolves.toBe(true);
    expect(mockCacheGet).toHaveBeenCalledWith("stats:dirty:octocat");
  });

  it("returns false when the marker is missing", async () => {
    mockCacheGet.mockResolvedValue(null);

    await expect(isStatsDirty("octocat")).resolves.toBe(false);
  });
});

describe("clearStatsDirty", () => {
  it("deletes the marker key", async () => {
    mockCacheDel.mockResolvedValue(undefined);

    await clearStatsDirty("Octocat");

    expect(mockCacheDel).toHaveBeenCalledWith("stats:dirty:octocat");
  });
});
