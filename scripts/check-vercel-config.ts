#!/usr/bin/env node
/**
 * check-vercel-config.ts
 *
 * CI gate for issue #1052: verifies that `vercel.json` actually lives where
 * Vercel will read it, and that every path inside it resolves.
 *
 * Background — this gate exists because of a silent, months-long outage.
 * The Vercel project's Root Directory is `apps/web`, and Vercel resolves
 * `vercel.json` relative to the Root Directory. The file lived at the *repo
 * root*, so it was never read. Consequences, none of which produced an error:
 *
 *   - All four cron jobs (warm-cache, sync-audience, process-campaigns,
 *     latency-check) were never registered and never ran. The Vercel
 *     dashboard showed the "Get Started with Cron Jobs" onboarding screen.
 *   - The `functions` block was ignored, including the `maxDuration: 300`
 *     that #942 specifically documented as a Pro requirement.
 *   - Commits that "changed" the config were silent no-ops: b24d9033 bumped
 *     warm-cache from daily to hourly and changed nothing at all.
 *   - With warm-cache dead, the badge cache was only ever populated by
 *     whichever request arrived first after a TTL expiry — which is why the
 *     #1045 scope-blinded write sat in production for three days with no
 *     server-token pass to heal it.
 *
 * The failure mode is the dangerous kind: config that is never read produces
 * no error, no warning, and no log line. It looks correct in review and in
 * git. Only a check that asserts *location* can catch it, so that is what
 * this does.
 *
 * Exits non-zero on any problem. Pure decision logic lives in
 * `checkVercelConfig` so it is testable without touching the filesystem.
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * The Vercel project's Root Directory setting (Settings -> General -> Root
 * Directory for `chapa`). Vercel reads `vercel.json` from here, NOT from the
 * repository root. If this setting is ever changed in the dashboard, this
 * constant and the file's location must move together — the test pins it so
 * the two cannot drift apart silently.
 */
export const VERCEL_ROOT_DIRECTORY = "apps/web";

export interface VercelConfigProblem {
  reason: string;
  detail: string;
}

interface VercelConfigShape {
  crons?: { path: string; schedule: string }[];
  functions?: Record<string, { maxDuration?: number }>;
}

export interface CheckInput {
  /** Does `<VERCEL_ROOT_DIRECTORY>/vercel.json` exist? */
  rootDirConfigExists: boolean;
  /** Does `./vercel.json` (repo root) exist? It would be ignored by Vercel. */
  repoRootConfigExists: boolean;
  /** Parsed config from the Root Directory location, or null if absent. */
  config: VercelConfigShape | null;
  /**
   * Resolves a path *relative to the Root Directory* to a real file.
   * Injected so the decision logic stays pure.
   */
  routeFileExists: (relativePath: string) => boolean;
}

/**
 * Pure decision logic. Returns every problem found (not just the first) so a
 * single CI run reports the whole picture.
 */
export function checkVercelConfig(input: CheckInput): VercelConfigProblem[] {
  const problems: VercelConfigProblem[] = [];

  if (!input.rootDirConfigExists && input.repoRootConfigExists) {
    problems.push({
      reason: "config_not_in_root_directory",
      detail:
        `vercel.json exists at the repo root but the Vercel Root Directory is ` +
        `"${VERCEL_ROOT_DIRECTORY}". Vercel resolves vercel.json relative to the ` +
        `Root Directory, so this file is NEVER READ: crons are not registered and ` +
        `the functions block is ignored. Move it to ${VERCEL_ROOT_DIRECTORY}/vercel.json. ` +
        `This is exactly the #1052 outage — four crons dead for months with no error.`,
    });
    return problems;
  }

  if (!input.rootDirConfigExists && !input.repoRootConfigExists) {
    problems.push({
      reason: "no_config_found",
      detail:
        `No vercel.json found at ${VERCEL_ROOT_DIRECTORY}/vercel.json or at the repo ` +
        `root. Cron schedules and function maxDuration settings come from that file.`,
    });
    return problems;
  }

  // A stray repo-root copy alongside the real one is its own hazard: it reads
  // as authoritative in review while having no effect on the deployment.
  if (input.repoRootConfigExists) {
    problems.push({
      reason: "ignored_repo_root_config",
      detail:
        `A vercel.json exists at BOTH the repo root and ${VERCEL_ROOT_DIRECTORY}/. ` +
        `Only the latter is read. Delete the repo-root copy so it cannot drift or ` +
        `mislead — a decoy config is worse than none.`,
    });
  }

  const config = input.config;
  if (!config) return problems;

  // Every cron path must map to a real route, or Vercel schedules an
  // invocation against a URL that 404s — a cron that "runs" and does nothing.
  for (const cron of config.crons ?? []) {
    const routePath = join("app", cron.path.replace(/^\//, ""), "route.ts");
    if (!input.routeFileExists(routePath)) {
      problems.push({
        reason: "cron_path_has_no_route",
        detail:
          `Cron path "${cron.path}" (schedule "${cron.schedule}") has no route file at ` +
          `${VERCEL_ROOT_DIRECTORY}/${routePath}. Vercel would GET a URL that 404s.`,
      });
    }
  }

  // A functions key that matches no file is silently ignored by Vercel, so a
  // typo'd maxDuration reads as configured while the route runs at the default.
  for (const key of Object.keys(config.functions ?? {})) {
    if (!input.routeFileExists(key)) {
      problems.push({
        reason: "functions_key_has_no_file",
        detail:
          `functions key "${key}" matches no file under ${VERCEL_ROOT_DIRECTORY}/. ` +
          `Vercel ignores unmatched keys, so its settings (e.g. maxDuration) never apply.`,
      });
    }
  }

  return problems;
}

function main(): void {
  const repoRoot = resolve(__dirname, "..");
  const rootDir = join(repoRoot, VERCEL_ROOT_DIRECTORY);
  const rootDirConfigPath = join(rootDir, "vercel.json");
  const repoRootConfigPath = join(repoRoot, "vercel.json");

  const rootDirConfigExists = existsSync(rootDirConfigPath);

  let config: VercelConfigShape | null = null;
  if (rootDirConfigExists) {
    try {
      config = JSON.parse(readFileSync(rootDirConfigPath, "utf8")) as VercelConfigShape;
    } catch (err) {
      console.error(`FAIL: ${rootDirConfigPath} is not valid JSON — ${String(err)}`);
      process.exit(1);
    }
  }

  const problems = checkVercelConfig({
    rootDirConfigExists,
    repoRootConfigExists: existsSync(repoRootConfigPath),
    config,
    routeFileExists: (relativePath) => existsSync(join(rootDir, relativePath)),
  });

  if (problems.length > 0) {
    console.error("FAIL: vercel.json configuration problems (#1052)\n");
    for (const p of problems) {
      console.error(`  [${p.reason}]\n  ${p.detail}\n`);
    }
    process.exit(1);
  }

  const cronCount = config?.crons?.length ?? 0;
  console.log(
    `OK: ${VERCEL_ROOT_DIRECTORY}/vercel.json is in the deployed Root Directory; ` +
      `${cronCount} cron path(s) and all functions keys resolve.`,
  );
}

// Only run main() when invoked directly, not when imported by tests.
if (require.main === module) {
  main();
}
