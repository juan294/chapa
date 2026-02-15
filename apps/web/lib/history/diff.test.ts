import { describe, expect, it } from "vitest";
import { compareSnapshots, explainDiff } from "./diff";
import { makeSnapshot } from "../test-helpers/fixtures";

// ---------------------------------------------------------------------------
// compareSnapshots
// ---------------------------------------------------------------------------

describe("compareSnapshots", () => {
  it("detects improving direction when adjustedComposite increases by >2", () => {
    const prev = makeSnapshot({ adjustedComposite: 50, date: "2025-06-14" });
    const curr = makeSnapshot({ adjustedComposite: 55, date: "2025-06-15" });
    const diff = compareSnapshots(prev, curr);

    expect(diff.direction).toBe("improving");
    expect(diff.adjustedComposite).toBe(5);
  });

  it("detects declining direction when adjustedComposite decreases by >2", () => {
    const prev = makeSnapshot({ adjustedComposite: 55, date: "2025-06-14" });
    const curr = makeSnapshot({ adjustedComposite: 50, date: "2025-06-15" });
    const diff = compareSnapshots(prev, curr);

    expect(diff.direction).toBe("declining");
    expect(diff.adjustedComposite).toBe(-5);
  });

  it("detects stable direction when adjustedComposite changes by <=2", () => {
    const prev = makeSnapshot({ adjustedComposite: 50, date: "2025-06-14" });
    const curr = makeSnapshot({ adjustedComposite: 51.5, date: "2025-06-15" });
    const diff = compareSnapshots(prev, curr);

    expect(diff.direction).toBe("stable");
  });

  it("computes deltas for compositeScore and confidence", () => {
    const prev = makeSnapshot({
      compositeScore: 60,
      confidence: 85,
      date: "2025-06-14",
    });
    const curr = makeSnapshot({
      compositeScore: 70,
      confidence: 90,
      date: "2025-06-15",
    });
    const diff = compareSnapshots(prev, curr);

    expect(diff.compositeScore).toBe(10);
    expect(diff.confidence).toBe(5);
  });

  it("computes per-dimension deltas", () => {
    const prev = makeSnapshot({
      building: 70,
      guarding: 50,
      consistency: 80,
      breadth: 40,
      date: "2025-06-14",
    });
    const curr = makeSnapshot({
      building: 75,
      guarding: 55,
      consistency: 70,
      breadth: 60,
      date: "2025-06-15",
    });
    const diff = compareSnapshots(prev, curr);

    expect(diff.dimensions.building).toBe(5);
    expect(diff.dimensions.guarding).toBe(5);
    expect(diff.dimensions.consistency).toBe(-10);
    expect(diff.dimensions.breadth).toBe(20);
  });

  it("computes stats deltas", () => {
    const prev = makeSnapshot({ commitsTotal: 100, activeDays: 150, date: "2025-06-14" });
    const curr = makeSnapshot({ commitsTotal: 160, activeDays: 200, date: "2025-06-15" });
    const diff = compareSnapshots(prev, curr);

    expect(diff.stats.commitsTotal).toBe(60);
    expect(diff.stats.activeDays).toBe(50);
  });

  it("detects archetype change", () => {
    const prev = makeSnapshot({ archetype: "Builder", date: "2025-06-14" });
    const curr = makeSnapshot({ archetype: "Polymath", date: "2025-06-15" });
    const diff = compareSnapshots(prev, curr);

    expect(diff.archetype).toEqual({ from: "Builder", to: "Polymath" });
  });

  it("returns null archetype when unchanged", () => {
    const prev = makeSnapshot({ archetype: "Builder", date: "2025-06-14" });
    const curr = makeSnapshot({ archetype: "Builder", date: "2025-06-15" });
    const diff = compareSnapshots(prev, curr);

    expect(diff.archetype).toBeNull();
  });

  it("detects tier change", () => {
    const prev = makeSnapshot({ tier: "Solid", date: "2025-06-14" });
    const curr = makeSnapshot({ tier: "High", date: "2025-06-15" });
    const diff = compareSnapshots(prev, curr);

    expect(diff.tier).toEqual({ from: "Solid", to: "High" });
  });

  it("returns null tier when unchanged", () => {
    const prev = makeSnapshot({ tier: "High", date: "2025-06-14" });
    const curr = makeSnapshot({ tier: "High", date: "2025-06-15" });
    const diff = compareSnapshots(prev, curr);

    expect(diff.tier).toBeNull();
  });

  it("detects profileType change", () => {
    const prev = makeSnapshot({ profileType: "solo", date: "2025-06-14" });
    const curr = makeSnapshot({ profileType: "collaborative", date: "2025-06-15" });
    const diff = compareSnapshots(prev, curr);

    expect(diff.profileType).toEqual({ from: "solo", to: "collaborative" });
  });

  it("computes daysBetween correctly", () => {
    const prev = makeSnapshot({ date: "2025-06-10" });
    const curr = makeSnapshot({ date: "2025-06-15" });
    const diff = compareSnapshots(prev, curr);

    expect(diff.daysBetween).toBe(5);
  });

  it("detects penalty additions", () => {
    const prev = makeSnapshot({
      confidencePenalties: [],
      date: "2025-06-14",
    });
    const curr = makeSnapshot({
      confidencePenalties: [{ flag: "burst_activity", penalty: 15 }],
      date: "2025-06-15",
    });
    const diff = compareSnapshots(prev, curr);

    expect(diff.penaltyChanges).not.toBeNull();
    expect(diff.penaltyChanges!.added).toEqual(["burst_activity"]);
    expect(diff.penaltyChanges!.removed).toEqual([]);
  });

  it("detects penalty removals", () => {
    const prev = makeSnapshot({
      confidencePenalties: [
        { flag: "burst_activity", penalty: 15 },
        { flag: "micro_commit_pattern", penalty: 10 },
      ],
      date: "2025-06-14",
    });
    const curr = makeSnapshot({
      confidencePenalties: [{ flag: "burst_activity", penalty: 15 }],
      date: "2025-06-15",
    });
    const diff = compareSnapshots(prev, curr);

    expect(diff.penaltyChanges!.added).toEqual([]);
    expect(diff.penaltyChanges!.removed).toEqual(["micro_commit_pattern"]);
  });

  it("returns null penaltyChanges when old snapshot lacks penalty data", () => {
    const prev = makeSnapshot({ date: "2025-06-14" });
    // Simulate old snapshot without penalty field
    delete (prev as unknown as Record<string, unknown>).confidencePenalties;

    const curr = makeSnapshot({
      confidencePenalties: [{ flag: "burst_activity", penalty: 15 }],
      date: "2025-06-15",
    });
    const diff = compareSnapshots(prev, curr);

    expect(diff.penaltyChanges).toBeNull();
  });

  it("is a pure function — does not mutate inputs", () => {
    const prev = makeSnapshot({ date: "2025-06-14" });
    const curr = makeSnapshot({ date: "2025-06-15" });
    const prevCopy = JSON.parse(JSON.stringify(prev));
    const currCopy = JSON.parse(JSON.stringify(curr));

    compareSnapshots(prev, curr);

    expect(prev).toEqual(prevCopy);
    expect(curr).toEqual(currCopy);
  });
});

// ---------------------------------------------------------------------------
// explainDiff
// ---------------------------------------------------------------------------

describe("explainDiff", () => {
  it("produces explanation for improving score with dimension changes", () => {
    const prev = makeSnapshot({
      adjustedComposite: 50,
      building: 60,
      consistency: 70,
      date: "2025-06-14",
    });
    const curr = makeSnapshot({
      adjustedComposite: 65,
      building: 80,
      consistency: 85,
      date: "2025-06-15",
    });
    const diff = compareSnapshots(prev, curr);
    const explanations = explainDiff(diff);

    expect(explanations.length).toBeGreaterThan(0);
    expect(explanations.some((e) => e.includes("improving"))).toBe(true);
  });

  it("mentions tier change when present", () => {
    const prev = makeSnapshot({
      adjustedComposite: 50,
      tier: "Solid",
      date: "2025-06-14",
    });
    const curr = makeSnapshot({
      adjustedComposite: 75,
      tier: "High",
      date: "2025-06-15",
    });
    const diff = compareSnapshots(prev, curr);
    const explanations = explainDiff(diff);

    expect(explanations.some((e) => e.includes("Solid") && e.includes("High"))).toBe(true);
  });

  it("mentions archetype change when present", () => {
    const prev = makeSnapshot({
      archetype: "Builder",
      adjustedComposite: 50,
      date: "2025-06-14",
    });
    const curr = makeSnapshot({
      archetype: "Polymath",
      adjustedComposite: 50,
      date: "2025-06-15",
    });
    const diff = compareSnapshots(prev, curr);
    const explanations = explainDiff(diff);

    expect(explanations.some((e) => e.includes("Builder") && e.includes("Polymath"))).toBe(true);
  });

  it("mentions penalty additions", () => {
    const prev = makeSnapshot({
      adjustedComposite: 55,
      confidencePenalties: [],
      date: "2025-06-14",
    });
    const curr = makeSnapshot({
      adjustedComposite: 50,
      confidencePenalties: [{ flag: "burst_activity", penalty: 15 }],
      date: "2025-06-15",
    });
    const diff = compareSnapshots(prev, curr);
    const explanations = explainDiff(diff);

    expect(explanations.some((e) => e.includes("burst_activity"))).toBe(true);
  });

  it("returns stable message when nothing changed", () => {
    const prev = makeSnapshot({ date: "2025-06-14" });
    const curr = makeSnapshot({ date: "2025-06-15" });
    const diff = compareSnapshots(prev, curr);
    const explanations = explainDiff(diff);

    expect(explanations.some((e) => e.toLowerCase().includes("stable"))).toBe(true);
  });

  it("highlights significant dimension changes (>=5 points)", () => {
    const prev = makeSnapshot({
      adjustedComposite: 50,
      building: 70,
      guarding: 60,
      consistency: 80,
      breadth: 40,
      date: "2025-06-14",
    });
    const curr = makeSnapshot({
      adjustedComposite: 55,
      building: 80,
      guarding: 62,
      consistency: 70,
      breadth: 50,
      date: "2025-06-15",
    });
    const diff = compareSnapshots(prev, curr);
    const explanations = explainDiff(diff);

    // Building +10 and Consistency -10 should be mentioned, Guarding +2 should not
    expect(explanations.some((e) => e.includes("Building"))).toBe(true);
    expect(explanations.some((e) => e.includes("Consistency"))).toBe(true);
  });
});
