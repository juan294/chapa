import { describe, expect, it } from "vitest";
import { buildReceiptSnapshotV7 } from "@/lib/history/snapshot";
import { receiptFixtureV7 } from "@/lib/history/__fixtures__/receipts-v7";
import { legacyViewModel, receiptViewModel, type ScoreViewModel } from "@/lib/profile/score-view-model";
import { describeScoringEvidence } from "./scoring-evidence-label";
import type { ImpactV6Result } from "@chapa/shared";

const legacy: ImpactV6Result = {
  handle: "alice", profileType: "collaborative",
  dimensions: { delivery: 70, quality: 60, consistency: 50, breadth: 40 },
  archetype: "Builder", compositeScore: 55, confidence: 90, confidencePenalties: [],
  adjustedComposite: 55, tier: "Solid", computedAt: "2026-09-01T12:00:00.000Z",
};

describe("badge accessible evidence description", () => {
  it("says nothing when there is no receipt to describe", () => {
    expect(describeScoringEvidence(undefined)).toBe("");
  });

  it("labels a v6 aggregate as legacy rather than describing v7 evidence", () => {
    expect(describeScoringEvidence(legacyViewModel(legacy))).toBe(" Legacy v6 aggregate score.");
  });

  it("states complete evidence and an absent Craft portfolio explicitly", async () => {
    const model = receiptViewModel("alice", buildReceiptSnapshotV7(await receiptFixtureV7("2026-09-01", 9), null));
    const description = describeScoringEvidence(model);

    expect(description).toContain("every value is an exact point");
    expect(description).toContain("No Craft practice portfolio observed");
    expect(description).toContain("does not lower it");
  });

  it("names which values are ranges instead of implying a point", async () => {
    const model = receiptViewModel("alice", buildReceiptSnapshotV7(await receiptFixtureV7("2026-09-01", 4, undefined, true), null));
    const description = describeScoringEvidence(model);

    expect(description).toContain("Evidence-completion range shown for delivery, composite");
    expect(description).not.toContain("every value is an exact point");
  });

  it("counts incomplete sources and disclosed exclusions", async () => {
    const base = receiptViewModel("alice", buildReceiptSnapshotV7(await receiptFixtureV7("2026-09-01", 9), null));
    const model: ScoreViewModel = {
      ...base,
      coverage: [
        { sourceRef: "source-1", provider: "github", status: "complete", dataThrough: null, discovery: "owned_and_contributed", accessibleRepositoryCount: 3, repositoryDiscoveryComplete: true, reasonCodes: [], unknownPeriods: [] },
        { sourceRef: "source-2", provider: "gitlab", status: "partial", dataThrough: null, discovery: "owned_and_contributed", accessibleRepositoryCount: 1, repositoryDiscoveryComplete: false, reasonCodes: ["pagination_incomplete"], unknownPeriods: [] },
      ],
      exclusions: [{ provider: "bitbucket", reason: "not_connected" }],
    };

    const description = describeScoringEvidence(model);
    expect(description).toContain("1 of 2 sources incomplete.");
    expect(description).toContain("1 sources excluded and disclosed.");
  });
});
