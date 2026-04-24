import { beforeEach, describe, expect, it, vi } from "vitest";
import { invalidateProfileReadModels } from "./post-write-invalidation";

const {
  mockCacheDel,
  mockBuildCraftKey,
  mockBuildSnapshotKey,
  mockInvalidateHistoryCache,
} = vi.hoisted(() => ({
  mockCacheDel: vi.fn(),
  mockBuildCraftKey: vi.fn(),
  mockBuildSnapshotKey: vi.fn(),
  mockInvalidateHistoryCache: vi.fn(),
}));

vi.mock("@/lib/cache/redis", () => ({
  cacheDel: (...args: unknown[]) => mockCacheDel(...args),
}));

vi.mock("@/lib/cache/craft-cache", () => ({
  buildCraftKey: (...args: unknown[]) => mockBuildCraftKey(...args),
}));

vi.mock("@/lib/cache/snapshot-cache", () => ({
  buildSnapshotKey: (...args: unknown[]) => mockBuildSnapshotKey(...args),
}));

vi.mock("@/lib/history/history", () => ({
  invalidateHistoryCache: (...args: unknown[]) => mockInvalidateHistoryCache(...args),
}));

describe("invalidateProfileReadModels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCacheDel.mockResolvedValue(undefined);
    mockBuildCraftKey.mockImplementation((handle: string) => `craft:${handle}`);
    mockBuildSnapshotKey.mockImplementation((handle: string) => `snapshot:${handle}`);
    mockInvalidateHistoryCache.mockResolvedValue(undefined);
  });

  it("invalidates enabled read models in a defined order", async () => {
    const steps: string[] = [];

    mockCacheDel.mockImplementation(async (key: string) => {
      steps.push(key);
    });
    mockInvalidateHistoryCache.mockImplementation(async (handle: string) => {
      steps.push(`history:${handle}`);
    });

    await invalidateProfileReadModels("MixedCase", {
      stats: true,
      craft: true,
      snapshot: true,
      history: true,
    });

    expect(steps).toEqual([
      "stats:v2:merged:mixedcase",
      "craft:mixedcase",
      "snapshot:mixedcase",
      "history:mixedcase",
    ]);
  });

  it("continues invalidating later read models when one step throws", async () => {
    mockCacheDel
      .mockRejectedValueOnce(new Error("stats down"))
      .mockResolvedValueOnce(undefined);

    await expect(
      invalidateProfileReadModels("TestUser", {
        stats: true,
        craft: true,
        history: true,
      }),
    ).resolves.toBeUndefined();

    expect(mockCacheDel).toHaveBeenNthCalledWith(1, "stats:v2:merged:testuser");
    expect(mockCacheDel).toHaveBeenNthCalledWith(2, "craft:testuser");
    expect(mockInvalidateHistoryCache).toHaveBeenCalledWith("testuser");
  });
});
