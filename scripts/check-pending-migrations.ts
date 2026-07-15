#!/usr/bin/env node
/**
 * check-pending-migrations.ts
 *
 * CI gate for issue #1011: verifies that every file under
 * supabase/migrations/ has actually been applied to the linked (production)
 * Supabase project before a develop -> main release PR is allowed to merge.
 *
 * Historically migrations were applied manually with no automated check —
 * see "Before a Production Release" in docs/runbooks/migrations.md. That
 * left room for a migration file to be committed and merged without ever
 * being run against production, causing code to reference schema objects
 * that don't exist yet.
 *
 * This script shells out to `supabase link` + `supabase db diff --linked`,
 * which compares the local migration files against the actual schema of the
 * linked remote project. A non-empty diff means either:
 *   - a migration file exists locally that has not been applied to
 *     production, or
 *   - the remote schema has drifted from what the migration files describe.
 * Either case must block the release — this script exits non-zero for both.
 *
 * Required environment variables:
 *   SUPABASE_ACCESS_TOKEN - Supabase personal access token used to
 *                           authenticate the CLI against the Management API.
 *                           Should be scoped read-only where the Supabase
 *                           dashboard allows it.
 *   SUPABASE_PROJECT_REF  - The production project's ref (the short ID in
 *                           its dashboard URL) to link against.
 * Optional:
 *   SUPABASE_DB_PASSWORD  - Only needed if the CLI requires a direct
 *                           Postgres connection during diff/link. Safe to
 *                           omit if the Management-API-only path works.
 *
 * A missing/failing credential is treated as "cannot confirm safety" and
 * exits non-zero rather than silently passing — see the CI workflow step
 * that calls this script for the separate, intentional "secret not
 * configured yet, skip this step" gate (that check happens in the workflow,
 * not here, so a misconfigured environment never reports false confidence
 * if this script is invoked directly).
 *
 * Run: pnpm run check:pending-migrations
 * Or:  tsx scripts/check-pending-migrations.ts
 *
 * Exit codes:
 *   0 - no pending/drifted migrations (diff is empty)
 *   1 - pending migrations found, missing credentials, or a CLI failure
 */

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/** Strings the Supabase CLI prints when there is no schema diff to report. */
export const NO_DIFF_MARKERS = ["No schema changes found"];

export interface DiffResult {
  hasPendingChanges: boolean;
  reason: string;
}

/**
 * Decide whether `supabase db diff --linked` output represents a clean
 * (no pending changes) state. Pure function — no I/O — so it's directly
 * unit-testable without shelling out to the real CLI.
 */
export function evaluateDiffOutput(stdout: string): DiffResult {
  const trimmed = stdout.trim();

  if (trimmed.length === 0) {
    return { hasPendingChanges: false, reason: "Empty diff output — nothing pending." };
  }

  if (NO_DIFF_MARKERS.some((marker) => trimmed.includes(marker))) {
    return {
      hasPendingChanges: false,
      reason: "Supabase CLI reported no schema changes.",
    };
  }

  return {
    hasPendingChanges: true,
    reason: "Supabase CLI reported a non-empty schema diff.",
  };
}

/** Read a required env var, trimmed. Returns undefined if unset/blank. */
export function readRequiredEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : undefined;
}

interface Credentials {
  accessToken: string;
  projectRef: string;
  dbPassword: string | undefined;
}

function loadCredentials(): Credentials | undefined {
  const accessToken = readRequiredEnv("SUPABASE_ACCESS_TOKEN");
  const projectRef = readRequiredEnv("SUPABASE_PROJECT_REF");
  const dbPassword = readRequiredEnv("SUPABASE_DB_PASSWORD");

  if (!accessToken || !projectRef) {
    return undefined;
  }

  return { accessToken, projectRef, dbPassword };
}

function runSupabaseCli(
  args: string[],
  credentials: Credentials,
): { status: number | null; stdout: string; stderr: string; error?: Error } {
  const result = spawnSync("supabase", args, {
    encoding: "utf8",
    env: {
      ...process.env,
      SUPABASE_ACCESS_TOKEN: credentials.accessToken,
      ...(credentials.dbPassword
        ? { SUPABASE_DB_PASSWORD: credentials.dbPassword }
        : {}),
    },
  });

  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    error: result.error,
  };
}

function main(): void {
  console.log("Checking for pending Supabase migrations against the linked production project...\n");

  const credentials = loadCredentials();
  if (!credentials) {
    console.error(
      "check-pending-migrations: missing SUPABASE_ACCESS_TOKEN and/or SUPABASE_PROJECT_REF.",
    );
    console.error(
      "This check requires read-only Supabase Management API credentials scoped to the production project.",
    );
    console.error("See docs/runbooks/migrations.md for setup and the manual fallback check.");
    process.exit(1);
    return;
  }

  console.log(`Linking to Supabase project ${credentials.projectRef}...`);
  const linkResult = runSupabaseCli(
    ["link", "--project-ref", credentials.projectRef],
    credentials,
  );

  if (linkResult.error) {
    console.error("check-pending-migrations: failed to invoke the `supabase` CLI.");
    console.error(linkResult.error.message);
    console.error("Is the Supabase CLI installed on this runner? See supabase/setup-cli in CI.");
    process.exit(1);
    return;
  }

  if (linkResult.status !== 0) {
    console.error("check-pending-migrations: `supabase link` failed.");
    console.error(linkResult.stdout);
    console.error(linkResult.stderr);
    process.exit(1);
    return;
  }

  console.log("Running `supabase db diff --linked`...");
  const diffResult = runSupabaseCli(["db", "diff", "--linked"], credentials);

  if (diffResult.error) {
    console.error(
      "check-pending-migrations: failed to run `supabase db diff --linked`.",
    );
    console.error(diffResult.error.message);
    process.exit(1);
    return;
  }

  if (diffResult.status !== 0) {
    console.error(
      "check-pending-migrations: `supabase db diff --linked` exited non-zero.",
    );
    console.error(diffResult.stdout);
    console.error(diffResult.stderr);
    process.exit(1);
    return;
  }

  const { hasPendingChanges, reason } = evaluateDiffOutput(diffResult.stdout);
  console.log(reason);

  if (hasPendingChanges) {
    console.error(
      "\nPending/drifted migrations detected between supabase/migrations/ and the linked production project:\n",
    );
    console.error(diffResult.stdout);
    console.error(
      "\nApply pending migrations with `supabase db push --linked` (see docs/runbooks/migrations.md) before merging this release.",
    );
    process.exit(1);
    return;
  }

  console.log(
    "\nNo pending migrations. Production schema matches supabase/migrations/.",
  );
  process.exit(0);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
