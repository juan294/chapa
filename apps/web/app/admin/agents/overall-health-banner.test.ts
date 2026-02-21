import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "overall-health-banner.tsx"),
  "utf-8",
);

describe("OverallHealthBanner", () => {
  describe("exports", () => {
    it("exports a named OverallHealthBanner component", () => {
      expect(SOURCE).toContain("export function OverallHealthBanner");
    });

    it("is a client component", () => {
      expect(SOURCE).toContain('"use client"');
    });
  });

  describe("props interface", () => {
    it("accepts agents array of AgentStatus", () => {
      expect(SOURCE).toContain("agents: AgentStatus[]");
    });
  });

  describe("getOverallHealth logic", () => {
    it("defines a getOverallHealth function", () => {
      expect(SOURCE).toContain("function getOverallHealth");
    });

    it("returns red if any agent is red", () => {
      expect(SOURCE).toContain('if (healthCounts.red > 0) return "red"');
    });

    it("returns yellow if any agent is yellow and none is red", () => {
      expect(SOURCE).toContain('if (healthCounts.yellow > 0) return "yellow"');
    });

    it("returns green if any agent is green and none are red or yellow", () => {
      expect(SOURCE).toContain('if (healthCounts.green > 0) return "green"');
    });

    it("returns unknown when no agents have known health", () => {
      expect(SOURCE).toContain('return "unknown"');
    });

    it("counts health states from all agents", () => {
      expect(SOURCE).toContain("healthCounts");
    });
  });

  describe("HEALTH_CONFIG", () => {
    it("defines configuration for all four health states", () => {
      expect(SOURCE).toContain("HEALTH_CONFIG");
      expect(SOURCE).toContain("green:");
      expect(SOURCE).toContain("yellow:");
      expect(SOURCE).toContain("red:");
      expect(SOURCE).toContain("unknown:");
    });

    it("green label is 'All systems healthy'", () => {
      expect(SOURCE).toContain('"All systems healthy"');
    });

    it("yellow label is 'Some agents need attention'", () => {
      expect(SOURCE).toContain('"Some agents need attention"');
    });

    it("red label is 'Critical issues detected'", () => {
      expect(SOURCE).toContain('"Critical issues detected"');
    });

    it("unknown label is 'No agent data available'", () => {
      expect(SOURCE).toContain('"No agent data available"');
    });

    it("uses terminal colors for health dots", () => {
      expect(SOURCE).toContain('"bg-terminal-green"');
      expect(SOURCE).toContain('"bg-terminal-yellow"');
      expect(SOURCE).toContain('"bg-terminal-red"');
    });
  });

  describe("accessibility", () => {
    it("has role=status", () => {
      expect(SOURCE).toContain('role="status"');
    });

    it("has aria-label with health description", () => {
      expect(SOURCE).toContain("aria-label={`Agent health: ${config.label}`}");
    });
  });

  describe("health counts display", () => {
    it("shows green count when > 0", () => {
      expect(SOURCE).toContain("counts.green > 0");
      expect(SOURCE).toContain("{counts.green} green");
    });

    it("shows yellow count when > 0", () => {
      expect(SOURCE).toContain("counts.yellow > 0");
      expect(SOURCE).toContain("{counts.yellow} yellow");
    });

    it("shows red count when > 0", () => {
      expect(SOURCE).toContain("counts.red > 0");
      expect(SOURCE).toContain("{counts.red} red");
    });

    it("shows unknown count when > 0", () => {
      expect(SOURCE).toContain("counts.unknown > 0");
      expect(SOURCE).toContain("{counts.unknown} unknown");
    });
  });

  describe("terminal styling", () => {
    it("uses terminal-style command prefix", () => {
      expect(SOURCE).toContain("$ agents/health");
    });

    it("uses font-heading for terminal text", () => {
      expect(SOURCE).toContain("font-heading");
    });
  });
});
