import { beforeEach, describe, expect, it, vi } from "vitest";
import { SITE_TOOL_MAP } from "@/lib/webmcp/site-tool-map";

const captureServerEvent = vi.hoisted(() => vi.fn());

vi.mock("@/lib/analytics/server-errors", () => ({ captureServerEvent }));

import { GET as getMcpDescriptor } from "./route";

function request(userAgent?: string): Request {
  return new Request("http://localhost:3001/.well-known/mcp.json", {
    headers: userAgent ? { "user-agent": userAgent } : undefined,
  });
}

describe("GET /.well-known/mcp.json", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the machine-readable WebMCP descriptor", async () => {
    const response = getMcpDescriptor(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json");
    expect(body).toHaveProperty("webmcp");
    expect(body).toEqual(expect.objectContaining({
      mcpEndpoint: "https://chapa.thecreativetoken.com/api/mcp",
      transport: expect.stringContaining("Streamable HTTP"),
    }));

    const serialized = JSON.stringify(body);
    for (const entry of SITE_TOOL_MAP) {
      for (const tool of entry.tools) {
        expect(serialized).toContain(tool);
      }
    }
  });

  it("captures classified agent traffic", () => {
    const ua = "GPTBot/1.2 (+https://openai.com/gptbot)";
    getMcpDescriptor(request(ua));

    expect(captureServerEvent).toHaveBeenCalledWith("agent_surface_fetch", {
      surface: ".well-known/mcp.json",
      agentClass: "openai",
      ua,
    });
  });

  it("does not capture normal browser traffic", () => {
    getMcpDescriptor(request("Mozilla/5.0 Chrome/128.0.0.0 Safari/537.36"));
    expect(captureServerEvent).not.toHaveBeenCalled();
  });
});
