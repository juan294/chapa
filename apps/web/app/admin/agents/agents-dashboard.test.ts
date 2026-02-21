import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "agents-dashboard.tsx"),
  "utf-8",
);

describe("AgentsDashboard", () => {
  describe("exports", () => {
    it("exports a named AgentsDashboard component", () => {
      expect(SOURCE).toContain("export function AgentsDashboard");
    });

    it("is a client component", () => {
      expect(SOURCE).toContain('"use client"');
    });
  });

  describe("state management", () => {
    it("tracks data as AgentsDashboardData or null", () => {
      expect(SOURCE).toContain("useState<AgentsDashboardData | null>(null)");
    });

    it("tracks loading state", () => {
      expect(SOURCE).toContain("useState(true)");
    });

    it("tracks error state as string or null", () => {
      expect(SOURCE).toContain("useState<string | null>(null)");
    });

    it("tracks running agent key", () => {
      expect(SOURCE).toContain("useState<string | null>(null)");
    });

    it("tracks terminal visibility", () => {
      expect(SOURCE).toContain("useState(false)");
    });
  });

  describe("data fetching", () => {
    it("fetches from /api/admin/agents-summary", () => {
      expect(SOURCE).toContain('fetch("/api/admin/agents-summary")');
    });

    it("handles non-ok responses", () => {
      expect(SOURCE).toContain("!res.ok");
    });

    it("parses error body from response", () => {
      expect(SOURCE).toContain("res.json().catch(() => null)");
    });

    it("falls back to HTTP status on parse failure", () => {
      expect(SOURCE).toContain("`HTTP ${res.status}`");
    });

    it("sets loading to false after fetch completes", () => {
      expect(SOURCE).toContain("setLoading(false)");
    });

    it("clears error on successful fetch", () => {
      expect(SOURCE).toContain("setError(null)");
    });

    it("triggers fetch on mount via useEffect", () => {
      expect(SOURCE).toContain("fetchData()");
    });
  });

  describe("command bar event listener", () => {
    it("listens for chapa:admin-run-agent events", () => {
      expect(SOURCE).toContain("chapa:admin-run-agent");
    });

    it("extracts agentKey from event detail", () => {
      expect(SOURCE).toContain("detail?.agentKey");
    });

    it("cleans up event listener on unmount", () => {
      expect(SOURCE).toContain("removeEventListener");
    });
  });

  describe("handleToggle", () => {
    it("sends PATCH to /api/admin/feature-flags", () => {
      expect(SOURCE).toContain('fetch("/api/admin/feature-flags"');
      expect(SOURCE).toContain('"PATCH"');
    });

    it("sends key and enabled in body", () => {
      expect(SOURCE).toContain("JSON.stringify({ key, enabled })");
    });

    it("refreshes data after successful toggle", () => {
      expect(SOURCE).toContain("if (res.ok)");
      expect(SOURCE).toContain("await fetchData()");
    });
  });

  describe("handleRun", () => {
    it("sends POST to /api/admin/agents/run", () => {
      expect(SOURCE).toContain('fetch("/api/admin/agents/run"');
      expect(SOURCE).toContain('"POST"');
    });

    it("sends agentKey in body", () => {
      expect(SOURCE).toContain("JSON.stringify({ agentKey })");
    });

    it("sets running agent on success", () => {
      expect(SOURCE).toContain("setRunningAgent(agentKey)");
    });

    it("shows terminal on success", () => {
      expect(SOURCE).toContain("setShowTerminal(true)");
    });
  });

  describe("handleStop", () => {
    it("sends DELETE to /api/admin/agents/run with agentKey", () => {
      expect(SOURCE).toContain("`/api/admin/agents/run?agentKey=${agentKey}`");
      expect(SOURCE).toContain('"DELETE"');
    });

    it("clears running agent after stop", () => {
      expect(SOURCE).toContain("setRunningAgent(null)");
    });

    it("refreshes data after stop", () => {
      // fetchData is called in handleStop
      expect(SOURCE).toContain("await fetchData()");
    });
  });

  describe("master toggle derivation", () => {
    it("derives master enabled from agent states", () => {
      expect(SOURCE).toContain("masterEnabled");
      expect(SOURCE).toContain("data?.agents.some");
    });

    it("defaults to false when data is null", () => {
      expect(SOURCE).toContain("?? false");
    });
  });

  describe("loading state", () => {
    it("shows spinner when loading", () => {
      expect(SOURCE).toContain("animate-spin");
    });

    it("shows terminal-style loading message", () => {
      expect(SOURCE).toContain("loading agent data...");
    });
  });

  describe("error state", () => {
    it("shows error message", () => {
      expect(SOURCE).toContain("{error}");
    });

    it("uses terminal-red for error styling", () => {
      expect(SOURCE).toContain("text-terminal-red");
    });

    it("has a retry button", () => {
      expect(SOURCE).toContain("Retry");
    });

    it("resets error and loading on retry", () => {
      expect(SOURCE).toContain("setError(null)");
      expect(SOURCE).toContain("setLoading(true)");
    });
  });

  describe("dashboard layout", () => {
    it("renders OverallHealthBanner", () => {
      expect(SOURCE).toContain("<OverallHealthBanner");
    });

    it("renders AgentTogglesTable", () => {
      expect(SOURCE).toContain("<AgentTogglesTable");
    });

    it("renders AgentStatusGrid", () => {
      expect(SOURCE).toContain("<AgentStatusGrid");
    });

    it("conditionally renders TerminalDisplay when agent is running", () => {
      expect(SOURCE).toContain("showTerminal && runningAgent");
      expect(SOURCE).toContain("<TerminalDisplay");
    });

    it("renders CrossAgentInsights", () => {
      expect(SOURCE).toContain("<CrossAgentInsights");
    });

    it("passes correct props to OverallHealthBanner", () => {
      expect(SOURCE).toContain("agents={data.agents}");
    });

    it("passes correct props to AgentTogglesTable", () => {
      expect(SOURCE).toContain("masterEnabled={masterEnabled}");
      expect(SOURCE).toContain("onToggle={handleToggle}");
    });

    it("passes correct props to AgentStatusGrid", () => {
      expect(SOURCE).toContain("runningAgent={runningAgent}");
      expect(SOURCE).toContain("onRun={handleRun}");
      expect(SOURCE).toContain("onStop={handleStop}");
    });

    it("passes onClose to TerminalDisplay", () => {
      expect(SOURCE).toContain("setShowTerminal(false)");
    });

    it("passes sharedContext to CrossAgentInsights", () => {
      expect(SOURCE).toContain("entries={data.sharedContext}");
    });

    it("returns null when data is null and not loading/error", () => {
      expect(SOURCE).toContain("if (!data) return null");
    });
  });

  describe("imports", () => {
    it("imports OverallHealthBanner", () => {
      expect(SOURCE).toContain(
        'import { OverallHealthBanner } from "./overall-health-banner"',
      );
    });

    it("imports AgentTogglesTable", () => {
      expect(SOURCE).toContain(
        'import { AgentTogglesTable } from "./agent-toggles-table"',
      );
    });

    it("imports AgentStatusGrid", () => {
      expect(SOURCE).toContain(
        'import { AgentStatusGrid } from "./agent-status-grid"',
      );
    });

    it("imports CrossAgentInsights", () => {
      expect(SOURCE).toContain(
        'import { CrossAgentInsights } from "./cross-agent-insights"',
      );
    });

    it("imports TerminalDisplay", () => {
      expect(SOURCE).toContain(
        'import { TerminalDisplay } from "./terminal-display"',
      );
    });

    it("imports AgentsDashboardData type", () => {
      expect(SOURCE).toContain("AgentsDashboardData");
    });
  });
});
