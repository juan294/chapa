import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { evaluateDiffOutput, readRequiredEnv } from "./check-pending-migrations";

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
// #1064 — the admin_users view artifact.
//
// migra emits a drop/recreate of public.admin_users on every run against the
// production project even though nothing differs: production's pg_get_viewdef
// is textually identical to what 014_views_security_invoker.sql produces, and
// the emitted block is byte-for-byte identical whether or not a migration
// recreates the view. No migration content can silence it.
//
// The tolerance is pinned to the exact view body so a genuine admin_users
// change still blocks — that is the property these tests exist to protect.
// ---------------------------------------------------------------------------

const BENIGN_ADMIN_USERS_BODY = ` SELECT u.handle,
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
     LEFT JOIN public.latest_snapshots ls ON ((ls.handle = u.handle)));`;

const BENIGN_ARTIFACT = `drop view if exists "public"."admin_users";

create or replace view "public"."admin_users" as ${BENIGN_ADMIN_USERS_BODY}`;

describe("evaluateDiffOutput — admin_users migra artifact (#1064)", () => {
  it("treats the known benign admin_users recreate as clean", () => {
    const result = evaluateDiffOutput(BENIGN_ARTIFACT);
    expect(result.hasPendingChanges).toBe(false);
  });

  it("accepts the artifact when the CLI wraps it in its JSON envelope", () => {
    const stdout = JSON.stringify({ diff: BENIGN_ARTIFACT, message: "Diff complete." });
    const result = evaluateDiffOutput(stdout);
    expect(result.hasPendingChanges).toBe(false);
  });

  it("BLOCKS when the artifact is accompanied by any other statement", () => {
    const stdout = `${BENIGN_ARTIFACT}\n\ndrop table "public"."users";`;
    const result = evaluateDiffOutput(stdout);
    expect(result.hasPendingChanges).toBe(true);
  });

  it("BLOCKS when admin_users itself genuinely changed", () => {
    // A real change to the view must not be masked by the tolerance.
    const changed = BENIGN_ARTIFACT.replace("ls.breadth", "ls.breadth,\n    ls.craft");
    const result = evaluateDiffOutput(changed);
    expect(result.hasPendingChanges).toBe(true);
  });

  it("BLOCKS a recreate of a different view with the same body shape", () => {
    const other = BENIGN_ARTIFACT.replaceAll("admin_users", "latest_snapshots");
    const result = evaluateDiffOutput(other);
    expect(result.hasPendingChanges).toBe(true);
  });
});
