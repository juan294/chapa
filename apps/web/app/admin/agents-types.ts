// ---------------------------------------------------------------------------
// Types for the Agents admin dashboard
// ---------------------------------------------------------------------------

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

export interface SharedContextEntry {
  agent: string;
  timestamp: string;
  content: string;
}

export interface AgentsDashboardData {
  agents: AgentStatus[];
  sharedContext: SharedContextEntry[];
}
