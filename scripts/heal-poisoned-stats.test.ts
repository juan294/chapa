import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  parseArgs,
  normalizeHandle,
  mergedStatsKey,
  staleStatsKey,
  snapshotKey,
  SNAPSHOT_COMMITS_THRESHOLD,
  healHandle,
  selectPoisonedSnapshotDates,
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

// The exact juan294 2026-07-14 production shape (#1049): a POSITIVE count from
// the token-scoped search, with sample-derived fields collapsed. Invisible to
// isPoisonedStats, which keys on count === 0.
const blindedStats = {
  prsMergedCount: 140,
  prsMergedWeight: 3.37828,
  linesAdded: 59,
  linesDeleted: 10,
  commitsTotal: 16292,
  issuesClosedCount: 5208,
};

const healthyStats = {
  prsMergedCount: 41,
  prsMergedWeight: 120,
  linesAdded: 78545,
  linesDeleted: 26537,
  commitsTotal: 14000,
  issuesClosedCount: 608,
};

/** Snapshot row as PostgREST returns it (snake_case). */
interface SnapshotRowLike {
  date: string;
  prs_merged_count: number;
  prs_merged_weight: number | null;
  lines_added: number | null;
  lines_deleted: number | null;
  commits_total: number;
  issues_closed: number;
}

const blindedRow: SnapshotRowLike = {
  date: "2026-07-14",
  prs_merged_count: 140,
  prs_merged_weight: 3.37828,
  lines_added: 59,
  lines_deleted: 10,
  commits_total: 16292,
  issues_closed: 5208,
};

const zeroShapeRow: SnapshotRowLike = {
  date: "2026-03-02",
  prs_merged_count: 0,
  prs_merged_weight: 0,
  lines_added: 0,
  lines_deleted: 0,
  commits_total: 15533,
  issues_closed: 5096,
};

const healthyRow: SnapshotRowLike = {
  date: "2026-07-13",
  prs_merged_count: 953,
  prs_merged_weight: 120,
  lines_added: 101313,
  lines_deleted: 54996,
  commits_total: 16187,
  issues_closed: 608,
};

interface FetchScenario {
  mergedValue: unknown;
  staleValue: unknown;
  snapshotRows: SnapshotRowLike[];
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

    // Supabase GET candidate rows
    if (method === "GET" && url.includes("/rest/v1/metrics_snapshots")) {
      return jsonResponse(scenario.snapshotRows);
    }

    // Supabase DELETE (date-filtered)
    if (method === "DELETE") {
      const m = url.match(/date=in\.%28([^&]*)%29|date=in\.\(([^&)]*)\)/);
      const rawDates = decodeURIComponent(m?.[1] ?? m?.[2] ?? "");
      const dates = rawDates.split(",").filter(Boolean);
      return jsonResponse(scenario.snapshotRows.filter((r) => dates.includes(r.date)));
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
      snapshotRows: [zeroShapeRow, blindedRow, healthyRow],
    });
    vi.stubGlobal("fetch", fn);

    const result = await healHandle(cfg, "juan294", false);

    expect(result).toEqual({
      handle: "juan294",
      mergedPoisoned: true,
      stalePoisoned: true,
      poisonedSnapshotRows: 2,
      poisonedSnapshotDates: ["2026-03-02", "2026-07-14"],
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
      snapshotRows: [healthyRow],
    });
    vi.stubGlobal("fetch", fn);

    const result = await healHandle(cfg, "healthy-user", false);

    expect(result).toEqual({
      handle: "healthy-user",
      mergedPoisoned: false,
      stalePoisoned: false,
      poisonedSnapshotRows: 0,
      poisonedSnapshotDates: [],
      deletedRedisKeys: [],
      deletedSnapshotRows: 0,
    });
  });

  it("treats a missing Redis key as not poisoned (no data to purge)", async () => {
    const { fn } = mockFetch({
      mergedValue: null,
      staleValue: null,
      snapshotRows: [],
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
      snapshotRows: [zeroShapeRow, blindedRow],
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
      snapshotRows: [healthyRow],
    });
    vi.stubGlobal("fetch", fn);

    const result = await healHandle(cfg, "healthy-user", true);

    expect(result.deletedRedisKeys).toEqual([]);
    expect(result.deletedSnapshotRows).toBe(0);
    expect(calls.some((c) => c.url.includes("/DEL/"))).toBe(false);
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// #1049 — the scope-blinded shape (positive count, collapsed sample fields)
// ---------------------------------------------------------------------------

describe("selectPoisonedSnapshotDates (#1049)", () => {
  it("selects zero-shape and blinded rows, never healthy ones", () => {
    expect(selectPoisonedSnapshotDates([zeroShapeRow, blindedRow, healthyRow])).toEqual([
      "2026-03-02",
      "2026-07-14",
    ]);
  });

  it("keeps the commits threshold for the zero shape (low-activity zero rows are left alone)", () => {
    const quietZeroRow = { ...zeroShapeRow, commits_total: SNAPSHOT_COMMITS_THRESHOLD };
    expect(selectPoisonedSnapshotDates([quietZeroRow])).toEqual([]);
  });

  it("tolerates legacy rows with null sample fields — zero-check only, no crash", () => {
    const legacyRow = {
      ...blindedRow,
      prs_merged_weight: null,
      lines_added: null,
      lines_deleted: null,
    };
    // Without the sample-derived fields the blindness proof is impossible, so
    // the row must be left alone rather than guessed at.
    expect(selectPoisonedSnapshotDates([legacyRow])).toEqual([]);
  });
});

describe("healHandle — blinded Redis keys (#1049)", () => {
  it("flags a blinded (positive-count) cached stats value as poisoned", async () => {
    const { fn } = mockFetch({
      mergedValue: blindedStats,
      staleValue: healthyStats,
      snapshotRows: [],
    });
    vi.stubGlobal("fetch", fn);

    const result = await healHandle(cfg, "juan294", false);

    expect(result.mergedPoisoned).toBe(true);
    expect(result.stalePoisoned).toBe(false);
  });

  it("treats a legacy cached value without sample fields as zero-check only", async () => {
    const legacy = { prsMergedCount: 140, commitsTotal: 16292, issuesClosedCount: 5208 };
    const { fn } = mockFetch({
      mergedValue: legacy,
      staleValue: null,
      snapshotRows: [],
    });
    vi.stubGlobal("fetch", fn);

    const result = await healHandle(cfg, "juan294", false);

    expect(result.mergedPoisoned).toBe(false);
  });

  it("apply mode DELETEs snapshot rows by exact date list, not a broad filter", async () => {
    const { fn, calls } = mockFetch({
      mergedValue: blindedStats,
      staleValue: healthyStats,
      snapshotRows: [blindedRow, healthyRow],
    });
    vi.stubGlobal("fetch", fn);

    const result = await healHandle(cfg, "juan294", true);

    expect(result.poisonedSnapshotDates).toEqual(["2026-07-14"]);
    expect(result.deletedSnapshotRows).toBe(1);

    const del = calls.find((c) => c.method === "DELETE");
    expect(del).toBeDefined();
    // The delete must be scoped to the reviewed dates — a dry-run shows the
    // operator exactly these dates, and apply must delete exactly them.
    expect(decodeURIComponent(del!.url)).toContain("date=in.(2026-07-14)");
    expect(decodeURIComponent(del!.url)).toContain("handle=eq.juan294");
  });
});
