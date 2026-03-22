// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { OverallHealthBanner } from "./overall-health-banner";
import type { AgentStatus } from "../agents-types";

// ---------------------------------------------------------------------------
// Helper to create mock AgentStatus objects
// ---------------------------------------------------------------------------

function createAgent(overrides: Partial<AgentStatus> = {}): AgentStatus {
  return {
    key: "test-agent",
    label: "Test Agent",
    schedule: "Daily 2:00 AM",
    enabled: true,
    health: "green",
    healthSummary: "All good",
    lastRun: "2026-03-22T02:00:00Z",
    outputFile: "test.log",
    reportContent: null,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe("OverallHealthBanner", () => {
  // ─── Health label computation ─────────────────────────────────────────

  describe("overall health label", () => {
    it("shows 'All systems healthy' when all agents are green", () => {
      const agents = [
        createAgent({ key: "a", health: "green" }),
        createAgent({ key: "b", health: "green" }),
        createAgent({ key: "c", health: "green" }),
      ];
      render(<OverallHealthBanner agents={agents} />);
      expect(screen.getByText("All systems healthy")).toBeDefined();
    });

    it("shows 'Some agents need attention' when any agent is yellow (no red)", () => {
      const agents = [
        createAgent({ key: "a", health: "green" }),
        createAgent({ key: "b", health: "yellow" }),
        createAgent({ key: "c", health: "green" }),
      ];
      render(<OverallHealthBanner agents={agents} />);
      expect(screen.getByText("Some agents need attention")).toBeDefined();
    });

    it("shows 'Critical issues detected' when any agent is red", () => {
      const agents = [
        createAgent({ key: "a", health: "green" }),
        createAgent({ key: "b", health: "yellow" }),
        createAgent({ key: "c", health: "red" }),
      ];
      render(<OverallHealthBanner agents={agents} />);
      expect(screen.getByText("Critical issues detected")).toBeDefined();
    });

    it("shows 'No agent data available' when agents array is empty", () => {
      render(<OverallHealthBanner agents={[]} />);
      expect(screen.getByText("No agent data available")).toBeDefined();
    });

    it("shows 'No agent data available' when all agents are unknown", () => {
      const agents = [
        createAgent({ key: "a", health: "unknown" }),
        createAgent({ key: "b", health: "unknown" }),
      ];
      render(<OverallHealthBanner agents={agents} />);
      expect(screen.getByText("No agent data available")).toBeDefined();
    });

    it("red takes priority over yellow", () => {
      const agents = [
        createAgent({ key: "a", health: "yellow" }),
        createAgent({ key: "b", health: "red" }),
      ];
      render(<OverallHealthBanner agents={agents} />);
      expect(screen.getByText("Critical issues detected")).toBeDefined();
    });
  });

  // ─── Health counts ────────────────────────────────────────────────────

  describe("health counts", () => {
    it("shows green count when > 0", () => {
      const agents = [
        createAgent({ key: "a", health: "green" }),
        createAgent({ key: "b", health: "green" }),
      ];
      render(<OverallHealthBanner agents={agents} />);
      expect(screen.getByText("2 green")).toBeDefined();
    });

    it("shows yellow count when > 0", () => {
      const agents = [
        createAgent({ key: "a", health: "green" }),
        createAgent({ key: "b", health: "yellow" }),
      ];
      render(<OverallHealthBanner agents={agents} />);
      expect(screen.getByText("1 yellow")).toBeDefined();
    });

    it("shows red count when > 0", () => {
      const agents = [
        createAgent({ key: "a", health: "red" }),
        createAgent({ key: "b", health: "red" }),
        createAgent({ key: "c", health: "green" }),
      ];
      render(<OverallHealthBanner agents={agents} />);
      expect(screen.getByText("2 red")).toBeDefined();
    });

    it("shows unknown count when > 0", () => {
      const agents = [
        createAgent({ key: "a", health: "unknown" }),
        createAgent({ key: "b", health: "green" }),
      ];
      render(<OverallHealthBanner agents={agents} />);
      expect(screen.getByText("1 unknown")).toBeDefined();
    });

    it("does not show a count when it is 0", () => {
      const agents = [
        createAgent({ key: "a", health: "green" }),
        createAgent({ key: "b", health: "green" }),
      ];
      render(<OverallHealthBanner agents={agents} />);
      expect(screen.queryByText(/yellow/)).toBeNull();
      expect(screen.queryByText(/red/)).toBeNull();
      expect(screen.queryByText(/unknown/)).toBeNull();
    });

    it("shows multiple counts for mixed health statuses", () => {
      const agents = [
        createAgent({ key: "a", health: "green" }),
        createAgent({ key: "b", health: "yellow" }),
        createAgent({ key: "c", health: "red" }),
        createAgent({ key: "d", health: "unknown" }),
      ];
      render(<OverallHealthBanner agents={agents} />);
      expect(screen.getByText("1 green")).toBeDefined();
      expect(screen.getByText("1 yellow")).toBeDefined();
      expect(screen.getByText("1 red")).toBeDefined();
      expect(screen.getByText("1 unknown")).toBeDefined();
    });

    it("shows no counts when agents is empty", () => {
      render(<OverallHealthBanner agents={[]} />);
      expect(screen.queryByText(/green/i)).toBeNull();
      expect(screen.queryByText(/yellow/i)).toBeNull();
      expect(screen.queryByText(/\bred\b/)).toBeNull();
      expect(screen.queryByText(/unknown/i)).toBeNull();
    });
  });

  // ─── Accessibility ────────────────────────────────────────────────────

  describe("accessibility", () => {
    it("has role=status", () => {
      const agents = [createAgent({ key: "a", health: "green" })];
      render(<OverallHealthBanner agents={agents} />);
      expect(screen.getByRole("status")).toBeDefined();
    });

    it("has aria-label describing the health status (green)", () => {
      const agents = [createAgent({ key: "a", health: "green" })];
      render(<OverallHealthBanner agents={agents} />);
      const banner = screen.getByRole("status");
      expect(banner.getAttribute("aria-label")).toBe("Agent health: All systems healthy");
    });

    it("has aria-label describing the health status (red)", () => {
      const agents = [createAgent({ key: "a", health: "red" })];
      render(<OverallHealthBanner agents={agents} />);
      const banner = screen.getByRole("status");
      expect(banner.getAttribute("aria-label")).toBe("Agent health: Critical issues detected");
    });

    it("has aria-label describing the health status (unknown/empty)", () => {
      render(<OverallHealthBanner agents={[]} />);
      const banner = screen.getByRole("status");
      expect(banner.getAttribute("aria-label")).toBe("Agent health: No agent data available");
    });
  });

  // ─── Terminal-style prefix ────────────────────────────────────────────

  describe("terminal prefix", () => {
    it("shows the terminal command prefix", () => {
      const agents = [createAgent({ key: "a", health: "green" })];
      render(<OverallHealthBanner agents={agents} />);
      expect(screen.getByText("$ agents/health")).toBeDefined();
    });
  });
});
