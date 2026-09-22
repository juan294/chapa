// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createScoringWindow } from "@chapa/shared";
import { parseInsightsHtmlV7 } from "./parser";
import { parseInsightsReportV7, describeInsightsReportV7 } from "./report-v7";
const now = "2026-09-05T12:00:00Z";
const html = readFileSync(join(__dirname, "__fixtures__/claude-code-report.html"), "utf8");
function report() { return parseInsightsHtmlV7(html, now); }

describe("v7 report diagnostics", () => {
  it("retains sample counts without probability or engineering credit", () => {
    const data = report();
    const description = describeInsightsReportV7(data, createScoringWindow(now));
    expect(description.diagnostics.totalSessions).toBe(189);
    expect(description.diagnostics.unclassifiedSessions).toBeGreaterThan(0);
    expect(description).not.toHaveProperty("craftScore");
    expect(description).not.toHaveProperty("confidence");
  });
  it("missing response fields remain unknown and estimates remain separate", () => {
    const data = parseInsightsHtmlV7(html.replace(/Median:.*?Average:.*?<\/[^>]+>/s, ""), now);
    expect(data.responseTime.medianSeconds).toBeNull();
    expect(data.responseTime.averageSeconds).toBeNull();
    const description = describeInsightsReportV7(report(), createScoringWindow(now));
    expect(description.diagnostics.likelySatisfiedEstimateCount).toBeGreaterThan(0);
  });
  it("preserves unknown and potentially negative outcome labels", () => {
    const data = parseInsightsReportV7({ ...report(), outcomes: { fully_achieved: 1, failed: 2, novel_category: 3 }, totalSessions: 1000 }, now);
    const description = describeInsightsReportV7(data, createScoringWindow(now));
    expect(description.diagnostics.unknownLabels).toEqual({ failed: 2, novel_category: 3 });
    expect(description.diagnostics.unclassifiedSessions).toBe(994);
    expect(description.diagnostics.knownClassifications).toEqual({ fully_achieved: 1 });
  });
  it.each([Infinity, NaN, 1e309, Number.MAX_SAFE_INTEGER + 1, -1])("rejects invalid finite count %s", value => {
    expect(() => parseInsightsReportV7({ ...report(), totalSessions: value }, now)).toThrow();
    expect(() => parseInsightsReportV7({ ...report(), toolUsage: { Read: value } }, now)).toThrow();
  });
  it("rejects sums that overflow and inconsistent count totals", () => {
    expect(() => parseInsightsReportV7({ ...report(), outcomes: { a: Number.MAX_SAFE_INTEGER, b: 1 } }, now)).toThrow();
    expect(() => parseInsightsReportV7({ ...report(), outcomes: { a: 1000 } }, now)).toThrow();
    expect(() => parseInsightsReportV7({ ...report(), totalToolCalls: 1 }, now)).toThrow();
  });
  it.each(["2026-02-30", "2026-09-06", "bad"])("rejects invalid or future dates %s", end => {
    expect(() => parseInsightsReportV7({ ...report(), reportPeriod: { start: "2026-02-20", end } }, now)).toThrow();
  });
  it.each(["1e309", "-1", "999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999"])("rejects malformed HTML subtitle count %s without suffix extraction", token => {
    expect(() => parseInsightsHtmlV7(html.replace("66 sessions (189 total)", `${token} sessions`), now)).toThrow();
    expect(() => parseInsightsHtmlV7(`<p class="subtitle">0 messages across ${token} sessions | 2026-02-20 to 2026-03-07</p>`, now)).toThrow();
    expect(() => parseInsightsHtmlV7(`<p class="subtitle">0 messages across 0 sessions (${token} total) | 2026-02-20 to 2026-03-07</p>`, now)).toThrow();
    expect(() => parseInsightsHtmlV7(html.replace("189 total", `${token} total`), now)).toThrow();
  });
  it("keeps aggregate periods historical or straddling without proration", () => {
    const historical = describeInsightsReportV7(report(), createScoringWindow("2028-01-01T00:00:00Z"));
    expect(historical.eligibility).toBe("historical");
    const partial = describeInsightsReportV7(report(), createScoringWindow("2027-03-01T00:00:00Z"));
    expect(partial.eligibility).toBe("straddling_aggregate");
    expect(partial.diagnostics).toEqual(historical.diagnostics);
    expect(partial.coverage).toBe("partial");
  });
});
