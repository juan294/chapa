import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  parseArgs,
  normalizeHandle,
  redisScanPattern,
  classifyRedisOwnership,
  SUPABASE_TABLES,
  run,
} from "./delete-user";

// ---------------------------------------------------------------------------
// run() — exercised against a fake `fetch` (no real network/Redis/Supabase).
// ---------------------------------------------------------------------------

vi.mock("./lib/env", () => ({
  loadConfig: () => ({
    redisUrl: "https://fake-redis.upstash.io", redisToken: "fake-redis-token",
    supaUrl: "https://fake-project.supabase.co", supaKey: "fake-service-role-key",
  }),
}));

const REDIS_URL = "https://fake-redis.upstash.io";
const SUPA_URL = "https://fake-project.supabase.co";

interface FakeFetchOptions {
  /** Row count returned for each table's HEAD count check. Default 0. */
  supaCounts?: Record<string, number>;
  /** Table name whose DELETE request should fail (simulates a mid-loop error). */
  supaDeleteFailTable?: string;
  scoringRpcFails?: boolean;
  receiptIds?: string[];
  redisDeleteFails?: boolean;
  redisKeys?: Set<string>;
  scoringRpcLeavesRows?: boolean;
  /** Successive SCAN pages: cursor to return alongside a batch of keys. */
  scanPages?: Array<{ cursor: string; keys: string[] }>;
}

interface RecordedCall {
  url: string;
  method: string;
  body?: BodyInit | null;
}

function tableFromUrl(url: string): string {
  const match = url.match(/\/rest\/v1\/([^?]+)\?/);
  if (!match) throw new Error(`Could not parse table from URL: ${url}`);
  return match[1];
}

function makeFakeFetch(opts: FakeFetchOptions) {
  const calls: RecordedCall[] = [];
  let scanCallIndex = 0;
  let scoringDeleted = false;
  const scanPages = opts.scanPages ?? [{ cursor: "0", keys: [] }];

  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    calls.push({ url, method, body: init?.body });

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
      if (!opts.redisDeleteFails) opts.redisKeys?.delete(decodeURIComponent(url.slice(`${REDIS_URL}/DEL/`.length)));
      return {
        ok: !opts.redisDeleteFails,
        status: opts.redisDeleteFails ? 500 : 200,
        json: async () => ({ result: 1 }),
        text: async () => "",
      } as unknown as Response;
    }

    if (url === `${SUPA_URL}/rest/v1/rpc/scoring_v7_delete_user_with_receipts` && method === "POST") {
      scoringDeleted = !opts.scoringRpcFails && !opts.scoringRpcLeavesRows;
      return {
        ok: !opts.scoringRpcFails, status: opts.scoringRpcFails ? 500 : 204,
        text: async () => opts.scoringRpcFails ? "simulated RPC failure" : "",
        json: async () => opts.receiptIds ?? [],
      } as Response;
    }

    if (new URL(url).origin === SUPA_URL) {
      const table = tableFromUrl(url);
      if (method === "HEAD") {
        const count = scoringDeleted && SUPABASE_TABLES.some(row => row.table === table && row.deletion === "scoring_v7_rpc") ? 0 : opts.supaCounts?.[table] ?? 0;
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
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("dry-run issues zero DELETE/DEL calls even when rows and keys exist", async () => {
    const { fetchMock, calls } = makeFakeFetch({
      supaCounts: { users: 5, metrics_snapshots: 2 },
      scanPages: [{ cursor: "0", keys: ["stats:v2:merged:octocat"] }],
    });
    vi.stubGlobal("fetch", fetchMock);

    await run(["octocat"]);

    expect(calls.some((c) => c.method === "DELETE" || c.method === "POST")).toBe(false);
    expect(calls.filter((c) => c.method === "HEAD").map((c) => {
      const url = new URL(c.url);
      return `${tableFromUrl(c.url)}.${[...url.searchParams.keys()][0]}`;
    }).sort()).toEqual(SUPABASE_TABLES.map(({ table, column }) => `${table}.${column}`).sort());
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

  it("deletes v7 atomically once before legacy deletes, never table by table", async () => {
    const { fetchMock, calls } = makeFakeFetch({
      receiptIds: ["11111111-1111-4111-8111-111111111111"],
      supaCounts: Object.fromEntries(SUPABASE_TABLES.map(({ table }) => [table, 1])),
      scanPages: [{ cursor: "0", keys: ["stats:v2:merged:octocat"] }],
    });
    vi.stubGlobal("fetch", fetchMock);
    await run(["OctoCat", "--delete"]);
    const rpcCalls = calls.filter((c) => c.method === "POST");
    expect(rpcCalls).toEqual([{ url: `${SUPA_URL}/rest/v1/rpc/scoring_v7_delete_user_with_receipts`, method: "POST", body: JSON.stringify({ p_handle: "octocat" }) }]);
    expect(calls[0]).toEqual(rpcCalls[0]);
    expect(calls.filter((c) => c.method === "DELETE").every((c) => !c.url.includes("/scoring_v7_"))).toBe(true);
    expect(calls.some((c) => c.method === "DELETE" && c.url.includes("/users?"))).toBe(true);
    expect(calls.some((c) => c.url.includes(`${REDIS_URL}/DEL/`))).toBe(true);
  });

  it("aborts before any later deletion if atomic v7 cleanup fails", async () => {
    const { fetchMock, calls } = makeFakeFetch({ scoringRpcFails: true, supaCounts: { users: 1 } });
    vi.stubGlobal("fetch", fetchMock);
    await expect(run(["octocat", "--delete"])).rejects.toThrow(/scoring_v7_delete_user: 500/);
    expect(calls).toEqual([{ url: `${SUPA_URL}/rest/v1/rpc/scoring_v7_delete_user_with_receipts`, method: "POST", body: JSON.stringify({ p_handle: "octocat" }) }]);
  });

  it("does not report success or bypass the RPC if v7 rows remain", async () => {
    const { fetchMock, calls } = makeFakeFetch({ scoringRpcLeavesRows: true, supaCounts: { scoring_v7_assessments: 1 } });
    vi.stubGlobal("fetch", fetchMock);
    await expect(run(["octocat", "--delete"])).rejects.toThrow(/left rows in scoring_v7_assessments.owner_handle/);
    expect(calls.some((c) => c.method === "DELETE" && c.url.includes("/scoring_v7_"))).toBe(false);
    expect(calls.some((c) => c.url.includes(`${REDIS_URL}/DEL/`))).toBe(false);
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

// ---------------------------------------------------------------------------
// Migration scanner (#1240)
//
// `SUPABASE_TABLES` is a hand-maintained list, and a migration that adds a new
// per-user table has no reason to remind anyone to update it. `studio_configs`
// (migration 027) and `merge_operations` (007) were both missed that way, so a
// "complete" deletion silently left rows behind and the script's own verify
// pass reported success because it only re-checks the tables it knows about.
//
// Reading the migrations makes the next omission a test failure instead. The
// output of this scanner was cross-checked against the production
// `information_schema` on 2026-08-31 and matched exactly: 9 base tables, the
// same handle columns, both views excluded.
// ---------------------------------------------------------------------------

const MIGRATIONS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "supabase",
  "migrations",
);

const CONSTRAINT_START = /^(constraint|primary|unique|foreign|check|exclude|like)\b/i;

/** Every base table in the migrations, mapped to its column names. */
function scanMigrations(): { tables: Map<string, Set<string>>; views: Set<string> } {
  const tables = new Map<string, Set<string>>();
  const views = new Set<string>();

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");

    for (const m of sql.matchAll(
      /create\s+(?:or\s+replace\s+)?view\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z0-9_]+)/gi,
    )) {
      views.add(m[1].toLowerCase());
    }

    for (const m of sql.matchAll(
      /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z0-9_]+)\s*\(([\s\S]*?)\n\);/gi,
    )) {
      const table = m[1].toLowerCase();
      const columns = tables.get(table) ?? new Set<string>();
      // Only lines at paren-depth zero are column definitions; a multi-line
      // CHECK or a composite constraint must not contribute a "column".
      let depth = 0;
      for (const raw of m[2].split("\n")) {
        const line = raw.trim();
        const atTopLevel = depth === 0;
        depth +=
          (line.match(/\(/g) ?? []).length - (line.match(/\)/g) ?? []).length;
        if (!line || line.startsWith("--") || !atTopLevel) continue;
        if (CONSTRAINT_START.test(line)) continue;
        const name = /^([a-z0-9_]+)/i.exec(line)?.[1];
        if (name) columns.add(name.toLowerCase());
      }
      tables.set(table, columns);
    }

    for (const m of sql.matchAll(
      /alter\s+table\s+(?:if\s+exists\s+)?(?:public\.)?([a-z0-9_]+)([\s\S]*?);/gi,
    )) {
      const table = m[1].toLowerCase();
      const columns = tables.get(table) ?? new Set<string>();
      for (const add of m[2].matchAll(
        /add\s+column\s+(?:if\s+not\s+exists\s+)?([a-z0-9_]+)/gi,
      )) {
        columns.add(add[1].toLowerCase());
      }
      for (const drop of m[2].matchAll(
        /drop\s+column\s+(?:if\s+exists\s+)?([a-z0-9_]+)/gi,
      )) {
        columns.delete(drop[1].toLowerCase());
      }
      if (columns.size > 0) tables.set(table, columns);
    }
  }

  return { tables, views };
}

/** Every `table.column` in the schema that identifies a user by handle. */
function handleColumnsInSchema(): string[] {
  const { tables, views } = scanMigrations();
  const found: string[] = [];
  for (const [table, columns] of tables) {
    if (views.has(table)) continue;
    for (const column of columns) {
      if (column.includes("handle")) found.push(`${table}.${column}`);
    }
  }
  return found.sort();
}

describe("SUPABASE_TABLES", () => {
  it("covers every per-user table with the correct handle column", () => {
    const covered = SUPABASE_TABLES.map((t) => `${t.table}.${t.column}`).sort();

    expect(covered).toEqual([
      "campaign_sends.handle",
      "merge_operations.source_handle",
      "merge_operations.target_handle",
      "metrics_snapshots.handle",
      "report_craft_reports.owner_handle",
      "report_craft_selection.owner_handle",
      "scoring_observed_current.owner_handle",
      "scoring_v7_assessments.evaluator_handle",
      "scoring_v7_assessments.owner_handle",
      "scoring_v7_evidence.owner_handle",
      "scoring_v7_evidence_references.owner_handle",
      "scoring_v7_raw_artifacts.owner_handle",
      "scoring_v7_receipts.owner_handle",
      "scoring_v7_reviewer_grants.owner_handle",
      "scoring_v7_reviewer_grants.reviewer_handle",
      "scoring_v7_source_observations.owner_handle",
      "scoring_v7_sources.owner_handle",
      "scoring_v7_subjects.owner_handle",
      "scoring_v7_trend_anchors.owner_handle",
      "studio_configs.handle",
      "supplemental_stats.source_handle",
      "supplemental_stats.target_handle",
      "tool_insights.handle",
      "user_platforms.handle",
      "users.handle",
      "verification_records.handle",
    ]);
  });

  it("#1240: leaves no handle-bearing column in the migrations uncovered", () => {
    const covered = new Set(
      SUPABASE_TABLES.map((t) => `${t.table}.${t.column}`),
    );
    const missing = handleColumnsInSchema().filter((c) => !covered.has(c));

    expect(missing).toEqual([]);
  });

  it("#1240: names no table or column the migrations do not define", () => {
    const inSchema = new Set(handleColumnsInSchema());
    const stale = SUPABASE_TABLES.map((t) => `${t.table}.${t.column}`).filter(
      (c) => !inSchema.has(c),
    );

    expect(stale).toEqual([]);
  });

  it("#1240: the scanner actually finds the schema (guards against a silent no-op)", () => {
    // A scanner that parsed nothing would make the coverage test vacuously
    // pass, which is the failure mode that matters most here.
    expect(handleColumnsInSchema().length).toBeGreaterThanOrEqual(11);
  });
});

describe("exact Redis deletion ownership", () => {
  it("distinguishes matching handles from substrings and other owners' repository names", () => {
    expect(classifyRedisOwnership("stats:v2:merged:ann", "ann")).toBe("owned");
    expect(classifyRedisOwnership("stats:v2:merged:joann", "ann")).toBe("foreign");
    expect(classifyRedisOwnership("badge:v2:joann:ann:2026-09-05:en", "ann")).toBe("foreign");
    expect(classifyRedisOwnership("repo:joann:ann", "ann")).toBe("unresolved");
    expect(classifyRedisOwnership("supplemental:v7:ann", "ann")).toBe("owned");
  });
  it("removes captured revision keys and refuses unrelated or unresolved matches", async () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const { fetchMock, calls } = makeFakeFetch({ receiptIds: [id], scanPages: [{ cursor: "0", keys: ["stats:v2:merged:ann", "stats:v2:merged:joann", "repo:joann:ann-private"] }] });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "log").mockImplementation(() => {});
    await expect(run(["ann", "--delete"])).rejects.toThrow("Deletion incomplete: 1 unresolved");
    const deleted = calls.filter(call => call.url.startsWith(`${REDIS_URL}/DEL/`)).map(call => decodeURIComponent(call.url));
    expect(deleted).toEqual([`${REDIS_URL}/DEL/stats:v2:merged:ann`, `${REDIS_URL}/DEL/snapshot:v7:receipt:${id}`, `${REDIS_URL}/DEL/snapshot:v7.2:receipt:${id}`]);
    expect(JSON.stringify(vi.mocked(console.log).mock.calls)).not.toContain("ann-private");
  });
  it("does not claim completion after cache transport failure", async () => {
    const { fetchMock } = makeFakeFetch({ redisDeleteFails: true, scanPages: [{ cursor: "0", keys: ["stats:v2:merged:ann"] }] });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "log").mockImplementation(() => {});
    await expect(run(["ann", "--delete"])).rejects.toThrow("1 failed cache removal");
  });
});

it("recognizes only exact supported-provider negative cache ownership", () => {
  for (const provider of ["github", "gitlab", "bitbucket", "codeberg"]) {
    expect(classifyRedisOwnership(`stats:v2:${provider}:ann:neg`, "ann")).toBe("owned");
    expect(classifyRedisOwnership(`stats:v2:${provider}:joann:neg`, "ann")).toBe("foreign");
  }
  for (const key of ["stats:v2:merged:ann:neg", "stats:v2:unknown:ann:neg", "stats:v2:github:ann:no", "stats:v2:github:ann:neg:extra"]) {
    expect(classifyRedisOwnership(key, "ann")).toBe("unresolved");
  }
});

it("reports pending on administrative retry while the first failed receipt cache key remains", async () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const retained = new Set([`snapshot:v7:receipt:${id}`]);
  const first = makeFakeFetch({ receiptIds: [id], redisDeleteFails: true, redisKeys: retained });
  vi.stubGlobal("fetch", first.fetchMock);
  vi.spyOn(console, "log").mockImplementation(() => {});
  await expect(run(["ann", "--delete"])).rejects.toThrow("2 failed cache removal");
  const retry = makeFakeFetch({ receiptIds: [], redisKeys: retained });
  vi.stubGlobal("fetch", retry.fetchMock);
  await expect(run(["ann", "--delete"])).rejects.toThrow("receipt cache cleanup pending");
  expect(retained.size).toBe(1);
  expect(retry.calls.some(call => call.url.includes("/DEL/"))).toBe(false);
});

it("classifies only known policy-scoped image and lock namespaces", () => {
  for (const namespace of ["badge:v2", "badge-lock:v2", "og-image:v5"]) for (const policy of ["v6", "v7.2"]) {
    expect(classifyRedisOwnership(`${namespace}:ann:ice-terminal-v2:${policy}:2026-09-08:en`, "ann")).toBe("owned");
    expect(classifyRedisOwnership(`${namespace}:joann:ann:${policy}:2026-09-08:es`, "ann")).toBe("foreign");
  }
  for (const suffix of ["v7.3:2026-09-08:en", "v7.2:private:en", "v7.2:2026-09-08:fr", "v7.2:2026-09-08:en:extra"]) {
    expect(classifyRedisOwnership(`badge:v2:ann:ice-terminal-v2:${suffix}`, "ann")).toBe("unresolved");
  }
});
