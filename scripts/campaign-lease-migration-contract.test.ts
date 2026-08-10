import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    import.meta.dirname,
    "../supabase/migrations/031_reject_whitespace_campaign_lease_tokens.sql",
  ),
  "utf8",
);

describe("campaign lease-token migration contract", () => {
  it("rejects every PostgreSQL whitespace-only token in claim and acknowledge", () => {
    expect(migration).not.toContain("btrim(p_lease_token)");
    expect(
      migration.match(/p_lease_token\s+(?:!~|~)\s+'\^\[\[:space:\]\]\*\$'/g),
    ).toHaveLength(2);
  });

  it("keeps both security-definer functions service-role only", () => {
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.claim_campaign_sends(UUID, INTEGER, TEXT, TIMESTAMPTZ)",
    );
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.acknowledge_campaign_sends(TEXT, JSONB)",
    );
    expect(migration.match(/GRANT EXECUTE ON FUNCTION/g)).toHaveLength(2);
    expect(migration.match(/TO service_role;/g)).toHaveLength(2);
  });
});
