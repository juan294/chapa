// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import type { AgentStatus } from "../agents-types";

vi.mock("../admin-types", () => ({
  formatDate: (iso: string) => `formatted:${iso}`,
}));

import { AgentStatusGrid } from "./agent-status-grid";

function createAgent(overrides: Partial<AgentStatus> = {}): AgentStatus {
  return {
    key: "coverage",
    label: "Coverage Agent",
    schedule: "Daily 2:00 AM",
    enabled: true,
    health: "green",
    healthSummary: "All checks passing",
    lastRun: "2026-03-24T02:00:00Z",
    outputFile: "coverage.log",
    reportContent: null,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe("AgentStatusGrid", () => {
  it("renders a card for each agent", () => {
    const agents = [
      createAgent({ key: "coverage", label: "Coverage Agent" }),
      createAgent({ key: "security", label: "Security Agent" }),
      createAgent({ key: "qa", label: "QA Agent" }),
    ];
    render(
      <AgentStatusGrid
        agents={agents}
        runningAgent={null}
        onRun={vi.fn()}
        onStop={vi.fn()}
      />,
    );
    expect(screen.getByText("Coverage Agent")).toBeDefined();
    expect(screen.getByText("Security Agent")).toBeDefined();
    expect(screen.getByText("QA Agent")).toBeDefined();
  });

  it("marks the correct agent as running based on runningAgent prop", () => {
    const agents = [
      createAgent({ key: "coverage", label: "Coverage Agent" }),
      createAgent({ key: "security", label: "Security Agent" }),
    ];
    render(
      <AgentStatusGrid
        agents={agents}
        runningAgent="security"
        onRun={vi.fn()}
        onStop={vi.fn()}
      />,
    );
    // The running agent should show "Stop" button, not "Run"
    expect(screen.getByLabelText("Stop Security Agent")).toBeDefined();
    // The non-running agent should show "Run" button
    expect(screen.getByLabelText("Run Coverage Agent")).toBeDefined();
  });

  it("renders empty grid when agents array is empty", () => {
    const { container } = render(
      <AgentStatusGrid
        agents={[]}
        runningAgent={null}
        onRun={vi.fn()}
        onStop={vi.fn()}
      />,
    );
    // The grid container renders but has no children
    const grid = container.firstElementChild;
    expect(grid).not.toBeNull();
    expect(grid!.children).toHaveLength(0);
  });

  it("passes onRun and onStop callbacks through to AgentCard", () => {
    const onRun = vi.fn();
    const onStop = vi.fn();
    const agents = [
      createAgent({ key: "coverage", label: "Coverage Agent" }),
      createAgent({ key: "security", label: "Security Agent" }),
    ];
    render(
      <AgentStatusGrid
        agents={agents}
        runningAgent="security"
        onRun={onRun}
        onStop={onStop}
      />,
    );
    // Click "Run" on Coverage Agent
    fireEvent.click(screen.getByLabelText("Run Coverage Agent"));
    expect(onRun).toHaveBeenCalledWith("coverage");
    // Click "Stop" on Security Agent
    fireEvent.click(screen.getByLabelText("Stop Security Agent"));
    expect(onStop).toHaveBeenCalledWith("security");
  });
});
