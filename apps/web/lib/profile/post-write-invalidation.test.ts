import { beforeEach, describe, expect, it, vi } from "vitest";
import { invalidateProfileReadModels } from "./post-write-invalidation";

const {
  mockCacheDel,
  mockBuildCraftKey,
  mockBuildBadgeSvgCacheKey,
  mockBuildSnapshotKey,
  mockInvalidateHistoryCache,
} = vi.hoisted(() => ({
  mockCacheDel: vi.fn(),
  mockBuildCraftKey: vi.fn(),
  mockBuildBadgeSvgCacheKey: vi.fn(),
  mockBuildSnapshotKey: vi.fn(),
  mockInvalidateHistoryCache: vi.fn(),
}));

vi.mock("@/lib/cache/redis", () => ({
  cacheDel: (...args: unknown[]) => mockCacheDel(...args),
}));

vi.mock("@/lib/cache/craft-cache", () => ({
  buildCraftKey: (...args: unknown[]) => mockBuildCraftKey(...args),
}));

vi.mock("@/lib/render/badge-svg-cache", () => ({
  buildBadgeSvgCacheKey: (...args: unknown[]) => mockBuildBadgeSvgCacheKey(...args),
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
    mockBuildBadgeSvgCacheKey.mockImplementation(
      (handle: string, date: string) => `badge:${handle}:${date}`,
    );
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
      badgeSvg: true,
      snapshot: true,
      history: true,
    });

    expect(steps).toEqual([
      "stats:v2:merged:mixedcase",
      "craft:mixedcase",
      expect.stringMatching(/^badge:mixedcase:\d{4}-\d{2}-\d{2}$/),
      "snapshot:mixedcase",
      "history:mixedcase",
    ]);
  });

  it("is a no-op when no read models are enabled", async () => {
    await invalidateProfileReadModels("anyone", {});

    expect(mockCacheDel).not.toHaveBeenCalled();
    expect(mockBuildCraftKey).not.toHaveBeenCalled();
    expect(mockBuildBadgeSvgCacheKey).not.toHaveBeenCalled();
    expect(mockBuildSnapshotKey).not.toHaveBeenCalled();
    expect(mockInvalidateHistoryCache).not.toHaveBeenCalled();
  });

  it("only invalidates the stats read model when stats=true", async () => {
    await invalidateProfileReadModels("Solo", { stats: true });

    expect(mockCacheDel).toHaveBeenCalledTimes(1);
    expect(mockCacheDel).toHaveBeenCalledWith("stats:v2:merged:solo");
    expect(mockBuildCraftKey).not.toHaveBeenCalled();
    expect(mockBuildBadgeSvgCacheKey).not.toHaveBeenCalled();
    expect(mockBuildSnapshotKey).not.toHaveBeenCalled();
    expect(mockInvalidateHistoryCache).not.toHaveBeenCalled();
  });

  it("invalidates the same-day badge SVG artifact when badgeSvg=true", async () => {
    await invalidateProfileReadModels("Solo", { badgeSvg: true });

    expect(mockBuildBadgeSvgCacheKey).toHaveBeenCalledWith(
      "solo",
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    );
    expect(mockCacheDel).toHaveBeenCalledTimes(1);
    expect(mockCacheDel).toHaveBeenCalledWith(
      expect.stringMatching(/^badge:solo:\d{4}-\d{2}-\d{2}$/),
    );
  });

  it("only invalidates the snapshot read model when snapshot=true", async () => {
    await invalidateProfileReadModels("Solo", { snapshot: true });

    expect(mockBuildSnapshotKey).toHaveBeenCalledWith("solo");
    expect(mockCacheDel).toHaveBeenCalledTimes(1);
    expect(mockCacheDel).toHaveBeenCalledWith("snapshot:solo");
    expect(mockBuildCraftKey).not.toHaveBeenCalled();
    expect(mockBuildBadgeSvgCacheKey).not.toHaveBeenCalled();
    expect(mockInvalidateHistoryCache).not.toHaveBeenCalled();
  });

  it("only invalidates the history read model when history=true", async () => {
    await invalidateProfileReadModels("Solo", { history: true });

    expect(mockInvalidateHistoryCache).toHaveBeenCalledWith("solo");
    expect(mockCacheDel).not.toHaveBeenCalled();
    expect(mockBuildCraftKey).not.toHaveBeenCalled();
    expect(mockBuildBadgeSvgCacheKey).not.toHaveBeenCalled();
    expect(mockBuildSnapshotKey).not.toHaveBeenCalled();
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
