import { captureServerEvent } from "@/lib/analytics/server-errors";
import { classifyAgentUserAgent } from "@/lib/analytics/agent-ua";
import { SITE_TOOL_MAP } from "@/lib/webmcp/site-tool-map";

const BODY = JSON.stringify(
  {
    name: "Chapa",
    description:
      "Browser-native WebMCP tools for developer impact profiles, badge design, and verification.",
    homepage: "https://chapa.thecreativetoken.com",
    webmcp: { pages: SITE_TOOL_MAP },
    mcpEndpoint: "https://chapa.thecreativetoken.com/api/mcp",
    transport:
      "Stateless Streamable HTTP with 9 public read-only tools shared with the WebMCP catalog.",
    llms: ["/llms.txt", "/llms-full.txt"],
  },
  null,
  2,
);

export function GET(request: Request): Response {
  const ua = request.headers.get("user-agent");
  const agentClass = classifyAgentUserAgent(ua);
  if (agentClass) {
    void captureServerEvent("agent_surface_fetch", {
      surface: ".well-known/mcp.json",
      agentClass,
      ua: (ua ?? "").slice(0, 200),
    });
  }
  return new Response(BODY, {
    status: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "public, s-maxage=86400, stale-while-revalidate=86400",
    },
  });
}
