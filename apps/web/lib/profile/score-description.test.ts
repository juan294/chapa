import { describe, expect, it } from "vitest";
import type { ImpactV6Result } from "@chapa/shared";
import { buildReceiptSnapshotV7 } from "@/lib/history/snapshot";
import { receiptFixtureV7 } from "@/lib/history/__fixtures__/receipts-v7";
import { legacyViewModel, receiptViewModel } from "./score-view-model";
import { describeScoreForMetadata } from "./score-description";

const legacy: ImpactV6Result = {
  handle: "alice", profileType: "collaborative",
  dimensions: { delivery: 70, quality: 68, consistency: 74, breadth: 66 },
  archetype: "Builder", compositeScore: 73, confidence: 88, confidencePenalties: [],
  adjustedComposite: 65, tier: "Solid", computedAt: "2026-04-17T12:00:00.000Z",
};

describe("describeScoreForMetadata", () => {
  it("describes nothing when there is no model", () => {
    expect(describeScoreForMetadata(null)).toBeNull();
  });

  it("keeps the legacy sentence for a v6 aggregate", () => {
    expect(describeScoreForMetadata(legacyViewModel(legacy)))
      .toBe("Developer with a Chapa Impact Score of 65 (Solid tier).");
  });

  it("names a v7 range as a range, never as a point", async () => {
    const snapshot = buildReceiptSnapshotV7(await receiptFixtureV7("2026-09-01", 9, undefined, true), null);
    const model = receiptViewModel("alice", snapshot);
    expect(model.composite.kind).toBe("range");

    const description = describeScoreForMetadata(model)!;

    const composite = model.composite as { displayLower: number; displayUpper: number };
    expect(description).toContain(`${composite.displayLower}–${composite.displayUpper}`);
    expect(description).toContain("evidence range");
    // The failure this guards: a single number quoted into a search index.
    expect(description).not.toMatch(/Impact Score of \d+/);
  });

  it("claims no tier when the range earned none", async () => {
    const snapshot = buildReceiptSnapshotV7(await receiptFixtureV7("2026-09-01", 9, undefined, true), null);
    const model = { ...receiptViewModel("alice", snapshot), tier: null };

    const description = describeScoreForMetadata(model)!;

    expect(description).not.toContain("tier");
  });
});
