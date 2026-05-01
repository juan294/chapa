import { describe, it, expect, vi, beforeEach } from "vitest";
import { CACHE_VERSION } from "@/lib/cache/version";

vi.mock("@/lib/cache/redis", () => ({
  cacheGet: vi.fn(),
  cacheSet: vi.fn(),
}));

import {
  buildBadgeSvgCacheKey,
  readBadgeSvgCache,
  writeBadgeSvgCache,
} from "./badge-svg-cache";
import * as redis from "@/lib/cache/redis";

const cacheGet = vi.mocked(redis.cacheGet);
const cacheSet = vi.mocked(redis.cacheSet);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("badge-svg-cache", () => {
  describe("buildBadgeSvgCacheKey", () => {
    it("uses the format badge:<version>:<lowercase-handle>:warm-amber:<date>", () => {
      const key = buildBadgeSvgCacheKey("Octocat", "2026-05-01");
      expect(key).toBe(`badge:${CACHE_VERSION}:octocat:warm-amber:2026-05-01`);
    });

    it("lowercases the handle so case variants share a cache slot", () => {
      const a = buildBadgeSvgCacheKey("OCTOCAT", "2026-05-01");
      const b = buildBadgeSvgCacheKey("octocat", "2026-05-01");
      expect(a).toBe(b);
    });
  });

  describe("readBadgeSvgCache", () => {
    it("returns the cached SVG on hit", async () => {
      cacheGet.mockResolvedValueOnce("<svg>cached</svg>");
      const result = await readBadgeSvgCache("badge:v2:octocat:warm-amber:2026-05-01");
      expect(result).toBe("<svg>cached</svg>");
    });

    it("returns null on cache miss", async () => {
      cacheGet.mockResolvedValueOnce(null);
      const result = await readBadgeSvgCache("badge:v2:nope:warm-amber:2026-05-01");
      expect(result).toBeNull();
    });

    it("returns null instead of throwing when Redis errors (fail-open)", async () => {
      cacheGet.mockRejectedValueOnce(new Error("redis down"));
      const result = await readBadgeSvgCache("badge:v2:octocat:warm-amber:2026-05-01");
      expect(result).toBeNull();
    });
  });

  describe("writeBadgeSvgCache", () => {
    it("writes the SVG with a 24h TTL", async () => {
      cacheSet.mockResolvedValueOnce(true);
      await writeBadgeSvgCache(
        "badge:v2:octocat:warm-amber:2026-05-01",
        "<svg>fresh</svg>",
      );
      expect(cacheSet).toHaveBeenCalledWith(
        "badge:v2:octocat:warm-amber:2026-05-01",
        "<svg>fresh</svg>",
        86400,
      );
    });

    it("does not throw when Redis errors", async () => {
      cacheSet.mockRejectedValueOnce(new Error("redis down"));
      await expect(
        writeBadgeSvgCache("k", "<svg/>"),
      ).resolves.not.toThrow();
    });
  });
});
