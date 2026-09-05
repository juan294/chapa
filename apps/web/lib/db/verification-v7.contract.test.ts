import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { canonicalJson } from "@chapa/shared";
import { getServiceClient } from "@/test/contract/invoke";
import { receiptFixtureV7 } from "@/lib/history/__fixtures__/receipts-v7";
const owner = "contract-verification-v7-owner";
const db = () => getServiceClient();
describe("v7 durable issuance (real local database)", () => {
  beforeEach(async () => {
    expect((await db().rpc("scoring_v7_withdraw", { p_owner: owner })).error).toBeNull();
    expect((await db().from("scoring_v7_subjects").insert({ owner_handle: owner, public_evidence_consent: true, consent_recorded_at: "2026-09-01T12:00:00.000Z" })).error).toBeNull();
  });
  afterEach(async () => { expect((await db().rpc("scoring_v7_withdraw", { p_owner: owner })).error).toBeNull(); });
  async function published() {
    const envelope = await receiptFixtureV7();
    const receipt = envelope.receipt;
    expect((await db().from("scoring_v7_receipts").insert({ id: receipt.revisionId, owner_handle: owner, schema_version: 7, policy_version: receipt.policyVersion, reference_time: receipt.window.referenceTime, revision: receipt.revision, canonical_receipt: canonicalJson(receipt), public_receipt: receipt, issued_at: receipt.recordedAt })).error).toBeNull();
    return { p_owner: owner, p_actor: owner, p_revision: receipt.revisionId, p_key_version: "contract-key", p_signature: receipt.revisionId.replaceAll("-", "").repeat(2), p_canonical: canonicalJson(receipt) };
  }
  it("denies browser roles access to every verification and deletion RPC", () => {
    const project = readFileSync("supabase/config.toml", "utf8").match(/^project_id = "([\w-]+)"/m)?.[1];
    if (!project) throw new Error("Missing local Supabase project identity");
    const query = "SELECT p.proname, has_function_privilege('anon',p.oid,'EXECUTE'), has_function_privilege('authenticated',p.oid,'EXECUTE'), has_function_privilege('service_role',p.oid,'EXECUTE') FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('scoring_v7_issue_verification','scoring_v7_read_verification','scoring_v7_withdraw_with_receipts','scoring_v7_delete_user_with_receipts','scoring_v7_revocation_batch') ORDER BY p.proname";
    const rows = execFileSync("docker", ["exec", `supabase_db_${project}`, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-At", "-c", query], { encoding: "utf8" }).trim().split("\n");
    expect(rows).toHaveLength(5);
    for (const row of rows) expect(row.split("|").slice(1)).toEqual(["f", "f", "t"]);
  });
  it("rejects NULL actors and mismatched canonical bytes without writes", async () => {
    const args = await published();
    expect((await db().rpc("scoring_v7_issue_verification", { ...args, p_actor: null })).error).not.toBeNull();
    expect((await db().rpc("scoring_v7_issue_verification", { ...args, p_canonical: args.p_canonical + " " })).error).not.toBeNull();
    expect((await db().from("scoring_v7_verification").select("signature").eq("receipt_id", args.p_revision)).data).toEqual([]);
  });
  it("retries exact issuance, rejects conflicts, and retains only unauthenticated tombstones", async () => {
    const args = await published();
    expect((await db().rpc("scoring_v7_issue_verification", args)).error).toBeNull();
    expect((await db().rpc("scoring_v7_issue_verification", args)).error).toBeNull();
    expect((await db().rpc("scoring_v7_issue_verification", { ...args, p_signature: "f".repeat(64) })).error).not.toBeNull();
    const read = await db().rpc("scoring_v7_read_verification", { p_revision: args.p_revision, p_signature: args.p_signature });
    expect(read.error).toBeNull();
    expect(read.data).toEqual({ status: "current", canonical: args.p_canonical, keyVersion: args.p_key_version });
    const withdrawn = await db().rpc("scoring_v7_withdraw_with_receipts", { p_owner: owner, p_actor: owner, p_acknowledged: true });
    expect(withdrawn.error).toBeNull();
    expect(withdrawn.data).toEqual([args.p_revision]);
    expect((await db().rpc("scoring_v7_read_verification", { p_revision: args.p_revision, p_signature: "0".repeat(64) })).data).toEqual({ status: "revoked" });
    expect((await db().from("scoring_v7_verification").select("signature").eq("receipt_id", args.p_revision)).data).toEqual([]);
  });
  it("requires explicit withdrawal acknowledgement and bounds sweep batches", async () => {
    const args = await published();
    expect((await db().rpc("scoring_v7_withdraw_with_receipts", { p_owner: owner, p_actor: owner, p_acknowledged: null })).error).not.toBeNull();
    expect((await db().from("scoring_v7_receipts").select("id").eq("id", args.p_revision)).data).toHaveLength(1);
    expect((await db().rpc("scoring_v7_revocation_batch", { p_after: null, p_limit: 1001 })).error).not.toBeNull();
  });
  it("serializes concurrent issuance and withdrawal without reviving verified access", async () => {
    const args = await published();
    const [issued, withdrawn] = await Promise.all([
      db().rpc("scoring_v7_issue_verification", args),
      db().rpc("scoring_v7_withdraw_with_receipts", { p_owner: owner, p_actor: owner, p_acknowledged: true }),
    ]);
    expect(withdrawn.error).toBeNull();
    expect(withdrawn.data).toEqual([args.p_revision]);
    // Either issuance committed before withdrawal or correctly rejected after it.
    if (issued.error) expect(issued.error.message).toContain("Current consent required");
    expect((await db().rpc("scoring_v7_read_verification", { p_revision: args.p_revision, p_signature: args.p_signature })).data).toEqual({ status: "revoked" });
    expect((await db().from("scoring_v7_verification").select("signature").eq("receipt_id", args.p_revision)).data).toEqual([]);
  });

});
