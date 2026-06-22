import { describe, it, expect } from "vitest";
import {
  parseArgs,
  normalizeHandle,
  redisScanPattern,
  SUPABASE_TABLES,
} from "./delete-user";

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
