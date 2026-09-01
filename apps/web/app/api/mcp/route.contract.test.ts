import { describe, it, vi } from "vitest";
import { declareField, generatePayloads, runMatrix } from "@/test/contract/payload-matrix";
import { invokeJson } from "@/test/contract/invoke";

vi.mock("@/lib/webmcp/server-tools", () => ({
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
  ].map((name) => ({
    name,
    description: `Contract fixture for ${name}`,
    inputSchema: {
      type: "object",
      properties: { handle: { type: "string" } },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    execute: async () => JSON.stringify({ ok: true }),
  })),
}));

// Literal import required by check:write-registration.
import { POST } from "./route";

describe("POST /api/mcp contract", () => {
  it("runs the JSON-RPC envelope matrix with zero 5xx", async () => {
    const fields = [
      declareField("jsonrpc", {
        candidates: ["2.0", "1.0", "", 2],
        includeAbsent: true,
        includeNull: true,
        typical: "2.0",
      }),
      declareField("id", {
        candidates: [1, "request-1", 0, false],
        includeAbsent: true,
        includeNull: true,
        typical: 1,
      }),
      declareField("method", {
        candidates: ["tools/list", "tools/call", "initialize", "unknown", ""],
        includeAbsent: true,
        includeNull: true,
        typical: "tools/list",
      }),
      declareField("params.name", {
        candidates: ["get_site_capabilities", "missing_tool", "", 1],
        includeAbsent: true,
        includeNull: true,
        typical: "get_site_capabilities",
      }),
      declareField("params.arguments.handle", {
        candidates: ["octocat", "-bad", "", 1, { nested: true }],
        includeAbsent: true,
        includeNull: true,
        typical: "octocat",
      }),
    ];
    const payloads = generatePayloads({
      fields,
      seed: 0x4d4350,
      randomCount: 80,
    });

    await runMatrix(
      payloads,
      (payload) =>
        invokeJson(POST, {
          method: "POST",
          path: "/api/mcp",
          body: payload,
          headers: {
            Accept: "application/json, text/event-stream",
            "x-vercel-forwarded-for": "1.2.3.4",
          },
        }),
      { allowedStatuses: [400, 405, 406, 415] },
    );
  });
});
