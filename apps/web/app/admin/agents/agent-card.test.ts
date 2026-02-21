import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "agent-card.tsx"),
  "utf-8",
);

describe("AgentCard", () => {
  describe("exports", () => {
    it("exports a named AgentCard component", () => {
      expect(SOURCE).toContain("export function AgentCard");
    });

    it("is a client component", () => {
      expect(SOURCE).toContain('"use client"');
    });
  });

  describe("props interface", () => {
    it("accepts agent prop of type AgentStatus", () => {
      expect(SOURCE).toContain("agent: AgentStatus");
    });

    it("accepts isRunning boolean", () => {
      expect(SOURCE).toContain("isRunning: boolean");
    });

    it("accepts onRun callback", () => {
      expect(SOURCE).toContain("onRun: (agentKey: string) => void");
    });

    it("accepts onStop callback", () => {
      expect(SOURCE).toContain("onStop: (agentKey: string) => void");
    });
  });

  describe("health indicator", () => {
    it("uses HEALTH_DOT mapping for health colors", () => {
      expect(SOURCE).toContain("HEALTH_DOT");
      expect(SOURCE).toContain('"bg-terminal-green"');
      expect(SOURCE).toContain('"bg-terminal-yellow"');
      expect(SOURCE).toContain('"bg-terminal-red"');
    });

    it("maps all four health states", () => {
      expect(SOURCE).toContain('green: "bg-terminal-green"');
      expect(SOURCE).toContain('yellow: "bg-terminal-yellow"');
      expect(SOURCE).toContain('red: "bg-terminal-red"');
      expect(SOURCE).toContain('unknown: "bg-text-secondary/40"');
    });

    it("shows animated pulse when running", () => {
      expect(SOURCE).toContain("animate-pulse");
      expect(SOURCE).toContain("isRunning");
    });

    it("has accessible health label via aria-label", () => {
      expect(SOURCE).toContain("aria-label={`Health:");
    });
  });

  describe("agent label", () => {
    it("renders agent.label in a heading", () => {
      expect(SOURCE).toContain("{agent.label}");
      expect(SOURCE).toContain("<h3");
    });

    it("uses font-heading for the label", () => {
      expect(SOURCE).toMatch(/h3.*font-heading/);
    });
  });

  describe("run/stop buttons", () => {
    it("shows Stop button when running", () => {
      expect(SOURCE).toContain("Stop");
      expect(SOURCE).toContain("onStop(agent.key)");
    });

    it("shows Run button when not running", () => {
      expect(SOURCE).toContain("Run");
      expect(SOURCE).toContain("onRun(agent.key)");
    });

    it("disables Run button when agent is not enabled", () => {
      expect(SOURCE).toContain("disabled={!agent.enabled}");
    });

    it("has accessible labels for both buttons", () => {
      expect(SOURCE).toContain("aria-label={`Stop ${agent.label}`}");
      expect(SOURCE).toContain("aria-label={`Run ${agent.label}`}");
    });

    it("Stop button has terminal-red styling", () => {
      expect(SOURCE).toContain("text-terminal-red");
    });

    it("Run button has disabled styling", () => {
      expect(SOURCE).toContain("disabled:opacity-30");
      expect(SOURCE).toContain("disabled:cursor-not-allowed");
    });

    it("includes a play icon SVG in Run button", () => {
      expect(SOURCE).toContain("viewBox=");
      expect(SOURCE).toContain('aria-hidden="true"');
    });
  });

  describe("schedule display", () => {
    it("renders agent.schedule", () => {
      expect(SOURCE).toContain("{agent.schedule}");
    });
  });

  describe("health summary", () => {
    it("renders agent.healthSummary", () => {
      expect(SOURCE).toContain("{agent.healthSummary}");
    });
  });

  describe("last run display", () => {
    it("shows formatted date when lastRun exists", () => {
      expect(SOURCE).toContain("agent.lastRun");
      expect(SOURCE).toContain("formatDate");
    });

    it("shows 'Never run' when lastRun is null", () => {
      expect(SOURCE).toContain('"Never run"');
    });
  });

  describe("styling", () => {
    it("uses card styling", () => {
      expect(SOURCE).toContain("rounded-xl border border-stroke bg-card");
    });
  });
});
