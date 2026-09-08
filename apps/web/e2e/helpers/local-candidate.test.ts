import { describe, expect, it } from "vitest";
import { localCandidateTarget, assertLocalCandidateRuntime } from "./local-candidate";

describe("local candidate target and runtime admission", () => {
  it.each(["http://localhost:3001", "http://127.0.0.1:3001", "http://[::1]:3001"])("accepts exact loopback origin %s", url => {
    expect(localCandidateTarget("local", "local-candidate", url)).toBe(true);
  });
  it.each(["https://example.com", "http://127.0.0.1.example.com", "http://127.1:3001", "http://2130706433:3001", "http://localhost@evil.test", "http://localhost:3001/path", "http://localhost:3001?token=x", "http://localhost:3001#x", "http://user:pass@localhost:3001", "file:///tmp/app"])("rejects unsafe or non-origin target %s", url => {
    expect(() => localCandidateTarget("local", "local-candidate", url)).toThrow(/loopback/);
  });
  it("keeps ordinary development outside qualification", () => {
    expect(localCandidateTarget(undefined, undefined, "http://localhost:3001")).toBe(false);
  });
  it("rejects a protection secret in local mode", () => {
    expect(() => localCandidateTarget("local", "local-candidate", "http://localhost:3001", "secret")).toThrow(/secret/i);
  });
  it("requires a production runtime without invented Vercel identity", () => {
    expect(() => assertLocalCandidateRuntime({ runtimeMode: "production", commitSha: null, environment: null })).not.toThrow();
    for (const body of [{ runtimeMode: "development", commitSha: null, environment: null }, { runtimeMode: "production", commitSha: "a".repeat(40), environment: "preview" }]) expect(() => assertLocalCandidateRuntime(body)).toThrow(/runtime|identity/i);
  });
});
