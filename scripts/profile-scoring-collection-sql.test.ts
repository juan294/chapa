import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkpointBatchSetup, configValue, object, parseArgs, parseMetadata,
  payloadSetup, sqlLiteral, string } from "./profile-scoring-collection-sql";

const directories: string[] = [];
afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });

const window = { referenceTime: "2026-09-26T12:00:00.000Z", startInclusive: "2025-09-27T00:00:00.000Z", endExclusive: "2026-09-27T00:00:00.000Z" };
const source = { provider: "github", host: "github.com", subjectId: "synthetic-subject-294" };
function validMetadata() {
  return { accessContextId: "a".repeat(64), count: 100, coverage: { source, window },
    jobId: "df712fee-d856-4d22-9bbb-618aa9160e57", owner: "contract-volume-100",
    requested: { provider: "github", host: "github.com", login: "contract-volume-100" },
    scope: { discovery: "owned_and_contributed" }, seed: 294, source, window };
}
function metadataFile(value: unknown): string {
  const directory = mkdtempSync(join(tmpdir(), "chapa-sql-profile-test-"));
  directories.push(directory);
  const path = join(directory, "metadata.json");
  writeFileSync(path, JSON.stringify(value));
  return path;
}

describe("SQL profiler safety guards", () => {
  it("accepts only absolute metadata paths and task evidence output", () => {
    const metadata = resolve("/tmp/profile.json");
    const output = resolve("docs/plans/2026-09-26-high-volume-badge-collection-phases/evidence/phase-1/test-profile.json");
    expect(parseArgs(["--help"])).toBeNull();
    expect(parseArgs(["-h"])).toBeNull();
    expect(parseArgs(["--metadata", metadata])).toEqual({ metadataPath: metadata, outputPath: null });
    expect(parseArgs(["--metadata", metadata, "--output", output])).toEqual({ metadataPath: metadata, outputPath: output });
    for (const args of [[], ["--metadata"], ["--metadata", "relative.json"], ["--bad", metadata],
      ["--metadata", metadata, "--bad", output], ["--metadata", metadata, "--output", "relative.json"]]) {
      expect(() => parseArgs(args)).toThrow();
    }
    expect(() => parseArgs(["--metadata", metadata, "--output", "/tmp/profile.json"])).toThrow("Profile output must");
    expect(() => parseArgs(["--metadata", metadata, "--output", output.replace(/\.json$/, ".txt")])).toThrow("Profile output must");
  });

  it("accepts synthetic benchmark metadata and rejects changed identity or shape", () => {
    const valid = validMetadata();
    expect(parseMetadata(metadataFile(valid))).toEqual(valid);
    const mutations: [string, (value: ReturnType<typeof validMetadata>) => void][] = [
      ["keys", value => { (value as Record<string, unknown>).extra = true; }],
      ["count", value => { value.count = 100_001; }],
      ["seed", value => { value.seed = -1; }],
      ["owner", value => { value.owner = "actual-user"; }],
      ["job", value => { value.jobId = "bad"; }],
      ["access", value => { value.accessContextId = "x".repeat(64); }],
      ["source", value => { value.source = { ...value.source, subjectId: "" }; }],
      ["requested", value => { value.requested = { ...value.requested, login: "different" }; }],
      ["window", value => { value.window = { ...value.window, referenceTime: "" }; }],
      ["coverage", value => { value.coverage = { ...value.coverage, source: { ...source, host: "other" } }; }],
    ];
    for (const [, mutate] of mutations) {
      const value = validMetadata();
      mutate(value);
      expect(() => parseMetadata(metadataFile(value))).toThrow();
    }
    expect(() => parseMetadata(metadataFile([]))).toThrow("metadata must be a JSON object");
  });

  it("quotes SQL values and builds bounded read-only profile inputs", () => {
    expect(object({ ok: true }, "row")).toEqual({ ok: true });
    expect(() => object([], "row")).toThrow();
    expect(string("value", "field")).toBe("value");
    expect(() => string("", "field")).toThrow();
    expect(configValue("[api]\nport = 55431\n[db]\nport = 55432", "db", "port")).toBe("55432");
    expect(configValue("[api]\nport = 55431", "db", "port")).toBeNull();
    expect(sqlLiteral("O'Brien")).toBe("'O''Brien'");
    expect(sqlLiteral({ count: 1 })).toBe("'{\"count\":1}'");
    expect(payloadSetup("O'Brien")).toContain("job_id='O''Brien'::uuid");
    expect(checkpointBatchSetup("O'Brien", 1000)).toContain("LIMIT 1000");
  });
});
