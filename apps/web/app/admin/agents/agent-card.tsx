"use client";

import type { AgentStatus } from "../agents-types";
import { formatDate } from "../admin-types";

interface AgentCardProps {
  agent: AgentStatus;
  isRunning: boolean;
  onRun: (agentKey: string) => void;
  onStop: (agentKey: string) => void;
}

const HEALTH_DOT: Record<string, string> = {
  green: "bg-terminal-green",
  yellow: "bg-terminal-yellow",
  red: "bg-terminal-red",
  unknown: "bg-text-secondary/40",
};

export function AgentCard({ agent, isRunning, onRun, onStop }: AgentCardProps) {
  return (
    <div className="rounded-xl border border-stroke bg-card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex h-2.5 w-2.5 rounded-full ${
              isRunning ? "bg-amber animate-pulse" : HEALTH_DOT[agent.health]
            }`}
            aria-label={`Health: ${isRunning ? "running" : agent.health}`}
          />
          <h3 className="font-heading text-sm font-medium text-text-primary">
            {agent.label}
          </h3>
        </div>
        {isRunning ? (
          <button
            onClick={() => onStop(agent.key)}
            className="rounded-md border border-terminal-red/20 px-2 py-1 text-xs font-heading text-terminal-red hover:bg-terminal-red/10 transition-colors"
            aria-label={`Stop ${agent.label}`}
          >
            Stop
          </button>
        ) : (
          <button
            onClick={() => onRun(agent.key)}
            disabled={!agent.enabled}
            className="rounded-md border border-stroke px-2 py-1 text-xs font-heading text-text-secondary hover:border-amber/20 hover:text-amber transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label={`Run ${agent.label}`}
          >
            <svg
              className="inline h-3 w-3 mr-1"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
            Run
          </button>
        )}
      </div>

      {/* Schedule */}
      <p className="text-xs text-text-secondary font-heading">
        {agent.schedule}
      </p>

      {/* Health summary */}
      <p className="text-sm text-text-primary leading-relaxed">
        {agent.healthSummary}
      </p>

      {/* Last run */}
      <p className="text-xs text-text-secondary">
        {agent.lastRun ? (
          <>Last run: {formatDate(agent.lastRun)}</>
        ) : (
          "Never run"
        )}
      </p>
    </div>
  );
}
