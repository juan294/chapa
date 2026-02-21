import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const migrationPath = join(
  __dirname,
  "../supabase/migrations/008_add_rls_deny_policies.sql",
);
const sql = readFileSync(migrationPath, "utf-8");

const TABLES_REQUIRING_DENY_ALL = [
  "users",
  "metrics_snapshots",
  "verification_records",
  "merge_operations",
];

const TABLE_WITH_PUBLIC_SELECT = "feature_flags";

describe("008_add_rls_deny_policies migration", () => {
  it("creates a deny policy for every table that needs full lockdown", () => {
    for (const table of TABLES_REQUIRING_DENY_ALL) {
      expect(sql).toMatch(
        new RegExp(`ON\\s+${table}\\s+FOR\\s+ALL\\s+TO\\s+anon`),
      );
    }
  });

  it("uses USING (false) to deny row visibility for anon", () => {
    for (const table of TABLES_REQUIRING_DENY_ALL) {
      const policyBlock = extractPolicyBlock(sql, table);
      expect(policyBlock).toContain("USING (false)");
    }
  });

  it("uses WITH CHECK (false) to deny writes for anon", () => {
    for (const table of TABLES_REQUIRING_DENY_ALL) {
      const policyBlock = extractPolicyBlock(sql, table);
      expect(policyBlock).toContain("WITH CHECK (false)");
    }
  });

  it("handles feature_flags table with deny policy for anon", () => {
    expect(sql).toMatch(
      new RegExp(`ON\\s+${TABLE_WITH_PUBLIC_SELECT}\\s+FOR\\s+ALL\\s+TO\\s+anon`),
    );
  });

  it("covers all 5 Supabase tables", () => {
    const allTables = [...TABLES_REQUIRING_DENY_ALL, TABLE_WITH_PUBLIC_SELECT];
    for (const table of allTables) {
      expect(sql).toContain(table);
    }
  });

  it("does not drop or alter the existing feature_flags SELECT policy", () => {
    expect(sql.toLowerCase()).not.toContain("drop policy");
    expect(sql.toLowerCase()).not.toMatch(
      /alter\s+policy.*feature_flags_read_all/,
    );
  });

  it("includes a comment explaining the defense-in-depth rationale", () => {
    expect(sql.toLowerCase()).toContain("defense");
  });
});

function extractPolicyBlock(fullSql: string, tableName: string): string {
  const regex = new RegExp(
    `CREATE POLICY[^;]*ON\\s+${tableName}[^;]*;`,
    "is",
  );
  const match = fullSql.match(regex);
  return match ? match[0] : "";
}
