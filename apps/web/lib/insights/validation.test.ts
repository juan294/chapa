import { describe, it, expect } from "vitest";
import { isValidInsightsUpload } from "./validation";
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
});
