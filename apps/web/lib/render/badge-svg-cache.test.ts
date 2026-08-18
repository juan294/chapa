import { describe, it, expect, vi, beforeEach } from "vitest";
import { CACHE_VERSION } from "@/lib/cache/version";

vi.mock("@/lib/cache/redis", () => ({
  cacheGet: vi.fn(),
  cacheSet: vi.fn(),
}));

import {
  AVATAR_ABSENT_CACHE_TTL_SECONDS,
  BADGE_RENDER_VARIANT,
  buildBadgeSvgCacheKey,
  buildBadgeSvgRenderLockKey,
  handleCacheJitterSeconds,
  readBadgeSvgCache,
  readBadgeSvgCacheWithStatus,
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
    it("includes the badge renderer version so visual changes bypass stale SVGs", () => {
      const key = buildBadgeSvgCacheKey("Octocat", "2026-05-01");
      expect(BADGE_RENDER_VARIANT).toBe("warm-amber-v3");
      expect(key).toBe(`badge:${CACHE_VERSION}:octocat:${BADGE_RENDER_VARIANT}:2026-05-01`);
    });

    it("lowercases the handle so case variants share a cache slot", () => {
      const a = buildBadgeSvgCacheKey("OCTOCAT", "2026-05-01");
      const b = buildBadgeSvgCacheKey("octocat", "2026-05-01");
      expect(a).toBe(b);
    });

    it("uses the same identity for the cross-instance render lock", () => {
      expect(buildBadgeSvgRenderLockKey("Octocat", "2026-05-01")).toBe(
        `badge-lock:${CACHE_VERSION}:octocat:${BADGE_RENDER_VARIANT}:2026-05-01`,
      );
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

  // #1014 — a 250ms read deadline misclassified genuine cache-hits as misses
  // under Redis tail latency, forcing an unnecessary full materialize+render.
  // The deadline was raised to give real reads more room while staying well
  // under the 800ms cache-hit SLO, and reads that DO exceed the deadline are
  // now distinguishable from a genuine miss via `readBadgeSvgCacheWithStatus`.
  describe("readBadgeSvgCacheWithStatus (#1014)", () => {
    it("treats a read that resolves in ~300ms as a HIT, not a miss", async () => {
      cacheGet.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve("<svg>cached</svg>"), 300);
          }),
      );

      const result = await readBadgeSvgCacheWithStatus(
        "badge:v2:octocat:warm-amber:2026-05-01",
      );

      expect(result.svg).toBe("<svg>cached</svg>");
      expect(result.timedOut).toBe(false);
    });

    it("marks the read as timed-out (not a genuine miss) when it exceeds the deadline", async () => {
      cacheGet.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve("<svg>too-late</svg>"), 5000);
          }),
      );

      const result = await readBadgeSvgCacheWithStatus(
        "badge:v2:octocat:warm-amber:2026-05-01",
      );

      expect(result.svg).toBeNull();
      expect(result.timedOut).toBe(true);
    });

    it("a genuine cache miss is NOT reported as timed-out", async () => {
      cacheGet.mockResolvedValueOnce(null);

      const result = await readBadgeSvgCacheWithStatus(
        "badge:v2:nope:warm-amber:2026-05-01",
      );

      expect(result.svg).toBeNull();
      expect(result.timedOut).toBe(false);
    });

    it("a Redis error is NOT reported as timed-out (fail-open, distinct from deadline breach)", async () => {
      cacheGet.mockRejectedValueOnce(new Error("redis down"));

      const result = await readBadgeSvgCacheWithStatus(
        "badge:v2:octocat:warm-amber:2026-05-01",
      );

      expect(result.svg).toBeNull();
      expect(result.timedOut).toBe(false);
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

    // #1088 — a handle whose avatar is permanently absent (no avatarUrl at
    // all, not a race-timeout) needs a short-TTL cache write instead of
    // either the full 24h+jitter write or no write at all, so a README embed
    // with real traffic stops forcing a full materialize+render on every
    // single request while a later good render (avatarUrl reappearing on a
    // subsequent stats refetch) isn't shadowed for anywhere near a full day.
    describe("ttlSeconds override (#1088)", () => {
      it("honors an explicit ttlSeconds override instead of the 24h+jitter default", async () => {
        cacheSet.mockResolvedValueOnce(true);
        await writeBadgeSvgCache(
          "badge:v2:octocat:warm-amber:2026-05-01",
          "<svg>placeholder</svg>",
          "octocat",
          { ttlSeconds: AVATAR_ABSENT_CACHE_TTL_SECONDS },
        );

        expect(cacheSet).toHaveBeenCalledWith(
          "badge:v2:octocat:warm-amber:2026-05-01",
          "<svg>placeholder</svg>",
          AVATAR_ABSENT_CACHE_TTL_SECONDS,
        );
      });

      it("the short TTL constant is well under an hour so it never shadows a good render or survives a daily key rollover", () => {
        expect(AVATAR_ABSENT_CACHE_TTL_SECONDS).toBeGreaterThanOrEqual(900); // >= 15 min
        expect(AVATAR_ABSENT_CACHE_TTL_SECONDS).toBeLessThanOrEqual(1800); // <= 30 min
      });

      it("without an override, still falls back to the standard 24h+jitter TTL", async () => {
        cacheSet.mockResolvedValueOnce(true);
        await writeBadgeSvgCache(
          "badge:v2:octocat:warm-amber:2026-05-01",
          "<svg>fresh</svg>",
          "octocat",
        );
        const ttl = cacheSet.mock.calls[0]![2] as number;
        expect(ttl).toBeGreaterThanOrEqual(86400);
      });
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
