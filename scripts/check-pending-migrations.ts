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
 * migra emits this drop/recreate of `public.admin_users` on every run against
 * the production project even though nothing differs. Since migration 052,
 * the dependent `public.admin_users_observed` view must be dropped and
 * recreated around that same false positive, so the pinned artifact includes
 * both exact view bodies. Evidence was gathered read-only against production:
 *
 *  - `pg_get_viewdef('public.admin_users')` is textually identical to what
 *    `014_views_security_invoker.sql` produces.
 *  - `pg_class.reloptions` is `{security_invoker=true}`, matching that migration.
 *  - The original emitted block was byte-for-byte identical whether or not a
 *    migration recreated the view. After applying migrations 049-052, the
 *    linked-production diff emits the same block plus the exact dependent view.
 *    No migration content can silence the underlying artifact, which is why
 *    `032_reconcile_remote_schema.sql` deliberately omits the view.
 *
 * The tolerance is pinned to this EXACT four-statement view chain,
 * whitespace-normalized. A genuine change to either view, a recreate of any
 * other view, or this artifact accompanied by any additional statement all
 * still block — see the `#1064` cases in
 * `check-pending-migrations.test.ts`, which exist specifically to keep this
 * narrow.
 *
 * ACCEPTED RISK: a view-chain change that normalizes to precisely this text
 * would pass unnoticed. That is only reachable by changing the views to what
 * they already are. Recorded in `docs/accepted-risks.md`.
 */
export const TOLERATED_MIGRA_ARTIFACT = `drop view if exists "public"."admin_users_observed";

drop view if exists "public"."admin_users";

create or replace view "public"."admin_users" as  SELECT u.handle,
    u.registered_at,
    u.display_name,
    u.avatar_url,
    ls.date AS snapshot_date,
    ls.captured_at AS snapshot_captured_at,
    ls.commits_total,
    ls.prs_merged_count,
    ls.reviews_submitted,
    ls.repos_contributed,
    ls.active_days,
    ls.total_stars,
    ls.archetype,
    ls.tier,
    ls.adjusted_composite,
    ls.composite_score,
    ls.confidence,
    ls.building,
    ls.guarding,
    ls.consistency AS consistency_score,
    ls.breadth
   FROM (public.users u
     LEFT JOIN public.latest_snapshots ls ON ((ls.handle = u.handle)));

create or replace view "public"."admin_users_observed" as  SELECT a.handle,
    a.registered_at,
    a.display_name,
    a.avatar_url,
    a.snapshot_date,
    a.snapshot_captured_at,
    a.commits_total,
    a.prs_merged_count,
    a.reviews_submitted,
    a.repos_contributed,
    a.active_days,
    a.total_stars,
    a.archetype,
    a.tier,
    a.adjusted_composite,
    a.composite_score,
    a.confidence,
    a.building,
    a.guarding,
    a.consistency_score,
    a.breadth,
        CASE
            WHEN (r.id IS NULL) THEN 'v6'::text
            ELSE 'v7.2'::text
        END AS current_policy_version,
        CASE
            WHEN (r.id IS NULL) THEN (a.adjusted_composite)::double precision
            ELSE ((r.public_receipt #>> '{core,composite,displayValue}'::text[]))::double precision
        END AS current_display_score,
        CASE
            WHEN (r.id IS NULL) THEN (a.composite_score)::double precision
            ELSE ((r.public_receipt #>> '{core,composite,exact}'::text[]))::double precision
        END AS current_exact_score,
        CASE
            WHEN (r.id IS NULL) THEN a.tier
            ELSE (r.public_receipt #>> '{core,tier}'::text[])
        END AS current_tier,
        CASE
            WHEN (r.id IS NULL) THEN a.archetype
            ELSE (r.public_receipt #>> '{core,archetype}'::text[])
        END AS current_archetype,
        CASE
            WHEN (r.id IS NULL) THEN a.confidence
            ELSE NULL::real
        END AS current_confidence,
        CASE
            WHEN (r.id IS NULL) THEN a.snapshot_date
            ELSE ((r.reference_time AT TIME ZONE 'UTC'::text))::date
        END AS current_snapshot_date,
        CASE
            WHEN (r.id IS NULL) THEN a.snapshot_captured_at
            ELSE r.reference_time
        END AS current_fetched_at,
    r.id AS current_revision_id,
        CASE
            WHEN (r.id IS NOT NULL) THEN encode(sha256(convert_to(r.canonical_receipt, 'UTF8'::name)), 'hex'::text)
            ELSE NULL::text
        END AS current_content_hash
   FROM (((public.admin_users a
     LEFT JOIN public.scoring_v7_subjects s ON (((s.owner_handle = a.handle) AND s.public_evidence_consent)))
     LEFT JOIN public.scoring_observed_current c ON ((c.owner_handle = s.owner_handle)))
     LEFT JOIN public.scoring_v7_receipts r ON (((r.id = c.receipt_id) AND (r.owner_handle = a.handle) AND (r.policy_version = 'v7.2'::text) AND ((r.public_receipt ->> 'action'::text) <> 'retract'::text))));`;

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
        "Diff contains only the known-benign admin_users view-chain migra artifact (#1064) — " +
        "production's view definitions are identical; nothing to apply.",
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
