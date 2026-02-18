"use client";

import { useCallback, useEffect, useState } from "react";
import type { AgentsDashboardData } from "../agents-types";
import { OverallHealthBanner } from "./overall-health-banner";
import { AgentTogglesTable } from "./agent-toggles-table";
import { AgentStatusGrid } from "./agent-status-grid";
import { CrossAgentInsights } from "./cross-agent-insights";
import { TerminalDisplay } from "./terminal-display";

export function AgentsDashboard() {
  const [data, setData] = useState<AgentsDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runningAgent, setRunningAgent] = useState<string | null>(null);
  const [showTerminal, setShowTerminal] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/agents-summary");
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Listen for events from command bar
  useEffect(() => {
    const runHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.agentKey) handleRun(detail.agentKey);
    };
    window.addEventListener("chapa:admin-run-agent", runHandler);
    return () => window.removeEventListener("chapa:admin-run-agent", runHandler);
  });

  const handleToggle = useCallback(
    async (key: string, enabled: boolean) => {
      const res = await fetch("/api/admin/feature-flags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, enabled }),
      });
      if (res.ok) {
        // Refresh data
        await fetchData();
      }
    },
    [fetchData],
  );

  const handleRun = useCallback(async (agentKey: string) => {
    try {
      const res = await fetch("/api/admin/agents/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentKey }),
      });
      if (res.ok) {
        setRunningAgent(agentKey);
        setShowTerminal(true);
      }
    } catch {
      // Network error
    }
  }, []);

  const handleStop = useCallback(
    async (agentKey: string) => {
      try {
        await fetch(`/api/admin/agents/run?agentKey=${agentKey}`, {
          method: "DELETE",
        });
        setRunningAgent(null);
        // Refresh data to pick up new report
        await fetchData();
      } catch {
        // Network error
      }
    },
    [fetchData],
  );

  // Master toggle state
  const masterEnabled =
    data?.agents.some(
      (a) =>
        // If any agent is enabled, the master toggle was on.
        // But we need to check the actual automated_agents flag.
        // Since the API returns individual agent enabled states,
        // we derive master from whether all agents show as enabled.
        a.enabled,
    ) ?? false;

  // -------------------------------------------------------------------------
  // Loading
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-stroke border-t-amber" />
        <p className="font-heading text-sm text-text-secondary">
          <span className="text-amber">$</span> loading agent data...
        </p>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Error
  // -------------------------------------------------------------------------

  if (error) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <div className="rounded-xl border border-terminal-red/20 bg-terminal-red/5 p-6">
          <p className="font-heading text-sm text-terminal-red">
            <span className="text-terminal-red/50">ERR</span> {error}
          </p>
          <button
            onClick={() => {
              setError(null);
              setLoading(true);
              fetchData();
            }}
            className="mt-4 rounded-lg bg-amber px-4 py-2 text-sm font-semibold text-white hover:bg-amber-light"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // -------------------------------------------------------------------------
  // Dashboard
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      <OverallHealthBanner agents={data.agents} />
      <AgentTogglesTable
        agents={data.agents}
        masterEnabled={masterEnabled}
        onToggle={handleToggle}
      />
      <AgentStatusGrid
        agents={data.agents}
        runningAgent={runningAgent}
        onRun={handleRun}
        onStop={handleStop}
      />
      {showTerminal && runningAgent && (
        <TerminalDisplay
          agentKey={runningAgent}
          onClose={() => setShowTerminal(false)}
        />
      )}
      <CrossAgentInsights entries={data.sharedContext} />
    </div>
  );
}
