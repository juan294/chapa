import { describe, expect, it } from "vitest";
import { SITE_TOOL_MAP } from "@/lib/webmcp/site-tool-map";
import { GET as getMcpDescriptor } from "./route";

describe("GET /.well-known/mcp.json", () => {
  it("returns the machine-readable WebMCP descriptor", async () => {
    const response = getMcpDescriptor();
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
});
