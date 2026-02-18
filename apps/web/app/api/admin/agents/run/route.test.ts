import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/auth/github", () => ({
  readSessionCookie: vi.fn(),
}));

vi.mock("@/lib/auth/admin", () => ({
  isAdminHandle: vi.fn(),
}));

vi.mock("@/lib/cache/redis", () => ({
  rateLimit: vi
    .fn()
    .mockResolvedValue({ allowed: true, current: 1, limit: 10 }),
}));

vi.mock("@/lib/http/client-ip", () => ({
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

vi.mock("@/lib/agents/agent-config", () => ({
  AGENTS: {
    coverage_agent: {
      key: "coverage_agent",
      label: "Coverage Agent",
      schedule: "Daily at 2:00 AM",
      outputFile: "docs/agents/coverage-report.md",
      defaultPrompt: "...",
      allowedTools: ["Read"],
    },
    security_scanner: {
      key: "security_scanner",
      label: "Security Scanner",
      schedule: "Weekly Monday 9:00 AM",
      outputFile: "docs/agents/security-report.md",
      defaultPrompt: "...",
      allowedTools: ["Read"],
    },
    qa_agent: {
      key: "qa_agent",
      label: "QA Agent",
      schedule: "Weekly Wednesday 9:00 AM",
      outputFile: "docs/agents/qa-report.md",
      defaultPrompt: "...",
      allowedTools: ["Read"],
    },
  },
}));

// Mock child_process.spawn
const mockStdout = { on: vi.fn() };
const mockStderr = { on: vi.fn() };
const mockProcess = {
  pid: 12345,
  stdout: mockStdout,
  stderr: mockStderr,
  on: vi.fn(),
  kill: vi.fn(),
};

vi.mock("node:child_process", () => ({
  spawn: vi.fn(() => mockProcess),
}));

import { readSessionCookie } from "@/lib/auth/github";
import { isAdminHandle } from "@/lib/auth/admin";
import { rateLimit } from "@/lib/cache/redis";
import { spawn } from "node:child_process";

// Import route handlers — they're module-level so we import after mocks
import { GET, POST, DELETE as DELETE_HANDLER } from "./route";
// We also need to reset the internal run state between tests
import { _resetRunState } from "./route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(
  method: string,
  params?: Record<string, string>,
): NextRequest {
  const url = new URL(
    "https://chapa.thecreativetoken.com/api/admin/agents/run",
  );
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }
  return new NextRequest(url, {
    method,
    headers: { cookie: "chapa_session=encrypted-value" },
  });
}

function makePostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest(
    "https://chapa.thecreativetoken.com/api/admin/agents/run",
    {
      method: "POST",
      headers: {
        cookie: "chapa_session=encrypted-value",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  _resetRunState();

  vi.stubEnv("NEXTAUTH_SECRET", "test-secret");
  vi.stubEnv("ADMIN_HANDLES", "admin1");
  vi.stubEnv("NODE_ENV", "development");

  vi.mocked(readSessionCookie).mockReturnValue({
    login: "admin1",
    name: "Admin One",
    avatar_url: "https://example.com/avatar.png",
    token: "gho_fake",
  });
  vi.mocked(isAdminHandle).mockReturnValue(true);
  vi.mocked(rateLimit).mockResolvedValue({
    allowed: true,
    current: 1,
    limit: 10,
  });

  // Reset spawn mock
  mockProcess.pid = 12345;
  mockProcess.kill.mockReset();
  mockProcess.on.mockReset();
  mockStdout.on.mockReset();
  mockStderr.on.mockReset();
  vi.mocked(spawn).mockReturnValue(mockProcess as never);
});

afterEach(() => {
  _resetRunState();
});

// ---------------------------------------------------------------------------
// POST /api/admin/agents/run
// ---------------------------------------------------------------------------

describe("POST /api/admin/agents/run", () => {
  it("returns 429 when rate limited", async () => {
    vi.mocked(rateLimit).mockResolvedValue({
      allowed: false,
      current: 11,
      limit: 10,
    });
    const res = await POST(makePostRequest({ agentKey: "coverage_agent" }));
    expect(res.status).toBe(429);
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(readSessionCookie).mockReturnValue(null);
    const res = await POST(makePostRequest({ agentKey: "coverage_agent" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 when not admin", async () => {
    vi.mocked(isAdminHandle).mockReturnValue(false);
    const res = await POST(makePostRequest({ agentKey: "coverage_agent" }));
    expect(res.status).toBe(403);
  });

  it("returns 403 when not in development mode", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const res = await POST(makePostRequest({ agentKey: "coverage_agent" }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("development");
  });

  it("allows run in production when ALLOW_AGENT_RUN is set", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_AGENT_RUN", "true");
    const res = await POST(makePostRequest({ agentKey: "coverage_agent" }));
    expect(res.status).toBe(200);
  });

  it("returns 400 for invalid agent key", async () => {
    const res = await POST(makePostRequest({ agentKey: "invalid_agent" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Unknown agent");
  });

  it("returns 400 when agentKey is missing", async () => {
    const res = await POST(makePostRequest({}));
    expect(res.status).toBe(400);
  });

  it("spawns process and returns pid", async () => {
    const res = await POST(makePostRequest({ agentKey: "coverage_agent" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.pid).toBe(12345);
    expect(body.startedAt).toBeDefined();
    expect(body.agentKey).toBe("coverage_agent");
    expect(spawn).toHaveBeenCalledTimes(1);
  });

  it("returns 409 when another agent is already running", async () => {
    // Start first agent
    await POST(makePostRequest({ agentKey: "coverage_agent" }));

    // Try to start second agent
    const res = await POST(
      makePostRequest({ agentKey: "security_scanner" }),
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("already running");
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/agents/run
// ---------------------------------------------------------------------------

describe("GET /api/admin/agents/run", () => {
  it("returns 401 when not authenticated", async () => {
    vi.mocked(readSessionCookie).mockReturnValue(null);
    const res = await GET(makeRequest("GET", { agentKey: "coverage_agent" }));
    expect(res.status).toBe(401);
  });

  it("returns 404 when no run is active", async () => {
    const res = await GET(makeRequest("GET", { agentKey: "coverage_agent" }));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("No run found");
  });

  it("returns log lines and status after POST", async () => {
    // Start agent
    await POST(makePostRequest({ agentKey: "coverage_agent" }));

    // Simulate stdout data
    const stdoutCallback = mockStdout.on.mock.calls.find(
      (c: string[]) => c[0] === "data",
    )?.[1];
    if (stdoutCallback) {
      stdoutCallback(Buffer.from("Running tests...\n"));
      stdoutCallback(Buffer.from("All tests passed\n"));
    }

    const res = await GET(
      makeRequest("GET", { agentKey: "coverage_agent", since: "0" }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("running");
    expect(body.lines).toHaveLength(2);
    expect(body.lines[0].text).toBe("Running tests...");
    expect(body.lines[0].stream).toBe("stdout");
  });

  it("returns only new lines when since offset is provided", async () => {
    await POST(makePostRequest({ agentKey: "coverage_agent" }));

    const stdoutCallback = mockStdout.on.mock.calls.find(
      (c: string[]) => c[0] === "data",
    )?.[1];
    if (stdoutCallback) {
      stdoutCallback(Buffer.from("Line 1\nLine 2\nLine 3\n"));
    }

    const res = await GET(
      makeRequest("GET", { agentKey: "coverage_agent", since: "2" }),
    );
    const body = await res.json();

    expect(body.lines).toHaveLength(1);
    expect(body.lines[0].text).toBe("Line 3");
  });

  it("strips ANSI escape codes from output", async () => {
    await POST(makePostRequest({ agentKey: "coverage_agent" }));

    const stdoutCallback = mockStdout.on.mock.calls.find(
      (c: string[]) => c[0] === "data",
    )?.[1];
    if (stdoutCallback) {
      stdoutCallback(
        Buffer.from("\x1b[32m✓\x1b[39m Test passed\n"),
      );
    }

    const res = await GET(
      makeRequest("GET", { agentKey: "coverage_agent", since: "0" }),
    );
    const body = await res.json();

    expect(body.lines[0].text).not.toContain("\x1b");
    expect(body.lines[0].text).toContain("Test passed");
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/agents/run
// ---------------------------------------------------------------------------

describe("DELETE /api/admin/agents/run", () => {
  it("returns 401 when not authenticated", async () => {
    vi.mocked(readSessionCookie).mockReturnValue(null);
    const res = await DELETE_HANDLER(
      makeRequest("DELETE", { agentKey: "coverage_agent" }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when no run is active", async () => {
    const res = await DELETE_HANDLER(
      makeRequest("DELETE", { agentKey: "coverage_agent" }),
    );
    expect(res.status).toBe(404);
  });

  it("stops a running agent", async () => {
    await POST(makePostRequest({ agentKey: "coverage_agent" }));

    const res = await DELETE_HANDLER(
      makeRequest("DELETE", { agentKey: "coverage_agent" }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("stopped");
    expect(mockProcess.kill).toHaveBeenCalled();
  });

  it("allows starting a new agent after stopping", async () => {
    await POST(makePostRequest({ agentKey: "coverage_agent" }));

    // Simulate process close after kill
    mockProcess.kill.mockImplementation(() => {
      const closeCallback = mockProcess.on.mock.calls.find(
        (c: string[]) => c[0] === "close",
      )?.[1];
      if (closeCallback) closeCallback(null);
    });

    await DELETE_HANDLER(
      makeRequest("DELETE", { agentKey: "coverage_agent" }),
    );

    // Reset spawn mock for second call
    vi.mocked(spawn).mockReturnValue({
      ...mockProcess,
      pid: 99999,
    } as never);

    const res = await POST(
      makePostRequest({ agentKey: "security_scanner" }),
    );
    expect(res.status).toBe(200);
  });
});
