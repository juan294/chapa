import { describe, expect, it } from "vitest";
import { makeImpact, makeStats } from "@/lib/test-helpers/fixtures";
import {
  buildScoreExplanation,
  getDimensionFormulaKey,
} from "./score-explanation";

describe("getDimensionFormulaKey", () => {
  it("selects collaborative and solo Quality formulas from composite membership", () => {
    expect(
      getDimensionFormulaKey({ key: "quality", countsTowardComposite: true }),
    ).toBe("scoreExplanation.dimensions.qualityCollaborativeFormula");
    expect(
      getDimensionFormulaKey({ key: "quality", countsTowardComposite: false }),
    ).toBe("scoreExplanation.dimensions.qualitySoloFormula");
  });

  it("selects the standard formula for other dimensions", () => {
    expect(
      getDimensionFormulaKey({ key: "craft", countsTowardComposite: true }),
    ).toBe("scoreExplanation.dimensions.craftFormula");
  });
});

describe("buildScoreExplanation", () => {
  it("builds a solo mdburgos-like explanation with Quality shown but excluded", () => {
    const explanation = buildScoreExplanation(
      makeImpact({
        profileType: "solo",
        dimensions: {
          delivery: 98,
          quality: 5,
          consistency: 40,
          breadth: 3,
        },
        compositeScore: 47,
        adjustedComposite: 46,
        tier: "Solid",
        confidence: 95,
        confidencePenalties: [
          {
            flag: "single_repo_concentration",
            penalty: 5,
            reason: "Most activity is concentrated in one repo.",
          },
          {
            flag: "platform_linked",
            penalty: 0,
            reason: "Includes verified data from a linked platform account.",
          },
        ],
      }),
      makeStats({
        handle: "mdburgos",
        linkedPlatforms: ["gitlab"],
        linkedPlatformLogins: { gitlab: "mdburgos" },
        prDescriptionRate: undefined,
        featureBranchRate: undefined,
        issueLinkageRate: undefined,
        batchSizeScore: undefined,
      }),
    );

    expect(explanation.composite).toMatchObject({
      score: 47,
      adjusted: 46,
      tier: "Solid",
      activeDimensionKeys: ["delivery", "consistency", "breadth"],
      soloQualityExcluded: true,
    });
    expect(explanation.dimensions.find((d) => d.key === "quality")).toMatchObject({
      score: 5,
      countsTowardComposite: false,
    });
    expect(explanation.dataSources.map((source) => source.platform)).toEqual([
      "github",
      "gitlab",
    ]);
    expect(explanation.dataSources[1]).toMatchObject({
      platform: "gitlab",
      login: "mdburgos",
      providesQualitySignals: false,
    });
    expect(explanation.dataSources[1]!.missingSignalKeys).toEqual(
      expect.arrayContaining(["prDescription", "featureBranch", "issueLinkage"]),
    );
    // GitHub (primary) here has no quality data (empty account): those signals
    // must NOT be listed as "not available on this platform" — GitHub can provide
    // them, there is just no data. They are omitted from both lists.
    expect(explanation.dataSources[0]!.platform).toBe("github");
    expect(explanation.dataSources[0]!.missingSignalKeys).not.toEqual(
      expect.arrayContaining(["prDescription", "featureBranch", "issueLinkage"]),
    );
    expect(explanation.dataSources[0]!.providedSignalKeys).not.toEqual(
      expect.arrayContaining(["prDescription", "featureBranch", "issueLinkage"]),
    );
    expect(explanation.confidence.value).toBe(95);
    expect(explanation.confidence.penalties).toEqual([
      { flag: "single_repo_concentration", penalty: 5 },
      { flag: "platform_linked", penalty: 0 },
    ]);
  });

  it("includes collaborative GitHub Quality in the composite and reports present quality signals", () => {
    const explanation = buildScoreExplanation(
      makeImpact({
        profileType: "collaborative",
        dimensions: {
          delivery: 80,
          quality: 70,
          consistency: 60,
          breadth: 50,
        },
        confidencePenalties: [],
      }),
      makeStats({
        prDescriptionRate: 0.9,
        featureBranchRate: 0.8,
        issueLinkageRate: 0.7,
        batchSizeScore: 0.6,
      }),
    );

    expect(explanation.composite.activeDimensionKeys).toEqual([
      "delivery",
      "quality",
      "consistency",
      "breadth",
    ]);
    expect(explanation.dimensions.find((d) => d.key === "quality")).toMatchObject({
      countsTowardComposite: true,
    });
    expect(explanation.dataSources[0]).toMatchObject({
      platform: "github",
      login: "testuser",
      providesQualitySignals: true,
    });
    expect(explanation.dataSources[0]!.providedSignalKeys).toEqual(
      expect.arrayContaining(["prDescription", "featureBranch", "issueLinkage"]),
    );
    expect(explanation.dataSources[0]!.missingSignalKeys).not.toEqual(
      expect.arrayContaining(["prDescription", "featureBranch", "issueLinkage"]),
    );
  });

  it("includes Craft when the profile has a Craft dimension", () => {
    const explanation = buildScoreExplanation(
      makeImpact({
        profileType: "collaborative",
        dimensions: {
          delivery: 80,
          quality: 70,
          consistency: 60,
          breadth: 50,
          craft: 90,
        },
      }),
      makeStats(),
    );

    expect(explanation.composite.activeDimensionKeys).toEqual([
      "delivery",
      "quality",
      "consistency",
      "breadth",
      "craft",
    ]);
    expect(explanation.dimensions.map((d) => d.key)).toEqual([
      "delivery",
      "quality",
      "consistency",
      "breadth",
      "craft",
    ]);
  });

  it("treats missing confidence penalties as no penalties", () => {
    const impact = makeImpact({ confidence: 88 });
    delete (impact as Partial<typeof impact>).confidencePenalties;

    const explanation = buildScoreExplanation(impact, makeStats());

    expect(explanation.confidence).toEqual({
      value: 88,
      penalties: [],
    });
  });
});
