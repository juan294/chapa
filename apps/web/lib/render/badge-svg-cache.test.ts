import { describe, it, expect, vi, beforeEach } from "vitest";
import { CACHE_VERSION } from "@/lib/cache/version";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "@/lib/i18n/types";

vi.mock("@/lib/cache/redis", () => ({
  cacheGet: vi.fn(),
  cacheSet: vi.fn(),
  cacheDel: vi.fn(),
}));

import {
  AVATAR_ABSENT_CACHE_TTL_SECONDS,
  BADGE_RENDER_VARIANT,
  buildBadgeSvgCacheKey,
  buildBadgeSvgRenderLockKey,
  handleCacheJitterSeconds,
  invalidateBadgeSvgCacheForHandle,
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
    // #1181 (UX-H3) — the key now carries a locale segment so an es-rendered
    // and an en-rendered badge for the same handle/day never collide. The
    // locale param defaults to DEFAULT_LOCALE so every out-of-scope
    // caller that still passes only (handle, date) — the share page,
    // warm-cache cron, platform-oauth invalidation, post-write-invalidation —
    // keeps compiling and lands on the same slot the badge.svg route uses
    // for an unqualified (no ?lang=) request.
    it("includes the badge renderer version and locale so visual/locale changes bypass stale SVGs", () => {
      const key = buildBadgeSvgCacheKey("Octocat", "2026-05-01");
      // #1225 bumped this from "warm-amber-v3": converging the badge onto the
      // Jade palette changed the rendered bytes, so every cached SVG must miss.
      expect(BADGE_RENDER_VARIANT).toBe("jade-v1");
      expect(key).toBe(
        `badge:${CACHE_VERSION}:octocat:${BADGE_RENDER_VARIANT}:2026-05-01:${DEFAULT_LOCALE}`,
      );
    });

    it("defaults the locale segment to DEFAULT_LOCALE when omitted", () => {
      expect(buildBadgeSvgCacheKey("octocat", "2026-05-01")).toBe(
        buildBadgeSvgCacheKey("octocat", "2026-05-01", DEFAULT_LOCALE),
      );
    });

    it("produces a distinct key per locale for the same handle/day", () => {
      const es = buildBadgeSvgCacheKey("octocat", "2026-05-01", "es");
      const en = buildBadgeSvgCacheKey("octocat", "2026-05-01", "en");
      expect(es).not.toBe(en);
      expect(en).toBe(`badge:${CACHE_VERSION}:octocat:${BADGE_RENDER_VARIANT}:2026-05-01:en`);
    });

    it("lowercases the handle so case variants share a cache slot", () => {
      const a = buildBadgeSvgCacheKey("OCTOCAT", "2026-05-01");
      const b = buildBadgeSvgCacheKey("octocat", "2026-05-01");
      expect(a).toBe(b);
    });

    it("uses the same identity for the cross-instance render lock, including locale", () => {
      expect(buildBadgeSvgRenderLockKey("Octocat", "2026-05-01")).toBe(
        `badge-lock:${CACHE_VERSION}:octocat:${BADGE_RENDER_VARIANT}:2026-05-01:${DEFAULT_LOCALE}`,
      );
      // Explicitly the non-default locale, so this stays a real assertion
      // whichever way DEFAULT_LOCALE points.
      expect(buildBadgeSvgRenderLockKey("Octocat", "2026-05-01", "es")).toBe(
        `badge-lock:${CACHE_VERSION}:octocat:${BADGE_RENDER_VARIANT}:2026-05-01:es`,
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

// #1191 — the badge cache key carries handle/variant/date/locale but nothing
// about the inputs, so anything that changes what the badge should look like
// has to invalidate explicitly. Two triggers do: platform link/unlink (#856)
// and saving a Studio config (#1191). Both go through this one helper.
describe("invalidateBadgeSvgCacheForHandle (#1191)", () => {
  it("deletes one entry per supported locale", async () => {
    const { cacheDel } = await import("@/lib/cache/redis");
    vi.mocked(cacheDel).mockClear();

    await invalidateBadgeSvgCacheForHandle("Octocat", "2026-08-30");

    const deleted = vi.mocked(cacheDel).mock.calls.map(([key]) => key);
    expect(deleted).toHaveLength(SUPPORTED_LOCALES.length);
    for (const locale of SUPPORTED_LOCALES) {
      expect(deleted).toContain(
        buildBadgeSvgCacheKey("Octocat", "2026-08-30", locale),
      );
    }
  });

  it("lowercases the handle the same way the key builder does", async () => {
    const { cacheDel } = await import("@/lib/cache/redis");
    vi.mocked(cacheDel).mockClear();

    await invalidateBadgeSvgCacheForHandle("MixedCase", "2026-08-30");

    for (const key of vi.mocked(cacheDel).mock.calls.map(([k]) => k)) {
      expect(key).toContain("mixedcase");
      expect(key).not.toContain("MixedCase");
    }
  });
});
