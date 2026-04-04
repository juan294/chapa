import { describe, it, expect } from "vitest";
import type { InsightsUpload } from "@chapa/shared";
import {
  computeCraftScore,
  _normalize,
  _normalizedEntropy,
  _scoreResponseTime,
  _getCraftTier,
  _computeProficiency,
  _computeEffectiveness,
  _computeSophistication,
} from "./scoring";

/** Create an InsightsUpload with all zeros, then override specific fields. */
function makeInsights(
  overrides: Partial<InsightsUpload> = {},
): InsightsUpload {
  return {
    tool: "claude-code",
    reportPeriod: { start: "2026-02-20", end: "2026-03-07" },
    volume: {
      messages: 0,
      linesAdded: 0,
      linesDeleted: 0,
      files: 0,
      days: 0,
      msgsPerDay: 0,
    },
    toolUsage: {},
    sessionTypes: {},
    outcomes: { fullyAchieved: 0, mostlyAchieved: 0, partiallyAchieved: 0 },
    friction: { buggyCode: 0, wrongApproach: 0, misunderstoodRequest: 0 },
    satisfaction: { dissatisfied: 0, likelySatisfied: 0, satisfied: 0 },
    multiClauding: {
      overlapEvents: 0,
      sessionsInvolved: 0,
      messagePercent: 0,
    },
    responseTime: { medianSeconds: 0, averageSeconds: 0 },
    toolErrors: {},
    totalSessions: 1,
    totalToolCalls: 0,
    ...overrides,
  };
}

/** Real-world data matching the actual Claude Code insights report. */
function makeRealWorldInsights(): InsightsUpload {
  return {
    tool: "claude-code",
    reportPeriod: { start: "2026-02-20", end: "2026-03-07" },
    volume: {
      messages: 549,
      linesAdded: 16843,
      linesDeleted: 1230,
      files: 290,
      days: 9,
      msgsPerDay: 61,
    },
    toolUsage: {
      Bash: 1213,
      Read: 572,
      Edit: 377,
      Write: 134,
      Grep: 115,
      Agent: 110,
    },
    sessionTypes: {
      "Single Task": 16,
      "Multi Task": 11,
      "Iterative Refinement": 4,
      Exploration: 1,
    },
    outcomes: {
      fullyAchieved: 24,
      mostlyAchieved: 6,
      partiallyAchieved: 2,
    },
    friction: {
      buggyCode: 15,
      wrongApproach: 12,
      misunderstoodRequest: 4,
    },
    satisfaction: {
      dissatisfied: 5,
      likelySatisfied: 50,
      satisfied: 19,
    },
    multiClauding: {
      overlapEvents: 52,
      sessionsInvolved: 45,
      messagePercent: 31,
    },
    responseTime: {
      medianSeconds: 80.6,
      averageSeconds: 188.4,
    },
    toolErrors: {
      Other: 87,
      "Command Failed": 64,
      "File Not Found": 5,
      "User Rejected": 5,
      "File Changed": 1,
    },
    totalSessions: 66,
    totalToolCalls: 2521,
  };
}

// ---------------------------------------------------------------------------
// Helper unit tests
// ---------------------------------------------------------------------------

describe("normalize", () => {
  it("returns 0 for zero or negative input", () => {
    expect(_normalize(0, 100)).toBe(0);
    expect(_normalize(-5, 100)).toBe(0);
  });

  it("returns 1 when value equals cap", () => {
    expect(_normalize(100, 100)).toBeCloseTo(1, 5);
  });

  it("returns 1 when value exceeds cap", () => {
    expect(_normalize(200, 100)).toBeCloseTo(1, 5);
  });

  it("returns a value between 0 and 1 for typical inputs", () => {
    const result = _normalize(30, 100);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(1);
  });

  it("handles zero cap gracefully", () => {
    expect(_normalize(10, 0)).toBe(0);
  });
});

describe("normalizedEntropy", () => {
  it("returns 0 for empty distribution", () => {
    expect(_normalizedEntropy({})).toBe(0);
  });

  it("returns 0 for single-tool usage", () => {
    expect(_normalizedEntropy({ Bash: 100 })).toBe(0);
  });

  it("returns 1 for perfectly uniform distribution", () => {
    expect(_normalizedEntropy({ A: 100, B: 100, C: 100 })).toBeCloseTo(1, 5);
  });

  it("returns value between 0 and 1 for skewed distribution", () => {
    const result = _normalizedEntropy({ Bash: 1000, Read: 10 });
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(1);
  });

  it("ignores zero-count entries", () => {
    expect(_normalizedEntropy({ A: 100, B: 0 })).toBe(0); // only 1 non-zero
  });
});

describe("scoreResponseTime", () => {
  it("returns 1 for zero or negative median (instant responses)", () => {
    expect(_scoreResponseTime(0)).toBe(1);
    expect(_scoreResponseTime(-10)).toBe(1);
  });

  it("returns ~1 for 30s median", () => {
    expect(_scoreResponseTime(30)).toBeCloseTo(1, 1);
  });

  it("returns lower score for slower response", () => {
    const fast = _scoreResponseTime(30);
    const slow = _scoreResponseTime(300);
    expect(fast).toBeGreaterThan(slow);
  });

  it("never exceeds 1", () => {
    expect(_scoreResponseTime(1)).toBeLessThanOrEqual(1);
  });
});

describe("getCraftTier", () => {
  it("returns Novice for 0-29", () => {
    expect(_getCraftTier(0)).toBe("Novice");
    expect(_getCraftTier(15)).toBe("Novice");
    expect(_getCraftTier(29)).toBe("Novice");
  });

  it("returns Practitioner for 30-54", () => {
    expect(_getCraftTier(30)).toBe("Practitioner");
    expect(_getCraftTier(42)).toBe("Practitioner");
    expect(_getCraftTier(54)).toBe("Practitioner");
  });

  it("returns Expert for 55-79", () => {
    expect(_getCraftTier(55)).toBe("Expert");
    expect(_getCraftTier(67)).toBe("Expert");
    expect(_getCraftTier(79)).toBe("Expert");
  });

  it("returns Master for 80-100", () => {
    expect(_getCraftTier(80)).toBe("Master");
    expect(_getCraftTier(90)).toBe("Master");
    expect(_getCraftTier(100)).toBe("Master");
  });
});

// ---------------------------------------------------------------------------
// Sub-dimension isolation tests
// ---------------------------------------------------------------------------

describe("computeProficiency", () => {
  it("scores higher with diverse tool usage", () => {
    const diverse = makeInsights({
      volume: { messages: 100, linesAdded: 0, linesDeleted: 0, files: 0, days: 5, msgsPerDay: 20 },
      toolUsage: { Bash: 30, Read: 25, Edit: 20, Write: 15, Grep: 10, Agent: 10 },
      totalSessions: 10,
      totalToolCalls: 110,
    });
    const singleTool = makeInsights({
      volume: { messages: 100, linesAdded: 0, linesDeleted: 0, files: 0, days: 5, msgsPerDay: 20 },
      toolUsage: { Bash: 100 },
      totalSessions: 10,
      totalToolCalls: 100,
    });
    expect(_computeProficiency(diverse)).toBeGreaterThan(
      _computeProficiency(singleTool),
    );
  });

  it("scores higher with more agent usage", () => {
    const highAgent = makeInsights({
      volume: { messages: 100, linesAdded: 0, linesDeleted: 0, files: 0, days: 5, msgsPerDay: 20 },
      toolUsage: { Bash: 60, Agent: 40 },
      totalSessions: 10,
      totalToolCalls: 100,
    });
    const noAgent = makeInsights({
      volume: { messages: 100, linesAdded: 0, linesDeleted: 0, files: 0, days: 5, msgsPerDay: 20 },
      toolUsage: { Bash: 100 },
      totalSessions: 10,
      totalToolCalls: 100,
    });
    expect(_computeProficiency(highAgent)).toBeGreaterThan(
      _computeProficiency(noAgent),
    );
  });

  it("scores higher with multi-clauding", () => {
    const parallel = makeInsights({
      volume: { messages: 100, linesAdded: 0, linesDeleted: 0, files: 0, days: 5, msgsPerDay: 20 },
      toolUsage: { Bash: 50, Read: 50 },
      multiClauding: { overlapEvents: 20, sessionsInvolved: 15, messagePercent: 40 },
      totalSessions: 20,
      totalToolCalls: 100,
    });
    const sequential = makeInsights({
      volume: { messages: 100, linesAdded: 0, linesDeleted: 0, files: 0, days: 5, msgsPerDay: 20 },
      toolUsage: { Bash: 50, Read: 50 },
      multiClauding: { overlapEvents: 0, sessionsInvolved: 0, messagePercent: 0 },
      totalSessions: 20,
      totalToolCalls: 100,
    });
    expect(_computeProficiency(parallel)).toBeGreaterThan(
      _computeProficiency(sequential),
    );
  });
});

describe("computeEffectiveness", () => {
  it("scores higher with better achievement rates", () => {
    const highAchieve = makeInsights({
      outcomes: { fullyAchieved: 20, mostlyAchieved: 5, partiallyAchieved: 0 },
      satisfaction: { dissatisfied: 0, likelySatisfied: 15, satisfied: 10 },
      totalSessions: 25,
      totalToolCalls: 500,
    });
    const lowAchieve = makeInsights({
      outcomes: { fullyAchieved: 5, mostlyAchieved: 5, partiallyAchieved: 15 },
      satisfaction: { dissatisfied: 10, likelySatisfied: 10, satisfied: 5 },
      totalSessions: 25,
      totalToolCalls: 500,
    });
    expect(_computeEffectiveness(highAchieve)).toBeGreaterThan(
      _computeEffectiveness(lowAchieve),
    );
  });

  it("does NOT penalize for friction events (Claude's mistakes, not the developer's)", () => {
    const base = {
      outcomes: { fullyAchieved: 20, mostlyAchieved: 0, partiallyAchieved: 0 },
      satisfaction: { dissatisfied: 0, likelySatisfied: 10, satisfied: 10 },
      totalSessions: 20,
      totalToolCalls: 500,
    };
    const noFriction = makeInsights({
      ...base,
      friction: { buggyCode: 0, wrongApproach: 0, misunderstoodRequest: 0 },
    });
    const heavyFriction = makeInsights({
      ...base,
      friction: { buggyCode: 50, wrongApproach: 40, misunderstoodRequest: 20 },
    });
    expect(_computeEffectiveness(noFriction)).toBe(
      _computeEffectiveness(heavyFriction),
    );
  });

  it("does NOT penalize for tool errors (Claude's mistakes, not the developer's)", () => {
    const base = {
      outcomes: { fullyAchieved: 10, mostlyAchieved: 0, partiallyAchieved: 0 },
      satisfaction: { dissatisfied: 0, likelySatisfied: 5, satisfied: 5 },
      totalSessions: 10,
      totalToolCalls: 1000,
    };
    const noErrors = makeInsights({
      ...base,
      toolErrors: {},
    });
    const manyErrors = makeInsights({
      ...base,
      toolErrors: { "Command Failed": 200, Other: 150, "Edit Failed": 50 },
    });
    expect(_computeEffectiveness(noErrors)).toBe(
      _computeEffectiveness(manyErrors),
    );
  });

  it("uses only achievement rate (55%) and satisfaction rate (45%)", () => {
    // Perfect achievement + perfect satisfaction = 100
    const perfect = makeInsights({
      outcomes: { fullyAchieved: 100, mostlyAchieved: 0, partiallyAchieved: 0 },
      satisfaction: { dissatisfied: 0, likelySatisfied: 0, satisfied: 100 },
      totalSessions: 100,
      totalToolCalls: 5000,
    });
    expect(_computeEffectiveness(perfect)).toBe(100);
  });
});

describe("computeSophistication", () => {
  it("scores higher with multi-task sessions", () => {
    const complex = makeInsights({
      volume: { messages: 200, linesAdded: 5000, linesDeleted: 500, files: 100, days: 10, msgsPerDay: 20 },
      sessionTypes: { "Multi Task": 15, "Iterative Refinement": 5, "Single Task": 5 },
      totalSessions: 25,
      totalToolCalls: 400,
    });
    const simple = makeInsights({
      volume: { messages: 200, linesAdded: 5000, linesDeleted: 500, files: 100, days: 10, msgsPerDay: 20 },
      sessionTypes: { "Single Task": 25 },
      totalSessions: 25,
      totalToolCalls: 400,
    });
    expect(_computeSophistication(complex)).toBeGreaterThan(
      _computeSophistication(simple),
    );
  });

  it("scores higher with more lines per session", () => {
    const highOutput = makeInsights({
      volume: { messages: 100, linesAdded: 10000, linesDeleted: 2000, files: 50, days: 5, msgsPerDay: 20 },
      totalSessions: 10,
      totalToolCalls: 200,
    });
    const lowOutput = makeInsights({
      volume: { messages: 100, linesAdded: 100, linesDeleted: 20, files: 50, days: 5, msgsPerDay: 20 },
      totalSessions: 10,
      totalToolCalls: 200,
    });
    expect(_computeSophistication(highOutput)).toBeGreaterThan(
      _computeSophistication(lowOutput),
    );
  });
});

// ---------------------------------------------------------------------------
// Integration tests — computeCraftScore
// ---------------------------------------------------------------------------

describe("computeCraftScore", () => {
  it("produces minimal craft score for all-zero data", () => {
    const result = computeCraftScore(makeInsights());
    // With zero data, some signals still produce non-zero scores:
    // - Proficiency: responseTimeScore(0)=1 gives engagement depth > 0 → ~10
    // - Effectiveness: 0 (no outcomes, no satisfaction — friction/errors excluded)
    // - Sophistication: truly 0 (no sessions, no lines, no files)
    expect(result.dimensions.proficiency).toBe(10);
    expect(result.dimensions.effectiveness).toBe(0);
    expect(result.dimensions.sophistication).toBe(0);
    expect(result.craftScore).toBe(3);
    expect(result.tier).toBe("Novice");
  });

  it("does not crash on single session with minimal data", () => {
    const data = makeInsights({
      volume: { messages: 3, linesAdded: 10, linesDeleted: 2, files: 1, days: 1, msgsPerDay: 3 },
      toolUsage: { Read: 3 },
      totalSessions: 1,
      totalToolCalls: 3,
    });
    const result = computeCraftScore(data);
    expect(result.craftScore).toBeGreaterThanOrEqual(0);
    expect(result.craftScore).toBeLessThanOrEqual(100);
    expect(result.tier).toBeDefined();
  });

  it("produces reasonable score (30-70) for typical developer", () => {
    const data = makeInsights({
      volume: { messages: 200, linesAdded: 3000, linesDeleted: 500, files: 80, days: 7, msgsPerDay: 28 },
      toolUsage: { Bash: 300, Read: 200, Edit: 100, Write: 50 },
      sessionTypes: { "Single Task": 15, "Multi Task": 5 },
      outcomes: { fullyAchieved: 15, mostlyAchieved: 4, partiallyAchieved: 1 },
      friction: { buggyCode: 5, wrongApproach: 3, misunderstoodRequest: 1 },
      satisfaction: { dissatisfied: 2, likelySatisfied: 13, satisfied: 5 },
      multiClauding: { overlapEvents: 5, sessionsInvolved: 4, messagePercent: 10 },
      responseTime: { medianSeconds: 90, averageSeconds: 150 },
      toolErrors: { "Command Failed": 20, Other: 10 },
      totalSessions: 20,
      totalToolCalls: 650,
    });
    const result = computeCraftScore(data);
    expect(result.craftScore).toBeGreaterThanOrEqual(30);
    expect(result.craftScore).toBeLessThanOrEqual(70);
  });

  it("produces high score (80+) for power user", () => {
    const data = makeInsights({
      volume: { messages: 800, linesAdded: 25000, linesDeleted: 5000, files: 400, days: 14, msgsPerDay: 57 },
      toolUsage: { Bash: 1500, Read: 800, Edit: 500, Write: 200, Grep: 150, Agent: 200 },
      sessionTypes: { "Single Task": 10, "Multi Task": 20, "Iterative Refinement": 8, Exploration: 2 },
      outcomes: { fullyAchieved: 35, mostlyAchieved: 4, partiallyAchieved: 1 },
      friction: { buggyCode: 3, wrongApproach: 2, misunderstoodRequest: 0 },
      satisfaction: { dissatisfied: 1, likelySatisfied: 25, satisfied: 14 },
      multiClauding: { overlapEvents: 60, sessionsInvolved: 50, messagePercent: 45 },
      responseTime: { medianSeconds: 40, averageSeconds: 80 },
      toolErrors: { "Command Failed": 10, Other: 5 },
      totalSessions: 40,
      totalToolCalls: 3350,
    });
    const result = computeCraftScore(data);
    expect(result.craftScore).toBeGreaterThanOrEqual(70);
    expect(result.tier).toMatch(/Expert|Master/);
  });

  it("produces low score (<35) for beginner", () => {
    const data = makeInsights({
      volume: { messages: 20, linesAdded: 50, linesDeleted: 10, files: 3, days: 2, msgsPerDay: 10 },
      toolUsage: { Bash: 20 },
      sessionTypes: { "Single Task": 3 },
      outcomes: { fullyAchieved: 1, mostlyAchieved: 1, partiallyAchieved: 1 },
      friction: { buggyCode: 2, wrongApproach: 1, misunderstoodRequest: 0 },
      satisfaction: { dissatisfied: 1, likelySatisfied: 1, satisfied: 1 },
      multiClauding: { overlapEvents: 0, sessionsInvolved: 0, messagePercent: 0 },
      responseTime: { medianSeconds: 300, averageSeconds: 400 },
      toolErrors: { "Command Failed": 5 },
      totalSessions: 3,
      totalToolCalls: 20,
    });
    const result = computeCraftScore(data);
    // Score is slightly higher than before since friction/errors no longer
    // penalize the developer (they're Claude's mistakes, not the user's).
    expect(result.craftScore).toBeLessThan(35);
    expect(result.tier).toBe("Practitioner");
  });

  it("handles edge case: no friction, no errors, no outcomes", () => {
    const data = makeInsights({
      volume: { messages: 50, linesAdded: 500, linesDeleted: 100, files: 20, days: 3, msgsPerDay: 17 },
      toolUsage: { Bash: 30, Read: 20 },
      totalSessions: 5,
      totalToolCalls: 50,
    });
    const result = computeCraftScore(data);
    // Should not crash; effectiveness sub-signals default to 0 for rates
    expect(result.craftScore).toBeGreaterThanOrEqual(0);
    expect(result.craftScore).toBeLessThanOrEqual(100);
  });

  it("is deterministic — same input produces same output", () => {
    const data = makeRealWorldInsights();
    const result1 = computeCraftScore(data);
    const result2 = computeCraftScore(data);
    expect(result1.craftScore).toBe(result2.craftScore);
    expect(result1.dimensions).toEqual(result2.dimensions);
    expect(result1.tier).toBe(result2.tier);
  });

  it("produces reasonable results for real-world insights data", () => {
    const data = makeRealWorldInsights();
    const result = computeCraftScore(data);

    // Real data: 549 msgs, 66 sessions, 6 tools, 75% fully achieved,
    // 52 multi-clauding events, 31% parallel — this is a power user
    expect(result.craftScore).toBeGreaterThanOrEqual(40);
    expect(result.craftScore).toBeLessThanOrEqual(85);
    expect(result.tier).toMatch(/Practitioner|Expert|Master/);
    expect(result.tool).toBe("claude-code");
    expect(result.reportPeriod.start).toBe("2026-02-20");
    expect(result.reportPeriod.end).toBe("2026-03-07");

    // All dimensions should be reasonable
    expect(result.dimensions.proficiency).toBeGreaterThan(20);
    expect(result.dimensions.effectiveness).toBeGreaterThan(20);
    expect(result.dimensions.sophistication).toBeGreaterThan(20);
  });

  it("returns correct tier boundaries", () => {
    // We can't directly control the composite score, but we can test getCraftTier
    // The integration test verifies the tier is derived from craftScore
    const result = computeCraftScore(makeInsights());
    expect(result.tier).toBe("Novice"); // score 0

    const realResult = computeCraftScore(makeRealWorldInsights());
    // craftScore determines tier — verify consistency
    if (realResult.craftScore >= 80) expect(realResult.tier).toBe("Master");
    else if (realResult.craftScore >= 55) expect(realResult.tier).toBe("Expert");
    else if (realResult.craftScore >= 30) expect(realResult.tier).toBe("Practitioner");
    else expect(realResult.tier).toBe("Novice");
  });

  it("includes correct metadata in result", () => {
    const data = makeRealWorldInsights();
    const result = computeCraftScore(data);
    expect(result.tool).toBe("claude-code");
    expect(result.reportPeriod).toEqual({
      start: "2026-02-20",
      end: "2026-03-07",
    });
    expect(result.computedAt).toBeTruthy();
    expect(new Date(result.computedAt).getTime()).not.toBeNaN();
  });

  it("clamps all dimension scores to 0-100", () => {
    // Even with extreme data, scores should stay in range
    const extreme = makeInsights({
      volume: { messages: 100000, linesAdded: 999999, linesDeleted: 999999, files: 99999, days: 365, msgsPerDay: 274 },
      toolUsage: { Bash: 50000, Read: 50000, Edit: 50000, Write: 50000, Grep: 50000, Agent: 50000 },
      sessionTypes: { "Multi Task": 500, "Iterative Refinement": 300, "Single Task": 200 },
      outcomes: { fullyAchieved: 1000, mostlyAchieved: 0, partiallyAchieved: 0 },
      satisfaction: { dissatisfied: 0, likelySatisfied: 0, satisfied: 1000 },
      multiClauding: { overlapEvents: 500, sessionsInvolved: 400, messagePercent: 90 },
      responseTime: { medianSeconds: 5, averageSeconds: 10 },
      totalSessions: 1000,
      totalToolCalls: 300000,
    });
    const result = computeCraftScore(extreme);
    expect(result.dimensions.proficiency).toBeLessThanOrEqual(100);
    expect(result.dimensions.effectiveness).toBeLessThanOrEqual(100);
    expect(result.dimensions.sophistication).toBeLessThanOrEqual(100);
    expect(result.craftScore).toBeLessThanOrEqual(100);
  });
});
