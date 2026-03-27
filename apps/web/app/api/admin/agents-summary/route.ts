import { type NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/auth/admin-route";
import { dbGetFeatureFlags } from "@/lib/db/feature-flags";
import { dbTimeoutOr504 } from "@/lib/async/with-timeout";
import { AGENTS } from "@/lib/agents/agent-config";
import {
  parseHealthStatus,
  parseHealthSummary,
  parseSharedContext,
} from "@/lib/agents/report-parser";
import { readReportFile, readSharedContext } from "@/lib/agents/report-reader";
import type {
  AgentStatus,
  AgentsDashboardData,
} from "@/app/admin/agents-types";

/**
 * GET /api/admin/agents-summary
 *
 * Admin-only endpoint that returns the status of all scheduled agents
 * plus cross-agent shared context entries.
 */
export async function GET(request: NextRequest) {
  const authError = await adminAuth(request, "ratelimit:admin-agents");
  if (authError) return authError;

  // Load feature flags to determine enabled state
  const flags = await dbTimeoutOr504(dbGetFeatureFlags(), "dbGetFeatureFlags");
  if (flags instanceof NextResponse) return flags;
  const flagMap = new Map(flags.map((f) => [f.key, f.enabled]));

  // Build agent statuses
  const agents: AgentStatus[] = await Promise.all(
    Object.values(AGENTS).map(async (config) => {
      const report = await readReportFile(config.outputFile);

      return {
        key: config.key,
        label: config.label,
        schedule: config.schedule,
        enabled: flagMap.get(config.key) ?? false,
        health: report.content
          ? parseHealthStatus(report.content)
          : "unknown",
        healthSummary: report.content
          ? parseHealthSummary(report.content)
          : "No summary available",
        lastRun: report.lastRun,
        outputFile: config.outputFile,
        reportContent: report.content,
      };
    }),
  );

  // Parse shared context
  const raw = await readSharedContext();
  const sharedContext: AgentsDashboardData["sharedContext"] = raw
    ? parseSharedContext(raw)
    : [];

  const data: AgentsDashboardData = { agents, sharedContext };

  return NextResponse.json(data, {
    headers: { "Cache-Control": "no-store" },
  });
}
