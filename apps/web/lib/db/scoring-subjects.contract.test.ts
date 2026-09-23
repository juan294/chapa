import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { dbEnsureScoringSubject } from "./scoring-subjects";
import { getServiceClient } from "@/test/contract/invoke";
import { assertLocalSqlTarget, inspectLocalSql } from "@/test/contract/local-sql";

const owner = "contract-ensure-subject";
const db = () => getServiceClient();
async function cleanup() { assertLocalSqlTarget(); expect((await db().rpc("scoring_v7_withdraw", { p_owner: owner })).error).toBeNull(); }
beforeEach(cleanup);
afterEach(cleanup);

describe("dbEnsureScoringSubject", () => {
  it("registers a subject with no consent row and is idempotent", async () => {
    expect(await dbEnsureScoringSubject(owner.toUpperCase())).toBe(true);
    const first = await db().from("scoring_v7_subjects").select("owner_handle").eq("owner_handle", owner);
    expect(first.data).toEqual([{ owner_handle: owner }]);
    expect(await dbEnsureScoringSubject(owner)).toBe(true);
    const second = await db().from("scoring_v7_subjects").select("owner_handle").eq("owner_handle", owner);
    expect(second.data).toHaveLength(1);
  });
  it("never touches an existing subject's row", async () => {
    expect((await db().rpc("scoring_v7_ensure_subject", { p_owner: owner })).error).toBeNull();
    const before = await db().from("scoring_v7_subjects").select("created_at").eq("owner_handle", owner).single();
    await dbEnsureScoringSubject(owner);
    const after = await db().from("scoring_v7_subjects").select("created_at").eq("owner_handle", owner).single();
    expect(after.data?.created_at).toBe(before.data?.created_at);
  });
  it("grants scoring_v7_ensure_subject only to service role", () => {
    expect(inspectLocalSql("SELECT has_function_privilege('anon','public.scoring_v7_ensure_subject(text)','EXECUTE'),has_function_privilege('authenticated','public.scoring_v7_ensure_subject(text)','EXECUTE'),has_function_privilege('service_role','public.scoring_v7_ensure_subject(text)','EXECUTE')")).toBe("f|f|t");
  });
});
