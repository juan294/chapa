import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { getSupabaseUrl } from "@/lib/env";
import { inspectLocalSql } from "./local-sql";

vi.mock("node:child_process", () => ({ execFileSync: vi.fn() }));
vi.mock("node:fs", () => ({ readFileSync: vi.fn() }));
vi.mock("@/lib/env", () => ({ getSupabaseUrl: vi.fn() }));

beforeEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv("CONTRACT_SUPABASE_CONFIG", undefined);
  vi.mocked(getSupabaseUrl).mockReturnValue("http://127.0.0.1:54331");
  vi.mocked(readFileSync).mockReturnValue('project_id = "chapa"\n[api]\nport = 54331\n');
  vi.mocked(execFileSync).mockReturnValueOnce("supabase_db_chapa\n").mockReturnValue("claim|f|f|t\n");
});

afterEach(() => vi.unstubAllEnvs());

describe("local SQL inspection safety", () => {
  it.each(["http://127.0.0.1:54331", "http://localhost:54331", "http://[::1]:54331"])("inspects the exact configured container for %s", url => {
    vi.mocked(getSupabaseUrl).mockReturnValue(url);
    expect(inspectLocalSql("SELECT 1")).toBe("claim|f|f|t");
    expect(readFileSync).toHaveBeenCalledExactlyOnceWith("supabase/config.toml", "utf8");
    expect(execFileSync).toHaveBeenNthCalledWith(1, "docker", ["ps", "--filter", "name=^/supabase_db_chapa$", "--format", "{{.Names}}"], { encoding: "utf8" });
    expect(execFileSync).toHaveBeenNthCalledWith(2, "docker", ["exec", "supabase_db_chapa", "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-At", "-c", "SELECT 1"], { encoding: "utf8" });
  });

  it.each([undefined, "", "https://hosted.supabase.co", "http://localhost.evil.test", "http://10.0.0.1", "file:///tmp/db", "not-a-url", "http://user:password@localhost:54331"])("rejects unsafe endpoint %s before filesystem or SQL access", url => {
    vi.mocked(getSupabaseUrl).mockReturnValue(url);
    expect(() => inspectLocalSql("SELECT 1")).toThrow(/loopback/);
    expect(readFileSync).not.toHaveBeenCalled();
    expect(execFileSync).not.toHaveBeenCalled();
  });

  it.each(['', 'project_id = "../chapa"', 'project_id = "chapa;echo"', 'project_id = ""', 'project_id = "chapa"\nproject_id = "other"', '[api]\nproject_id = "chapa"'])("rejects missing, invalid or ambiguous project config %s before docker access", config => {
    vi.mocked(readFileSync).mockReturnValue(config);
    expect(() => inspectLocalSql("SELECT 1")).toThrow(/project identity/);
    expect(execFileSync).not.toHaveBeenCalled();
  });

  it.each(["", "supabase_db_other\n", "supabase_db_chapa\nsupabase_db_chapa\n", "supabase_db_chapa\nsupabase_db_chapa_copy\n"])("rejects missing or ambiguous container output %s before SQL execution", output => {
    vi.mocked(execFileSync).mockReset().mockReturnValue(output);
    expect(() => inspectLocalSql("SELECT 1")).toThrow(/exactly one/);
    expect(execFileSync).toHaveBeenCalledTimes(1);
  });

  it.each(['project_id = "chapa"', 'project_id = "chapa"\n[api]\nport = 54321', 'project_id = "chapa"\n[api]\nport = 54331\nport = 54321'])("rejects an unbound or ambiguous API port before docker access", config => {
    vi.mocked(readFileSync).mockReturnValue(config);
    expect(() => inspectLocalSql("SELECT 1")).toThrow(/API port/);
    expect(execFileSync).not.toHaveBeenCalled();
  });
});

describe("explicit disposable config selection", () => {
  it("binds overridden config, API and exact container without reading default config", () => {
    vi.stubEnv("CONTRACT_SUPABASE_CONFIG", "/repo/logs/qualification/supabase/config.toml");
    vi.mocked(getSupabaseUrl).mockReturnValue("http://127.0.0.1:55331");
    vi.mocked(readFileSync).mockReturnValue('project_id = "chapa-v7-qualification"\n[api]\nport = 55331\n');
    vi.mocked(execFileSync).mockReset().mockReturnValueOnce("supabase_db_chapa-v7-qualification\n").mockReturnValue("1\n");
    expect(inspectLocalSql("SELECT 1")).toBe("1");
    expect(readFileSync).toHaveBeenCalledExactlyOnceWith("/repo/logs/qualification/supabase/config.toml", "utf8");
    expect(execFileSync).toHaveBeenNthCalledWith(2, "docker", ["exec", "supabase_db_chapa-v7-qualification", "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-At", "-c", "SELECT 1"], { encoding: "utf8" });
  });
  it.each(["", "relative/config.toml", "/repo/.env.local", "/repo/unsafe.json"])("rejects invalid explicit config path %s without fallback or filesystem access", path => {
    vi.stubEnv("CONTRACT_SUPABASE_CONFIG", path);
    expect(() => inspectLocalSql("SELECT 1")).toThrow(/config path/);
    expect(readFileSync).not.toHaveBeenCalled();
    expect(execFileSync).not.toHaveBeenCalled();
  });
  it("rejects the old project's config when HTTP uses the disposable project", () => {
    vi.stubEnv("CONTRACT_SUPABASE_CONFIG", "/repo/supabase/config.toml");
    vi.mocked(getSupabaseUrl).mockReturnValue("http://127.0.0.1:55331");
    expect(() => inspectLocalSql("SELECT 1")).toThrow(/API port/);
    expect(execFileSync).not.toHaveBeenCalled();
  });
});
