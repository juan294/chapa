import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  parseArgs,
  normalizeHandle,
  redisScanPattern,
  SUPABASE_TABLES,
  run,
} from "./delete-user";

// ---------------------------------------------------------------------------
// run() — exercised against a fake `fetch` (no real network/Redis/Supabase).
// ---------------------------------------------------------------------------

const REDIS_URL = "https://fake-redis.upstash.io";
const SUPA_URL = "https://fake-project.supabase.co";

interface FakeFetchOptions {
  /** Row count returned for each table's HEAD count check. Default 0. */
  supaCounts?: Record<string, number>;
  /** Table name whose DELETE request should fail (simulates a mid-loop error). */
  supaDeleteFailTable?: string;
  /** Successive SCAN pages: cursor to return alongside a batch of keys. */
  scanPages?: Array<{ cursor: string; keys: string[] }>;
}

interface RecordedCall {
  url: string;
  method: string;
}

function tableFromUrl(url: string): string {
  const match = url.match(/\/rest\/v1\/([^?]+)\?/);
  if (!match) throw new Error(`Could not parse table from URL: ${url}`);
  return match[1];
}

function makeFakeFetch(opts: FakeFetchOptions) {
  const calls: RecordedCall[] = [];
  let scanCallIndex = 0;
  const scanPages = opts.scanPages ?? [{ cursor: "0", keys: [] }];

  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    calls.push({ url, method });

    if (url.startsWith(`${REDIS_URL}/SCAN/`)) {
      const page = scanPages[scanCallIndex] ?? { cursor: "0", keys: [] };
      scanCallIndex += 1;
      return {
        ok: true,
        status: 200,
        json: async () => ({ result: [page.cursor, page.keys] }),
        text: async () => "",
      } as unknown as Response;
    }

    if (url.startsWith(`${REDIS_URL}/DEL/`)) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ result: 1 }),
        text: async () => "",
      } as unknown as Response;
    }

    if (url.startsWith(SUPA_URL)) {
      const table = tableFromUrl(url);
      if (method === "HEAD") {
        const count = opts.supaCounts?.[table] ?? 0;
        return {
          ok: true,
          status: 200,
          headers: {
            get: (h: string) => (h === "content-range" ? `*/${count}` : null),
          },
          text: async () => "",
          json: async () => ({}),
        } as unknown as Response;
      }
      if (method === "DELETE") {
        if (opts.supaDeleteFailTable === table) {
          return {
            ok: false,
            status: 500,
            headers: { get: () => null },
            text: async () => "simulated failure",
            json: async () => ({}),
          } as unknown as Response;
        }
        return {
          ok: true,
          status: 200,
          headers: { get: () => null },
          text: async () => "[{}]",
          json: async () => [{}],
        } as unknown as Response;
      }
    }

    throw new Error(`Unhandled fake fetch call: ${method} ${url}`);
  });

  return { fetchMock, calls };
}

describe("run", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = REDIS_URL;
    process.env.UPSTASH_REDIS_REST_TOKEN = "fake-redis-token";
    process.env.SUPABASE_URL = SUPA_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "fake-service-role-key";
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("dry-run issues zero DELETE/DEL calls even when rows and keys exist", async () => {
    const { fetchMock, calls } = makeFakeFetch({
      supaCounts: { users: 5, metrics_snapshots: 2 },
      scanPages: [{ cursor: "0", keys: ["stats:v2:merged:octocat"] }],
    });
    vi.stubGlobal("fetch", fetchMock);

    await run(["octocat"]);

    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
    expect(calls.some((c) => c.url.includes(`${REDIS_URL}/DEL/`))).toBe(
      false,
    );
    // Sanity: it still did the read-only discovery work.
    expect(calls.some((c) => c.method === "HEAD")).toBe(true);
    expect(calls.some((c) => c.url.includes(`${REDIS_URL}/SCAN/`))).toBe(
      true,
    );
  });

  it("a mid-loop supaDelete rejection surfaces which tables already completed", async () => {
    const allCounted = Object.fromEntries(
      SUPABASE_TABLES.map(({ table }) => [table, 1]),
    );
    const { fetchMock, calls } = makeFakeFetch({
      supaCounts: allCounted,
      supaDeleteFailTable: "user_platforms",
      scanPages: [{ cursor: "0", keys: [] }],
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(run(["octocat", "--delete"])).rejects.toThrow(
      /delete user_platforms/,
    );

    // Tables before the failure completed (HEAD + DELETE both fired)...
    const completed = ["users", "metrics_snapshots", "verification_records"];
    for (const table of completed) {
      const tableCalls = calls.filter((c) => c.url.includes(`/${table}?`));
      expect(tableCalls.map((c) => c.method)).toEqual(["HEAD", "DELETE"]);
    }
    // ...the failing table was counted and attempted...
    const failingCalls = calls.filter((c) =>
      c.url.includes("/user_platforms?"),
    );
    expect(failingCalls.map((c) => c.method)).toEqual(["HEAD", "DELETE"]);

    // ...and nothing after it in the table list was ever touched — the loop
    // stopped exactly where the failure happened, not before, not after.
    const untouched = ["supplemental_stats", "tool_insights", "campaign_sends"];
    for (const table of untouched) {
      expect(calls.some((c) => c.url.includes(`/${table}?`))).toBe(false);
    }

    // The printed log surfaces the same boundary: completed tables (and the
    // failing one) were named in the log, but only completed tables got a
    // "-> DELETED" confirmation — the failing table's delete never printed,
    // and later tables were never named at all.
    const logged = (console.log as unknown as { mock: { calls: unknown[][] } })
      .mock.calls.map((args) => args.join(" "));
    for (const table of [...completed, "user_platforms"]) {
      expect(logged.some((line) => line.includes(table))).toBe(true);
    }
    expect(logged.filter((line) => line.includes("-> DELETED")).length).toBe(
      completed.length,
    );
    for (const table of untouched) {
      expect(logged.some((line) => line.includes(table))).toBe(false);
    }
  });

  it("SCAN pagination follows a non-\"0\" cursor to completion", async () => {
    const { fetchMock, calls } = makeFakeFetch({
      scanPages: [
        { cursor: "42", keys: ["stats:v2:merged:octocat", "stats:stale:v2:octocat"] },
        { cursor: "0", keys: ["snapshot:v2:latest:octocat"] },
      ],
    });
    vi.stubGlobal("fetch", fetchMock);

    await run(["octocat"]);

    const scanCalls = calls.filter((c) => c.url.includes(`${REDIS_URL}/SCAN/`));
    expect(scanCalls).toHaveLength(2);
    expect(scanCalls[0].url).toContain(`${REDIS_URL}/SCAN/0/`);
    expect(scanCalls[1].url).toContain(`${REDIS_URL}/SCAN/42/`);

    const logged = (console.log as unknown as { mock: { calls: unknown[][] } })
      .mock.calls.map((args) => args.join(" "));
    expect(logged.some((line) => line.includes("Found 3 key(s)"))).toBe(true);
  });

  it("normalizeHandle runs before any fetch call — invalid handles never touch Redis or Supabase", async () => {
    const { fetchMock, calls } = makeFakeFetch({});
    vi.stubGlobal("fetch", fetchMock);

    await expect(run(["a*b", "--delete"])).rejects.toThrow(/invalid/i);

    expect(calls).toHaveLength(0);
  });
});

describe("parseArgs", () => {
  it("returns handle with dry-run default (no --delete)", () => {
    expect(parseArgs(["mdburgos"])).toEqual({
      handle: "mdburgos",
      doDelete: false,
    });
  });

  it("sets doDelete when --delete is passed (order-independent)", () => {
    expect(parseArgs(["--delete", "MdBurgos"])).toEqual({
      handle: "MdBurgos",
      doDelete: true,
    });
    expect(parseArgs(["MdBurgos", "--delete"])).toEqual({
      handle: "MdBurgos",
      doDelete: true,
    });
  });

  it("throws when no handle is provided", () => {
    expect(() => parseArgs([])).toThrow(/handle/i);
    expect(() => parseArgs(["--delete"])).toThrow(/handle/i);
  });
});

describe("normalizeHandle", () => {
  it("lowercases and trims", () => {
    expect(normalizeHandle("  MdBurgos  ")).toBe("mdburgos");
    expect(normalizeHandle("Octo-Cat")).toBe("octo-cat");
    expect(normalizeHandle("user123")).toBe("user123");
  });

  it("rejects empty / whitespace handles", () => {
    expect(() => normalizeHandle("")).toThrow();
    expect(() => normalizeHandle("   ")).toThrow();
  });

  it("rejects glob/wildcard characters to prevent mass-delete via SCAN", () => {
    expect(() => normalizeHandle("*")).toThrow(/invalid/i);
    expect(() => normalizeHandle("md*")).toThrow(/invalid/i);
    expect(() => normalizeHandle("?")).toThrow(/invalid/i);
  });

  it("rejects characters that could break PostgREST filters / injection", () => {
    expect(() => normalizeHandle("a b")).toThrow(/invalid/i);
    expect(() => normalizeHandle("foo;drop")).toThrow(/invalid/i);
    expect(() => normalizeHandle("a,b")).toThrow(/invalid/i);
    expect(() => normalizeHandle("a.b")).toThrow(/invalid/i);
    expect(() => normalizeHandle("a/b")).toThrow(/invalid/i);
  });

  it("accepts only valid GitHub-style handles (alphanumeric + hyphen)", () => {
    expect(normalizeHandle("a-valid-handle-123")).toBe("a-valid-handle-123");
  });
});

describe("redisScanPattern", () => {
  it("wraps a normalized handle in wildcards", () => {
    expect(redisScanPattern("mdburgos")).toBe("*mdburgos*");
  });
});

describe("SUPABASE_TABLES", () => {
  it("covers every per-user table with the correct handle column", () => {
    const map = Object.fromEntries(
      SUPABASE_TABLES.map((t) => [t.table, t.column]),
    );
    expect(map).toEqual({
      users: "handle",
      metrics_snapshots: "handle",
      verification_records: "handle",
      user_platforms: "handle",
      supplemental_stats: "target_handle",
      tool_insights: "handle",
      campaign_sends: "handle",
    });
  });
});
