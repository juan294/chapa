import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getServiceClient } from "@/test/contract/invoke";
import { assertLocalSqlTarget } from "@/test/contract/local-sql";
import { dbRecordScoringIssuanceAttempt } from "./scoring-issuance";

/**
 * The scoring_issuance_attempts.reason CHECK constraint (migration 056) is a
 * hard DB barrier a unit-mocked test cannot see: a reason value it does not
 * enumerate rejects the insert outright, and dbRecordScoringIssuanceAttempt
 * catches that and returns false rather than throwing, which means a unit
 * suite mocking the Supabase client would still pass even if the real
 * constraint had never been widened for a new reason. This proves it was.
 */
const owner = "contract-scoring-issuance";
const db = () => getServiceClient();
async function cleanup() {
  assertLocalSqlTarget();
  expect((await db().rpc("scoring_v7_withdraw", { p_owner: owner })).error).toBeNull();
}
beforeEach(async () => {
  await cleanup();
  expect((await db().rpc("scoring_v7_ensure_subject", { p_owner: owner })).error).toBeNull();
});
afterEach(cleanup);

describe("dbRecordScoringIssuanceAttempt against the real reason CHECK constraint", () => {
  it("accepts and durably records a failed{reason: 'empty_evidence'} outcome", async () => {
    const recorded = await dbRecordScoringIssuanceAttempt(owner, "2026-09-24", { status: "failed", reason: "empty_evidence" });
    expect(recorded).toBe(true);
    const row = await db().from("scoring_issuance_attempts").select("owner_handle,outcome,reason").eq("owner_handle", owner).single();
    expect(row.error).toBeNull();
    expect(row.data).toMatchObject({ owner_handle: owner, outcome: "failed", reason: "empty_evidence" });
  });

  it("still rejects a reason the constraint does not enumerate", async () => {
    const recorded = await dbRecordScoringIssuanceAttempt(owner, "2026-09-24", { status: "failed", reason: "not_a_real_reason" as never });
    expect(recorded).toBe(false);
    expect((await db().from("scoring_issuance_attempts").select("id").eq("owner_handle", owner)).data).toEqual([]);
  });
});
