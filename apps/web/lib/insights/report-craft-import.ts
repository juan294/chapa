import { canonicalJson, canonicalSha256, createScoringWindow, SCORING_OBSERVED_POLICY, type ReportCraftCalculation } from "@chapa/shared";
import { calculateReportCraft } from "./report-craft";

/** Private ordered labels cross the ingestion boundary; public receipts receive aggregates only. */
export interface ReportCraftImport {
  schemaVersion: "v7.2";
  tool: "claude-code";
  reportPeriod: { start: string; end: string };
  totalSessions: number;
  outcomes: readonly { label: string; count: number }[];
}
export interface PreparedReportCraftImport {
  contentDigest: string;
  canonicalBody: string;
  declaredPeriod: { start: string; end: string };
  periodBasis: "declared_dates_first_capture_v7.2";
  capturedAt: string;
  calculation: Extract<ReportCraftCalculation, { status: "valid" }>;
}
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const keys = (value: Record<string, unknown>, expected: readonly string[]) => Object.keys(value).length === expected.length && expected.every(key => Object.hasOwn(value, key));
function invalid(): never { throw new RangeError("Invalid report Craft import"); }
function calendar(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return invalid();
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return invalid();
  return value;
}
function validate(value: unknown): ReportCraftImport {
  if (!object(value) || !keys(value, ["schemaVersion", "tool", "reportPeriod", "totalSessions", "outcomes"]) || value.schemaVersion !== "v7.2" || value.tool !== "claude-code"
    || !object(value.reportPeriod) || !keys(value.reportPeriod, ["start", "end"]) || !Array.isArray(value.outcomes) || value.outcomes.length > 1000
    || typeof value.totalSessions !== "number" || !Number.isSafeInteger(value.totalSessions) || value.totalSessions < 0) return invalid();
  const start = calendar(value.reportPeriod.start), end = calendar(value.reportPeriod.end);
  if (start > end) return invalid();
  const outcomes = value.outcomes.map((entry: unknown) => {
    if (!object(entry) || !keys(entry, ["label", "count"]) || typeof entry.label !== "string" || !entry.label.length || entry.label.length > 120
      || typeof entry.count !== "number" || !Number.isSafeInteger(entry.count) || entry.count < 0) return invalid();
    return { label: entry.label, count: entry.count };
  });
  return { schemaVersion: "v7.2", tool: "claude-code", reportPeriod: { start, end }, totalSessions: value.totalSessions, outcomes };
}

/** Browser-only extraction. Preserve label spelling and order before the closed classifier. */
export function parseReportCraftHtml(html: string): ReportCraftImport {
  if (typeof html !== "string" || !html.length || html.length > 5_000_000) return invalid();
  const doc = new DOMParser().parseFromString(html, "text/html");
  const subtitles = doc.querySelectorAll(".subtitle");
  if (subtitles.length !== 1) return invalid();
  const match = /\b([\d,]+)\s+messages\s+across\s+([\d,]+)\s+sessions(?:\s*\(([\d,]+)\s+total\))?\s*\|\s*(\d{4}-\d{2}-\d{2})\s+to\s+(\d{4}-\d{2}-\d{2})\s*$/.exec(subtitles[0]!.textContent ?? "");
  if (!match) return invalid();
  const number = (raw: string) => { if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(raw)) return invalid(); const n = Number(raw.replaceAll(",", "")); return Number.isSafeInteger(n) ? n : invalid(); };
  const analyzed = number(match[2]!), total = number(match[3] ?? match[2]!);
  if (analyzed > total) return invalid();
  const charts = Array.from(doc.querySelectorAll(".chart-card")).filter(card => card.querySelector(".chart-title")?.textContent?.trim() === "Outcomes");
  if (charts.length !== 1) return invalid();
  const outcomes = Array.from(charts[0]!.querySelectorAll(".bar-row")).map(row => {
    const labels = row.querySelectorAll(".bar-label"), counts = row.querySelectorAll(".bar-value");
    if (labels.length !== 1 || counts.length !== 1) return invalid();
    return { label: labels[0]!.textContent ?? "", count: number((counts[0]!.textContent ?? "").trim()) };
  });
  return validate({ schemaVersion: "v7.2", tool: "claude-code", reportPeriod: { start: match[4], end: match[5] }, totalSessions: total, outcomes });
}

/** Authoritative capture is supplied by the server. Digest excludes this clock so retries cannot rejuvenate a report. */
export async function prepareReportCraftImport(value: unknown, capturedAt: string): Promise<PreparedReportCraftImport> {
  const dto = validate(value), window = createScoringWindow(capturedAt);
  if (dto.reportPeriod.end > window.referenceDate) return invalid();
  const end = Math.min(new Date(`${dto.reportPeriod.end}T00:00:00.000Z`).getTime() + 86_400_000, new Date(window.referenceTime).getTime());
  const calculation = calculateReportCraft({ policyVersion: "v7.2", classifierRevision: SCORING_OBSERVED_POLICY.reportCraft.classifierRevision, window,
    reportPeriod: { startInclusive: `${dto.reportPeriod.start}T00:00:00.000Z`, endExclusive: new Date(end).toISOString() }, totalSessions: dto.totalSessions, outcomes: dto.outcomes });
  if (calculation.status !== "valid") return invalid();
  const canonical = { ...dto, outcomes: [...dto.outcomes].sort((a, b) => a.label < b.label ? -1 : a.label > b.label ? 1 : 0) };
  const canonicalBody = canonicalJson(canonical);
  if (new TextEncoder().encode(canonicalBody).length > 262_144) return invalid();
  return { contentDigest: await canonicalSha256(canonical), canonicalBody, declaredPeriod: dto.reportPeriod,
    periodBasis: "declared_dates_first_capture_v7.2", capturedAt: window.referenceTime, calculation };
}
