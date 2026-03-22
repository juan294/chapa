// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  parseInsightsHtml,
  _parseNumeric,
  _parseSubtitle,
  _parseLinesStat,
} from "./parser";

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

const FIXTURE_HTML = readFileSync(
  join(__dirname, "__fixtures__", "claude-code-report.html"),
  "utf-8",
);

// Parse the fixture once — pure function, same result every time
const PARSED = parseInsightsHtml(FIXTURE_HTML);

// ---------------------------------------------------------------------------
// Helper tests
// ---------------------------------------------------------------------------

describe("parseNumeric", () => {
  it("parses plain integers", () => {
    expect(_parseNumeric("549")).toBe(549);
  });

  it("strips commas from large numbers", () => {
    expect(_parseNumeric("16,843")).toBe(16843);
  });

  it("strips percentage signs", () => {
    expect(_parseNumeric("31%")).toBe(31);
  });

  it("parses floats", () => {
    expect(_parseNumeric("80.6")).toBe(80.6);
  });

  it("returns 0 for empty string", () => {
    expect(_parseNumeric("")).toBe(0);
  });

  it("returns 0 for non-numeric string", () => {
    expect(_parseNumeric("abc")).toBe(0);
  });
});

describe("parseSubtitle", () => {
  it("extracts messages, sessions, and dates", () => {
    const result = _parseSubtitle(
      "549 messages across 66 sessions (189 total) | 2026-02-20 to 2026-03-07",
    );
    expect(result).toEqual({
      messages: 549,
      sessions: 66,
      start: "2026-02-20",
      end: "2026-03-07",
    });
  });

  it("handles missing dates gracefully", () => {
    const result = _parseSubtitle("100 messages across 10 sessions");
    expect(result.messages).toBe(100);
    expect(result.sessions).toBe(10);
    expect(result.start).toBe("");
    expect(result.end).toBe("");
  });

  it("returns zeros for empty string", () => {
    const result = _parseSubtitle("");
    expect(result).toEqual({ messages: 0, sessions: 0, start: "", end: "" });
  });
});

describe("parseLinesStat", () => {
  it("parses standard format with commas", () => {
    expect(_parseLinesStat("+16,843/-1,230")).toEqual({
      added: 16843,
      deleted: 1230,
    });
  });

  it("parses without commas", () => {
    expect(_parseLinesStat("+500/-100")).toEqual({
      added: 500,
      deleted: 100,
    });
  });

  it("returns zeros for malformed input", () => {
    expect(_parseLinesStat("no lines here")).toEqual({
      added: 0,
      deleted: 0,
    });
  });
});

// ---------------------------------------------------------------------------
// Full report parsing
// ---------------------------------------------------------------------------

describe("parseInsightsHtml — full report", () => {
  const result = PARSED;

  it("sets tool to claude-code", () => {
    expect(result.tool).toBe("claude-code");
  });

  it("extracts report period from subtitle", () => {
    expect(result.reportPeriod).toEqual({
      start: "2026-02-20",
      end: "2026-03-07",
    });
  });

  it("extracts total sessions from subtitle", () => {
    expect(result.totalSessions).toBe(66);
  });
});

// ---------------------------------------------------------------------------
// Volume extraction
// ---------------------------------------------------------------------------

describe("parseInsightsHtml — volume", () => {
  const result = PARSED;

  it("extracts messages count", () => {
    expect(result.volume.messages).toBe(549);
  });

  it("extracts lines added", () => {
    expect(result.volume.linesAdded).toBe(16843);
  });

  it("extracts lines deleted", () => {
    expect(result.volume.linesDeleted).toBe(1230);
  });

  it("extracts files count", () => {
    expect(result.volume.files).toBe(290);
  });

  it("extracts days count", () => {
    expect(result.volume.days).toBe(9);
  });

  it("extracts msgs per day", () => {
    expect(result.volume.msgsPerDay).toBe(61);
  });
});

// ---------------------------------------------------------------------------
// Tool usage
// ---------------------------------------------------------------------------

describe("parseInsightsHtml — tool usage", () => {
  const result = PARSED;

  it("extracts all tools with correct counts", () => {
    expect(result.toolUsage).toEqual({
      Bash: 1213,
      Read: 572,
      Edit: 377,
      Write: 134,
      Grep: 115,
      Agent: 110,
    });
  });

  it("computes totalToolCalls as sum of tool usage", () => {
    const expected = 1213 + 572 + 377 + 134 + 115 + 110;
    expect(result.totalToolCalls).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// Session types
// ---------------------------------------------------------------------------

describe("parseInsightsHtml — session types", () => {
  const result = PARSED;

  it("extracts all session types with correct counts", () => {
    expect(result.sessionTypes).toEqual({
      "Single Task": 16,
      "Multi Task": 11,
      "Iterative Refinement": 4,
      Exploration: 1,
    });
  });
});

// ---------------------------------------------------------------------------
// Outcomes
// ---------------------------------------------------------------------------

describe("parseInsightsHtml — outcomes", () => {
  const result = PARSED;

  it("extracts fully achieved", () => {
    expect(result.outcomes.fullyAchieved).toBe(24);
  });

  it("extracts mostly achieved", () => {
    expect(result.outcomes.mostlyAchieved).toBe(6);
  });

  it("extracts partially achieved", () => {
    expect(result.outcomes.partiallyAchieved).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Friction
// ---------------------------------------------------------------------------

describe("parseInsightsHtml — friction", () => {
  const result = PARSED;

  it("extracts buggy code count", () => {
    expect(result.friction.buggyCode).toBe(15);
  });

  it("extracts wrong approach count", () => {
    expect(result.friction.wrongApproach).toBe(12);
  });

  it("extracts misunderstood request count", () => {
    expect(result.friction.misunderstoodRequest).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// Satisfaction
// ---------------------------------------------------------------------------

describe("parseInsightsHtml — satisfaction", () => {
  const result = PARSED;

  it("extracts dissatisfied count", () => {
    expect(result.satisfaction.dissatisfied).toBe(5);
  });

  it("extracts likely satisfied count", () => {
    expect(result.satisfaction.likelySatisfied).toBe(50);
  });

  it("extracts satisfied count", () => {
    expect(result.satisfaction.satisfied).toBe(19);
  });
});

// ---------------------------------------------------------------------------
// Multi-clauding
// ---------------------------------------------------------------------------

describe("parseInsightsHtml — multi-clauding", () => {
  const result = PARSED;

  it("extracts overlap events", () => {
    expect(result.multiClauding.overlapEvents).toBe(52);
  });

  it("extracts sessions involved", () => {
    expect(result.multiClauding.sessionsInvolved).toBe(45);
  });

  it("extracts message percent", () => {
    expect(result.multiClauding.messagePercent).toBe(31);
  });
});

// ---------------------------------------------------------------------------
// Response time
// ---------------------------------------------------------------------------

describe("parseInsightsHtml — response time", () => {
  const result = PARSED;

  it("extracts median seconds", () => {
    expect(result.responseTime.medianSeconds).toBe(80.6);
  });

  it("extracts average seconds", () => {
    expect(result.responseTime.averageSeconds).toBe(188.4);
  });
});

// ---------------------------------------------------------------------------
// Tool errors
// ---------------------------------------------------------------------------

describe("parseInsightsHtml — tool errors", () => {
  const result = PARSED;

  it("extracts all error types with correct counts", () => {
    expect(result.toolErrors).toEqual({
      Other: 87,
      "Command Failed": 64,
      "File Not Found": 5,
      "User Rejected": 5,
      "File Changed": 1,
    });
  });
});

// ---------------------------------------------------------------------------
// Missing sections / edge cases
// ---------------------------------------------------------------------------

describe("parseInsightsHtml — missing sections", () => {
  it("returns valid InsightsUpload with all zeros for empty HTML", () => {
    const result = parseInsightsHtml("");
    expect(result.tool).toBe("claude-code");
    expect(result.volume.messages).toBe(0);
    expect(result.totalSessions).toBe(0);
    expect(result.totalToolCalls).toBe(0);
    expect(result.outcomes.fullyAchieved).toBe(0);
    expect(result.friction.buggyCode).toBe(0);
    expect(result.satisfaction.satisfied).toBe(0);
    expect(result.multiClauding.overlapEvents).toBe(0);
    expect(result.responseTime.medianSeconds).toBe(0);
    expect(result.reportPeriod.start).toBe("");
    expect(result.reportPeriod.end).toBe("");
  });

  it("handles HTML with only subtitle (no charts)", () => {
    const html = `<html><body>
      <p class="subtitle">100 messages across 10 sessions (20 total) | 2026-01-01 to 2026-01-31</p>
    </body></html>`;
    const result = parseInsightsHtml(html);
    expect(result.totalSessions).toBe(10);
    expect(result.reportPeriod.start).toBe("2026-01-01");
    expect(result.volume.messages).toBe(100);
    expect(result.toolUsage).toEqual({});
    expect(result.sessionTypes).toEqual({});
  });

  it("handles HTML with charts but missing specific sections", () => {
    const html = `<html><body>
      <p class="subtitle">200 messages across 20 sessions | 2026-01-01 to 2026-02-01</p>
      <div class="stats-row">
        <div class="stat"><div class="stat-value">200</div><div class="stat-label">Messages</div></div>
      </div>
      <div class="chart-card">
        <div class="chart-title">Top Tools Used</div>
        <div class="bar-row">
          <div class="bar-label">Bash</div>
          <div class="bar-track"><div class="bar-fill"></div></div>
          <div class="bar-value">50</div>
        </div>
      </div>
    </body></html>`;
    const result = parseInsightsHtml(html);
    expect(result.volume.messages).toBe(200);
    expect(result.toolUsage).toEqual({ Bash: 50 });
    // Missing charts default to empty/zero
    expect(result.outcomes.fullyAchieved).toBe(0);
    expect(result.friction.buggyCode).toBe(0);
    expect(result.satisfaction.satisfied).toBe(0);
    expect(result.multiClauding.overlapEvents).toBe(0);
    expect(result.responseTime.medianSeconds).toBe(0);
    expect(result.toolErrors).toEqual({});
  });
});

describe("parseInsightsHtml — malformed values", () => {
  it("handles numbers with extra whitespace", () => {
    const html = `<html><body>
      <div class="stats-row">
        <div class="stat"><div class="stat-value">  549  </div><div class="stat-label">Messages</div></div>
      </div>
    </body></html>`;
    const result = parseInsightsHtml(html);
    expect(result.volume.messages).toBe(549);
  });

  it("handles commas in all number positions", () => {
    const html = `<html><body>
      <div class="stats-row">
        <div class="stat"><div class="stat-value">+1,234,567/-9,876</div><div class="stat-label">Lines</div></div>
      </div>
    </body></html>`;
    const result = parseInsightsHtml(html);
    expect(result.volume.linesAdded).toBe(1234567);
    expect(result.volume.linesDeleted).toBe(9876);
  });
});
