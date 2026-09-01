import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  enabled: vi.fn(async () => true),
  rateLimit: vi.fn(async () => ({ allowed: true, current: 1, limit: 60 })),
  getClientIp: vi.fn(() => "1.2.3.4"),
  scheduleServerEvent: vi.fn(),
  execute: vi.fn(async (input: unknown) => JSON.stringify({ echoed: input })),
}));

vi.mock("@/lib/feature-flags", () => ({ isMcpServerEnabled: mocks.enabled }));
vi.mock("@/lib/cache/redis", () => ({ rateLimit: mocks.rateLimit }));
vi.mock("@/lib/http/client-ip", () => ({
  getClientIp: mocks.getClientIp,
  NO_TRUSTED_IP: "unknown",
}));
vi.mock("@/lib/analytics/server-errors", () => ({
  withErrorCapture: (_route: string, handler: unknown) => handler,
}));
vi.mock("@/lib/analytics/schedule-server-event", () => ({
  scheduleServerEvent: mocks.scheduleServerEvent,
}));
vi.mock("@/lib/webmcp/server-tools", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/lib/webmcp/server-tools")
  >();
  return {
    ...actual,
    SERVER_MCP_TOOLS: [
      "get_site_capabilities",
      "find_profile",
      "get_impact_profile",
      "get_impact_history",
      "verify_badge",
      "explain_verification",
      "explain_dimension",
      "compare_profiles",
      "get_embed_snippet",
    ].map((name, index) => ({
      name,
      description: `Read tool ${index}`,
      inputSchema: {
        type: "object",
        properties: index === 0 ? {} : { handle: { type: "string" } },
        additionalProperties: false,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
        untrustedContentHint: index > 0,
      },
      execute: mocks.execute,
    })),
  };
});

import { DELETE, GET, POST } from "./route";

function request(body: unknown, userAgent = "modelcontextprotocol-mcp-client/2.0") {
  return new NextRequest("http://localhost:3001/api/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "x-vercel-forwarded-for": "1.2.3.4",
      "user-agent": userAgent,
    },
    body: JSON.stringify(body),
  });
}

async function jsonRpc(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  const data = text.startsWith("event:")
    ? text.match(/^data: (.+)$/m)?.[1]
    : text;
  if (!data) throw new Error(`Missing JSON-RPC body: ${text}`);
  return JSON.parse(data) as Record<string, unknown>;
}

describe("/api/mcp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enabled.mockResolvedValue(true);
    mocks.rateLimit.mockResolvedValue({ allowed: true, current: 1, limit: 60 });
  });

  it("returns 503 before rate limiting when the MCP flag is off", async () => {
    mocks.enabled.mockResolvedValueOnce(false);
    const response = await POST(request({ jsonrpc: "2.0", id: 1, method: "tools/list" }));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual(expect.objectContaining({
      error: expect.any(String),
      hint: expect.any(String),
    }));
    expect(mocks.rateLimit).not.toHaveBeenCalled();
  });

  it("rate limits by client IP before dispatch", async () => {
    mocks.rateLimit.mockResolvedValueOnce({ allowed: false, current: 61, limit: 60 });
    const response = await POST(request({ jsonrpc: "2.0", id: 1, method: "tools/list" }));

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(mocks.rateLimit).toHaveBeenCalledWith("ratelimit:mcp:1.2.3.4", 60, 60);
  });

  it("uses a stricter shared fail-open bucket without a trusted IP", async () => {
    mocks.getClientIp.mockReturnValueOnce("unknown");

    const response = await POST(request({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
      params: {},
    }));

    expect(response.status).toBe(200);
    expect(mocks.rateLimit).toHaveBeenCalledWith(
      "ratelimit:mcp:untrusted",
      10,
      60,
    );
  });

  it("lists 9 tools with raw catalog schemas and read-only annotations", async () => {
    const response = await POST(request({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
      params: {},
    }));
    const body = await jsonRpc(response);
    const result = body.result as { tools: Array<Record<string, unknown>> };

    expect(response.status).toBe(200);
    expect(result.tools).toHaveLength(9);
    expect(result.tools.map(({ name }) => name)).toEqual([
      "get_site_capabilities",
      "find_profile",
      "get_impact_profile",
      "get_impact_history",
      "verify_badge",
      "explain_verification",
      "explain_dimension",
      "compare_profiles",
      "get_embed_snippet",
    ]);
    expect(result.tools[0]).toEqual(expect.objectContaining({
      name: "get_site_capabilities",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
        untrustedContentHint: false,
      },
    }));
    expect(result.tools[2]).toEqual(expect.objectContaining({
      name: "get_impact_profile",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
        untrustedContentHint: true,
      },
    }));
  });

  it("round-trips a tools/call through the hand-written executor", async () => {
    const response = await POST(request({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "find_profile", arguments: { handle: "octocat" } },
    }));
    const body = await jsonRpc(response);
    const result = body.result as { content: Array<{ text: string }> };

    expect(response.status).toBe(200);
    expect(JSON.parse(result.content[0]!.text)).toEqual({
      echoed: { handle: "octocat" },
    });
    expect(mocks.execute).toHaveBeenCalledWith({ handle: "octocat" });
    expect(mocks.scheduleServerEvent).toHaveBeenCalledWith("mcp_tool_called", {
      tool: "find_profile",
      outcome: "ok",
      durationMs: expect.any(Number),
      agentClass: "mcp-client",
    });
  });

  it("classifies recovery strings as invalid input", async () => {
    mocks.execute.mockResolvedValueOnce(
      "Invalid input for find_profile: handle must be a public GitHub handle.",
    );

    const response = await POST(request({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "find_profile", arguments: { handle: "-bad" } },
    }, "ClaudeBot/1.0"));

    expect(response.status).toBe(200);
    expect(mocks.scheduleServerEvent).toHaveBeenCalledWith("mcp_tool_called", {
      tool: "find_profile",
      outcome: "invalid_input",
      durationMs: expect.any(Number),
      agentClass: "anthropic",
    });
  });

  it("preserves thrown tool errors and emits an error outcome", async () => {
    mocks.execute.mockRejectedValueOnce(new Error("tool exploded"));

    const response = await POST(request({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "find_profile", arguments: { handle: "octocat" } },
    }, "PerplexityBot/1.0"));
    const body = await jsonRpc(response);

    expect(JSON.stringify(body)).toContain(
      "find_profile is unavailable right now. Please try again later.",
    );
    expect(mocks.scheduleServerEvent).toHaveBeenCalledWith("mcp_tool_called", {
      tool: "find_profile",
      outcome: "error",
      durationMs: expect.any(Number),
      agentClass: "perplexity",
    });
  });

  it("returns explanatory JSON 405 responses for GET and DELETE", async () => {
    for (const handler of [GET, DELETE]) {
      const response = await handler();
      expect(response.status).toBe(405);
      expect(response.headers.get("allow")).toBe("POST");
      await expect(response.json()).resolves.toEqual(expect.objectContaining({
        error: expect.any(String),
      }));
    }
  });
});
