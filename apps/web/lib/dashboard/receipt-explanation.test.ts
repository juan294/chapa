import { describe, expect, it } from "vitest";
import { SCORING_V7_RECEIPT_RULES } from "@chapa/shared";
import { buildReceiptSnapshotV7 } from "@/lib/history/snapshot";
import { receiptFixtureV7 } from "@/lib/history/__fixtures__/receipts-v7";
import { explainReceipt, explanationReconciles } from "./receipt-explanation";
import { CORE_DIMENSION_KEYS } from "@/lib/profile/score-view-model";

const tolerance = SCORING_V7_RECEIPT_RULES.numericTolerance;

describe("v7 explanation reads the receipt's own arithmetic", () => {
  it("sums the four contributions to the published composite exactly", async () => {
    // activeIsoWeeks cannot exceed 54, which the receipt itself enforces.
    for (const n of [0, 1, 4, 9, 40, 54]) {
      const snapshot = buildReceiptSnapshotV7(await receiptFixtureV7("2026-09-01", n), null);
      const explanation = explainReceipt(snapshot);

      expect(explanationReconciles(explanation, snapshot)).toBe(true);
      const summed = explanation.dimensions.reduce((total, row) => total + row.contribution.lower, 0);
      expect(Math.abs(summed - snapshot.receipt.receipt.calculation.core.composite.lower)).toBeLessThanOrEqual(tolerance);
    }
  });

  it("explains each dimension from its own steps, not a rebuilt formula", async () => {
    const snapshot = buildReceiptSnapshotV7(await receiptFixtureV7("2026-09-01", 9), null);
    const explanation = explainReceipt(snapshot);
    const trace = snapshot.receipt.receipt.calculation.core;

    expect(explanation.dimensions.map(row => row.key)).toEqual([...CORE_DIMENSION_KEYS]);
    expect(explanation.dimensions.find(row => row.key === "quality")!.steps.map(row => row.label))
      .toEqual(["rationale", "verification", "review_or_correction", "outcome_followup"]);
    expect(explanation.dimensions.find(row => row.key === "breadth")!.steps.map(row => row.label))
      .toEqual(["eligible_projects", "eligible_categories"]);
    expect(explanation.dimensions.find(row => row.key === "delivery")!.steps[0]!.step)
      .toEqual({ observed: trace.delivery.input, cap: trace.delivery.cap, normalized: trace.delivery.normalized, weighted: trace.delivery.weighted });
  });

  it("shows the receipt's caps rather than restating the policy constants", async () => {
    const snapshot = buildReceiptSnapshotV7(await receiptFixtureV7("2026-09-01", 4), null);
    const explanation = explainReceipt(snapshot);
    const caps = Object.fromEntries(
      explanation.dimensions.map(row => [row.key, row.steps.map(entry => entry.step.cap)]),
    );

    expect(caps).toEqual({ delivery: [120], quality: [12, 12, 12, 12], consistency: [40], breadth: [4, 4] });
  });

  it("keeps a range a range and refuses a point tier for a straddling interval", async () => {
    const snapshot = buildReceiptSnapshotV7(await receiptFixtureV7("2026-09-01", 4, undefined, true), null);
    const explanation = explainReceipt(snapshot);

    expect(explanation.displayedComposite.kind).toBe("range");
    const delivery = explanation.dimensions.find(row => row.key === "delivery")!;
    expect(delivery.displayed.kind).toBe("range");
    expect(delivery.dimension.lower).toBeLessThan(delivery.dimension.upper);
    expect(explanation.tier).toBe(snapshot.receipt.receipt.core.tier);
    expect(explanationReconciles(explanation, snapshot)).toBe(true);
  });

  it("reports no Craft channel without touching the core or drawing a zero axis", async () => {
    const snapshot = buildReceiptSnapshotV7(await receiptFixtureV7("2026-09-01", 9), null);
    const explanation = explainReceipt(snapshot);

    expect(explanation.craft).toBeNull();
    expect(explanation.dimensions.map(row => row.key)).not.toContain("craft");
    expect(explanation.composite).toEqual(snapshot.receipt.receipt.calculation.core.composite);
  });

  it("carries coverage and limitations so unknown evidence is visible, not scored as zero", async () => {
    const snapshot = buildReceiptSnapshotV7(await receiptFixtureV7("2026-09-01", 0), null);
    const explanation = explainReceipt(snapshot);

    expect(explanation.coverage).toEqual(snapshot.receipt.receipt.coverage);
    expect(explanation.limitations).toEqual(snapshot.receipt.receipt.limitations);
    // A zero-evidence profile is a truthful zero point, not an unknown.
    expect(explanation.displayedComposite).toEqual({ kind: "point", value: 0, display: 0 });
  });

  it("detects an explanation that disagrees with the artifact it explains", async () => {
    const snapshot = buildReceiptSnapshotV7(await receiptFixtureV7("2026-09-01", 9), null);
    const explanation = explainReceipt(snapshot);
    const tampered = {
      ...explanation,
      composite: { lower: explanation.composite.lower + 1, upper: explanation.composite.upper + 1 },
    };

    expect(explanationReconciles(tampered, snapshot)).toBe(false);
  });
});
