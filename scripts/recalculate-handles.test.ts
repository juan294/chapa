import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  BADGE_RENDER_VARIANT as CANONICAL_BADGE_RENDER_VARIANT,
} from "../apps/web/lib/render/badge-render-variant";
import {
  parseArgs,
  normalizeHandle,
  mergedStatsKey,
  staleStatsKey,
  snapshotKey,
  dirtyStatsKey,
  badgeSvgCacheKey,
  badgeUrl,
  computeFootprint,
  snapshotChanged,
  recalculateHandle,
  DEFAULT_BASE_URL,
  DIRTY_STATS_TTL_SECONDS,
  BADGE_RENDER_VARIANT,
  type Config,
  type SnapshotRow,
} from "./recalculate-handles";

describe("parseArgs", () => {
  it("returns handles with dry-run default and production base URL", () => {
    expect(parseArgs(["juan294"])).toEqual({
      handles: ["juan294"],
      apply: false,
      baseUrl: DEFAULT_BASE_URL,
    });
  });

  it("accepts multiple handles", () => {
    expect(parseArgs(["juan294", "mdburgos"])).toEqual({
      handles: ["juan294", "mdburgos"],
      apply: false,
      baseUrl: DEFAULT_BASE_URL,
    });
  });

  it("sets apply when --apply is passed (order-independent)", () => {
    expect(parseArgs(["--apply", "juan294"]).apply).toBe(true);
    expect(parseArgs(["juan294", "--apply"]).apply).toBe(true);
  });

  it("accepts a custom --base-url and strips a trailing slash", () => {
    expect(parseArgs(["juan294", "--base-url=http://localhost:3001/"]).baseUrl).toBe(
      "http://localhost:3001",
    );
    expect(parseArgs(["--base-url=https://preview.example", "juan294"]).baseUrl).toBe(
      "https://preview.example",
    );
  });

  it("throws when no handle is provided", () => {
    expect(() => parseArgs([])).toThrow(/handle/i);
    expect(() => parseArgs(["--apply"])).toThrow(/handle/i);
    expect(() => parseArgs(["--base-url=http://localhost:3001"])).toThrow(/handle/i);
  });
});

describe("normalizeHandle", () => {
  it("lowercases and trims", () => {
    expect(normalizeHandle("  Juan294  ")).toBe("juan294");
  });

  it("rejects glob/wildcard and injection characters", () => {
    expect(() => normalizeHandle("*")).toThrow(/invalid/i);
    expect(() => normalizeHandle("foo;drop")).toThrow(/invalid/i);
    expect(() => normalizeHandle("foo/bar")).toThrow(/invalid/i);
    expect(() => normalizeHandle("foo bar")).toThrow(/invalid/i);
  });

  it("rejects empty handles", () => {
    expect(() => normalizeHandle("")).toThrow();
    expect(() => normalizeHandle("   ")).toThrow();
  });
});

describe("key builders", () => {
  it("build the exact keys the app itself reads/writes", () => {
    expect(mergedStatsKey("juan294")).toBe("stats:v2:merged:juan294");
    expect(staleStatsKey("juan294")).toBe("stats:stale:v2:juan294");
    expect(snapshotKey("juan294")).toBe("snapshot:v2:latest:juan294");
    expect(dirtyStatsKey("juan294")).toBe("stats:dirty:juan294");
  });

  it("builds the locale-scoped badge SVG cache key", () => {
    expect(badgeSvgCacheKey("juan294", "2026-08-28", "es")).toBe(
      "badge:v2:juan294:jade-v1:2026-08-28:es",
    );
    expect(badgeSvgCacheKey("juan294", "2026-08-28", "en")).toBe(
      "badge:v2:juan294:jade-v1:2026-08-28:en",
    );
  });

  it("builds the anonymous trigger URL", () => {
    expect(badgeUrl("https://chapa.thecreativetoken.com", "juan294")).toBe(
      "https://chapa.thecreativetoken.com/u/juan294/badge.svg",
    );
  });

  it("documented constants match the real writers", () => {
    expect(DIRTY_STATS_TTL_SECONDS).toBe(3600);
    expect(BADGE_RENDER_VARIANT).toBe(CANONICAL_BADGE_RENDER_VARIANT);
  });
});

describe("computeFootprint", () => {
  it("is pure and includes one badge key per supported locale, never the baseline in a mutating slot", () => {
    const footprint = computeFootprint("juan294", "https://chapa.thecreativetoken.com", "2026-08-28");

    expect(footprint).toEqual({
      handle: "juan294",
      mergedKey: "stats:v2:merged:juan294",
      snapshotKey: "snapshot:v2:latest:juan294",
      badgeKeys: [
        "badge:v2:juan294:jade-v1:2026-08-28:en",
        "badge:v2:juan294:jade-v1:2026-08-28:es",
      ],
      dirtyKey: "stats:dirty:juan294",
      dirtyTtlSeconds: 3600,
      triggerUrl: "https://chapa.thecreativetoken.com/u/juan294/badge.svg",
      protectedBaselineKey: "stats:stale:v2:juan294",
    });
  });
});

describe("snapshotChanged", () => {
  const base: SnapshotRow = {
    date: "2026-08-28",
    captured_at: "2026-08-28T10:00:00.000Z",
    composite_score: 70,
    adjusted_composite: 68,
  };

  it("reports no change when both sides are absent", () => {
    expect(snapshotChanged(null, null)).toBe(false);
  });

  it("reports change when a row appears where there was none", () => {
    expect(snapshotChanged(null, base)).toBe(true);
  });

  it("reports change when a row disappears", () => {
    expect(snapshotChanged(base, null)).toBe(true);
  });

  it("ignores captured_at-only differences (no real change)", () => {
    const after = { ...base, captured_at: "2026-08-28T11:30:00.000Z" };
    expect(snapshotChanged(base, after)).toBe(false);
  });

  it("reports change when a scoring field differs", () => {
    const after = { ...base, adjusted_composite: 82, captured_at: "2026-08-28T11:30:00.000Z" };
    expect(snapshotChanged(base, after)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// recalculateHandle — network-mocked tests
// ---------------------------------------------------------------------------

const cfg: Config = {
  redisUrl: "https://redis.example",
  redisToken: "redis-token",
  supaUrl: "https://supa.example",
  supaKey: "supa-key",
};

interface Scenario {
  /** Sequential responses for the metrics_snapshots GET, in call order. Last value repeats if exhausted. */
  snapshotRows: (SnapshotRow | null)[];
  /** HTTP status for the badge.svg trigger request, or "error" to simulate a network failure. */
  triggerStatus?: number | "error";
}

function mockFetch(scenario: Scenario) {
  const calls: { url: string; method: string }[] = [];
  const rows = [...scenario.snapshotRows];

  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    calls.push({ url, method });

    if (url.includes("/DEL/")) {
      return jsonResponse({ result: 1 });
    }
    if (url.includes("/SET/")) {
      return jsonResponse({ result: "OK" });
    }
    if (url.includes("/rest/v1/metrics_snapshots")) {
      const next = rows.length > 1 ? rows.shift()! : rows[0] ?? null;
      return jsonResponse(next ? [next] : []);
    }
    if (url.includes("/badge.svg")) {
      if (scenario.triggerStatus === "error") {
        throw new Error("network error");
      }
      return new Response("<svg></svg>", {
        status: scenario.triggerStatus ?? 200,
        headers: { "content-type": "image/svg+xml" },
      });
    }

    throw new Error(`Unexpected fetch call: ${method} ${url}`);
  });

  return { fn, calls };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("recalculateHandle — dry run (apply: false)", () => {
  it("issues ZERO network calls and returns only the computed footprint", async () => {
    const fn = vi.fn(() => {
      throw new Error("dry run must never call fetch");
    });
    vi.stubGlobal("fetch", fn);

    const result = await recalculateHandle(
      cfg,
      "juan294",
      false,
      "https://chapa.thecreativetoken.com",
      "2026-08-28",
    );

    expect(fn).not.toHaveBeenCalled();
    expect(result.footprint.mergedKey).toBe("stats:v2:merged:juan294");
    expect(result.beforeSnapshot).toBeNull();
    expect(result.afterSnapshot).toBeNull();
    expect(result.changed).toBeNull();
    expect(result.deletedRedisKeys).toEqual([]);
    expect(result.dirtyMarkerSet).toBe(false);
    expect(result.triggerRequested).toBe(false);
  });

  it("rejects an invalid handle before touching the network at all, in either mode", async () => {
    const fn = vi.fn(() => {
      throw new Error("must never call fetch for an invalid handle");
    });
    vi.stubGlobal("fetch", fn);

    await expect(
      recalculateHandle(cfg, "*", false, "https://chapa.thecreativetoken.com", "2026-08-28"),
    ).rejects.toThrow(/invalid/i);
    await expect(
      recalculateHandle(cfg, "foo;drop table", true, "https://chapa.thecreativetoken.com", "2026-08-28"),
    ).rejects.toThrow(/invalid/i);

    expect(fn).not.toHaveBeenCalled();
  });
});

describe("recalculateHandle — apply mode (apply: true)", () => {
  const before: SnapshotRow = {
    date: "2026-08-28",
    captured_at: "2026-08-28T09:00:00.000Z",
    adjusted_composite: 61,
  };
  const after: SnapshotRow = {
    date: "2026-08-28",
    captured_at: "2026-08-28T09:05:00.000Z",
    adjusted_composite: 74,
  };

  it("deletes merged/snapshot/badge keys, NEVER the protected baseline, in the right order relative to the dirty marker and trigger", async () => {
    const { fn, calls } = mockFetch({ snapshotRows: [before, after], triggerStatus: 200 });
    vi.stubGlobal("fetch", fn);

    const result = await recalculateHandle(
      cfg,
      "juan294",
      true,
      "https://chapa.thecreativetoken.com",
      "2026-08-28",
      { verifyAttempts: 1 },
    );

    expect(result.deletedRedisKeys.sort()).toEqual(
      [
        "stats:v2:merged:juan294",
        "snapshot:v2:latest:juan294",
        "badge:v2:juan294:jade-v1:2026-08-28:en",
        "badge:v2:juan294:jade-v1:2026-08-28:es",
      ].sort(),
    );

    // The protected baseline is NEVER deleted, in this or any other test.
    expect(calls.some((c) => c.url.includes("stats%3Astale%3Av2%3Ajuan294"))).toBe(false);
    expect(calls.some((c) => c.url.includes("stats:stale:v2:juan294"))).toBe(false);

    const setIndex = calls.findIndex((c) => c.url.includes("/SET/"));
    const triggerIndex = calls.findIndex((c) => c.url.includes("/badge.svg"));
    expect(setIndex).toBeGreaterThanOrEqual(0);
    expect(triggerIndex).toBeGreaterThan(setIndex);

    // The SET call carries the exact dirty key and the real writer's TTL.
    const setCall = calls[setIndex];
    expect(decodeURIComponent(setCall.url)).toContain("/SET/stats:dirty:juan294/1/EX/3600");

    expect(result.dirtyMarkerSet).toBe(true);
    expect(result.triggerRequested).toBe(true);
    expect(result.triggerStatus).toBe(200);
    expect(result.changed).toBe(true);
    expect(result.beforeSnapshot).toEqual(before);
    expect(result.afterSnapshot).toEqual(after);
  });

  it("reports UNCHANGED when the recomputed row is identical (ignoring captured_at)", async () => {
    const same = { ...before, captured_at: "2026-08-28T09:05:00.000Z" };
    const { fn } = mockFetch({ snapshotRows: [before, same], triggerStatus: 200 });
    vi.stubGlobal("fetch", fn);

    const result = await recalculateHandle(
      cfg,
      "juan294",
      true,
      "https://chapa.thecreativetoken.com",
      "2026-08-28",
      { verifyAttempts: 1 },
    );

    expect(result.changed).toBe(false);
  });

  it("polls for the after()-deferred write instead of reporting a false UNCHANGED", async () => {
    // First after-read still shows the pre-recompute row (write hasn't landed
    // yet); second read shows the corrected value.
    const { fn } = mockFetch({ snapshotRows: [before, before, after], triggerStatus: 200 });
    vi.stubGlobal("fetch", fn);
    const sleepFn = vi.fn(async () => {});

    const result = await recalculateHandle(
      cfg,
      "juan294",
      true,
      "https://chapa.thecreativetoken.com",
      "2026-08-28",
      { verifyAttempts: 3, verifyDelayMs: 1500, sleepFn },
    );

    expect(sleepFn).toHaveBeenCalledTimes(1);
    expect(sleepFn).toHaveBeenCalledWith(1500);
    expect(result.changed).toBe(true);
    expect(result.afterSnapshot).toEqual(after);
  });

  it("gives up after verifyAttempts and reports UNCHANGED rather than polling forever", async () => {
    const { fn } = mockFetch({ snapshotRows: [before, before, before, before], triggerStatus: 200 });
    vi.stubGlobal("fetch", fn);
    const sleepFn = vi.fn(async () => {});

    const result = await recalculateHandle(
      cfg,
      "juan294",
      true,
      "https://chapa.thecreativetoken.com",
      "2026-08-28",
      { verifyAttempts: 3, verifyDelayMs: 10, sleepFn },
    );

    expect(sleepFn).toHaveBeenCalledTimes(2); // attempts 2 and 3, never a 3rd sleep after the last read
    expect(result.changed).toBe(false);
  });

  it("does not throw when the trigger request itself fails, and still verifies", async () => {
    const { fn } = mockFetch({ snapshotRows: [before, after], triggerStatus: "error" });
    vi.stubGlobal("fetch", fn);

    const result = await recalculateHandle(
      cfg,
      "juan294",
      true,
      "https://chapa.thecreativetoken.com",
      "2026-08-28",
      { verifyAttempts: 1 },
    );

    expect(result.triggerRequested).toBe(true);
    expect(result.triggerStatus).toBeNull();
    // Verification still runs even though the trigger request failed.
    expect(result.changed).toBe(true);
  });

  it("never issues a mutating call before validating the handle", async () => {
    const { fn, calls } = mockFetch({ snapshotRows: [before, after], triggerStatus: 200 });
    vi.stubGlobal("fetch", fn);

    await expect(
      recalculateHandle(cfg, "not a handle", true, "https://chapa.thecreativetoken.com", "2026-08-28"),
    ).rejects.toThrow(/invalid/i);

    expect(calls).toEqual([]);
  });
});
