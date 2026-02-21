import { type NextRequest, NextResponse } from "next/server";
import { spawn, type ChildProcess } from "node:child_process";
import { join } from "node:path";
import { readSessionCookie } from "@/lib/auth/github";
import { isAdminHandle } from "@/lib/auth/admin";
import { rateLimit } from "@/lib/cache/redis";
import { getClientIp } from "@/lib/http/client-ip";
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
}

const MAX_LOG_LINES = 500;

let currentRun: RunState | null = null;

/** Strip ANSI escape codes from a string. */
function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");
}

/** Test helper — reset internal state between tests. */
export function _resetRunState(): void {
  currentRun = null;
}

// ---------------------------------------------------------------------------
// Auth + guards shared by all handlers
// ---------------------------------------------------------------------------

function authorize(
  request: NextRequest,
): { login: string } | NextResponse {
  const sessionSecret = process.env.NEXTAUTH_SECRET?.trim();
  if (!sessionSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cookieHeader = request.headers.get("cookie");
  const session = readSessionCookie(cookieHeader, sessionSecret);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAdminHandle(session.login)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return { login: session.login };
}

function devOnlyGuard(): NextResponse | null {
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
  // Rate limit
  const ip = getClientIp(request);
  const rl = await rateLimit(`ratelimit:admin-agent-run:${ip}`, 10, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  const auth = authorize(request);
  if (auth instanceof NextResponse) return auth;

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

  const { agentKey } = body;
  if (!agentKey) {
    return NextResponse.json(
      { error: "Missing agentKey in request body" },
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
  // process.cwd() inside Next.js returns apps/web/ — go up to monorepo root
  const projectRoot = join(process.cwd(), "..", "..");
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

  child.stdout!.on("data", (data: Buffer) => addLines(data, "stdout"));
  child.stderr!.on("data", (data: Buffer) => addLines(data, "stderr"));

  child.on("close", (code) => {
    if (run.status === "stopped") return; // already stopped via DELETE
    run.status = code === 0 ? "completed" : "failed";
  });

  child.on("error", () => {
    run.status = "failed";
  });

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
  // Rate limit
  const ip = getClientIp(request);
  const rl = await rateLimit(`ratelimit:admin-agent-run:${ip}`, 30, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  const auth = authorize(request);
  if (auth instanceof NextResponse) return auth;

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
  // Rate limit
  const ip = getClientIp(request);
  const rl = await rateLimit(`ratelimit:admin-agent-run:${ip}`, 10, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  const auth = authorize(request);
  if (auth instanceof NextResponse) return auth;

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

  const result = {
    status: "stopped" as const,
    pid: currentRun.pid,
    agentKey: currentRun.agentKey,
  };

  // Allow new runs
  currentRun = null;

  return NextResponse.json(result);
}
