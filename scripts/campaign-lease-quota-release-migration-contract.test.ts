import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    import.meta.dirname,
    "../supabase/migrations/033_release_oversized_recovered_lease_groups.sql",
  ),
  "utf8",
);

describe("campaign lease quota-release migration contract (#1085)", () => {
  it("adds a group_token column that persists group identity across status transitions", () => {
    expect(migration).toContain(
      "ADD COLUMN IF NOT EXISTS group_token TEXT",
    );
  });

  it("recovers a previously-released pending group whole, ignoring p_limit, just like an expired lease group", () => {
    expect(migration).toContain("pending_group AS MATERIALIZED");
    expect(migration).toContain(
      "AND sends.status = 'pending'\n      AND sends.group_token IS NOT NULL",
    );
    expect(migration).toContain(
      "WHEN EXISTS (SELECT 1 FROM expired_group)\n        OR EXISTS (SELECT 1 FROM pending_group)\n      THEN 2147483647",
    );
  });

  it("seeds group_token from the expiring lease but never clobbers an existing one", () => {
    expect(migration).toContain(
      "group_token = COALESCE(\n        sends.group_token,\n        (SELECT lease_token FROM expired_group)\n      )",
    );
  });

  it("adds a lease-scoped release function that clears the lease but preserves group_token", () => {
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.release_campaign_send_lease(",
    );
    const fnStart = migration.indexOf(
      "CREATE OR REPLACE FUNCTION public.release_campaign_send_lease(",
    );
    const fnEnd = migration.indexOf("$$;", fnStart);
    const fnBody = migration.slice(fnStart, fnEnd);

    // Must reset status/lease bookkeeping back to pending...
    expect(fnBody).toContain("status = 'pending'");
    expect(fnBody).toContain("claimed_at = NULL");
    expect(fnBody).toContain("lease_expires_at = NULL");
    expect(fnBody).toContain("lease_token = NULL");
    // ...but must never touch group_token, so identity survives the release.
    expect(fnBody).not.toContain("group_token");
    // Scoped strictly to the caller's own lease, and fails closed on a
    // blank token (same whitespace-safe guard as 031's claim/acknowledge).
    expect(fnBody).toContain("sends.lease_token = p_lease_token");
    expect(fnBody).toContain("p_lease_token !~ '^[[:space:]]*$'");
  });

  it("keeps the new function service-role only", () => {
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.release_campaign_send_lease(TEXT)",
    );
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.release_campaign_send_lease(TEXT)",
    );
    expect(migration).toContain("TO service_role;");
  });
});
