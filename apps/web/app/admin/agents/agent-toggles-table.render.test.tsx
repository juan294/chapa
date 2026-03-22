// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, act } from "@testing-library/react";
import { AgentTogglesTable } from "./agent-toggles-table";
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

describe("AgentTogglesTable", () => {
  const defaultProps = {
    agents: [
      createAgent({ key: "coverage", label: "Coverage", schedule: "Daily 2:00 AM", enabled: true }),
      createAgent({ key: "cost-analyst", label: "Cost Analyst", schedule: "Daily 3:00 AM", enabled: false }),
    ],
    masterEnabled: true,
    onToggle: vi.fn().mockResolvedValue(undefined),
  };

  // ─── Table structure ──────────────────────────────────────────────────

  describe("table structure", () => {
    it("renders a table element", () => {
      render(<AgentTogglesTable {...defaultProps} />);
      expect(screen.getByRole("table")).toBeDefined();
    });

    it("renders Agent, Schedule, and Status column headers", () => {
      render(<AgentTogglesTable {...defaultProps} />);
      const headers = screen.getAllByRole("columnheader");
      expect(headers).toHaveLength(3);
      expect(headers[0]!.textContent).toBe("Agent");
      expect(headers[1]!.textContent).toBe("Schedule");
      expect(headers[2]!.textContent).toBe("Status");
    });
  });

  // ─── Master toggle row ────────────────────────────────────────────────

  describe("master toggle row", () => {
    it("renders the master toggle row with label 'All Agents (master)'", () => {
      render(<AgentTogglesTable {...defaultProps} />);
      expect(screen.getByText("All Agents (master)")).toBeDefined();
    });

    it("master toggle has role=switch", () => {
      render(<AgentTogglesTable {...defaultProps} />);
      const masterSwitch = screen.getByRole("switch", { name: "Toggle all agents" });
      expect(masterSwitch).toBeDefined();
    });

    it("master toggle reflects masterEnabled=true with aria-checked", () => {
      render(<AgentTogglesTable {...defaultProps} masterEnabled={true} />);
      const masterSwitch = screen.getByRole("switch", { name: "Toggle all agents" });
      expect(masterSwitch.getAttribute("aria-checked")).toBe("true");
    });

    it("master toggle reflects masterEnabled=false with aria-checked", () => {
      render(<AgentTogglesTable {...defaultProps} masterEnabled={false} />);
      const masterSwitch = screen.getByRole("switch", { name: "Toggle all agents" });
      expect(masterSwitch.getAttribute("aria-checked")).toBe("false");
    });

    it("clicking master toggle calls onToggle with 'automated_agents' and toggled value", async () => {
      const onToggle = vi.fn().mockResolvedValue(undefined);
      render(<AgentTogglesTable {...defaultProps} masterEnabled={true} onToggle={onToggle} />);
      const masterSwitch = screen.getByRole("switch", { name: "Toggle all agents" });

      await act(async () => {
        fireEvent.click(masterSwitch);
      });

      expect(onToggle).toHaveBeenCalledWith("automated_agents", false);
    });
  });

  // ─── Individual agent rows ────────────────────────────────────────────

  describe("individual agent rows", () => {
    it("renders a row for each agent with its label", () => {
      render(<AgentTogglesTable {...defaultProps} />);
      expect(screen.getByText("Coverage")).toBeDefined();
      expect(screen.getByText("Cost Analyst")).toBeDefined();
    });

    it("renders agent schedules", () => {
      render(<AgentTogglesTable {...defaultProps} />);
      expect(screen.getByText("Daily 2:00 AM")).toBeDefined();
      expect(screen.getByText("Daily 3:00 AM")).toBeDefined();
    });

    it("each agent has a toggle with role=switch", () => {
      render(<AgentTogglesTable {...defaultProps} />);
      const coverageSwitch = screen.getByRole("switch", { name: "Toggle Coverage" });
      const costSwitch = screen.getByRole("switch", { name: "Toggle Cost Analyst" });
      expect(coverageSwitch).toBeDefined();
      expect(costSwitch).toBeDefined();
    });

    it("agent toggle reflects enabled state via aria-checked", () => {
      render(<AgentTogglesTable {...defaultProps} />);
      const coverageSwitch = screen.getByRole("switch", { name: "Toggle Coverage" });
      const costSwitch = screen.getByRole("switch", { name: "Toggle Cost Analyst" });
      expect(coverageSwitch.getAttribute("aria-checked")).toBe("true");
      expect(costSwitch.getAttribute("aria-checked")).toBe("false");
    });

    it("clicking agent toggle calls onToggle with correct key and toggled value", async () => {
      const onToggle = vi.fn().mockResolvedValue(undefined);
      render(<AgentTogglesTable {...defaultProps} onToggle={onToggle} />);
      const coverageSwitch = screen.getByRole("switch", { name: "Toggle Coverage" });

      await act(async () => {
        fireEvent.click(coverageSwitch);
      });

      expect(onToggle).toHaveBeenCalledWith("coverage", false);
    });

    it("clicking disabled agent toggle calls onToggle to enable it", async () => {
      const onToggle = vi.fn().mockResolvedValue(undefined);
      render(<AgentTogglesTable {...defaultProps} onToggle={onToggle} />);
      const costSwitch = screen.getByRole("switch", { name: "Toggle Cost Analyst" });

      await act(async () => {
        fireEvent.click(costSwitch);
      });

      expect(onToggle).toHaveBeenCalledWith("cost-analyst", true);
    });
  });

  // ─── Pending/loading state ────────────────────────────────────────────

  describe("pending state", () => {
    it("disables the toggle while onToggle is in progress", async () => {
      let resolveToggle!: () => void;
      const onToggle = vi.fn().mockImplementation(
        () => new Promise<void>((resolve) => { resolveToggle = resolve; }),
      );

      render(<AgentTogglesTable {...defaultProps} onToggle={onToggle} />);
      const coverageSwitch = screen.getByRole("switch", { name: "Toggle Coverage" });

      // Start toggle — do not await completion
      act(() => {
        fireEvent.click(coverageSwitch);
      });

      // While pending, the switch should be disabled
      await waitFor(() => {
        expect(coverageSwitch.hasAttribute("disabled")).toBe(true);
      });

      // Resolve the toggle
      await act(async () => {
        resolveToggle();
      });

      // After resolution, the switch should be enabled again
      await waitFor(() => {
        expect(coverageSwitch.hasAttribute("disabled")).toBe(false);
      });
    });

    it("other toggles remain enabled while one is pending", async () => {
      let resolveToggle!: () => void;
      const onToggle = vi.fn().mockImplementation(
        () => new Promise<void>((resolve) => { resolveToggle = resolve; }),
      );

      render(<AgentTogglesTable {...defaultProps} onToggle={onToggle} />);
      const coverageSwitch = screen.getByRole("switch", { name: "Toggle Coverage" });
      const costSwitch = screen.getByRole("switch", { name: "Toggle Cost Analyst" });

      act(() => {
        fireEvent.click(coverageSwitch);
      });

      // Coverage should be disabled (pending), Cost Analyst should not
      await waitFor(() => {
        expect(coverageSwitch.hasAttribute("disabled")).toBe(true);
        expect(costSwitch.hasAttribute("disabled")).toBe(false);
      });

      await act(async () => {
        resolveToggle();
      });
    });
  });

  // ─── Empty agents list ────────────────────────────────────────────────

  describe("empty agents list", () => {
    it("renders table with master toggle but no agent rows", () => {
      render(<AgentTogglesTable agents={[]} masterEnabled={false} onToggle={vi.fn().mockResolvedValue(undefined)} />);
      expect(screen.getByText("All Agents (master)")).toBeDefined();
      // Only 1 row in tbody (master)
      const switches = screen.getAllByRole("switch");
      expect(switches).toHaveLength(1);
    });
  });

  // ─── Accessibility ────────────────────────────────────────────────────

  describe("accessibility", () => {
    it("all toggles have aria-label describing their target", () => {
      render(<AgentTogglesTable {...defaultProps} />);
      const switches = screen.getAllByRole("switch");
      const labels = switches.map((s) => s.getAttribute("aria-label"));
      expect(labels).toContain("Toggle all agents");
      expect(labels).toContain("Toggle Coverage");
      expect(labels).toContain("Toggle Cost Analyst");
    });

    it("all toggles have aria-checked attribute", () => {
      render(<AgentTogglesTable {...defaultProps} />);
      const switches = screen.getAllByRole("switch");
      for (const s of switches) {
        const checked = s.getAttribute("aria-checked");
        expect(checked === "true" || checked === "false").toBe(true);
      }
    });
  });
});
