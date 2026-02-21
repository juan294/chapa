import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "agent-status-grid.tsx"),
  "utf-8",
);

describe("AgentStatusGrid", () => {
  describe("exports", () => {
    it("exports a named AgentStatusGrid component", () => {
      expect(SOURCE).toContain("export function AgentStatusGrid");
    });

    it("is a client component", () => {
      expect(SOURCE).toContain('"use client"');
    });
  });

  describe("props interface", () => {
    it("accepts agents array of AgentStatus", () => {
      expect(SOURCE).toContain("agents: AgentStatus[]");
    });

    it("accepts runningAgent as string or null", () => {
      expect(SOURCE).toContain("runningAgent: string | null");
    });

    it("accepts onRun callback", () => {
      expect(SOURCE).toContain("onRun: (agentKey: string) => void");
    });

    it("accepts onStop callback", () => {
      expect(SOURCE).toContain("onStop: (agentKey: string) => void");
    });
  });

  describe("rendering", () => {
    it("maps over agents array", () => {
      expect(SOURCE).toContain("agents.map");
    });

    it("renders AgentCard for each agent", () => {
      expect(SOURCE).toContain("<AgentCard");
      expect(SOURCE).toContain("AgentCard");
    });

    it("passes agent key as React key", () => {
      expect(SOURCE).toContain("key={agent.key}");
    });

    it("determines isRunning by comparing runningAgent to agent.key", () => {
      expect(SOURCE).toContain("runningAgent === agent.key");
    });

    it("passes onRun and onStop to AgentCard", () => {
      expect(SOURCE).toContain("onRun={onRun}");
      expect(SOURCE).toContain("onStop={onStop}");
    });
  });

  describe("layout", () => {
    it("uses responsive grid layout", () => {
      expect(SOURCE).toContain("grid");
      expect(SOURCE).toContain("grid-cols-1");
      expect(SOURCE).toContain("sm:grid-cols-2");
      expect(SOURCE).toContain("lg:grid-cols-3");
    });

    it("has gap between cards", () => {
      expect(SOURCE).toContain("gap-4");
    });
  });

  describe("imports", () => {
    it("imports AgentStatus type", () => {
      expect(SOURCE).toContain('import type { AgentStatus } from "../agents-types"');
    });

    it("imports AgentCard component", () => {
      expect(SOURCE).toContain('import { AgentCard } from "./agent-card"');
    });
  });
});
