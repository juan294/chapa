import type { InsightsUpload } from "@chapa/shared";
import { MAX_INSIGHTS_BYTES } from "./validation";
import { parseInsightsReportV7, type InsightsReportV7 } from "./report-v7";

/**
 * Find a chart card element by its title prefix.
 * Returns null if no matching card is found.
 */
function findChartCard(doc: Document, titlePrefix: string): Element | null {
  const cards = doc.querySelectorAll(".chart-card");
  for (const card of cards) {
    const title = card.querySelector(".chart-title")?.textContent?.trim() ?? "";
    if (title.startsWith(titlePrefix)) return card;
  }
  return null;
}

/**
 * Extract bar chart data from a chart card identified by its title.
 * Returns a map of label → numeric value.
 */
function extractBarChart(
  doc: Document,
  chartTitle: string,
): Record<string, number> {
  const result: Record<string, number> = {};
  const card = findChartCard(doc, chartTitle);
  if (!card) return result;

  const rows = card.querySelectorAll(".bar-row");
  for (const row of rows) {
    const label =
      row.querySelector(".bar-label")?.textContent?.trim() ?? "";
    const rawValue =
      row.querySelector(".bar-value")?.textContent?.trim() ?? "0";
    if (label) {
      result[label] = parseNumeric(rawValue);
    }
  }
  return result;
}

/**
 * Parse a numeric string, stripping commas and % signs.
 * Returns 0 for unparseable values.
 */
function parseNumeric(raw: string): number {
  const cleaned = raw.replace(/,/g, "").replace(/%/g, "").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Parse the subtitle line:
 * "549 messages across 66 sessions (189 total) | 2026-02-20 to 2026-03-07"
 */
function parseSubtitle(text: string): {
  messages: number;
  sessions: number;
  start: string;
  end: string;
} {
  const messagesMatch = text.match(/(\d[\d,]*)\s+messages/);
  const sessionsMatch = text.match(/(\d[\d,]*)\s+sessions/);
  const dateMatch = text.match(/(\d{4}-\d{2}-\d{2})\s+to\s+(\d{4}-\d{2}-\d{2})/);

  return {
    messages: messagesMatch ? parseNumeric(messagesMatch[1] ?? "0") : 0,
    sessions: sessionsMatch ? parseNumeric(sessionsMatch[1] ?? "0") : 0,
    start: dateMatch?.[1] ?? "",
    end: dateMatch?.[2] ?? "",
  };
}

/**
 * Parse the lines stat: "+16,843/-1,230" → { added: 16843, deleted: 1230 }
 */
function parseLinesStat(text: string): { added: number; deleted: number } {
  const match = text.match(/\+?([\d,]+)\s*\/\s*-?([\d,]+)/);
  if (!match) return { added: 0, deleted: 0 };
  return {
    added: parseNumeric(match[1] ?? "0"),
    deleted: parseNumeric(match[2] ?? "0"),
  };
}

/**
 * Extract volume stats from the stats row.
 */
function extractVolumeStats(doc: Document): {
  messages: number;
  linesAdded: number;
  linesDeleted: number;
  files: number;
  days: number;
  msgsPerDay: number;
} {
  const result = {
    messages: 0,
    linesAdded: 0,
    linesDeleted: 0,
    files: 0,
    days: 0,
    msgsPerDay: 0,
  };

  const stats = doc.querySelectorAll(".stats-row .stat");
  for (const stat of stats) {
    const value = stat.querySelector(".stat-value")?.textContent?.trim() ?? "";
    const label = stat.querySelector(".stat-label")?.textContent?.trim().toLowerCase() ?? "";

    switch (label) {
      case "messages":
        result.messages = parseNumeric(value);
        break;
      case "lines": {
        const lines = parseLinesStat(value);
        result.linesAdded = lines.added;
        result.linesDeleted = lines.deleted;
        break;
      }
      case "files":
        result.files = parseNumeric(value);
        break;
      case "days":
        result.days = parseNumeric(value);
        break;
      case "msgs/day":
        result.msgsPerDay = parseNumeric(value);
        break;
    }
  }

  return result;
}

/**
 * Parse multi-clauding section: overlap events, sessions involved, message percent.
 */
function parseMultiClauding(doc: Document): {
  overlapEvents: number;
  sessionsInvolved: number;
  messagePercent: number;
} {
  const result = { overlapEvents: 0, sessionsInvolved: 0, messagePercent: 0 };
  const card = findChartCard(doc, "Multi-Clauding");
  if (!card) return result;

  // The multi-clauding section has inline stat divs with uppercase labels
  const statDivs = card.querySelectorAll("div[style]");
  const values: number[] = [];
  const labels: string[] = [];

  for (const div of statDivs) {
    const style = div.getAttribute("style") ?? "";
    if (style.includes("font-weight: 700") || style.includes("font-weight:700")) {
      values.push(parseNumeric(div.textContent?.trim() ?? "0"));
    }
    if (style.includes("text-transform: uppercase") || style.includes("text-transform:uppercase")) {
      labels.push(div.textContent?.trim().toLowerCase() ?? "");
    }
  }

  for (let i = 0; i < labels.length && i < values.length; i++) {
    const label = labels[i]!;
    const value = values[i]!;
    if (label.includes("overlap")) result.overlapEvents = value;
    else if (label.includes("sessions")) result.sessionsInvolved = value;
    else if (label.includes("message")) result.messagePercent = value;
  }

  return result;
}

/**
 * Parse response time from the footer text:
 * "Median: 80.6s • Average: 188.4s"
 */
function parseResponseTime(doc: Document): {
  medianSeconds: number;
  averageSeconds: number;
} {
  const result = { medianSeconds: 0, averageSeconds: 0 };
  const card = findChartCard(doc, "User Response Time");
  if (!card) return result;

  const text = card.textContent ?? "";
  const medianMatch = text.match(/Median:\s*([\d.]+)s/);
  const avgMatch = text.match(/Average:\s*([\d.]+)s/);

  if (medianMatch?.[1]) result.medianSeconds = parseNumeric(medianMatch[1]);
  if (avgMatch?.[1]) result.averageSeconds = parseNumeric(avgMatch[1]);

  return result;
}

/**
 * Map outcome labels from HTML to InsightsUpload field names.
 */
function mapOutcomes(chart: Record<string, number>): {
  fullyAchieved: number;
  mostlyAchieved: number;
  partiallyAchieved: number;
} {
  return {
    fullyAchieved: chart["Fully Achieved"] ?? 0,
    mostlyAchieved: chart["Mostly Achieved"] ?? 0,
    partiallyAchieved: chart["Partially Achieved"] ?? 0,
  };
}

/**
 * Map friction labels from HTML to InsightsUpload field names.
 */
function mapFriction(chart: Record<string, number>): {
  buggyCode: number;
  wrongApproach: number;
  misunderstoodRequest: number;
} {
  return {
    buggyCode: chart["Buggy Code"] ?? 0,
    wrongApproach: chart["Wrong Approach"] ?? 0,
    misunderstoodRequest: chart["Misunderstood Request"] ?? 0,
  };
}

/**
 * Map satisfaction labels from HTML to InsightsUpload field names.
 */
function mapSatisfaction(chart: Record<string, number>): {
  dissatisfied: number;
  likelySatisfied: number;
  satisfied: number;
} {
  return {
    dissatisfied: chart["Dissatisfied"] ?? 0,
    likelySatisfied: chart["Likely Satisfied"] ?? 0,
    satisfied: chart["Satisfied"] ?? 0,
  };
}

/**
 * Legacy v6 parser retained for archived/versioned consumers.
 * Parse a Claude Code /insights HTML report into structured InsightsUpload data.
 * Runs client-side only (uses DOMParser).
 * Best-effort extraction — missing fields default to 0/empty.
 */
export function parseInsightsHtml(html: string): InsightsUpload {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  // Subtitle: period + session count
  const subtitleEl = doc.querySelector(".subtitle");
  const subtitle = parseSubtitle(subtitleEl?.textContent ?? "");

  // Volume stats
  const volume = extractVolumeStats(doc);
  // Use subtitle messages as fallback if stats row is missing
  if (volume.messages === 0 && subtitle.messages > 0) {
    volume.messages = subtitle.messages;
  }

  // Bar charts
  const toolUsage = extractBarChart(doc, "Top Tools Used");
  const sessionTypes = extractBarChart(doc, "Session Types");
  const outcomesChart = extractBarChart(doc, "Outcomes");
  const frictionChart = extractBarChart(doc, "Primary Friction Types");
  const satisfactionChart = extractBarChart(doc, "Inferred Satisfaction");
  const toolErrors = extractBarChart(doc, "Tool Errors Encountered");

  // Multi-clauding
  const multiClauding = parseMultiClauding(doc);

  // Response time
  const responseTime = parseResponseTime(doc);

  // Total tool calls = sum of tool usage values
  const totalToolCalls = Object.values(toolUsage).reduce((a, b) => a + b, 0);

  return {
    tool: "claude-code",
    reportPeriod: {
      start: subtitle.start,
      end: subtitle.end,
    },
    volume: {
      messages: volume.messages,
      linesAdded: volume.linesAdded,
      linesDeleted: volume.linesDeleted,
      files: volume.files,
      days: volume.days,
      msgsPerDay: volume.msgsPerDay,
    },
    toolUsage,
    sessionTypes,
    outcomes: mapOutcomes(outcomesChart),
    friction: mapFriction(frictionChart),
    satisfaction: mapSatisfaction(satisfactionChart),
    multiClauding,
    responseTime,
    toolErrors,
    totalSessions: subtitle.sessions,
    totalToolCalls,
  };
}

// Export helpers for isolated testing
export {
  parseNumeric as _parseNumeric,
  parseSubtitle as _parseSubtitle,
  parseLinesStat as _parseLinesStat,
};

/** Strict v7 descriptive import. Missing sections are unknown; labels are never silently discarded. */
export function parseInsightsHtmlV7(html: string, referenceTime: string): InsightsReportV7 {
  if (new TextEncoder().encode(html).length > MAX_INSIGHTS_BYTES) throw new RangeError("Report exceeds upload limit");
  const doc = new DOMParser().parseFromString(html, "text/html");
  const subtitleText = doc.querySelector(".subtitle")?.textContent ?? "";
  const subtitleMatch = /^\s*(\S+)\s+messages\s+across\s+(\S+)\s+sessions(?:\s+\((\S+)\s+total\))?\s*\|\s*(\d{4}-\d{2}-\d{2})\s+to\s+(\d{4}-\d{2}-\d{2})\s*$/.exec(subtitleText);
  if (!subtitleMatch) throw new RangeError("Invalid report subtitle");
  const subtitleCount = (token: string): number => {
    if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(token)) throw new RangeError("Invalid subtitle count");
    const value = Number(token.replaceAll(",", ""));
    if (!Number.isSafeInteger(value) || value < 0) throw new RangeError("Invalid subtitle count");
    return value;
  };
  subtitleCount(subtitleMatch[1]!);
  const analyzedSessions = subtitleCount(subtitleMatch[2]!);
  const totalSessions = subtitleMatch[3] ? subtitleCount(subtitleMatch[3]) : analyzedSessions;
  if (analyzedSessions > totalSessions) throw new RangeError("Inconsistent subtitle sessions");
  const numeric = (raw: string): number => {
    const clean = raw.replaceAll(",", "").replaceAll("%", "").trim();
    if (!clean || !/^\d+(?:\.\d+)?$/.test(clean)) throw new RangeError("Invalid report number");
    const number = Number(clean);
    if (!Number.isFinite(number) || number > Number.MAX_SAFE_INTEGER) throw new RangeError("Invalid report number");
    return number;
  };
  const chart = (title: string, normalize = false): Record<string, number> | null => {
    const card = findChartCard(doc, title);
    if (!card) return null;
    const entries = [...card.querySelectorAll(".bar-row")].map(row => {
      const label = row.querySelector(".bar-label")?.textContent?.trim();
      if (!label) throw new RangeError("Missing classification label");
      return [normalize ? label.toLowerCase().replaceAll(/\s+/g, "_") : label, numeric(row.querySelector(".bar-value")?.textContent ?? "")] as const;
    });
    if (new Set(entries.map(([label]) => label)).size !== entries.length) throw new RangeError("Duplicate classification label");
    return Object.fromEntries(entries);
  };
  const responseText = findChartCard(doc, "User Response Time")?.textContent ?? "";
  const duration = (label: string): number | null => {
    const match = responseText.match(new RegExp(`${label}:\\s*([^\\s]+)s`));
    return match?.[1] ? numeric(match[1]) : null;
  };
  const volumeEntries = [...doc.querySelectorAll(".stats-row .stat")].flatMap(stat => {
    const label = stat.querySelector(".stat-label")?.textContent?.trim().toLowerCase();
    const raw = stat.querySelector(".stat-value")?.textContent?.trim();
    if (!label || !raw) throw new RangeError("Invalid volume diagnostic");
    if (label === "lines") {
      const match = /^\+?([\d,]+)\s*\/\s*-?([\d,]+)$/.exec(raw);
      if (!match) throw new RangeError("Invalid line diagnostic");
      return [["linesAdded", numeric(match[1]!)], ["linesDeleted", numeric(match[2]!)]] as [string, number][];
    }
    return [[label, numeric(raw)]] as [string, number][];
  });
  const toolUsage = chart("Top Tools Used");
  const multiCard = findChartCard(doc, "Multi-Clauding");
  const multi: { overlapEvents: number | null; sessionsInvolved: number | null; messagePercent: number | null } = { overlapEvents: null, sessionsInvolved: null, messagePercent: null };
  for (const labelEl of multiCard?.querySelectorAll("div[style*='text-transform']") ?? []) {
    const label = labelEl.textContent?.toLowerCase() ?? "";
    const value = labelEl.previousElementSibling?.textContent;
    if (value === undefined || value === null) continue;
    if (label.includes("overlap")) multi.overlapEvents = numeric(value);
    if (label.includes("sessions")) multi.sessionsInvolved = numeric(value);
    if (label.includes("message")) multi.messagePercent = numeric(value);
  }
  return parseInsightsReportV7({ schemaVersion: "v7", tool: "claude-code", reportPeriod: { start: subtitleMatch[4], end: subtitleMatch[5] },
    totalSessions,
    outcomes: chart("Outcomes", true), satisfaction: chart("Inferred Satisfaction", true), toolUsage,
    sessionTypes: chart("Session Types"), friction: chart("Primary Friction Types"), toolErrors: chart("Tool Errors Encountered"),
    totalToolCalls: null, // A chart titled Top Tools is a subset, not an authoritative total.
    responseTime: { medianSeconds: duration("Median"), averageSeconds: duration("Average") },
    volume: volumeEntries.length ? Object.fromEntries(volumeEntries) : null, multiClauding: multiCard ? multi : null }, referenceTime);
}
