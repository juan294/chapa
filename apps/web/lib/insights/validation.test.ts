import { describe, it, expect } from "vitest";
import { isValidInsightsUpload, MAX_INSIGHTS_BYTES } from "./validation";
import type { InsightsUpload } from "@chapa/shared";

function makeValid(): InsightsUpload {
  return {
    tool: "claude-code",
    reportPeriod: { start: "2026-02-20", end: "2026-03-07" },
    volume: { messages: 100, linesAdded: 500, linesDeleted: 50, files: 20, days: 5, msgsPerDay: 20 },
    toolUsage: { Bash: 50, Read: 30 },
    sessionTypes: { "Single Task": 5 },
    outcomes: { fullyAchieved: 10, mostlyAchieved: 3, partiallyAchieved: 1 },
    friction: { buggyCode: 2, wrongApproach: 1, misunderstoodRequest: 0 },
    satisfaction: { dissatisfied: 1, likelySatisfied: 8, satisfied: 5 },
    multiClauding: { overlapEvents: 3, sessionsInvolved: 2, messagePercent: 15 },
    responseTime: { medianSeconds: 45, averageSeconds: 90 },
    toolErrors: { Other: 5 },
    totalSessions: 10,
    totalToolCalls: 80,
  };
}

describe("isValidInsightsUpload", () => {
  it("exports the 256 KB payload cap constant", () => {
    expect(MAX_INSIGHTS_BYTES).toBe(256 * 1024);
  });

  it("accepts valid complete data", () => {
    expect(isValidInsightsUpload(makeValid())).toEqual({ valid: true });
  });

  it("rejects missing tool", () => {
    const data = makeValid();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (data as any).tool;
    const result = isValidInsightsUpload(data);
    expect(result.valid).toBe(false);
  });

  it("rejects invalid tool value", () => {
    const data = { ...makeValid(), tool: "cursor" };
    const result = isValidInsightsUpload(data);
    expect(result.valid).toBe(false);
  });

  it("rejects missing report period", () => {
    const data = makeValid();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (data as any).reportPeriod;
    const result = isValidInsightsUpload(data);
    expect(result.valid).toBe(false);
  });

  it("rejects negative volume numbers", () => {
    const data = makeValid();
    data.volume.messages = -1;
    const result = isValidInsightsUpload(data);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("volume.messages");
  });

  it("rejects messagePercent > 100", () => {
    const data = makeValid();
    data.multiClauding.messagePercent = 101;
    const result = isValidInsightsUpload(data);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("messagePercent");
  });

  it("rejects zero totalSessions", () => {
    const data = makeValid();
    data.totalSessions = 0;
    const result = isValidInsightsUpload(data);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("totalSessions");
  });

  it("allows extra fields (forward compatibility)", () => {
    const data = { ...makeValid(), futureField: "something", extraMetric: 42 };
    expect(isValidInsightsUpload(data)).toEqual({ valid: true });
  });

  it("rejects non-object input", () => {
    expect(isValidInsightsUpload(null)).toEqual({ valid: false, reason: "Expected an object" });
    expect(isValidInsightsUpload("string")).toEqual({ valid: false, reason: "Expected an object" });
    expect(isValidInsightsUpload(42)).toEqual({ valid: false, reason: "Expected an object" });
  });

  it("rejects negative numbers in toolUsage", () => {
    const data = makeValid();
    data.toolUsage = { Bash: -1 };
    const result = isValidInsightsUpload(data);
    expect(result.valid).toBe(false);
  });

  it("rejects invalid date format in reportPeriod", () => {
    const data = makeValid();
    data.reportPeriod.start = "not-a-date";
    const result = isValidInsightsUpload(data);
    expect(result.valid).toBe(false);
  });

  it("rejects end date before start date", () => {
    const data = makeValid();
    data.reportPeriod.start = "2026-03-07";
    data.reportPeriod.end = "2026-02-20";
    const result = isValidInsightsUpload(data);
    expect(result.valid).toBe(false);
  });

  it("rejects array input for nested objects", () => {
    expect(isValidInsightsUpload([1, 2, 3])).toEqual({ valid: false, reason: "Expected an object" });
    const data = makeValid();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data as any).outcomes = [1, 2, 3];
    const result = isValidInsightsUpload(data);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("outcomes");
  });

  it("rejects non-integer values in outcomes", () => {
    const data = makeValid();
    data.outcomes.fullyAchieved = 1.5;
    const result = isValidInsightsUpload(data);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("outcomes.fullyAchieved");
  });

  it("rejects negative responseTime.medianSeconds", () => {
    const data = makeValid();
    data.responseTime.medianSeconds = -1;
    const result = isValidInsightsUpload(data);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("medianSeconds");
  });

  it("rejects negative totalToolCalls", () => {
    const data = makeValid();
    data.totalToolCalls = -1;
    const result = isValidInsightsUpload(data);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("totalToolCalls");
  });

  it("rejects non-numeric values in sessionTypes", () => {
    const data = makeValid();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data as any).sessionTypes = { "Single Task": "not-a-number" };
    const result = isValidInsightsUpload(data);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("sessionTypes");
  });

  // --- Edge-case coverage: remaining uncovered branches ---

  it("rejects negative volume.linesAdded", () => {
    const data = makeValid();
    data.volume.linesAdded = -10;
    const result = isValidInsightsUpload(data);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("volume.linesAdded");
  });

  it("rejects negative volume.linesDeleted", () => {
    const data = makeValid();
    data.volume.linesDeleted = -5;
    const result = isValidInsightsUpload(data);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("volume.linesDeleted");
  });

  it("rejects negative volume.files", () => {
    const data = makeValid();
    data.volume.files = -1;
    const result = isValidInsightsUpload(data);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("volume.files");
  });

  it("rejects negative volume.days", () => {
    const data = makeValid();
    data.volume.days = -2;
    const result = isValidInsightsUpload(data);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("volume.days");
  });

  it("rejects negative volume.msgsPerDay", () => {
    const data = makeValid();
    data.volume.msgsPerDay = -3;
    const result = isValidInsightsUpload(data);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("volume.msgsPerDay");
  });

  it("rejects negative values in toolUsage entries", () => {
    const data = makeValid();
    data.toolUsage = { Bash: 50, Read: -1 };
    const result = isValidInsightsUpload(data);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("toolUsage.Read");
  });

  it("rejects negative values in sessionTypes entries", () => {
    const data = makeValid();
    data.sessionTypes = { "Single Task": -5 };
    const result = isValidInsightsUpload(data);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("sessionTypes");
  });

  it("rejects negative values in toolErrors entries", () => {
    const data = makeValid();
    data.toolErrors = { Other: -2 };
    const result = isValidInsightsUpload(data);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("toolErrors.Other");
  });

  it("rejects float outcomes.mostlyAchieved", () => {
    const data = makeValid();
    data.outcomes.mostlyAchieved = 2.7;
    const result = isValidInsightsUpload(data);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("outcomes.mostlyAchieved");
  });

  it("rejects float outcomes.partiallyAchieved", () => {
    const data = makeValid();
    data.outcomes.partiallyAchieved = 0.5;
    const result = isValidInsightsUpload(data);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("outcomes.partiallyAchieved");
  });

  it("rejects float friction.buggyCode", () => {
    const data = makeValid();
    data.friction.buggyCode = 1.1;
    const result = isValidInsightsUpload(data);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("friction.buggyCode");
  });

  it("rejects float friction.wrongApproach", () => {
    const data = makeValid();
    data.friction.wrongApproach = 0.9;
    const result = isValidInsightsUpload(data);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("friction.wrongApproach");
  });

  it("rejects float friction.misunderstoodRequest", () => {
    const data = makeValid();
    data.friction.misunderstoodRequest = 0.3;
    const result = isValidInsightsUpload(data);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("friction.misunderstoodRequest");
  });

  it("rejects float satisfaction.dissatisfied", () => {
    const data = makeValid();
    data.satisfaction.dissatisfied = 1.5;
    const result = isValidInsightsUpload(data);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("satisfaction.dissatisfied");
  });

  it("rejects float satisfaction.likelySatisfied", () => {
    const data = makeValid();
    data.satisfaction.likelySatisfied = 7.2;
    const result = isValidInsightsUpload(data);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("satisfaction.likelySatisfied");
  });

  it("rejects float satisfaction.satisfied", () => {
    const data = makeValid();
    data.satisfaction.satisfied = 4.9;
    const result = isValidInsightsUpload(data);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("satisfaction.satisfied");
  });

  it("rejects negative multiClauding.overlapEvents", () => {
    const data = makeValid();
    data.multiClauding.overlapEvents = -1;
    const result = isValidInsightsUpload(data);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("overlapEvents");
  });

  it("rejects negative multiClauding.sessionsInvolved", () => {
    const data = makeValid();
    data.multiClauding.sessionsInvolved = -3;
    const result = isValidInsightsUpload(data);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("sessionsInvolved");
  });

  it("rejects negative multiClauding.messagePercent", () => {
    const data = makeValid();
    data.multiClauding.messagePercent = -5;
    const result = isValidInsightsUpload(data);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("messagePercent");
  });

  it("rejects negative responseTime.averageSeconds", () => {
    const data = makeValid();
    data.responseTime.averageSeconds = -10;
    const result = isValidInsightsUpload(data);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("averageSeconds");
  });

  it("rejects float totalToolCalls", () => {
    const data = makeValid();
    data.totalToolCalls = 80.5;
    const result = isValidInsightsUpload(data);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("totalToolCalls");
  });

  it("rejects float totalSessions", () => {
    const data = makeValid();
    data.totalSessions = 9.5;
    const result = isValidInsightsUpload(data);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("totalSessions");
  });

  it("rejects undefined input", () => {
    expect(isValidInsightsUpload(undefined)).toEqual({
      valid: false,
      reason: "Expected an object",
    });
  });

  it("rejects boolean input", () => {
    expect(isValidInsightsUpload(true)).toEqual({
      valid: false,
      reason: "Expected an object",
    });
  });

  it("rejects array for volume", () => {
    const data = makeValid();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data as any).volume = [100, 200];
    const result = isValidInsightsUpload(data);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("volume");
  });

  it("rejects null for volume", () => {
    const data = makeValid();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data as any).volume = null;
    const result = isValidInsightsUpload(data);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("volume");
  });

  it("rejects array for toolUsage", () => {
    const data = makeValid();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data as any).toolUsage = [50, 30];
    const result = isValidInsightsUpload(data);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("toolUsage");
  });

  it("rejects array for sessionTypes", () => {
    const data = makeValid();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data as any).sessionTypes = [5];
    const result = isValidInsightsUpload(data);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("sessionTypes");
  });

  it("rejects array for friction", () => {
    const data = makeValid();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data as any).friction = [2, 1, 0];
    const result = isValidInsightsUpload(data);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("friction");
  });

  it("rejects array for satisfaction", () => {
    const data = makeValid();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data as any).satisfaction = [1, 8, 5];
    const result = isValidInsightsUpload(data);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("satisfaction");
  });

  it("rejects array for multiClauding", () => {
    const data = makeValid();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data as any).multiClauding = [3, 2, 15];
    const result = isValidInsightsUpload(data);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("multiClauding");
  });

  it("rejects array for responseTime", () => {
    const data = makeValid();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data as any).responseTime = [45, 90];
    const result = isValidInsightsUpload(data);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("responseTime");
  });

  it("rejects array for toolErrors", () => {
    const data = makeValid();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data as any).toolErrors = [5];
    const result = isValidInsightsUpload(data);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("toolErrors");
  });

  it("rejects invalid end date format", () => {
    const data = makeValid();
    data.reportPeriod.end = "03-07-2026";
    const result = isValidInsightsUpload(data);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("reportPeriod.end");
  });

  it("rejects reportPeriod as array", () => {
    const data = makeValid();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data as any).reportPeriod = ["2026-02-20", "2026-03-07"];
    const result = isValidInsightsUpload(data);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("reportPeriod");
  });

  it("rejects when reportPeriod.start is not a string", () => {
    const data = makeValid();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data as any).reportPeriod.start = 20260220;
    const result = isValidInsightsUpload(data);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("reportPeriod.start");
  });

  it("rejects when reportPeriod.end is not a string", () => {
    const data = makeValid();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data as any).reportPeriod.end = 20260307;
    const result = isValidInsightsUpload(data);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("reportPeriod.end");
  });

  it("rejects missing volume (null)", () => {
    const data = makeValid();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data as any).volume = undefined;
    const result = isValidInsightsUpload(data);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("volume");
  });

  it("rejects when volume.messages is not a number", () => {
    const data = makeValid();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data as any).volume.messages = "one hundred";
    const result = isValidInsightsUpload(data);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("volume.messages");
  });

  it("accepts edge case: same start and end date", () => {
    const data = makeValid();
    data.reportPeriod.start = "2026-03-01";
    data.reportPeriod.end = "2026-03-01";
    expect(isValidInsightsUpload(data)).toEqual({ valid: true });
  });

  it("accepts edge case: zero values for volume fields", () => {
    const data = makeValid();
    data.volume.messages = 0;
    data.volume.linesAdded = 0;
    data.volume.linesDeleted = 0;
    data.volume.files = 0;
    data.volume.days = 0;
    data.volume.msgsPerDay = 0;
    expect(isValidInsightsUpload(data)).toEqual({ valid: true });
  });

  it("accepts edge case: totalToolCalls = 0", () => {
    const data = makeValid();
    data.totalToolCalls = 0;
    expect(isValidInsightsUpload(data)).toEqual({ valid: true });
  });

  it("accepts edge case: messagePercent at boundaries 0 and 100", () => {
    const data = makeValid();
    data.multiClauding.messagePercent = 0;
    expect(isValidInsightsUpload(data)).toEqual({ valid: true });

    data.multiClauding.messagePercent = 100;
    expect(isValidInsightsUpload(data)).toEqual({ valid: true });
  });

  it("accepts edge case: empty record objects (toolUsage, sessionTypes, toolErrors)", () => {
    const data = makeValid();
    data.toolUsage = {};
    data.sessionTypes = {};
    data.toolErrors = {};
    expect(isValidInsightsUpload(data)).toEqual({ valid: true });
  });
});
