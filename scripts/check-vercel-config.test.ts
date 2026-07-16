import { describe, it, expect } from "vitest";
import {
  VERCEL_ROOT_DIRECTORY,
  checkVercelConfig,
  type VercelConfigProblem,
} from "./check-vercel-config";

/**
 * #1052 — `vercel.json` lived at the repo root while the Vercel project's
 * Root Directory is `apps/web`. Vercel resolves `vercel.json` relative to the
 * Root Directory, so the file was never read: no crons were ever registered
 * and the `functions` block (including #942's documented `maxDuration: 300`)
 * was silently ignored, for the entire life of the project.
 *
 * Nothing failed. There is no error for config that is merely never read —
 * which is why four dead crons went unnoticed for months, and why the #1045
 * cache poisoning survived three days with no warm-cache pass to heal it.
 *
 * These tests pin the invariant that made that possible.
 */

function reasons(problems: VercelConfigProblem[]): string[] {
  return problems.map((p) => p.reason);
}

describe("checkVercelConfig", () => {
  it("accepts a config at the Root Directory whose paths all resolve", () => {
    const problems = checkVercelConfig({
      rootDirConfigExists: true,
      repoRootConfigExists: false,
      config: {
        crons: [{ path: "/api/cron/warm-cache", schedule: "0 * * * *" }],
        functions: { "app/api/cron/warm-cache/route.ts": { maxDuration: 300 } },
      },
      routeFileExists: () => true,
    });
    expect(problems).toEqual([]);
  });

  it("rejects a config that exists ONLY at the repo root — the #1052 trap", () => {
    // The exact production state: repo-root vercel.json defining four crons,
    // no apps/web/vercel.json, Root Directory = apps/web. Vercel read nothing.
    const problems = checkVercelConfig({
      rootDirConfigExists: false,
      repoRootConfigExists: true,
      config: null,
      routeFileExists: () => true,
    });
    expect(reasons(problems)).toContain("config_not_in_root_directory");
  });

  it("rejects a stray repo-root config even when the Root Directory one exists", () => {
    // Two files, only one read. A decoy is worse than nothing: it looks
    // authoritative in code review while having no effect on the deployment.
    const problems = checkVercelConfig({
      rootDirConfigExists: true,
      repoRootConfigExists: true,
      config: { crons: [], functions: {} },
      routeFileExists: () => true,
    });
    expect(reasons(problems)).toContain("ignored_repo_root_config");
  });

  it("rejects a cron path with no corresponding route file", () => {
    const problems = checkVercelConfig({
      rootDirConfigExists: true,
      repoRootConfigExists: false,
      config: {
        crons: [{ path: "/api/cron/does-not-exist", schedule: "0 * * * *" }],
        functions: {},
      },
      routeFileExists: () => false,
    });
    expect(reasons(problems)).toContain("cron_path_has_no_route");
  });

  it("rejects a functions key that resolves to no file", () => {
    const problems = checkVercelConfig({
      rootDirConfigExists: true,
      repoRootConfigExists: false,
      config: {
        crons: [],
        functions: { "app/api/cron/ghost/route.ts": { maxDuration: 300 } },
      },
      routeFileExists: () => false,
    });
    expect(reasons(problems)).toContain("functions_key_has_no_file");
  });

  it("reports missing config when neither location has one", () => {
    const problems = checkVercelConfig({
      rootDirConfigExists: false,
      repoRootConfigExists: false,
      config: null,
      routeFileExists: () => true,
    });
    expect(reasons(problems)).toContain("no_config_found");
  });

  it("pins the Root Directory to the Vercel project setting", () => {
    // Must match Settings -> General -> Root Directory for `chapa`. If that
    // setting ever changes, this constant and the file location move together.
    expect(VERCEL_ROOT_DIRECTORY).toBe("apps/web");
  });
});
