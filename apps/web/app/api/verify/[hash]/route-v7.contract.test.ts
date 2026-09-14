import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { canonicalJson, sealScoreReceipt, type CraftScoringInputs, type HashedScoreReceipt, type PublicScoringReceipt } from "@chapa/shared";
import { getServiceClient } from "@/test/contract/invoke";
import { receiptFixtureV7 } from "@/lib/history/__fixtures__/receipts-v7";
import { calculateCraftV7 } from "@/lib/insights/craft-v7";
import { dbPublishReceiptV7 } from "@/lib/db/snapshots";
import { issueReceiptVerificationV7 } from "@/lib/verification/store";
import { GET, POST } from "./route";

const owner = "contract-receipt-api-v7";
const db = () => getServiceClient();
type CraftCase = "absent" | "not_observed" | "zero" | "full" | "range";
async function fixture(craftCase: CraftCase = "full", date = "2026-09-01", count = 4, range = false, previous?: PublicScoringReceipt) {
  const base = await receiptFixtureV7(date, count, previous, range);
  if (craftCase === "absent") return base;
  const bounds = { lower: craftCase === "full" ? 8 : 0, upper: craftCase === "full" || craftCase === "range" ? 8 : 0 };
  const inputs: CraftScoringInputs = { policyVersion: "v7", window: base.receipt.window,
    eligibleEpisodes: craftCase === "not_observed" ? 0 : craftCase === "zero" ? 1 : 8,
    independentlyCorroboratedCompleteEpisodes: craftCase === "full" ? 8 : 0,
    counts: { framing: bounds, verification_debugging: bounds, tool_judgment: bounds, accepted_outcome: bounds } };
  const craft = calculateCraftV7(inputs);
  return sealScoreReceipt({ ...base.receipt, craft: { inputs, result: craft.result }, calculation: { ...base.receipt.calculation, craft: craft.trace } });
}
let requestNumber = 0;
async function request(token: string, submitted?: unknown) {
  const method = submitted === undefined ? "GET" : "POST";
  const req = new NextRequest(`https://contract.test/api/verify/${token}`, { method,
    headers: { "content-type": "application/json", "x-forwarded-for": `contract-receipt-${++requestNumber}` },
    ...(submitted === undefined ? {} : { body: JSON.stringify(submitted) }) });
  const response = await (method === "GET" ? GET : POST)(req, { params: Promise.resolve({ hash: token }) });
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  return { status: response.status, body: await response.json() };
}
async function publish(envelope: HashedScoreReceipt) {
  await dbPublishReceiptV7(owner, owner, envelope);
  return issueReceiptVerificationV7(owner, owner, envelope);
}
beforeEach(async () => {
  expect((await db().rpc("scoring_v7_withdraw", { p_owner: owner })).error).toBeNull();
  expect((await db().from("scoring_v7_subjects").insert({ owner_handle: owner, public_evidence_consent: true, consent_recorded_at: "2026-09-01T12:00:00.000Z" })).error).toBeNull();
});
afterEach(async () => { expect((await db().rpc("scoring_v7_withdraw", { p_owner: owner })).error).toBeNull(); });

describe("v7 receipt issuance and API (real Supabase, real HMAC/store/handlers)", () => {
  it.each<CraftCase>(["absent", "not_observed", "zero", "full", "range"])("round-trips complete %s Craft without changing the core", async craftCase => {
    const envelope = await fixture(craftCase);
    const token = await publish(envelope);
    const persisted = await db().from("scoring_v7_verification").select("signature,receipt_id,key_version").eq("receipt_id", envelope.receipt.revisionId).single();
    expect(persisted.error).toBeNull();
    expect(token).toBe(`v7.${envelope.receipt.revisionId}.${persisted.data!.signature}`);
    const fetched = await request(token);
    expect(fetched.status).toBe(200);
    expect(fetched.body).toMatchObject({ status: "current", issuanceRecorded: true, signatureAuthenticated: true, sourceEvidence: "not_verified" });
    expect(canonicalJson(fetched.body.envelope)).toBe(canonicalJson(envelope));
    expect(fetched.body.envelope.receipt.core).toEqual((await fixture("absent")).receipt.core);
    const compared = await request(token, envelope);
    expect(compared.status).toBe(200);
    expect(compared.body.submittedReceiptMatches).toBe(true);
    if (craftCase === "absent") expect(fetched.body.envelope.receipt.craft).toBeNull();
    if (craftCase === "not_observed") expect(fetched.body.envelope.receipt.craft.result).toEqual({ status: "not_observed" });
    if (craftCase === "zero") expect(fetched.body.envelope.receipt.craft.result.composite).toEqual({ kind: "point", value: 0, displayValue: 0 });
    if (craftCase === "full") expect(fetched.body.envelope.receipt.craft.result).toMatchObject({ descriptor: "Artificer", composite: { kind: "point", value: 100 } });
    if (craftCase === "range") expect(fetched.body.envelope.receipt.craft.result.composite.kind).toBe("range");
  });

  it("rejects or distinguishes every changed signed field even with a recomputed content hash", async () => {
    const original = await fixture();
    const token = await publish(original);
    const dimension = await fixture("full", "2026-09-01", 6);
    const range = await fixture("full", "2026-09-01", 4, true);
    const date = await fixture("full", "2026-09-02");
    const differentCraft = await fixture("range");
    const candidates: Record<string, unknown> = {
      dimension: { ...original.receipt, inputs: dimension.receipt.inputs, core: dimension.receipt.core, calculation: { ...original.receipt.calculation, core: dimension.receipt.calculation.core } },
      range: { ...original.receipt, inputs: range.receipt.inputs, core: range.receipt.core, calculation: { ...original.receipt.calculation, core: range.receipt.calculation.core } },
      craft: { ...original.receipt, craft: differentCraft.receipt.craft, calculation: { ...original.receipt.calculation, craft: differentCraft.receipt.calculation.craft } },
      craftAbsence: { ...original.receipt, craft: null, calculation: { ...original.receipt.calculation, craft: null } },
      date: { ...date.receipt, receiptId: original.receipt.receiptId, revisionId: original.receipt.revisionId },
    };
    for (const [field, changed] of Object.entries(candidates)) {
      const resealed = await sealScoreReceipt(changed);
      const result = await request(token, resealed);
      expect(result.status, field).toBe(200);
      expect(result.body.submittedReceiptMatches, field).toBe(false);
      // Authentication refers to the stored issued bytes, never the differing submission.
      expect(result.body.signatureAuthenticated, field).toBe(true);
    }
    const unsupportedPolicy = { ...original, receipt: { ...original.receipt, policyVersion: "v8" } };
    expect((await request(token, unsupportedPolicy)).status).toBe(400);
  });

  it("keeps superseded and retracted revisions distinct, then serves only tombstones after withdrawal", async () => {
    const first = await fixture();
    const firstToken = await publish(first);
    const correction = await fixture("zero", "2026-09-01", 4, false, first.receipt);
    const correctionToken = await publish(correction);
    expect((await request(firstToken)).body.status).toBe("superseded");
    expect((await request(correctionToken)).body.status).toBe("current");
    const third = await fixture("zero", "2026-09-01", 4, false, correction.receipt);
    const retraction = await sealScoreReceipt({ ...third.receipt, action: "retract" });
    const retractedToken = await publish(retraction);
    expect((await request(retractedToken)).body.status).toBe("retracted");
    expect((await request(correctionToken)).body.status).toBe("superseded");
    expect((await db().rpc("scoring_v7_withdraw_with_receipts", { p_owner: owner, p_actor: owner, p_acknowledged: true })).error).toBeNull();
    for (const token of [firstToken, correctionToken, retractedToken]) {
      const result = await request(token);
      expect(result.status).toBe(410);
      expect(result.body).toMatchObject({ status: "revoked", signatureAuthenticated: false });
      expect(result.body).not.toHaveProperty("envelope");
    }
  });
});
