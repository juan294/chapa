import { type NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { readSessionCookie } from "@/lib/auth/github";
import { isAdminHandle } from "@/lib/auth/admin";
import { rateLimit } from "@/lib/cache/redis";
import { getClientIp } from "@/lib/http/client-ip";
import { dbGetFeatureFlags } from "@/lib/db/feature-flags";
import { AGENTS } from "@/lib/agents/agent-config";
import {
  parseHealthStatus,
  parseHealthSummary,
  parseSharedContext,
} from "@/lib/agents/report-parser";
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
  // Rate limit: 10 requests per IP per 60 seconds
  const ip = getClientIp(request);
  const rl = await rateLimit(`ratelimit:admin-agents:${ip}`, 10, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  // Auth: require session cookie
  const sessionSecret = process.env.NEXTAUTH_SECRET?.trim();
  if (!sessionSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cookieHeader = request.headers.get("cookie");
  const session = readSessionCookie(cookieHeader, sessionSecret);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Admin check
  if (!isAdminHandle(session.login)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Load feature flags to determine enabled state
  const flags = await dbGetFeatureFlags();
  const flagMap = new Map(flags.map((f) => [f.key, f.enabled]));

  // Build agent statuses
  const projectRoot = process.cwd();
  const agents: AgentStatus[] = await Promise.all(
    Object.values(AGENTS).map(async (config) => {
      const filePath = join(projectRoot, config.outputFile);
      let reportContent: string | null = null;
      let lastRun: string | null = null;

      try {
        const fileStat = await stat(filePath);
        lastRun = fileStat.mtime.toISOString();
        reportContent = await readFile(filePath, "utf-8");
      } catch {
        // Report file doesn't exist yet — that's fine
      }

      return {
        key: config.key,
        label: config.label,
        schedule: config.schedule,
        enabled: flagMap.get(config.key) ?? false,
        health: reportContent
          ? parseHealthStatus(reportContent)
          : "unknown",
        healthSummary: reportContent
          ? parseHealthSummary(reportContent)
          : "No summary available",
        lastRun,
        outputFile: config.outputFile,
        reportContent,
      };
    }),
  );

  // Parse shared context
  const sharedContextPath = join(
    projectRoot,
    "docs/agents/shared-context.md",
  );
  let sharedContext: AgentsDashboardData["sharedContext"] = [];
  try {
    const content = await readFile(sharedContextPath, "utf-8");
    sharedContext = parseSharedContext(content);
  } catch {
    // Shared context file doesn't exist yet — return empty
  }

  const data: AgentsDashboardData = { agents, sharedContext };

  return NextResponse.json(data, {
    headers: { "Cache-Control": "no-store" },
  });
}
