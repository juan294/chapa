// ---------------------------------------------------------------------------
// Types for the Agents admin dashboard
// ---------------------------------------------------------------------------

export type { SharedContextEntry } from "@/lib/agents/types";
import type { SharedContextEntry } from "@/lib/agents/types";

export interface AgentStatus {
  key: string;
  label: string;
  schedule: string;
  enabled: boolean;
  health: "green" | "yellow" | "red" | "unknown";
  healthSummary: string;
  lastRun: string | null;
  outputFile: string;
  reportContent: string | null;
}

export interface AgentsDashboardData {
  agents: AgentStatus[];
  sharedContext: SharedContextEntry[];
}
