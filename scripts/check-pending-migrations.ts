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
 * #1064 — the single tolerated migra artifact.
 *
 * migra emits a drop/recreate of the admin view on every run against the
 * production project even though nothing differs. Until migration 059 it was
 * a four-statement chain: `public.admin_users` (identical to what
 * `014_views_security_invoker.sql` produces) and its dependent
 * `public.admin_users_observed`. 059 dropped `admin_users` and rebuilt
 * `admin_users_observed` directly on `users`, so the same false positive is
 * now this two-statement drop/recreate. Evidence, read-only against
 * production on 2026-09-25 after 058 and 059 were applied:
 *
 *  - `pg_get_viewdef('public.admin_users_observed')` matches this body and
 *    059's definition (the only textual difference is the `public.` prefix,
 *    which Postgres omits for objects on the search path).
 *  - `pg_class.reloptions` is `{security_invoker=true}`, as 059 sets.
 *  - This exact text is what the v4.1.0 release PR's check emitted.
 *
 * The tolerance is pinned to this EXACT text, whitespace-normalized. A
 * genuine change to the view, a recreate of any other view, the retired
 * pre-059 chain, or this artifact accompanied by any additional statement all
 * still block — see the `#1064` cases in `check-pending-migrations.test.ts`.
 *
 * ACCEPTED RISK: a view change that normalizes to precisely this text would
 * pass unnoticed. That is only reachable by changing the view to what it
 * already is. Recorded in `docs/accepted-risks.md`.
 */
export const TOLERATED_MIGRA_ARTIFACT = `drop view if exists "public"."admin_users_observed";

create or replace view "public"."admin_users_observed" as  SELECT u.handle,
    u.registered_at,
    u.display_name,
    u.avatar_url,
    r.id AS current_revision_id,
    ((r.public_receipt #>> '{core,composite,displayValue}'::text[]))::double precision AS current_display_score,
    ((r.public_receipt #>> '{core,composite,exact}'::text[]))::double precision AS current_exact_score,
    (r.public_receipt #>> '{core,tier}'::text[]) AS current_tier,
    (r.public_receipt #>> '{core,archetype}'::text[]) AS current_archetype,
    ((r.reference_time AT TIME ZONE 'UTC'::text))::date AS current_snapshot_date,
    r.reference_time AS current_fetched_at,
        CASE
            WHEN (r.id IS NOT NULL) THEN encode(sha256(convert_to(r.canonical_receipt, 'UTF8'::name)), 'hex'::text)
            ELSE NULL::text
        END AS current_content_hash
   FROM (((public.users u
     LEFT JOIN public.scoring_v7_subjects s ON ((s.owner_handle = u.handle)))
     LEFT JOIN public.scoring_observed_current c ON ((c.owner_handle = s.owner_handle)))
     LEFT JOIN public.scoring_v7_receipts r ON (((r.id = c.receipt_id) AND (r.owner_handle = u.handle) AND (r.policy_version = 'v7.2'::text) AND ((r.public_receipt ->> 'action'::text) <> 'retract'::text))));`;

/** Collapse all whitespace runs so formatting differences never decide safety. */
function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, " ").trim();
}

/**
 * Newer Supabase CLI builds print a JSON envelope on stdout while older ones
 * print raw SQL. Accept both so the gate's verdict does not depend on which CLI
 * version the runner happens to have.
 */
function extractDiff(stdout: string): string {
  const trimmed = stdout.trim();
  if (!trimmed.startsWith("{")) return trimmed;
  try {
    const parsed = JSON.parse(trimmed) as { diff?: unknown };
    return typeof parsed.diff === "string" ? parsed.diff.trim() : trimmed;
  } catch {
    return trimmed;
  }
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

  const diff = extractDiff(trimmed);

  if (diff.length === 0) {
    return { hasPendingChanges: false, reason: "Empty diff output — nothing pending." };
  }

  if (normalizeSql(diff) === normalizeSql(TOLERATED_MIGRA_ARTIFACT)) {
    return {
      hasPendingChanges: false,
      reason:
        "Diff contains only the known-benign admin_users_observed migra artifact (#1064) — " +
        "production's view definition is identical; nothing to apply.",
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
