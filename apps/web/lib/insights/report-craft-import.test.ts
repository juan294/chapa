// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { parseReportCraftHtml, prepareReportCraftImport, type ReportCraftImport } from "./report-craft-import";
const report = (): ReportCraftImport => ({ schemaVersion: "v7.2", tool: "claude-code", reportPeriod: { start: "2026-09-01", end: "2026-09-08" }, totalSessions: 10, outcomes: [{ label: "Fully Achieved", count: 4 }, { label: "Mostly Achieved", count: 2 }, { label: "Partially Achieved", count: 1 }, { label: "Failed", count: 1 }, { label: "private unknown", count: 1 }] });
describe("observed report import boundary", () => {
  it("extracts ordered original labels including failures without legacy remapping", () => {
    const html = '<div class="subtitle">30 messages across 8 sessions (10 total) | 2026-09-01 to 2026-09-08</div><div class="chart-card"><h3 class="chart-title">Outcomes</h3><div class="bar-row"><span class="bar-label"> Failed </span><span class="bar-value">10</span></div></div>';
    expect(parseReportCraftHtml(html)).toEqual({ schemaVersion: "v7.2", tool: "claude-code", reportPeriod: { start: "2026-09-01", end: "2026-09-08" }, totalSessions: 10, outcomes: [{ label: " Failed ", count: 10 }] });
  });
  it("scores57 and bounds today's date-only report by the first server capture", async () => {
    const prepared = await prepareReportCraftImport(report(), "2026-09-08T11:00:00Z");
    expect(prepared.calculation).toMatchObject({ status: "valid", result: { status: "scored", point: { exact: 57 } }, inputs: { reportPeriod: { startInclusive: "2026-09-01T00:00:00.000Z", endExclusive: "2026-09-08T11:00:00.000Z" } } });
    expect(prepared.periodBasis).toBe("declared_dates_first_capture_v7.2");
    expect(prepared.declaredPeriod).toEqual(report().reportPeriod);
  });
  it("computes content digest before capture so same-day/next-day retries retain one identity", async () => {
    const a = await prepareReportCraftImport(report(), "2026-09-08T11:00:00Z");
    const b = await prepareReportCraftImport(report(), "2026-09-08T12:00:00Z");
    const c = await prepareReportCraftImport(report(), "2026-09-09T12:00:00Z");
    expect(a.contentDigest).toBe(b.contentDigest);
    expect(a.contentDigest).toBe(c.contentDigest);
    expect(a.canonicalBody).toBe(c.canonicalBody);
    expect(c.calculation.inputs.reportPeriod.endExclusive).toBe("2026-09-09T00:00:00.000Z");
  });
  it("never accepts future declared calendar ends or invalid/duplicate aliases", async () => {
    await expect(prepareReportCraftImport(report(), "2026-09-07T12:00:00Z")).rejects.toThrow();
    await expect(prepareReportCraftImport({ ...report(), outcomes: [{ label: "failed", count: 1 }, { label: "not-achieved", count: 1 }] }, "2026-09-08T12:00:00Z")).rejects.toThrow();
    await expect(prepareReportCraftImport({ ...report(), totalSessions: 1 }, "2026-09-08T12:00:00Z")).rejects.toThrow();
  });
  it("rejects extra authority fields and does not silently replace malformed chart values with zero", async () => {
    await expect(prepareReportCraftImport({ ...report(), owner: "other" }, "2026-09-08T12:00:00Z")).rejects.toThrow();
    expect(() => parseReportCraftHtml('<div class="subtitle">bad</div>')).toThrow();
    expect(() => parseReportCraftHtml('<div class="subtitle">3 messages across 10 sessions | 2026-09-01 to 2026-09-08</div><div class="chart-card"><div class="chart-title">Outcomes</div><div class="bar-row"><span class="bar-label">Failed</span><span class="bar-value">n/a</span></div></div>')).toThrow();
  });
});
