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
// #1064 — the admin_users view-chain artifact.
//
// migra emits a drop/recreate of public.admin_users on every run against the
// production project even though nothing differs: production's pg_get_viewdef
// is textually identical to what 014_views_security_invoker.sql produces, and
// the emitted block is byte-for-byte identical whether or not a migration
// recreates the view. No migration content can silence it.
//
// Migration 052 added admin_users_observed as a dependent view, so migra now
// wraps the same false positive in an exact drop/recreate of that dependency.
// The tolerance is pinned to both exact bodies so a genuine change to either
// view still blocks — that is the property these tests exist to protect.
// ---------------------------------------------------------------------------

const BENIGN_VIEW_CHAIN_ARTIFACT = TOLERATED_MIGRA_ARTIFACT;

describe("evaluateDiffOutput — admin_users view-chain migra artifact (#1064)", () => {
  it("treats the known benign admin view-chain recreate as clean", () => {
    const result = evaluateDiffOutput(BENIGN_VIEW_CHAIN_ARTIFACT);
    expect(result.hasPendingChanges).toBe(false);
  });

  it("accepts the artifact when the CLI wraps it in its JSON envelope", () => {
    const stdout = JSON.stringify({ diff: BENIGN_VIEW_CHAIN_ARTIFACT, message: "Diff complete." });
    const result = evaluateDiffOutput(stdout);
    expect(result.hasPendingChanges).toBe(false);
  });

  it("BLOCKS when the artifact is accompanied by any other statement", () => {
    const stdout = `${BENIGN_VIEW_CHAIN_ARTIFACT}\n\ndrop table "public"."users";`;
    const result = evaluateDiffOutput(stdout);
    expect(result.hasPendingChanges).toBe(true);
  });

  it("BLOCKS when admin_users itself genuinely changed", () => {
    // A real change to the view must not be masked by the tolerance.
    const changed = BENIGN_VIEW_CHAIN_ARTIFACT.replace("ls.breadth", "ls.breadth,\n    ls.craft");
    const result = evaluateDiffOutput(changed);
    expect(result.hasPendingChanges).toBe(true);
  });

  it("BLOCKS a recreate of a different view with the same body shape", () => {
    const other = BENIGN_VIEW_CHAIN_ARTIFACT.replaceAll("admin_users", "latest_snapshots");
    const result = evaluateDiffOutput(other);
    expect(result.hasPendingChanges).toBe(true);
  });

  it("BLOCKS when the dependent observed view genuinely changed", () => {
    const changed = BENIGN_VIEW_CHAIN_ARTIFACT.replace(
      "ELSE 'v7.2'::text",
      "ELSE 'v8'::text",
    );
    expect(evaluateDiffOutput(changed).hasPendingChanges).toBe(true);
  });
});
