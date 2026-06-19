import { describe, it, expect, vi, beforeEach } from "vitest";
import { CACHE_VERSION } from "@/lib/cache/version";

vi.mock("@/lib/cache/redis", () => ({
  cacheGet: vi.fn(),
  cacheSet: vi.fn(),
}));

import {
  buildBadgeSvgCacheKey,
  handleCacheJitterSeconds,
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
    it("writes the SVG with a TTL of at least 24h", async () => {
      cacheSet.mockResolvedValueOnce(true);
      await writeBadgeSvgCache(
        "badge:v2:octocat:warm-amber:2026-05-01",
        "<svg>fresh</svg>",
        "octocat",
      );
      const ttl = cacheSet.mock.calls[0]![2] as number;
      expect(ttl).toBeGreaterThanOrEqual(86400);
      expect(cacheSet).toHaveBeenCalledWith(
        "badge:v2:octocat:warm-amber:2026-05-01",
        "<svg>fresh</svg>",
        ttl,
      );
    });

    it("TTL is at most 24h + 2h jitter", async () => {
      cacheSet.mockResolvedValueOnce(true);
      await writeBadgeSvgCache(
        "badge:v2:octocat:warm-amber:2026-05-01",
        "<svg>fresh</svg>",
        "octocat",
      );
      const ttl = cacheSet.mock.calls[0]![2] as number;
      expect(ttl).toBeLessThanOrEqual(86400 + 7200);
    });

    it("does not throw when Redis errors", async () => {
      cacheSet.mockRejectedValueOnce(new Error("redis down"));
      await expect(
        writeBadgeSvgCache("k", "<svg/>", "testuser"),
      ).resolves.not.toThrow();
    });
  });

  describe("handleCacheJitterSeconds (PE-S1)", () => {
    it("returns a number between 0 and 7200 inclusive", () => {
      const jitter = handleCacheJitterSeconds("octocat");
      expect(jitter).toBeGreaterThanOrEqual(0);
      expect(jitter).toBeLessThanOrEqual(7200);
    });

    it("is deterministic — same handle always returns the same jitter", () => {
      expect(handleCacheJitterSeconds("alice")).toBe(handleCacheJitterSeconds("alice"));
    });

    it("produces different jitter for different handles (distributes load)", () => {
      const handles = ["alice", "bob", "carol", "dave", "eve", "frank"];
      const jitters = handles.map(handleCacheJitterSeconds);
      // Not all jitters should be the same — at least 2 distinct values
      const unique = new Set(jitters);
      expect(unique.size).toBeGreaterThan(1);
    });

    it("is case-insensitive — lowercases the handle before hashing", () => {
      expect(handleCacheJitterSeconds("ALICE")).toBe(handleCacheJitterSeconds("alice"));
    });

    it("two different handles get different effective TTLs when written to cache (PE-S1)", async () => {
      cacheSet.mockResolvedValue(true);

      await writeBadgeSvgCache("k1", "<svg/>", "alice");
      await writeBadgeSvgCache("k2", "<svg/>", "zz-different-hash-zz");

      const ttl1 = cacheSet.mock.calls[0]![2] as number;
      const ttl2 = cacheSet.mock.calls[1]![2] as number;
      // These are intentionally different handles chosen to produce different hashes.
      // If by coincidence they collide, this test is a false negative — acceptable
      // given the wide jitter space (7201 possible values).
      expect(ttl1).not.toBe(ttl2);
    });
  });
});
