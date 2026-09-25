import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  evaluateDiffOutput,
  readRequiredEnv,
  TOLERATED_MIGRA_ARTIFACT,
} from "./check-pending-migrations";

describe("evaluateDiffOutput", () => {
  it("treats empty stdout as no pending changes", () => {
    const result = evaluateDiffOutput("");
    expect(result.hasPendingChanges).toBe(false);
  });

  it("treats whitespace-only stdout as no pending changes", () => {
    const result = evaluateDiffOutput("   \n\n  ");
    expect(result.hasPendingChanges).toBe(false);
  });

  it("treats the Supabase CLI's 'no schema changes' message as clean", () => {
    const result = evaluateDiffOutput(
      "Connecting to remote database...\nNo schema changes found\n",
    );
    expect(result.hasPendingChanges).toBe(false);
  });

  it("flags a non-empty SQL diff as pending changes", () => {
    const result = evaluateDiffOutput(
      "alter table \"public\".\"users\" add column \"foo\" text;\n",
    );
    expect(result.hasPendingChanges).toBe(true);
    expect(result.reason).toMatch(/non-empty schema diff/i);
  });

  it("flags arbitrary CLI chatter that isn't the known 'no changes' marker as pending", () => {
    const result = evaluateDiffOutput("Some unexpected CLI output that isn't empty");
    expect(result.hasPendingChanges).toBe(true);
  });
});

describe("readRequiredEnv", () => {
  const KEY = "CHECK_PENDING_MIGRATIONS_TEST_VAR";

  beforeEach(() => {
    delete process.env[KEY];
  });

  afterEach(() => {
    delete process.env[KEY];
  });

  it("returns undefined when unset", () => {
    expect(readRequiredEnv(KEY)).toBeUndefined();
  });

  it("returns undefined for a blank/whitespace-only value", () => {
    process.env[KEY] = "   ";
    expect(readRequiredEnv(KEY)).toBeUndefined();
  });

  it("trims and returns a set value", () => {
    process.env[KEY] = "  abc123  ";
    expect(readRequiredEnv(KEY)).toBe("abc123");
  });
});

// ---------------------------------------------------------------------------
// #1064 — the admin_users_observed migra artifact.
//
// migra emits a drop/recreate of the admin view on every run against the
// production project even though nothing differs. Until migration 059 that was
// a four-statement chain through public.admin_users. 059 dropped admin_users
// and rebuilt admin_users_observed directly on users, so the same false
// positive is now a two-statement drop/recreate of admin_users_observed.
//
// POST_059_CI_DIFF is the literal diff from the v4.1.0 release PR's Pending
// Migrations Check (2026-09-25), after 058 and 059 were applied and
// production's pg_get_viewdef + reloptions were read back as identical to 059.
// It is kept separate from the constant so these tests do not compare the
// constant with itself. The tolerance stays pinned to that exact body so a
// genuine change still blocks.
// ---------------------------------------------------------------------------

const POST_059_CI_DIFF = `drop view if exists "public"."admin_users_observed";

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

describe("evaluateDiffOutput — admin_users_observed migra artifact (#1064)", () => {
  it("pins the tolerated artifact to the literal post-059 CI diff", () => {
    expect(TOLERATED_MIGRA_ARTIFACT.replace(/\s+/g, " ").trim()).toBe(POST_059_CI_DIFF.replace(/\s+/g, " ").trim());
  });

  it("treats the literal post-059 CI diff as clean", () => {
    expect(evaluateDiffOutput(POST_059_CI_DIFF).hasPendingChanges).toBe(false);
  });

  it("accepts the artifact when the CLI wraps it in its JSON envelope", () => {
    const stdout = JSON.stringify({ diff: POST_059_CI_DIFF, message: "Diff complete." });
    expect(evaluateDiffOutput(stdout).hasPendingChanges).toBe(false);
  });

  it("BLOCKS when the artifact is accompanied by any other statement", () => {
    const stdout = `${POST_059_CI_DIFF}\n\ndrop table "public"."users";`;
    expect(evaluateDiffOutput(stdout).hasPendingChanges).toBe(true);
  });

  it("BLOCKS when the view genuinely changed", () => {
    const changed = POST_059_CI_DIFF.replace("u.avatar_url,", "u.avatar_url,\n    u.email,");
    expect(changed).not.toBe(POST_059_CI_DIFF);
    expect(evaluateDiffOutput(changed).hasPendingChanges).toBe(true);
  });

  it("BLOCKS when the policy filter changed", () => {
    const changed = POST_059_CI_DIFF.replace("'v7.2'::text", "'v8'::text");
    expect(changed).not.toBe(POST_059_CI_DIFF);
    expect(evaluateDiffOutput(changed).hasPendingChanges).toBe(true);
  });

  it("BLOCKS a recreate of a different view with the same body", () => {
    const other = POST_059_CI_DIFF.replaceAll("admin_users_observed", "latest_snapshots");
    expect(evaluateDiffOutput(other).hasPendingChanges).toBe(true);
  });

  it("BLOCKS the retired pre-059 four-statement chain", () => {
    const pre059 = `drop view if exists "public"."admin_users";\n\n${POST_059_CI_DIFF}`;
    expect(evaluateDiffOutput(pre059).hasPendingChanges).toBe(true);
  });
});
