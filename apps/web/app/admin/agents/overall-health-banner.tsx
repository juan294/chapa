"use client";

import type { AgentStatus } from "../agents-types";

interface OverallHealthBannerProps {
  agents: AgentStatus[];
}

function getOverallHealth(agents: AgentStatus[]): "green" | "yellow" | "red" | "unknown" {
  const healthCounts = { green: 0, yellow: 0, red: 0, unknown: 0 };
  for (const a of agents) healthCounts[a.health]++;
  if (healthCounts.red > 0) return "red";
  if (healthCounts.yellow > 0) return "yellow";
  if (healthCounts.green > 0) return "green";
  return "unknown";
}

const HEALTH_CONFIG = {
  green: {
    bg: "bg-terminal-green/5",
    border: "border-terminal-green/20",
    dot: "bg-terminal-green",
    text: "text-terminal-green",
    label: "All systems healthy",
  },
  yellow: {
    bg: "bg-terminal-yellow/5",
    border: "border-terminal-yellow/20",
    dot: "bg-terminal-yellow",
    text: "text-terminal-yellow",
    label: "Some agents need attention",
  },
  red: {
    bg: "bg-terminal-red/5",
    border: "border-terminal-red/20",
    dot: "bg-terminal-red",
    text: "text-terminal-red",
    label: "Critical issues detected",
  },
  unknown: {
    bg: "bg-stroke/5",
    border: "border-stroke",
    dot: "bg-text-secondary",
    text: "text-text-secondary",
    label: "No agent data available",
  },
} as const;

export function OverallHealthBanner({ agents }: OverallHealthBannerProps) {
  const overall = getOverallHealth(agents);
  const config = HEALTH_CONFIG[overall];

  const counts = { green: 0, yellow: 0, red: 0, unknown: 0 };
  for (const a of agents) counts[a.health]++;

  return (
    <div
      className={`rounded-xl border ${config.border} ${config.bg} p-4`}
      role="status"
      aria-label={`Agent health: ${config.label}`}
    >
      <div className="flex items-center gap-3">
        <span className="font-heading text-sm text-terminal-dim">
          $ agents/health
        </span>
        <span className={`inline-flex h-2.5 w-2.5 rounded-full ${config.dot}`} />
        <span className={`font-heading text-sm ${config.text}`}>
          {config.label}
        </span>
      </div>
      <div className="mt-2 flex gap-4 pl-6 font-heading text-xs text-text-secondary">
        {counts.green > 0 && (
          <span className="text-terminal-green">{counts.green} green</span>
        )}
        {counts.yellow > 0 && (
          <span className="text-terminal-yellow">{counts.yellow} yellow</span>
        )}
        {counts.red > 0 && (
          <span className="text-terminal-red">{counts.red} red</span>
        )}
        {counts.unknown > 0 && (
          <span className="text-text-secondary">{counts.unknown} unknown</span>
        )}
      </div>
    </div>
  );
}
