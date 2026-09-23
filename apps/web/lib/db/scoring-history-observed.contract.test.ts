import { beforeEach, afterEach, describe, it, expect } from "vitest";
import { canonicalJson } from "@chapa/shared";
import { observedReceiptFixture } from "@/lib/history/__fixtures__/receipts-observed";
import { dbListObservedReceiptHistory } from "./scoring-history-observed";
import { dbGetAdminUsers } from "./admin-users";
import { dbPublishObservedReceipt } from "./score-receipts-observed";
import { getServiceClient } from "@/test/contract/invoke";
import { assertLocalSqlTarget, inspectLocalSql } from "@/test/contract/local-sql";
const owner = "contract-observed-history";
async function clear() { assertLocalSqlTarget(); expect((await getServiceClient().rpc("scoring_v7_withdraw", { p_owner: owner })).error).toBeNull(); expect((await getServiceClient().from("users").delete().eq("handle", owner)).error).toBeNull(); }
beforeEach(clear); afterEach(clear);
describe("durable observed public history", () => {
  it("lists only the final daily current receipt with original exact/display values and durable trend", async () => {
    await getServiceClient().rpc("scoring_v7_ensure_subject", { p_owner: owner });
    const original = await observedReceiptFixture({ referenceTime: "2026-09-08T10:00:00.000Z" });
    expect((await dbPublishObservedReceipt(owner, owner, original, "a".repeat(64))).status).toBe("inserted");
    const winner = await observedReceiptFixture({ referenceTime: original.receipt.window.referenceTime, delivery: 1 });
    expect((await dbPublishObservedReceipt(owner, owner, winner, "b".repeat(64))).status).toBe("inserted");
    expect((await getServiceClient().from("users").upsert({ handle: owner }, { onConflict: "handle" })).error).toBeNull();
    const admin = await dbGetAdminUsers({ page: 1, limit: 1, sort: "adjustedComposite", dir: "desc", search: owner, tier: winner.receipt.core.tier }, { observed: true });
    expect(admin.total).toBe(1);
    expect(admin.users[0]).toMatchObject({ handle: owner, policyVersion: "v7.2", adjustedComposite: winner.receipt.core.composite.displayValue, archetype: winner.receipt.core.archetype, confidence: null, identity: { revisionId: winner.receipt.revisionId, contentHash: winner.contentHash.value } });
    const listed = await dbListObservedReceiptHistory(owner, { from: "2026-09-08", to: "2026-09-08" });
    expect(listed.status).toBe("found");
    if (listed.status !== "found") throw new Error("Expected history");
    expect(listed.entries).toHaveLength(1);
    expect(canonicalJson(listed.entries[0]!.envelope)).toBe(canonicalJson(winner));
    expect(listed.entries[0]!.trend).toMatchObject({ policyVersion: "v7.2", receiptRevisionId: winner.receipt.revisionId });
    expect(listed.entries[0]!.trend.rawPoint).toBeCloseTo(winner.receipt.core.composite.exact, 10);
    await clear();
    expect(await dbListObservedReceiptHistory(owner)).toEqual({ status: "missing" });
  });
  it("grants the history reader and current admin view only to service role", () => {
    expect(inspectLocalSql("SELECT has_function_privilege('anon','public.scoring_observed_history(text,date,date)','EXECUTE'),has_function_privilege('authenticated','public.scoring_observed_history(text,date,date)','EXECUTE'),has_function_privilege('service_role','public.scoring_observed_history(text,date,date)','EXECUTE'),has_table_privilege('anon','public.admin_users_observed','SELECT'),has_table_privilege('authenticated','public.admin_users_observed','SELECT'),has_table_privilege('service_role','public.admin_users_observed','SELECT')")).toBe("f|f|t|f|f|t");
  });
});
