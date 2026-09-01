import type { StandardSchemaWithJSON, ToolAnnotations } from "@modelcontextprotocol/server";
import { createMcpHandler } from "mcp-handler";
import { NextResponse, type NextRequest } from "next/server";
import { withErrorCapture } from "@/lib/analytics/server-errors";
import { rateLimit } from "@/lib/cache/redis";
import { isMcpServerEnabled } from "@/lib/feature-flags";
import { getClientIp, NO_TRUSTED_IP } from "@/lib/http/client-ip";
import { WEBMCP_INVALID_INPUT_PREFIX } from "@/lib/webmcp/errors";
import { SERVER_MCP_TOOLS } from "@/lib/webmcp/server-tools";
import packageJson from "@/package.json";

function rawJsonSchema(
  schema: Record<string, unknown>,
): StandardSchemaWithJSON<unknown, unknown> {
  return {
    "~standard": {
      version: 1,
      vendor: "chapa",
      // Chapa's handlers validate manually so invalid input returns recovery
      // instructions instead of an SDK-generated protocol error.
      validate: (value) => ({ value }),
      // Return the catalog object itself. This keeps WebMCP and remote MCP on
      // one byte-for-byte JSON Schema contract without translating to Zod.
      jsonSchema: {
        input: () => schema,
        output: () => schema,
      },
    },
  };
}

const mcpHandler = createMcpHandler(
  (server) => {
    for (const tool of SERVER_MCP_TOOLS) {
      server.registerTool(
        tool.name,
        {
          description: tool.description,
          inputSchema: rawJsonSchema(tool.inputSchema),
          // `untrustedContentHint` is part of Chapa's WebMCP annotations and
          // is preserved on the wire by the SDK even though its public type
          // currently lists only the core MCP annotation keys.
          annotations: tool.annotations as ToolAnnotations,
        },
        async (inputs) => {
          const text = await tool.execute(inputs);
          return {
            content: [{ type: "text", text }],
            ...(text.startsWith(WEBMCP_INVALID_INPUT_PREFIX) && {
              isError: true,
            }),
          };
        },
      );
    }
  },
  {
    serverInfo: { name: "chapa", version: packageJson.version },
    maxSubscriptions: 0,
  },
);

export const POST = withErrorCapture("/api/mcp", async (request: NextRequest) => {
  if (!(await isMcpServerEnabled())) {
    return NextResponse.json(
      {
        error: "Remote MCP endpoint is disabled.",
        hint: "Use Chapa's browser WebMCP tools or try again after the endpoint is enabled.",
      },
      { status: 503 },
    );
  }

  const ip = getClientIp(request);
  const limit = ip === NO_TRUSTED_IP
    ? await rateLimit("ratelimit:mcp:untrusted", 10, 60)
    : await rateLimit(`ratelimit:mcp:${ip}`, 60, 60);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many MCP requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  return mcpHandler(request);
});

function methodNotAllowed(): Response {
  return NextResponse.json(
    {
      error: "This stateless MCP endpoint accepts POST requests only.",
      hint: "Send MCP Streamable HTTP JSON-RPC requests with POST /api/mcp.",
    },
    { status: 405, headers: { Allow: "POST" } },
  );
}

export function GET(): Response {
  return methodNotAllowed();
}

export function DELETE(): Response {
  return methodNotAllowed();
}
