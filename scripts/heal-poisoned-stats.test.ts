import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { inspectRecord, healHandle, normalizeHandle, parseArgs, run, type Config } from "./heal-poisoned-stats";
import { loadConfig } from "./lib/env";

vi.mock("./lib/env", () => ({ loadConfig: vi.fn() }));
const cfg: Config = { redisUrl: "https://redis.example", redisToken: "test", supaUrl: "https://db.example", supaKey: "test" };
const quiet = { handle: "alice", prsMergedCount: 0, commitsTotal: 15000, issuesClosedCount: 5000, linesAdded: 0, linesDeleted: 0 };
const location = { kind: "merged_cache" as const, owner: "alice", recordId: "stats:v2:merged:alice" };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("read-only historical inspection", () => {
  it.each([["--apply", "alice"], ["alice", "--apply"], ["--apply"]])("rejects mutation before configuration or I/O: %j", async (...args) => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    await expect(run(args)).rejects.toThrow(/retired|read.only/i);
    expect(loadConfig).not.toHaveBeenCalled(); expect(fetchMock).not.toHaveBeenCalled();
  });
  it("normalizes every handle before configuration, rejects unknown options and unsafe handles", async () => {
    expect(parseArgs([" Alice ", "BOB", "alice"])).toEqual({ handles: ["alice", "bob"] });
    expect(() => parseArgs([])).toThrow(/handle/i);
    expect(() => parseArgs(["alice", "--force"])).toThrow(/option/i);
    await expect(run(["alice", "bad*"])).rejects.toThrow(/handle/i);
    expect(loadConfig).not.toHaveBeenCalled();
    expect(normalizeHandle(" ALICE ")).toBe("alice");
  });
  it("rejects programmatic legacy apply before any request", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    await expect(healHandle(cfg, "alice", true)).rejects.toThrow(/retired|read.only/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([
    quiet, { ...quiet, prsMergedCount: 140, prsMergedWeight: 3.38, linesAdded: 59, linesDeleted: 10 },
    { ...quiet, commitsTotal: 0, issuesClosedCount: 0 },
    { ...quiet, fetchedAt: "2026-01-01", uploadedAt: "2026-09-05", hasSupplementalData: false },
    { ...quiet, corruptionReason: "scope_blinded", contentDigest: "a".repeat(64) },
  ])("does not infer corruption from activity, upload age, reason strings or supplied digests", value => {
    expect(inspectRecord(location, JSON.stringify(value))).toMatchObject({ status: "unproven", reasons: [] });
  });
  it("binds a subject mismatch to the exact requested storage identity and observed bytes", () => {
    const raw = JSON.stringify({ ...quiet, handle: "bob" });
    const finding = inspectRecord(location, raw);
    expect(finding).toMatchObject({ ...location, status: "recorded_contradiction", reasons: ["subject_mismatch"] });
    expect(finding.contentSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(inspectRecord(location, raw + " ").contentSha256).not.toBe(finding.contentSha256);
    expect(inspectRecord({ ...location, owner: "bob", recordId: "stats:v2:merged:bob" }, raw).status).toBe("unproven");
    expect(JSON.stringify(finding)).not.toContain('"prsMergedCount"');
  });
  it("treats missing ownership evidence as unproven, malformed records as uninterpretable and absent records as missing", () => {
    expect(inspectRecord(location, JSON.stringify({ prsMergedCount: 0 })).status).toBe("unproven");
    expect(inspectRecord(location, "{private invalid JSON").status).toBe("uninterpretable");
    expect(inspectRecord(location, "[]").status).toBe("uninterpretable");
    expect(inspectRecord(location, null).status).toBe("missing");
    expect(inspectRecord(location, JSON.stringify({ handle: "ALICE" })).status).toBe("unproven");
  });
  it("reads full identified rows and only GETs; bounded row reads disclose incomplete enumeration", async () => {
    const row = { id: 7, handle: "alice", date: "2026-09-05", commits_total: 15000, prs_merged_count: 0, privateField: "private-value" };
    const fetchMock = vi.fn(async (input: string) => input.includes("metrics_snapshots")
      ? new Response(JSON.stringify([row]), { headers: { "content-range": "0-0/2" } })
      : response({ result: JSON.stringify(quiet) }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await healHandle(cfg, "alice");
    expect(result.mode).toBe("dry_run"); expect(result.snapshotEnumeration).toBe("partial");
    expect(result.records).toHaveLength(3);
    expect(result.records[2]).toMatchObject({ kind: "metrics_snapshot", owner: "alice", recordId: "7", status: "unproven" });
    expect(JSON.stringify(result)).not.toContain("private-value");
    for (const [input, init] of fetchMock.mock.calls as unknown as [string, RequestInit][]) {
      expect(init.method ?? "GET").toBe("GET"); expect(input).not.toContain("/DEL/");
    }
    const url = fetchMock.mock.calls.find(([input]) => input.includes("metrics_snapshots"))![0];
    expect(url).toContain("select=*"); expect(url).toContain("handle=eq.alice");
  });
  it("never emits upstream bodies or request errors", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response({ message: "https://private.example/secret" }, 500)));
    await expect(healHandle(cfg, "alice")).rejects.toThrow("Historical inspection read failed");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("private-token"); }));
    await expect(healHandle(cfg, "alice")).rejects.toThrow("Historical inspection read failed");
  });
  it("prints counts and limitations without record contents, digests or false clean/repair claims", async () => {
    vi.mocked(loadConfig).mockReturnValue(cfg);
    vi.stubGlobal("fetch", vi.fn(async (input: string) => input.includes("metrics_snapshots")
      ? new Response("[]", { headers: { "content-range": "*/0" } }) : response({ result: JSON.stringify({ ...quiet, privateURL: "https://private.example" }) })));
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await run(["alice"]);
    const output = log.mock.calls.flat().join(" ");
    expect(output).toMatch(/unproven/i); expect(output).toMatch(/no.*(deleted|changed)/i);
    expect(output).not.toMatch(/https:\/\/private|[a-f0-9]{64}|nothing to heal|re-run with --apply|sees everything/i);
  });
  it.each([
    ["0-0/1", "complete"], ["0-0/2", "partial"], ["garbage", "partial"],
    ["0-4/5", "partial"], [null, "partial"],
  ])("reports snapshot enumeration honestly for range %s", async (range, expected) => {
    vi.stubGlobal("fetch", vi.fn(async (input: string) => input.includes("metrics_snapshots")
      ? new Response(JSON.stringify([{ id: 1, handle: "alice" }]), { headers: range ? { "content-range": range } : {} })
      : response({ result: null })));
    expect((await healHandle(cfg, "alice")).snapshotEnumeration).toBe(expected);
  });
  it.each([[{ id: 0 }], [{ id: Number.MAX_SAFE_INTEGER + 1 }], [{ id: "1" }], Array.from({ length: 1001 }, (_, id) => ({ id: id + 1 }))])("rejects snapshots without safe exact identity or exceeding the bound", async (...rows) => {
    vi.stubGlobal("fetch", vi.fn(async (input: string) => input.includes("metrics_snapshots") ? response(rows) : response({ result: null })));
    await expect(healHandle(cfg, "alice")).rejects.toThrow("Historical inspection read failed");
  });
  it.each([{ error: "private failure", result: null }, {}, { result: {} }])("rejects malformed Redis envelopes without leaking them", async body => {
    vi.stubGlobal("fetch", vi.fn(async () => response(body)));
    await expect(healHandle(cfg, "alice")).rejects.toThrow("Historical inspection read failed");
  });
  it("binds a mismatching snapshot subject to its exact row ID and contents", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string) => input.includes("metrics_snapshots")
      ? response([{ id: 42, handle: "bob", date: "2026-09-05", privateURL: "private-sentinel" }])
      : response({ result: null })));
    const record = (await healHandle(cfg, "alice")).records[2]!;
    expect(record).toMatchObject({ recordId: "42", owner: "alice", status: "recorded_contradiction", reasons: ["subject_mismatch"] });
    expect(record.contentSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(record)).not.toContain("private-sentinel");
  });

});
