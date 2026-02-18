import { describe, it, expect } from "vitest";
import {
  parseHealthStatus,
  parseHealthSummary,
  parseSharedContext,
} from "./report-parser";

// ---------------------------------------------------------------------------
// parseHealthStatus
// ---------------------------------------------------------------------------

describe("parseHealthStatus", () => {
  it("extracts green status", () => {
    expect(parseHealthStatus("Health status: green")).toBe("green");
  });

  it("extracts yellow status", () => {
    expect(parseHealthStatus("Health status: yellow")).toBe("yellow");
  });

  it("extracts red status", () => {
    expect(parseHealthStatus("Health status: RED")).toBe("red");
  });

  it("is case-insensitive", () => {
    expect(parseHealthStatus("Health status: Green")).toBe("green");
    expect(parseHealthStatus("health status: YELLOW")).toBe("yellow");
  });

  it('returns "unknown" when no match', () => {
    expect(parseHealthStatus("No health info here")).toBe("unknown");
  });

  it('returns "unknown" for empty string', () => {
    expect(parseHealthStatus("")).toBe("unknown");
  });

  it("handles status embedded in markdown", () => {
    const content = `# Coverage Report
> Generated: 2026-02-18 | Health status: green

## Executive Summary`;
    expect(parseHealthStatus(content)).toBe("green");
  });
});

// ---------------------------------------------------------------------------
// parseHealthSummary
// ---------------------------------------------------------------------------

describe("parseHealthSummary", () => {
  it("extracts first sentence after Executive Summary heading", () => {
    const content = `## Executive Summary
Overall coverage is at 87%. Two modules need attention.

## Details`;
    expect(parseHealthSummary(content)).toBe("Overall coverage is at 87%.");
  });

  it("returns the full line if no period", () => {
    const content = `## Executive Summary
All systems operational`;
    expect(parseHealthSummary(content)).toBe("All systems operational");
  });

  it('returns "No summary available" when heading is missing', () => {
    expect(parseHealthSummary("No summary here")).toBe(
      "No summary available",
    );
  });

  it('returns "No summary available" for empty content', () => {
    expect(parseHealthSummary("")).toBe("No summary available");
  });

  it("handles extra whitespace after heading", () => {
    const content = `## Executive Summary

  Coverage looks good. All critical paths tested.`;
    expect(parseHealthSummary(content)).toBe("Coverage looks good.");
  });
});

// ---------------------------------------------------------------------------
// parseSharedContext
// ---------------------------------------------------------------------------

describe("parseSharedContext", () => {
  it("parses a single entry", () => {
    const content = `# Shared Context

<!-- ENTRY:START agent=coverage_agent timestamp=2026-02-18T02:00:00Z -->
## Coverage Agent — 2026-02-18
- **Status**: GREEN
- Overall coverage: 87%
<!-- ENTRY:END -->`;

    const entries = parseSharedContext(content);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.agent).toBe("coverage_agent");
    expect(entries[0]!.timestamp).toBe("2026-02-18T02:00:00Z");
    expect(entries[0]!.content).toContain("Coverage Agent");
  });

  it("parses multiple entries", () => {
    const content = `<!-- ENTRY:START agent=coverage_agent timestamp=2026-02-18T02:00:00Z -->
Entry 1
<!-- ENTRY:END -->

<!-- ENTRY:START agent=security_scanner timestamp=2026-02-17T09:00:00Z -->
Entry 2
<!-- ENTRY:END -->`;

    const entries = parseSharedContext(content);
    expect(entries).toHaveLength(2);
    expect(entries[0]!.agent).toBe("coverage_agent");
    expect(entries[1]!.agent).toBe("security_scanner");
  });

  it("returns empty array for empty content", () => {
    expect(parseSharedContext("")).toEqual([]);
  });

  it("returns empty array when no entries found", () => {
    expect(parseSharedContext("Just some text")).toEqual([]);
  });

  it("trims entry content", () => {
    const content = `<!-- ENTRY:START agent=qa_agent timestamp=2026-02-18T09:00:00Z -->

  Some content here

<!-- ENTRY:END -->`;

    const entries = parseSharedContext(content);
    expect(entries[0]!.content).toBe("Some content here");
  });
});
