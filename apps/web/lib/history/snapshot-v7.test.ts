import { calculateCoreV7 } from "@/lib/impact/v7";
import { describe, expect, it } from "vitest";
import { sealScoreReceipt, SCORING_V7_RECEIPT_RULES, type TrendAnchor } from "@chapa/shared";
import { receiptFixtureV7 } from "./__fixtures__/receipts-v7";
import { buildReceiptSnapshotV7 } from "./snapshot";
async function fixture(count = 4) {
  const receipt = await receiptFixtureV7("2026-09-01", count);
  const core = receipt.receipt.core.composite;
  if (core.kind !== "point") throw new Error("Expected point fixture");
  const anchor: TrendAnchor = { policyVersion: "v7", referenceDate: receipt.receipt.window.referenceDate, receiptRevisionId: receipt.receipt.revisionId, rawPoint: core.value, unroundedValue: core.value, previousAnchorRevisionId: null };
  return { receipt, anchor };
}
describe("receipt/trend boundary precision", () => {
  it("accepts the observed SQL float serialization difference without modifying receipt bytes", async () => {
    const { receipt, anchor } = await fixture();
    expect(anchor.rawPoint).toBe(59.91152278612738);
    const before = JSON.stringify(receipt);
    expect(buildReceiptSnapshotV7(receipt, { ...anchor, rawPoint: 59.9115227861274 }).trend.status).toBe("point");
    expect(JSON.stringify(receipt)).toBe(before);
  });
  it("limits raw internal-math tolerance to the pinned policy", async () => {
    const { receipt, anchor } = await fixture();
    const tolerance = SCORING_V7_RECEIPT_RULES.numericTolerance;
    expect(() => buildReceiptSnapshotV7(receipt, { ...anchor, rawPoint: anchor.rawPoint + tolerance / 2 })).not.toThrow();
    expect(() => buildReceiptSnapshotV7(receipt, { ...anchor, rawPoint: anchor.rawPoint + tolerance * 2 })).toThrow();
  });
  it.each([NaN, Infinity, -Infinity])("rejects nonfinite raw values %s", async rawPoint => {
    const { receipt, anchor } = await fixture();
    expect(() => buildReceiptSnapshotV7(receipt, { ...anchor, rawPoint })).toThrow();
  });
  it("keeps identity, date and point/range checks exact", async () => {
    const { receipt, anchor } = await fixture();
    expect(() => buildReceiptSnapshotV7(receipt, { ...anchor, receiptRevisionId: "other" })).toThrow();
    expect(() => buildReceiptSnapshotV7(receipt, { ...anchor, referenceDate: "2026-09-02" })).toThrow();
    const range = await receiptFixtureV7("2026-09-01", 4, undefined, true);
    expect(() => buildReceiptSnapshotV7(range, { ...anchor, receiptRevisionId: range.receipt.revisionId })).toThrow();
    expect(() => buildReceiptSnapshotV7({ ...receipt, receipt: { ...receipt.receipt, action: "retract" } }, anchor)).toThrow();
  });
  it("cannot use tolerance to admit raw values outside the score domain", async () => {
    const low = await fixture(0);
    expect(() => buildReceiptSnapshotV7(low.receipt, { ...low.anchor, rawPoint: -1e-12 })).toThrow();
    const high = await fixture(40);
    const input = high.receipt.receipt.inputs;
    const core = calculateCoreV7({ ...input, counts: { ...input.counts, deliveryUnits: { lower: 120, upper: 120 } } });
    const fullReceipt = await sealScoreReceipt({ ...high.receipt.receipt, inputs: core.inputs, core: core.core, calculation: { ...high.receipt.receipt.calculation, core: core.calculation } });
    expect(fullReceipt.receipt.core.composite).toMatchObject({ kind: "point", value: 100 });
    expect(() => buildReceiptSnapshotV7(fullReceipt, { ...high.anchor, rawPoint: 100 + 1e-12, unroundedValue: 100 })).toThrow();
  });
});
