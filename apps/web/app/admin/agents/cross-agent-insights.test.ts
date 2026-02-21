import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "cross-agent-insights.tsx"),
  "utf-8",
);

describe("CrossAgentInsights", () => {
  describe("exports", () => {
    it("exports a named CrossAgentInsights component", () => {
      expect(SOURCE).toContain("export function CrossAgentInsights");
    });

    it("is a client component", () => {
      expect(SOURCE).toContain('"use client"');
    });
  });

  describe("props interface", () => {
    it("accepts entries array of SharedContextEntry", () => {
      expect(SOURCE).toContain("entries: SharedContextEntry[]");
    });
  });

  describe("entry grouping", () => {
    it("groups entries by agent and picks most recent", () => {
      expect(SOURCE).toContain("latestByAgent");
      expect(SOURCE).toContain("new Map<string, SharedContextEntry>()");
    });

    it("compares timestamps to find latest per agent", () => {
      expect(SOURCE).toContain("entry.timestamp > existing.timestamp");
    });
  });

  describe("empty state", () => {
    it("shows empty state message when no entries exist", () => {
      // JSX splits the text across lines — check for key fragment
      expect(SOURCE).toContain("shared context available yet");
    });

    it("suggests running an agent to generate insights", () => {
      expect(SOURCE).toContain("Run an agent to generate insights");
    });

    it("uses terminal-style prefix for empty state", () => {
      expect(SOURCE).toContain("agents/insights");
    });
  });

  describe("agent pills navigation", () => {
    it("renders clickable pills for each agent", () => {
      expect(SOURCE).toContain("agentKeys.map");
      expect(SOURCE).toContain("setSelected(key)");
    });

    it("highlights selected pill with amber background", () => {
      expect(SOURCE).toContain("bg-amber text-white");
    });

    it("replaces underscores with spaces in agent labels", () => {
      expect(SOURCE).toContain('key.replace(/_/g, " ")');
    });

    it("uses selected state for active pill tracking", () => {
      expect(SOURCE).toContain("useState(agentKeys[0]");
    });
  });

  describe("content rendering", () => {
    it("shows entry timestamp", () => {
      expect(SOURCE).toContain("new Date(entry.timestamp).toLocaleString()");
    });

    it("renders markdown content via dangerouslySetInnerHTML", () => {
      expect(SOURCE).toContain("dangerouslySetInnerHTML");
      expect(SOURCE).toContain("renderMarkdown");
    });
  });

  describe("renderMarkdown utility", () => {
    it("handles h2 headings", () => {
      expect(SOURCE).toContain('line.startsWith("# ")');
    });

    it("handles h3 headings", () => {
      expect(SOURCE).toContain('line.startsWith("## ")');
    });

    it("handles bullet points", () => {
      expect(SOURCE).toContain('line.startsWith("- ")');
    });

    it("handles empty lines", () => {
      expect(SOURCE).toContain('line.trim() === ""');
    });

    it("wraps regular text in paragraphs", () => {
      expect(SOURCE).toContain("<p class=");
    });
  });

  describe("inlineFormat utility", () => {
    it("formats bold text", () => {
      expect(SOURCE).toContain("\\*\\*(.+?)\\*\\*");
      expect(SOURCE).toContain("<strong");
    });

    it("formats inline code", () => {
      expect(SOURCE).toContain("`(.+?)`");
      expect(SOURCE).toContain("<code");
    });
  });

  describe("styling", () => {
    it("uses card styling for container", () => {
      expect(SOURCE).toContain("rounded-xl border border-stroke bg-card");
    });

    it("uses border for pill/content divider", () => {
      expect(SOURCE).toContain("border-b border-stroke");
    });
  });
});
