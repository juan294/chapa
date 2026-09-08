import { beforeEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { getSupabaseUrl } from "@/lib/env";
import { inspectLocalSql } from "./local-sql";

vi.mock("node:child_process", () => ({ execFileSync: vi.fn() }));
vi.mock("node:fs", () => ({ readFileSync: vi.fn() }));
vi.mock("@/lib/env", () => ({ getSupabaseUrl: vi.fn() }));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getSupabaseUrl).mockReturnValue("http://127.0.0.1:54331");
  vi.mocked(readFileSync).mockReturnValue('project_id = "chapa"\n[api]\nport = 54331\n');
  vi.mocked(execFileSync).mockReturnValueOnce("supabase_db_chapa\n").mockReturnValue("claim|f|f|t\n");
});

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
