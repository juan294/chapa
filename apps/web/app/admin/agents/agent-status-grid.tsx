"use client";

import type { AgentStatus } from "../agents-types";
import { AgentCard } from "./agent-card";

interface AgentStatusGridProps {
  agents: AgentStatus[];
  runningAgent: string | null;
  onRun: (agentKey: string) => void;
  onStop: (agentKey: string) => void;
}

export function AgentStatusGrid({
  agents,
  runningAgent,
  onRun,
  onStop,
}: AgentStatusGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {agents.map((agent) => (
        <AgentCard
          key={agent.key}
          agent={agent}
          isRunning={runningAgent === agent.key}
          onRun={onRun}
          onStop={onStop}
        />
      ))}
    </div>
  );
}
