import { beforeEach, describe, it, expect, vi } from "vitest";
import { SITE_TOOL_MAP } from "@/lib/webmcp/site-tool-map";

const scheduleAgentSurfaceFetch = vi.hoisted(() => vi.fn());

vi.mock("@/lib/analytics/schedule-server-event", () => ({
  scheduleAgentSurfaceFetch,
}));

import { GET as getLlmsTxt } from "./route";

function request(userAgent?: string): Request {
  return new Request("http://localhost:3001/llms.txt", {
    headers: userAgent ? { "user-agent": userAgent } : undefined,
  });
}

describe("GET /llms.txt", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns text/plain with correct cache headers", () => {
    const res = getLlmsTxt(request());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(res.headers.get("cache-control")).toContain("s-maxage=86400");
  });

  it("contains key SEO terms for discoverability", async () => {
    const res = getLlmsTxt(request());
    const text = await res.text();

    // Core product terms
    expect(text).toContain("developer impact");
    expect(text).toContain("GitHub");
    expect(text).toContain("badge");
    expect(text).toContain("SVG");

    // Impact dimensions
    expect(text).toContain("Delivery");
    expect(text).toContain("Quality");
    expect(text).toContain("Consistency");
    expect(text).toContain("Breadth");

    // Archetypes
    expect(text).toContain("Builder");
    expect(text).toContain("Quality Champion");
    expect(text).toContain("Marathoner");
    expect(text).toContain("Polymath");
    expect(text).toContain("Balanced");
    expect(text).toContain("Emerging");

    // Tier system
    expect(text).toContain("Solid");
    expect(text).toContain("High");
    expect(text).toContain("Elite");
  });

  it("includes links to key pages", async () => {
    const res = getLlmsTxt(request());
    const text = await res.text();

    expect(text).toContain("/u/{handle}/badge.svg");
    expect(text).toContain("/about/scoring");
    expect(text).toContain("/llms-full.txt");
  });

  it("lists every registered WebMCP tool", async () => {
    const text = await getLlmsTxt(request()).text();

    for (const entry of SITE_TOOL_MAP) {
      for (const tool of entry.tools) {
        expect(text).toContain(tool);
      }
    }
  });

  it("mentions WebMCP by name", async () => {
    expect(await getLlmsTxt(request()).text()).toContain("WebMCP");
  });

  it("advertises the remote Streamable HTTP MCP endpoint", async () => {
    const text = await getLlmsTxt(request()).text();
    expect(text).toContain("https://chapa.thecreativetoken.com/api/mcp");
    expect(text).toContain("Streamable HTTP");
    expect(text).toContain("same 9 public read-only tools");
  });

  it("limits cryptographic claims to badges marked Verified metrics", async () => {
    const res = getLlmsTxt(request());
    const text = await res.text();

    expect(text).toContain('Badges marked "Verified metrics"');
    expect(text).toContain('Badges marked "Public metrics"');
    expect(text).not.toContain(
      "Every badge includes a cryptographic HMAC-SHA256 hash",
    );
  });

  it("describes named processing providers without claiming data is not shared", async () => {
    const text = await getLlmsTxt(request()).text();
    expect(text).toContain("No personal data is sold.");
    expect(text).toContain("https://chapa.thecreativetoken.com/privacy");
    expect(text).not.toContain("sold or shared with third parties");
  });

  it("delegates agent-surface scheduling", () => {
    const req = request("GPTBot/1.2 (+https://openai.com/gptbot)");
    getLlmsTxt(req);
    expect(scheduleAgentSurfaceFetch).toHaveBeenCalledWith(req, "llms.txt");
  });
});
