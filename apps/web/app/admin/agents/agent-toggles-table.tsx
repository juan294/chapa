"use client";

import { useCallback, useState } from "react";
import type { AgentStatus } from "../agents-types";

interface AgentTogglesTableProps {
  agents: AgentStatus[];
  masterEnabled: boolean;
  onToggle: (key: string, enabled: boolean) => Promise<void>;
}

export function AgentTogglesTable({
  agents,
  masterEnabled,
  onToggle,
}: AgentTogglesTableProps) {
  const [pending, setPending] = useState<string | null>(null);

  const handleToggle = useCallback(
    async (key: string, enabled: boolean) => {
      setPending(key);
      try {
        await onToggle(key, enabled);
      } finally {
        setPending(null);
      }
    },
    [onToggle],
  );

  return (
    <div className="rounded-xl border border-stroke bg-card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-stroke">
            <th className="px-4 py-3 text-left font-heading text-xs font-medium text-text-secondary uppercase tracking-wider">
              Agent
            </th>
            <th className="px-4 py-3 text-left font-heading text-xs font-medium text-text-secondary uppercase tracking-wider hidden sm:table-cell">
              Schedule
            </th>
            <th className="px-4 py-3 text-right font-heading text-xs font-medium text-text-secondary uppercase tracking-wider">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {/* Master toggle */}
          <tr className="border-b border-stroke bg-purple-tint">
            <td className="px-4 py-3 font-heading text-sm font-medium text-amber">
              All Agents (master)
            </td>
            <td className="px-4 py-3 text-text-secondary text-xs hidden sm:table-cell">
              &mdash;
            </td>
            <td className="px-4 py-3 text-right">
              <ToggleSwitch
                enabled={masterEnabled}
                loading={pending === "automated_agents"}
                onToggle={(v) => handleToggle("automated_agents", v)}
                label="Toggle all agents"
              />
            </td>
          </tr>
          {/* Individual agents */}
          {agents.map((agent) => (
            <tr key={agent.key} className="border-b border-stroke last:border-0">
              <td className="px-4 py-3 font-heading text-sm text-text-primary">
                {agent.label}
              </td>
              <td className="px-4 py-3 text-text-secondary text-xs hidden sm:table-cell">
                {agent.schedule}
              </td>
              <td className="px-4 py-3 text-right">
                <ToggleSwitch
                  enabled={agent.enabled}
                  loading={pending === agent.key}
                  onToggle={(v) => handleToggle(agent.key, v)}
                  label={`Toggle ${agent.label}`}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toggle switch component
// ---------------------------------------------------------------------------

function ToggleSwitch({
  enabled,
  loading,
  onToggle,
  label,
}: {
  enabled: boolean;
  loading: boolean;
  onToggle: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      disabled={loading}
      onClick={() => onToggle(!enabled)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        enabled ? "bg-amber" : "bg-stroke"
      } ${loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
          enabled ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
