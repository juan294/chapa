import { type NextRequest, NextResponse } from "next/server";
import { spawn, type ChildProcess } from "node:child_process";
import { join } from "node:path";
import { adminAuth } from "@/lib/auth/admin-route";
import { AGENTS } from "@/lib/agents/agent-config";

// ---------------------------------------------------------------------------
// In-memory run state — one agent at a time
// ---------------------------------------------------------------------------

interface LogLine {
  timestamp: string;
  text: string;
  stream: "stdout" | "stderr";
}

interface RunState {
  agentKey: string;
  pid: number;
  startedAt: string;
  status: "running" | "completed" | "failed" | "stopped";
  lines: LogLine[];
  process: ChildProcess;
  cleanup?: () => void;
}

const MAX_LOG_LINES = 500;
/** Hard timeout for spawned agent processes (5 minutes). */
const PROCESS_TIMEOUT_MS = 300_000;
/** Grace period after SIGTERM before escalating to SIGKILL. */
const SIGKILL_GRACE_MS = 5_000;
/** Closed-format guard for configured and requested agent keys. */
const AGENT_KEY_RE = /^[a-z0-9_]+$/;

for (const [agentKey, config] of Object.entries(AGENTS)) {
  if (!AGENT_KEY_RE.test(agentKey) || !AGENT_KEY_RE.test(config.key)) {
    throw new Error(`Invalid AGENTS key at module load: ${agentKey}`);
  }
}

let currentRun: RunState | null = null;

/** Strip ANSI escape codes from a string. */
function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");
}

/** Test helper — reset internal state between tests. */
export function _resetRunState(): void {
  currentRun = null;
}

/**
 * Returns a 403 response when the route should not be available.
 *
 * Two conditions block execution:
 * 1. NODE_ENV is not "development" AND ALLOW_AGENT_RUN is not "true" — prevents
 *    accidental exposure in staging/CI environments.
 * 2. VERCEL_ENV === "production" — hard blocks the route on Vercel production
 *    regardless of ALLOW_AGENT_RUN, because module-level `currentRun` state is
 *    not shared across Vercel instances (BE-H10/DO-M6). In production, a DELETE
 *    may land on a different instance than the POST, seeing null and leaving
 *    orphaned processes with no way to stop them.
 */
function devOnlyGuard(): NextResponse | null {
  // Hard block in Vercel production — in-memory state breaks across instances.
  if (process.env.VERCEL_ENV === "production") {
    return NextResponse.json(
      { error: "Not available in production" },
      { status: 403 },
    );
  }
  const isDev = process.env.NODE_ENV === "development";
  const allowRun = process.env.ALLOW_AGENT_RUN?.trim() === "true";
  if (!isDev && !allowRun) {
    return NextResponse.json(
      { error: "Agent runs are only available in development mode." },
      { status: 403 },
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// POST /api/admin/agents/run — spawn an agent
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const authError = await adminAuth(request, "ratelimit:admin-agent-run", 10, 60);
  if (authError) return authError;

  const devGuard = devOnlyGuard();
  if (devGuard) return devGuard;

  // Parse body
  let body: { agentKey?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const agentKey = typeof body.agentKey === "string" ? body.agentKey.trim() : "";
  if (!agentKey) {
    return NextResponse.json(
      { error: "Missing agentKey in request body" },
      { status: 400 },
    );
  }

  if (!AGENT_KEY_RE.test(agentKey)) {
    return NextResponse.json(
      { error: `Invalid agent key: ${agentKey}` },
      { status: 400 },
    );
  }

  // Validate agent key
  if (!(agentKey in AGENTS)) {
    return NextResponse.json(
      { error: `Unknown agent key: ${agentKey}` },
      { status: 400 },
    );
  }

  // One at a time
  if (currentRun && currentRun.status === "running") {
    return NextResponse.json(
      {
        error: `Agent "${currentRun.agentKey}" is already running (pid ${currentRun.pid})`,
      },
      { status: 409 },
    );
  }

  // Spawn the agent shell script
  // process.cwd() inside Next.js returns apps/web/ — go up to monorepo root.
  // turbopackIgnore prevents NFT from tracing the entire project tree.
  const projectRoot = join(/* turbopackIgnore: true */ process.cwd(), "..", "..");
  const agentConfig = AGENTS[agentKey]!;
  const scriptPath = join(projectRoot, `scripts/${agentConfig.scriptName}.sh`);
  const startedAt = new Date().toISOString();

  const child = spawn("bash", [scriptPath], {
    cwd: projectRoot,
    env: { ...process.env },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const run: RunState = {
    agentKey,
    pid: child.pid!,
    startedAt,
    status: "running",
    lines: [],
    process: child,
  };

  function addLines(data: Buffer, stream: "stdout" | "stderr") {
    const text = stripAnsi(data.toString("utf-8"));
    const lineTexts = text.split("\n").filter((l) => l.length > 0);
    for (const line of lineTexts) {
      run.lines.push({
        timestamp: new Date().toISOString(),
        text: line,
        stream,
      });
      // Trim to max
      if (run.lines.length > MAX_LOG_LINES) {
        run.lines.shift();
      }
    }
  }

  let processTimer: ReturnType<typeof setTimeout> | null = null;
  let killTimer: ReturnType<typeof setTimeout> | null = null;

  /** Destroy streams, remove listeners, and clear pending timers. */
  function cleanupProcess() {
    if (processTimer) { clearTimeout(processTimer); processTimer = null; }
    if (killTimer) { clearTimeout(killTimer); killTimer = null; }
    child.stdout?.removeAllListeners();
    child.stderr?.removeAllListeners();
    child.stdout?.destroy();
    child.stderr?.destroy();
    child.removeAllListeners();
  }

  // Store cleanup on run state so the DELETE handler can call it
  run.cleanup = cleanupProcess;

  child.stdout!.on("data", (data: Buffer) => addLines(data, "stdout"));
  child.stderr!.on("data", (data: Buffer) => addLines(data, "stderr"));

  child.on("close", (code) => {
    if (run.status === "stopped") return; // already stopped via DELETE
    run.status = code === 0 ? "completed" : "failed";
    cleanupProcess();
  });

  child.on("error", () => {
    run.status = "failed";
    cleanupProcess();
  });

  // Hard timeout — kill the process if it runs too long
  processTimer = setTimeout(() => {
    if (run.status === "running") {
      run.status = "failed";
      run.lines.push({
        timestamp: new Date().toISOString(),
        text: `Process killed after ${PROCESS_TIMEOUT_MS / 1000}s timeout`,
        stream: "stderr",
      });
      try {
        child.kill("SIGTERM");
      } catch {
        // Process may have already exited
      }
      // Escalate to SIGKILL if SIGTERM doesn't terminate within grace period
      killTimer = setTimeout(() => {
        try {
          child.kill("SIGKILL");
        } catch {
          // Process may have already exited
        }
        cleanupProcess();
      }, SIGKILL_GRACE_MS);
    }
  }, PROCESS_TIMEOUT_MS);

  currentRun = run;

  return NextResponse.json({
    pid: run.pid,
    startedAt: run.startedAt,
    agentKey: run.agentKey,
  });
}

// ---------------------------------------------------------------------------
// GET /api/admin/agents/run — poll log lines
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const authError = await adminAuth(request, "ratelimit:admin-agent-run", 30, 60);
  if (authError) return authError;

  const devGuard = devOnlyGuard();
  if (devGuard) return devGuard;

  const agentKey = request.nextUrl.searchParams.get("agentKey");
  if (!currentRun || currentRun.agentKey !== agentKey) {
    return NextResponse.json(
      { error: "No run found for this agent" },
      { status: 404 },
    );
  }

  const since = parseInt(
    request.nextUrl.searchParams.get("since") ?? "0",
    10,
  );
  const lines = currentRun.lines.slice(since).map(({ timestamp, text, stream }) => ({
    timestamp,
    text,
    stream,
  }));

  return NextResponse.json({
    status: currentRun.status,
    pid: currentRun.pid,
    startedAt: currentRun.startedAt,
    agentKey: currentRun.agentKey,
    lines,
    totalLines: currentRun.lines.length,
  });
}

// ---------------------------------------------------------------------------
// DELETE /api/admin/agents/run — stop an agent
// ---------------------------------------------------------------------------

export async function DELETE(request: NextRequest) {
  const authError = await adminAuth(request, "ratelimit:admin-agent-run", 10, 60);
  if (authError) return authError;

  const devGuard = devOnlyGuard();
  if (devGuard) return devGuard;

  const agentKey = request.nextUrl.searchParams.get("agentKey");
  if (!currentRun || currentRun.agentKey !== agentKey) {
    return NextResponse.json(
      { error: "No run found for this agent" },
      { status: 404 },
    );
  }

  currentRun.status = "stopped";
  try {
    // Kill the process group
    currentRun.process.kill("SIGTERM");
  } catch {
    // Process may have already exited
  }
  // Clean up streams, listeners, and timers
  currentRun.cleanup?.();

  const result = {
    status: "stopped" as const,
    pid: currentRun.pid,
    agentKey: currentRun.agentKey,
  };

  // Allow new runs
  currentRun = null;

  return NextResponse.json(result);
}
