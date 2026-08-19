// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, act, waitFor } from "@testing-library/react";
import type { AgentsDashboardData, AgentStatus } from "../agents-types";

// ---------- Module mocks ----------

vi.mock("./overall-health-banner", () => ({
  OverallHealthBanner: ({ agents }: { agents: AgentStatus[] }) => (
    <div data-testid="health-banner" data-count={agents.length} />
  ),
}));

vi.mock("./agent-toggles-table", () => ({
  AgentTogglesTable: ({
    agents,
    masterEnabled,
    onToggle,
  }: {
    agents: AgentStatus[];
    masterEnabled: boolean;
    onToggle: (key: string, enabled: boolean) => void;
  }) => (
    <div
      data-testid="toggles-table"
      data-master={String(masterEnabled)}
      data-count={agents.length}
    >
      <button data-testid="toggle-btn" onClick={() => onToggle("coverage", true)}>
        Toggle
      </button>
    </div>
  ),
}));

vi.mock("./agent-status-grid", () => ({
  AgentStatusGrid: ({
    agents,
    runningAgent,
    onRun,
    onStop,
  }: {
    agents: AgentStatus[];
    runningAgent: string | null;
    onRun: (key: string) => void;
    onStop: (key: string) => void;
  }) => (
    <div
      data-testid="status-grid"
      data-running={runningAgent ?? "none"}
      data-count={agents.length}
    >
      <button data-testid="run-btn" onClick={() => onRun("coverage")}>
        Run
      </button>
      <button data-testid="stop-btn" onClick={() => onStop("coverage")}>
        Stop
      </button>
    </div>
  ),
}));

vi.mock("./cross-agent-insights", () => ({
  CrossAgentInsights: ({ entries }: { entries: unknown[] }) => (
    <div data-testid="cross-insights" data-count={entries.length} />
  ),
}));

vi.mock("./terminal-display", () => ({
  TerminalDisplay: ({
    agentKey,
    onClose,
  }: {
    agentKey: string;
    onClose: () => void;
  }) => (
    <div data-testid="terminal-display" data-agent={agentKey}>
      <button data-testid="close-terminal" onClick={onClose}>
        Close
      </button>
    </div>
  ),
}));

import { AgentsDashboard } from "./agents-dashboard";

// ---------- Fixtures ----------

const mockAgent: AgentStatus = {
  key: "coverage",
  label: "Coverage Agent",
  schedule: "Daily 2:00 AM",
  enabled: true,
  health: "green",
  healthSummary: "All good",
  lastRun: "2026-03-16T02:00:00Z",
  outputFile: "coverage-report.md",
  reportContent: "# Coverage Report",
};

const mockData: AgentsDashboardData = {
  agents: [mockAgent],
  sharedContext: [
    {
      agent: "coverage",
      timestamp: "2026-03-16T02:00:00Z",
      content: "Coverage is at 80%",
    },
  ],
};

// ---------- Setup / Teardown ----------

let mockFetch: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockFetch = vi.fn();
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ---------- Tests ----------

describe("AgentsDashboard", () => {
  describe("loading state", () => {
    it("renders loading spinner initially", () => {
      // Never resolve the fetch to stay in loading state
      mockFetch.mockReturnValue(new Promise(() => {}));
      render(<AgentsDashboard />);
      expect(screen.getByText(/loading agent data/)).toBeDefined();
    });

    it("shows spinning animation during load", () => {
      mockFetch.mockReturnValue(new Promise(() => {}));
      const { container } = render(<AgentsDashboard />);
      expect(container.querySelector(".animate-spin")).not.toBeNull();
    });
  });

  describe("error state", () => {
    it("shows error message when fetch fails", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "Unauthorized" }),
      });

      render(<AgentsDashboard />);

      await waitFor(() => {
        expect(screen.getByText(/Unauthorized/)).toBeDefined();
      });
    });

    it("shows HTTP status when no error body", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error("invalid json")),
      });

      render(<AgentsDashboard />);

      await waitFor(() => {
        expect(screen.getByText(/HTTP 500/)).toBeDefined();
      });
    });

    it("shows error on network failure", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      render(<AgentsDashboard />);

      await waitFor(() => {
        expect(screen.getByText(/Network error/)).toBeDefined();
      });
    });

    it("styles the error text with terminal-red", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "Unauthorized" }),
      });

      render(<AgentsDashboard />);

      await waitFor(() => {
        const errorText = screen.getByText(/Unauthorized/);
        expect(errorText.className).toContain("text-terminal-red");
      });
    });

    it("retry button re-fetches data", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({ error: "Temp error" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockData),
        });

      render(<AgentsDashboard />);

      await waitFor(() => {
        expect(screen.getByText(/Temp error/)).toBeDefined();
      });

      await act(async () => {
        fireEvent.click(screen.getByText("Retry"));
      });

      await waitFor(() => {
        expect(screen.getByTestId("health-banner")).toBeDefined();
      });
    });
  });

  describe("dashboard rendering", () => {
    it("renders all dashboard sections on success", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      render(<AgentsDashboard />);

      await waitFor(() => {
        expect(screen.getByTestId("health-banner")).toBeDefined();
        expect(screen.getByTestId("toggles-table")).toBeDefined();
        expect(screen.getByTestId("status-grid")).toBeDefined();
        expect(screen.getByTestId("cross-insights")).toBeDefined();
      });
    });

    it("passes agents to child components", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      render(<AgentsDashboard />);

      await waitFor(() => {
        expect(screen.getByTestId("health-banner").getAttribute("data-count")).toBe("1");
        expect(screen.getByTestId("toggles-table").getAttribute("data-count")).toBe("1");
        expect(screen.getByTestId("status-grid").getAttribute("data-count")).toBe("1");
      });
    });

    it("passes shared context entries to CrossAgentInsights", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      render(<AgentsDashboard />);

      await waitFor(() => {
        expect(screen.getByTestId("cross-insights").getAttribute("data-count")).toBe("1");
      });
    });

    it("derives masterEnabled from agent enabled states", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      render(<AgentsDashboard />);

      await waitFor(() => {
        expect(screen.getByTestId("toggles-table").getAttribute("data-master")).toBe("true");
      });
    });

    it("masterEnabled is false when no agents are enabled", async () => {
      const dataWithDisabled: AgentsDashboardData = {
        agents: [{ ...mockAgent, enabled: false }],
        sharedContext: [],
      };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(dataWithDisabled),
      });

      render(<AgentsDashboard />);

      await waitFor(() => {
        expect(screen.getByTestId("toggles-table").getAttribute("data-master")).toBe("false");
      });
    });

    it("returns null when data is null and not loading/error", async () => {
      // This would require data to be null with no error and no loading,
      // which is an edge case. We test it via the code path.
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(null),
      });

      const { container } = render(<AgentsDashboard />);

      await waitFor(() => {
        // Should render nothing (null return)
        expect(container.querySelector("[data-testid='health-banner']")).toBeNull();
        expect(container.querySelector("[data-testid='toggles-table']")).toBeNull();
      });
    });
  });

  describe("toggle handler", () => {
    it("calls PATCH on feature-flags and re-fetches data", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockData),
        })
        .mockResolvedValueOnce({ ok: true }) // PATCH response
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockData),
        }); // Re-fetch

      render(<AgentsDashboard />);

      await waitFor(() => {
        expect(screen.getByTestId("toggle-btn")).toBeDefined();
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId("toggle-btn"));
      });

      expect(mockFetch).toHaveBeenCalledWith("/api/admin/feature-flags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "coverage", enabled: true }),
      });
    });
  });

  describe("run/stop handlers", () => {
    it("run handler calls POST to agents/run and shows terminal", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockData),
        })
        .mockResolvedValueOnce({ ok: true }); // POST agents/run

      render(<AgentsDashboard />);

      await waitFor(() => {
        expect(screen.getByTestId("run-btn")).toBeDefined();
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId("run-btn"));
      });

      expect(mockFetch).toHaveBeenCalledWith("/api/admin/agents/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentKey: "coverage" }),
      });

      // Terminal display should appear
      await waitFor(() => {
        expect(screen.getByTestId("terminal-display")).toBeDefined();
        expect(screen.getByTestId("terminal-display").getAttribute("data-agent")).toBe("coverage");
      });
    });

    it("run handler handles network error gracefully", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockData),
        })
        .mockRejectedValueOnce(new Error("Network error"));

      render(<AgentsDashboard />);

      await waitFor(() => {
        expect(screen.getByTestId("run-btn")).toBeDefined();
      });

      // Should not throw
      await act(async () => {
        fireEvent.click(screen.getByTestId("run-btn"));
      });

      // Terminal should not appear
      expect(screen.queryByTestId("terminal-display")).toBeNull();
    });

    it("stop handler calls DELETE and re-fetches", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockData),
        })
        .mockResolvedValueOnce({ ok: true }) // POST agents/run
        .mockResolvedValueOnce({ ok: true }) // DELETE agents/run
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockData),
        }); // Re-fetch

      render(<AgentsDashboard />);

      await waitFor(() => {
        expect(screen.getByTestId("run-btn")).toBeDefined();
      });

      // First run an agent to show the terminal
      await act(async () => {
        fireEvent.click(screen.getByTestId("run-btn"));
      });

      await waitFor(() => {
        expect(screen.getByTestId("stop-btn")).toBeDefined();
      });

      // Then stop it
      await act(async () => {
        fireEvent.click(screen.getByTestId("stop-btn"));
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/admin/agents/run?agentKey=coverage",
        { method: "DELETE" },
      );
    });

    it("stop handler handles network error gracefully", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockData),
        })
        .mockResolvedValueOnce({ ok: true }) // POST agents/run
        .mockRejectedValueOnce(new Error("Network error")); // DELETE fails

      render(<AgentsDashboard />);

      await waitFor(() => {
        expect(screen.getByTestId("run-btn")).toBeDefined();
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId("run-btn"));
      });

      // Should not throw
      await act(async () => {
        fireEvent.click(screen.getByTestId("stop-btn"));
      });
    });

    it("close terminal button hides terminal display", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockData),
        })
        .mockResolvedValueOnce({ ok: true }); // POST agents/run

      render(<AgentsDashboard />);

      await waitFor(() => {
        expect(screen.getByTestId("run-btn")).toBeDefined();
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId("run-btn"));
      });

      await waitFor(() => {
        expect(screen.getByTestId("terminal-display")).toBeDefined();
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId("close-terminal"));
      });

      expect(screen.queryByTestId("terminal-display")).toBeNull();
    });
  });

  describe("command bar event listener", () => {
    it("handles chapa:admin-run-agent custom event", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockData),
        })
        .mockResolvedValueOnce({ ok: true }); // POST agents/run

      render(<AgentsDashboard />);

      await waitFor(() => {
        expect(screen.getByTestId("status-grid")).toBeDefined();
      });

      await act(async () => {
        window.dispatchEvent(
          new CustomEvent("chapa:admin-run-agent", {
            detail: { agentKey: "coverage" },
          }),
        );
      });

      expect(mockFetch).toHaveBeenCalledWith("/api/admin/agents/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentKey: "coverage" }),
      });
    });

    it("removes the event listener on unmount", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      const { unmount } = render(<AgentsDashboard />);

      await waitFor(() => {
        expect(screen.getByTestId("status-grid")).toBeDefined();
      });

      const removeSpy = vi.spyOn(window, "removeEventListener");
      unmount();

      expect(removeSpy).toHaveBeenCalledWith(
        "chapa:admin-run-agent",
        expect.any(Function),
      );
      removeSpy.mockRestore();
    });

    it("ignores custom event without agentKey in detail", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      render(<AgentsDashboard />);

      await waitFor(() => {
        expect(screen.getByTestId("status-grid")).toBeDefined();
      });

      const fetchCallCount = mockFetch.mock.calls.length;

      await act(async () => {
        window.dispatchEvent(
          new CustomEvent("chapa:admin-run-agent", {
            detail: {},
          }),
        );
      });

      // No additional fetch calls (only the initial data fetch)
      expect(mockFetch.mock.calls.length).toBe(fetchCallCount);
    });
  });
});
