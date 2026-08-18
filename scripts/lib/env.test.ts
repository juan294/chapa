import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadEnvLocal, loadConfig } from "./env";

const REQUIRED_KEYS = [
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

let originalEnv: Record<string, string | undefined>;
let originalCwd: string;
let tmpDir: string;

beforeEach(() => {
  originalEnv = {};
  for (const key of REQUIRED_KEYS) {
    originalEnv[key] = process.env[key];
    delete process.env[key];
  }
  originalCwd = process.cwd();
  tmpDir = mkdtempSync(join(tmpdir(), "chapa-env-test-"));
  vi.spyOn(process, "cwd").mockReturnValue(tmpDir);
});

afterEach(() => {
  for (const key of REQUIRED_KEYS) {
    if (originalEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalEnv[key];
    }
  }
  vi.restoreAllMocks();
  rmSync(tmpDir, { recursive: true, force: true });
});

function writeEnvLocal(contents: string): void {
  writeFileSync(join(tmpDir, ".env.local"), contents, "utf8");
}

describe("loadEnvLocal", () => {
  it("fills unset env vars from .env.local at cwd", () => {
    writeEnvLocal("UPSTASH_REDIS_REST_URL=https://from-file.example\n");
    loadEnvLocal();
    expect(process.env.UPSTASH_REDIS_REST_URL).toBe("https://from-file.example");
  });

  it("never overrides an already-exported env var (env takes precedence over .env.local)", () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://from-real-env.example";
    writeEnvLocal("UPSTASH_REDIS_REST_URL=https://from-file.example\n");
    loadEnvLocal();
    expect(process.env.UPSTASH_REDIS_REST_URL).toBe("https://from-real-env.example");
  });

  it("strips surrounding quotes from .env.local values", () => {
    writeEnvLocal('SUPABASE_URL="https://quoted.example"\n');
    loadEnvLocal();
    expect(process.env.SUPABASE_URL).toBe("https://quoted.example");
  });

  it("does not throw when .env.local is missing (relies on already-exported vars)", () => {
    expect(() => loadEnvLocal()).not.toThrow();
  });
});

describe("loadConfig", () => {
  it("returns a trimmed config when all required vars are present", () => {
    process.env.UPSTASH_REDIS_REST_URL = "  https://redis.example  ";
    process.env.UPSTASH_REDIS_REST_TOKEN = "  redis-token  ";
    process.env.SUPABASE_URL = "  https://supa.example  ";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "  supa-key  ";

    expect(loadConfig()).toEqual({
      redisUrl: "https://redis.example",
      redisToken: "redis-token",
      supaUrl: "https://supa.example",
      supaKey: "supa-key",
    });
  });

  it("prefers already-exported env vars over .env.local (override precedence)", () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://real-env.example";
    process.env.UPSTASH_REDIS_REST_TOKEN = "real-token";
    process.env.SUPABASE_URL = "https://real-supa.example";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "real-key";
    writeEnvLocal(
      [
        "UPSTASH_REDIS_REST_URL=https://file.example",
        "UPSTASH_REDIS_REST_TOKEN=file-token",
        "SUPABASE_URL=https://file-supa.example",
        "SUPABASE_SERVICE_ROLE_KEY=file-key",
      ].join("\n"),
    );

    expect(loadConfig()).toEqual({
      redisUrl: "https://real-env.example",
      redisToken: "real-token",
      supaUrl: "https://real-supa.example",
      supaKey: "real-key",
    });
  });

  it("falls back to .env.local when a var is not already exported", () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://real-env.example";
    process.env.UPSTASH_REDIS_REST_TOKEN = "real-token";
    writeEnvLocal(
      [
        "SUPABASE_URL=https://file-supa.example",
        "SUPABASE_SERVICE_ROLE_KEY=file-key",
      ].join("\n"),
    );

    expect(loadConfig()).toEqual({
      redisUrl: "https://real-env.example",
      redisToken: "real-token",
      supaUrl: "https://file-supa.example",
      supaKey: "file-key",
    });
  });

  it("throws when Redis vars are missing", () => {
    process.env.SUPABASE_URL = "https://supa.example";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "supa-key";
    expect(() => loadConfig()).toThrow(/UPSTASH_REDIS_REST_URL/);
  });

  it("throws when Supabase vars are missing", () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.example";
    process.env.UPSTASH_REDIS_REST_TOKEN = "redis-token";
    expect(() => loadConfig()).toThrow(/SUPABASE_URL/);
  });
});
