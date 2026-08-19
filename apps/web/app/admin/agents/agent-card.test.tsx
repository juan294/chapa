// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import type { AgentStatus } from "../agents-types";

vi.mock("../admin-types", () => ({
  formatDate: (iso: string) => `formatted:${iso}`,
}));

import { AgentCard } from "./agent-card";

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

describe("AgentCard", () => {
  it("renders agent label, schedule, and health summary", () => {
    const agent = createAgent();
    render(
      <AgentCard agent={agent} isRunning={false} onRun={vi.fn()} onStop={vi.fn()} />,
    );
    expect(screen.getByText("Coverage Agent")).toBeDefined();
    expect(screen.getByText("Daily 2:00 AM")).toBeDefined();
    expect(screen.getByText("All checks passing")).toBeDefined();
  });

  it("renders the agent label as an h3 heading with font-heading", () => {
    const agent = createAgent();
    render(
      <AgentCard agent={agent} isRunning={false} onRun={vi.fn()} onStop={vi.fn()} />,
    );
    const heading = screen.getByRole("heading", { level: 3, name: "Coverage Agent" });
    expect(heading.className).toContain("font-heading");
  });

  it("uses card styling on the root container", () => {
    const agent = createAgent();
    const { container } = render(
      <AgentCard agent={agent} isRunning={false} onRun={vi.fn()} onStop={vi.fn()} />,
    );
    const root = container.firstElementChild;
    expect(root?.className).toContain("rounded-xl");
    expect(root?.className).toContain("border-stroke");
    expect(root?.className).toContain("bg-card");
  });

  describe("health dot color", () => {
    it.each([
      ["green", "bg-terminal-green"],
      ["yellow", "bg-terminal-yellow"],
      ["red", "bg-terminal-red"],
      ["unknown", "bg-text-secondary/40"],
    ] as const)("shows %s health dot with class %s", (health, expectedClass) => {
      const agent = createAgent({ health });
      render(
        <AgentCard agent={agent} isRunning={false} onRun={vi.fn()} onStop={vi.fn()} />,
      );
      const dot = screen.getByLabelText(`Health: ${health}`);
      expect(dot.className).toContain(expectedClass);
    });
  });

  it("when running: shows amber pulse dot and Stop button", () => {
    const agent = createAgent();
    render(
      <AgentCard agent={agent} isRunning={true} onRun={vi.fn()} onStop={vi.fn()} />,
    );
    const dot = screen.getByLabelText("Health: running");
    expect(dot.className).toContain("bg-amber");
    expect(dot.className).toContain("animate-pulse");
    expect(screen.getByText("Stop")).toBeDefined();
    expect(screen.queryByText("Run")).toBeNull();

    const stopButton = screen.getByLabelText("Stop Coverage Agent");
    expect(stopButton.className).toContain("text-terminal-red");
  });

  it("when not running: shows Run button with a decorative play icon", () => {
    const agent = createAgent();
    render(
      <AgentCard agent={agent} isRunning={false} onRun={vi.fn()} onStop={vi.fn()} />,
    );
    const runButton = screen.getByLabelText("Run Coverage Agent");
    expect(runButton).toBeDefined();
    expect(runButton.textContent).toContain("Run");
    // Check for the SVG play icon (path with d="M8 5v14l11-7z")
    const svg = runButton.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.queryByText("Stop")).toBeNull();
  });

  it("Run button calls onRun with agent key", () => {
    const agent = createAgent({ key: "qa" });
    const onRun = vi.fn();
    render(
      <AgentCard agent={agent} isRunning={false} onRun={onRun} onStop={vi.fn()} />,
    );
    fireEvent.click(screen.getByLabelText(`Run ${agent.label}`));
    expect(onRun).toHaveBeenCalledWith("qa");
  });

  it("Stop button calls onStop with agent key", () => {
    const agent = createAgent({ key: "security" });
    const onStop = vi.fn();
    render(
      <AgentCard agent={agent} isRunning={true} onRun={vi.fn()} onStop={onStop} />,
    );
    fireEvent.click(screen.getByLabelText(`Stop ${agent.label}`));
    expect(onStop).toHaveBeenCalledWith("security");
  });

  it("Run button is disabled when agent.enabled is false", () => {
    const agent = createAgent({ enabled: false });
    render(
      <AgentCard agent={agent} isRunning={false} onRun={vi.fn()} onStop={vi.fn()} />,
    );
    const runButton = screen.getByLabelText(`Run ${agent.label}`);
    expect(runButton.hasAttribute("disabled")).toBe(true);
    expect(runButton.className).toContain("disabled:opacity-30");
    expect(runButton.className).toContain("disabled:cursor-not-allowed");
  });

  it("shows 'Never run' when lastRun is null", () => {
    const agent = createAgent({ lastRun: null });
    render(
      <AgentCard agent={agent} isRunning={false} onRun={vi.fn()} onStop={vi.fn()} />,
    );
    expect(screen.getByText("Never run")).toBeDefined();
  });

  it("shows formatted date when lastRun is provided", () => {
    const agent = createAgent({ lastRun: "2026-03-24T02:00:00Z" });
    render(
      <AgentCard agent={agent} isRunning={false} onRun={vi.fn()} onStop={vi.fn()} />,
    );
    expect(screen.getByText(/formatted:2026-03-24T02:00:00Z/)).toBeDefined();
  });
});
