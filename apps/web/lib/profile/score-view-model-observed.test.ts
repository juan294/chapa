import { expect, it } from "vitest";
import { createScoringWindow } from "@chapa/shared";
import { observedReceiptFixture } from "@/lib/history/__fixtures__/receipts-observed";
import { calculateReportCraftInputs } from "@/lib/insights/report-craft";
import { observedReceiptViewModel } from "./score-view-model";
it("expires the report axis without mutating the sealed core or treating zero Craft as absent", async () => {
  const window = createScoringWindow("2026-09-07T17:20:02.164Z");
  const calculation = calculateReportCraftInputs({ policyVersion: "v7.2", classifierRevision: "cc-outcomes-v7.2", window,
    reportPeriod: { startInclusive: "2026-09-01T00:00:00.000Z", endExclusive: "2026-09-07T00:00:00.000Z" }, totalSessions: 5,
    outcomes: { fully_achieved: 0, mostly_achieved: 0, partially_achieved: 0, not_achieved: 5 }, unknownSessions: 0, unclassifiedSessions: 0 });
  if (calculation.status !== "valid" || calculation.result.status !== "scored") throw new Error("fixture invalid");
  const receipt = await observedReceiptFixture({ craft: { status: "scored", unlocked: true, report: {
    reportRef: "11111111-1111-4111-8111-111111111111", supersedesReportRef: null, inputs: calculation.inputs, result: calculation.result,
  } } });
  const current = observedReceiptViewModel("alice", { receipt, trend: null }, Date.parse(window.referenceTime));
  const expired = observedReceiptViewModel("alice", { receipt, trend: null }, Date.parse("2027-10-01T00:00:00.000Z"));
  expect(current.reportCraft).toMatchObject({ status: "scored", unlocked: true, report: { result: { point: { displayValue: 0 } } } });
  expect(expired.reportCraft).toMatchObject({ status: "expired", unlocked: true, report: null });
  expect(expired.freshness).toBe("stale");
  expect(expired.composite).toEqual(current.composite);
  expect(receipt.receipt.craft.status).toBe("scored");
});
