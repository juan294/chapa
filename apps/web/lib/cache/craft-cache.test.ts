import { describe, it, expect, vi, beforeEach } from "vitest";
import { CACHE_VERSION } from "./version";

// ---------------------------------------------------------------------------
// Mocks — set up before importing the module under test
// ---------------------------------------------------------------------------

vi.mock("./redis", () => ({
  cacheGet: vi.fn(),
  cacheSet: vi.fn(),
  cacheDel: vi.fn(),
}));

vi.mock("@/lib/db/tool-insights", () => ({
  dbGetToolInsights: vi.fn(),
}));

import { cacheGet, cacheSet, cacheDel } from "./redis";
import { dbGetToolInsights } from "@/lib/db/tool-insights";
import {
  buildCraftKey,
  getCachedCraftScore,
  updateCraftCache,
  invalidateCraftCache,
} from "./craft-cache";
import type { CraftResult } from "@chapa/shared";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeCraftResult(overrides: Partial<CraftResult> = {}): CraftResult {
  return {
    tool: "cursor" as CraftResult["tool"],
    dimensions: {
      proficiency: 75,
      effectiveness: 80,
      sophistication: 70,
    },
    craftScore: 75,
    tier: "Practitioner",
    reportPeriod: { start: "2025-01-01", end: "2025-12-31" },
    computedAt: "2025-12-31T00:00:00.000Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe("buildCraftKey", () => {
  it("includes the CACHE_VERSION axis", () => {
    expect(buildCraftKey("juan")).toBe(`craft:${CACHE_VERSION}:juan`);
  });
});

// ---------------------------------------------------------------------------
// getCachedCraftScore
// ---------------------------------------------------------------------------

describe("getCachedCraftScore", () => {
  it("returns cached craft result on cache hit (no DB call)", async () => {
    const craft = makeCraftResult();
    vi.mocked(cacheGet).mockResolvedValueOnce(craft);

    const result = await getCachedCraftScore("TestUser");

    expect(result).toEqual(craft);
    expect(cacheGet).toHaveBeenCalledWith(`craft:${CACHE_VERSION}:testuser`);
    expect(dbGetToolInsights).not.toHaveBeenCalled();
  });

  it("fetches from DB on cache miss and caches the result", async () => {
    const craft = makeCraftResult();
    vi.mocked(cacheGet).mockResolvedValueOnce(null);
    vi.mocked(dbGetToolInsights).mockResolvedValueOnce(craft);
    vi.mocked(cacheSet).mockResolvedValueOnce(true);

    const result = await getCachedCraftScore("testuser");

    expect(result).toEqual(craft);
    expect(dbGetToolInsights).toHaveBeenCalledWith("testuser");
    expect(cacheSet).toHaveBeenCalledWith(`craft:${CACHE_VERSION}:testuser`, craft, 3600);
  });

  it("returns null when both cache and DB have no data", async () => {
    vi.mocked(cacheGet).mockResolvedValueOnce(null);
    vi.mocked(dbGetToolInsights).mockResolvedValueOnce(null);

    const result = await getCachedCraftScore("testuser");

    expect(result).toBeNull();
    // Should not cache a null result
    expect(cacheSet).not.toHaveBeenCalled();
  });

  it("lowercases the handle for the cache key", async () => {
    vi.mocked(cacheGet).mockResolvedValueOnce(null);
    vi.mocked(dbGetToolInsights).mockResolvedValueOnce(null);

    await getCachedCraftScore("UPPERCASE");

    expect(cacheGet).toHaveBeenCalledWith(`craft:${CACHE_VERSION}:uppercase`);
    expect(dbGetToolInsights).toHaveBeenCalledWith("UPPERCASE");
  });

  it("falls back to DB when Redis fails (fail-open)", async () => {
    const craft = makeCraftResult();
    vi.mocked(cacheGet).mockRejectedValueOnce(new Error("Connection refused"));
    vi.mocked(dbGetToolInsights).mockResolvedValueOnce(craft);
    vi.mocked(cacheSet).mockResolvedValueOnce(true);

    const result = await getCachedCraftScore("testuser");

    expect(result).toEqual(craft);
    expect(dbGetToolInsights).toHaveBeenCalledWith("testuser");
  });

  it("does not cache null results", async () => {
    vi.mocked(cacheGet).mockResolvedValueOnce(null);
    vi.mocked(dbGetToolInsights).mockResolvedValueOnce(null);

    await getCachedCraftScore("testuser");

    expect(cacheSet).not.toHaveBeenCalled();
  });

  it("returns null when both Redis and DB fail", async () => {
    vi.mocked(cacheGet).mockRejectedValueOnce(new Error("Redis down"));
    vi.mocked(dbGetToolInsights).mockResolvedValueOnce(null);

    const result = await getCachedCraftScore("testuser");

    expect(result).toBeNull();
  });

  it("does not block on cache write failure", async () => {
    const craft = makeCraftResult();
    vi.mocked(cacheGet).mockResolvedValueOnce(null);
    vi.mocked(dbGetToolInsights).mockResolvedValueOnce(craft);
    vi.mocked(cacheSet).mockRejectedValueOnce(new Error("Write failed"));

    const result = await getCachedCraftScore("testuser");

    // Should still return the craft result despite cache write failure
    expect(result).toEqual(craft);
  });
});

// ---------------------------------------------------------------------------
// updateCraftCache
// ---------------------------------------------------------------------------

describe("updateCraftCache", () => {
  it("updates the cache with the new craft result", async () => {
    const craft = makeCraftResult();
    vi.mocked(cacheSet).mockResolvedValueOnce(true);

    await updateCraftCache("TestUser", craft);

    expect(cacheSet).toHaveBeenCalledWith(`craft:${CACHE_VERSION}:testuser`, craft, 3600);
  });

  it("lowercases the handle for the cache key", async () => {
    const craft = makeCraftResult();
    vi.mocked(cacheSet).mockResolvedValueOnce(true);

    await updateCraftCache("UPPERCASE", craft);

    expect(cacheSet).toHaveBeenCalledWith(`craft:${CACHE_VERSION}:uppercase`, craft, 3600);
  });

  it("does not throw when Redis fails (fire-and-forget safe)", async () => {
    vi.mocked(cacheSet).mockRejectedValueOnce(
      new Error("Connection refused"),
    );

    await expect(
      updateCraftCache("testuser", makeCraftResult()),
    ).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// invalidateCraftCache
// ---------------------------------------------------------------------------

describe("invalidateCraftCache", () => {
  it("deletes the craft cache key", async () => {
    vi.mocked(cacheDel).mockResolvedValueOnce(undefined);
    await invalidateCraftCache("testuser");
    expect(cacheDel).toHaveBeenCalledWith(`craft:${CACHE_VERSION}:testuser`);
  });

  it("lowercases handle", async () => {
    vi.mocked(cacheDel).mockResolvedValueOnce(undefined);
    await invalidateCraftCache("TestUser");
    expect(cacheDel).toHaveBeenCalledWith(`craft:${CACHE_VERSION}:testuser`);
  });

  it("does not throw on Redis failure", async () => {
    vi.mocked(cacheDel).mockRejectedValueOnce(new Error("Redis down"));
    await expect(
      invalidateCraftCache("testuser"),
    ).resolves.toBeUndefined();
  });
});
