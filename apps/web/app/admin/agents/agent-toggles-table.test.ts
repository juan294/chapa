import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "agent-toggles-table.tsx"),
  "utf-8",
);

describe("AgentTogglesTable", () => {
  describe("exports", () => {
    it("exports a named AgentTogglesTable component", () => {
      expect(SOURCE).toContain("export function AgentTogglesTable");
    });

    it("is a client component", () => {
      expect(SOURCE).toContain('"use client"');
    });
  });

  describe("props interface", () => {
    it("accepts agents array", () => {
      expect(SOURCE).toContain("agents: AgentStatus[]");
    });

    it("accepts masterEnabled boolean", () => {
      expect(SOURCE).toContain("masterEnabled: boolean");
    });

    it("accepts onToggle async callback", () => {
      expect(SOURCE).toContain(
        "onToggle: (key: string, enabled: boolean) => Promise<void>",
      );
    });
  });

  describe("table structure", () => {
    it("renders a table element", () => {
      expect(SOURCE).toContain("<table");
    });

    it("has Agent column header", () => {
      expect(SOURCE).toContain("Agent");
    });

    it("has Schedule column header", () => {
      expect(SOURCE).toContain("Schedule");
    });

    it("has Status column header", () => {
      expect(SOURCE).toContain("Status");
    });

    it("uses uppercase tracking-wider on headers", () => {
      expect(SOURCE).toContain("uppercase tracking-wider");
    });
  });

  describe("master toggle row", () => {
    it("renders a master toggle row for all agents", () => {
      expect(SOURCE).toContain("All Agents (master)");
    });

    it("highlights master row with purple tint", () => {
      expect(SOURCE).toContain("bg-purple-tint");
    });

    it("uses amber color for master label", () => {
      expect(SOURCE).toContain("text-amber");
    });

    it("sends automated_agents key for master toggle", () => {
      expect(SOURCE).toContain('"automated_agents"');
    });
  });

  describe("individual agent rows", () => {
    it("maps over agents array", () => {
      expect(SOURCE).toContain("agents.map");
    });

    it("renders agent label", () => {
      expect(SOURCE).toContain("{agent.label}");
    });

    it("renders agent schedule", () => {
      expect(SOURCE).toContain("{agent.schedule}");
    });

    it("uses agent key as React key", () => {
      expect(SOURCE).toContain("key={agent.key}");
    });
  });

  describe("pending state", () => {
    it("tracks pending state for toggle operations", () => {
      expect(SOURCE).toContain("useState<string | null>(null)");
    });

    it("sets pending before calling onToggle", () => {
      expect(SOURCE).toContain("setPending(key)");
    });

    it("clears pending after onToggle completes", () => {
      expect(SOURCE).toContain("setPending(null)");
    });

    it("uses try/finally to ensure pending is cleared", () => {
      expect(SOURCE).toContain("finally");
    });
  });

  describe("ToggleSwitch sub-component", () => {
    it("defines an internal ToggleSwitch component", () => {
      expect(SOURCE).toContain("function ToggleSwitch");
    });

    it("uses role=switch for accessibility", () => {
      expect(SOURCE).toContain('role="switch"');
    });

    it("sets aria-checked based on enabled state", () => {
      expect(SOURCE).toContain("aria-checked={enabled}");
    });

    it("has aria-label for accessibility", () => {
      expect(SOURCE).toContain("aria-label={label}");
    });

    it("is disabled when loading", () => {
      expect(SOURCE).toContain("disabled={loading}");
    });

    it("toggles to opposite value on click", () => {
      expect(SOURCE).toContain("onToggle(!enabled)");
    });

    it("uses amber background when enabled", () => {
      expect(SOURCE).toContain('enabled ? "bg-amber"');
    });

    it("translates knob based on enabled state", () => {
      expect(SOURCE).toContain("translate-x-4");
      expect(SOURCE).toContain("translate-x-0.5");
    });

    it("shows reduced opacity when loading", () => {
      expect(SOURCE).toContain("opacity-50");
      expect(SOURCE).toContain("cursor-not-allowed");
    });
  });

  describe("responsive design", () => {
    it("hides Schedule column on small screens", () => {
      expect(SOURCE).toContain("hidden sm:table-cell");
    });
  });

  describe("styling", () => {
    it("uses card styling for the container", () => {
      expect(SOURCE).toContain("rounded-xl border border-stroke bg-card");
    });

    it("uses border-stroke for row dividers", () => {
      expect(SOURCE).toContain("border-b border-stroke");
    });
  });
});
