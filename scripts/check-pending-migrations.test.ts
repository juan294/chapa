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
