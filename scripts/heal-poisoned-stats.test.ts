import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  parseArgs,
  normalizeHandle,
  mergedStatsKey,
  staleStatsKey,
  snapshotKey,
  SNAPSHOT_COMMITS_THRESHOLD,
  healHandle,
  type Config,
} from "./heal-poisoned-stats";

describe("parseArgs", () => {
  it("returns handles with dry-run default (no --apply)", () => {
    expect(parseArgs(["juan294"])).toEqual({
      handles: ["juan294"],
      apply: false,
    });
  });

  it("accepts multiple handles", () => {
    expect(parseArgs(["juan294", "mdburgos"])).toEqual({
      handles: ["juan294", "mdburgos"],
      apply: false,
    });
  });

  it("sets apply when --apply is passed (order-independent)", () => {
    expect(parseArgs(["--apply", "juan294"])).toEqual({
      handles: ["juan294"],
      apply: true,
    });
    expect(parseArgs(["juan294", "--apply"])).toEqual({
      handles: ["juan294"],
      apply: true,
    });
  });

  it("throws when no handle is provided", () => {
    expect(() => parseArgs([])).toThrow(/handle/i);
    expect(() => parseArgs(["--apply"])).toThrow(/handle/i);
  });
});

describe("normalizeHandle", () => {
  it("lowercases and trims", () => {
    expect(normalizeHandle("  Juan294  ")).toBe("juan294");
  });

  it("rejects glob/wildcard and injection characters", () => {
    expect(() => normalizeHandle("*")).toThrow(/invalid/i);
    expect(() => normalizeHandle("foo;drop")).toThrow(/invalid/i);
  });

  it("rejects empty handles", () => {
    expect(() => normalizeHandle("")).toThrow();
  });
});

describe("key builders", () => {
  it("build the exact keys the app itself reads/writes", () => {
    expect(mergedStatsKey("juan294")).toBe("stats:v2:merged:juan294");
    expect(staleStatsKey("juan294")).toBe("stats:stale:juan294");
    expect(snapshotKey("juan294")).toBe("snapshot:v2:latest:juan294");
  });
});

describe("SNAPSHOT_COMMITS_THRESHOLD", () => {
  it("is the documented threshold (100)", () => {
    expect(SNAPSHOT_COMMITS_THRESHOLD).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// healHandle — network-mocked tests
// ---------------------------------------------------------------------------

const cfg: Config = {
  redisUrl: "https://redis.example",
  redisToken: "redis-token",
  supaUrl: "https://supa.example",
  supaKey: "supa-key",
};

const poisonedStats = {
  prsMergedCount: 0,
  commitsTotal: 15533,
  issuesClosedCount: 5096,
};

const healthyStats = {
  prsMergedCount: 41,
  commitsTotal: 14000,
  issuesClosedCount: 608,
};

interface FetchScenario {
  mergedValue: unknown;
  staleValue: unknown;
  poisonedRowCount: number;
}

function mockFetch(scenario: FetchScenario) {
  const calls: { url: string; method: string }[] = [];

  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    calls.push({ url, method });

    // Redis GET
    if (url.includes("/GET/stats%3Av2%3Amerged%3A")) {
      return jsonResponse({ result: toRedisResult(scenario.mergedValue) });
    }
    if (url.includes("/GET/stats%3Astale%3A")) {
      return jsonResponse({ result: toRedisResult(scenario.staleValue) });
    }

    // Redis DEL
    if (url.includes("/DEL/")) {
      return jsonResponse({ result: 1 });
    }

    // Supabase HEAD count
    if (method === "HEAD") {
      return new Response(null, {
        status: 200,
        headers: { "content-range": `0-0/${scenario.poisonedRowCount}` },
      });
    }

    // Supabase DELETE
    if (method === "DELETE") {
      const rows = Array.from({ length: scenario.poisonedRowCount }, (_, i) => ({
        id: i,
      }));
      return jsonResponse(rows);
    }

    throw new Error(`Unexpected fetch call: ${method} ${url}`);
  });

  return { fn, calls };
}

function toRedisResult(value: unknown): string | null {
  if (value === null) return null;
  return JSON.stringify(value);
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

describe("healHandle — dry run (apply: false)", () => {
  it("identifies the poisoned shape without mutating anything", async () => {
    const { fn, calls } = mockFetch({
      mergedValue: poisonedStats,
      staleValue: poisonedStats,
      poisonedRowCount: 3,
    });
    vi.stubGlobal("fetch", fn);

    const result = await healHandle(cfg, "juan294", false);

    expect(result).toEqual({
      handle: "juan294",
      mergedPoisoned: true,
      stalePoisoned: true,
      poisonedSnapshotRows: 3,
      deletedRedisKeys: [],
      deletedSnapshotRows: 0,
    });

    // Never mutates in dry-run mode.
    expect(calls.some((c) => c.url.includes("/DEL/"))).toBe(false);
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
  });

  it("reports a healthy handle as not poisoned", async () => {
    const { fn } = mockFetch({
      mergedValue: healthyStats,
      staleValue: healthyStats,
      poisonedRowCount: 0,
    });
    vi.stubGlobal("fetch", fn);

    const result = await healHandle(cfg, "healthy-user", false);

    expect(result).toEqual({
      handle: "healthy-user",
      mergedPoisoned: false,
      stalePoisoned: false,
      poisonedSnapshotRows: 0,
      deletedRedisKeys: [],
      deletedSnapshotRows: 0,
    });
  });

  it("treats a missing Redis key as not poisoned (no data to purge)", async () => {
    const { fn } = mockFetch({
      mergedValue: null,
      staleValue: null,
      poisonedRowCount: 0,
    });
    vi.stubGlobal("fetch", fn);

    const result = await healHandle(cfg, "no-cache-user", false);

    expect(result.mergedPoisoned).toBe(false);
    expect(result.stalePoisoned).toBe(false);
  });
});

describe("healHandle — apply mode (apply: true)", () => {
  it("DELETEs the poisoned Redis keys, the snapshot cache key, and the corrupt snapshot rows", async () => {
    const { fn, calls } = mockFetch({
      mergedValue: poisonedStats,
      staleValue: poisonedStats,
      poisonedRowCount: 2,
    });
    vi.stubGlobal("fetch", fn);

    const result = await healHandle(cfg, "juan294", true);

    expect(result.deletedRedisKeys.sort()).toEqual(
      [
        "stats:v2:merged:juan294",
        "stats:stale:juan294",
        "snapshot:v2:latest:juan294",
      ].sort(),
    );
    expect(result.deletedSnapshotRows).toBe(2);

    expect(calls.some((c) => c.url.includes("/DEL/stats%3Av2%3Amerged%3Ajuan294"))).toBe(true);
    expect(calls.some((c) => c.url.includes("/DEL/stats%3Astale%3Ajuan294"))).toBe(true);
    expect(calls.some((c) => c.url.includes("/DEL/snapshot%3Av2%3Alatest%3Ajuan294"))).toBe(true);
    expect(calls.some((c) => c.method === "DELETE")).toBe(true);
  });

  it("does NOT issue any mutating call for a healthy handle", async () => {
    const { fn, calls } = mockFetch({
      mergedValue: healthyStats,
      staleValue: healthyStats,
      poisonedRowCount: 0,
    });
    vi.stubGlobal("fetch", fn);

    const result = await healHandle(cfg, "healthy-user", true);

    expect(result.deletedRedisKeys).toEqual([]);
    expect(result.deletedSnapshotRows).toBe(0);
    expect(calls.some((c) => c.url.includes("/DEL/"))).toBe(false);
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
  });
});
