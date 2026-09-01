import { beforeEach, describe, it, expect, vi } from "vitest";
import { SITE_TOOL_MAP } from "@/lib/webmcp/site-tool-map";

const captureServerEvent = vi.hoisted(() => vi.fn());

vi.mock("@/lib/analytics/server-errors", () => ({ captureServerEvent }));

import { GET as getLlmsFullTxt } from "./route";

function request(userAgent?: string): Request {
  return new Request("http://localhost:3001/llms-full.txt", {
    headers: userAgent ? { "user-agent": userAgent } : undefined,
  });
}

describe("GET /llms-full.txt", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns text/plain with correct cache headers", () => {
    const res = getLlmsFullTxt(request());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(res.headers.get("cache-control")).toContain("s-maxage=86400");
  });

  it("is substantially longer than basic llms.txt", async () => {
    const res = getLlmsFullTxt(request());
    const text = await res.text();

    // llms-full.txt should be significantly more detailed
    expect(text.length).toBeGreaterThan(2000);
  });

  it("contains detailed scoring methodology", async () => {
    const res = getLlmsFullTxt(request());
    const text = await res.text();

    expect(text).toContain("Delivery");
    expect(text).toContain("Quality");
    expect(text).toContain("Consistency");
    expect(text).toContain("Breadth");
    expect(text).toContain("0-100");
  });

  it("contains archetype descriptions", async () => {
    const res = getLlmsFullTxt(request());
    const text = await res.text();

    expect(text).toContain("Builder");
    expect(text).toContain("Quality Champion");
    expect(text).toContain("Marathoner");
    expect(text).toContain("Polymath");
    expect(text).toContain("Balanced");
    expect(text).toContain("Emerging");
  });

  it("contains API and embedding documentation", async () => {
    const res = getLlmsFullTxt(request());
    const text = await res.text();

    expect(text).toContain("badge.svg");
    expect(text).toContain("Markdown");
    expect(text).toContain("HTML");
    expect(text).toContain("Creator Studio");
  });

  it("lists every registered WebMCP tool", async () => {
    const text = await getLlmsFullTxt(request()).text();

    for (const entry of SITE_TOOL_MAP) {
      for (const tool of entry.tools) {
        expect(text).toContain(tool);
      }
    }
  });

  it("mentions WebMCP by name", async () => {
    expect(await getLlmsFullTxt(request()).text()).toContain("WebMCP");
  });

  it("advertises the remote Streamable HTTP MCP endpoint", async () => {
    const text = await getLlmsFullTxt(request()).text();
    expect(text).toContain("https://chapa.thecreativetoken.com/api/mcp");
    expect(text).toContain("Streamable HTTP");
    expect(text).toContain("same 9 public read-only tools");
  });

  it("lists all seven Creator Studio badge categories", async () => {
    const res = getLlmsFullTxt(request());
    const text = await res.text();

    expect(text).toContain(
      "Creator Studio**: Visual customization tool at /studio with 7 categories (background, card style, border, score effect, heatmap animation, tier treatment, color palette), every one of which renders in the embeddable badge.",
    );
  });

  it("limits cryptographic claims to badges marked Verified metrics", async () => {
    const res = getLlmsFullTxt(request());
    const text = await res.text();

    expect(text).toContain('Badges marked "Verified metrics"');
    expect(text).toContain('Badges marked "Public metrics"');
    expect(text).not.toContain(
      "Each badge includes a cryptographic verification hash",
    );
  });

  it("captures classified agent traffic", () => {
    const ua = "GPTBot/1.2 (+https://openai.com/gptbot)";
    getLlmsFullTxt(request(ua));

    expect(captureServerEvent).toHaveBeenCalledWith("agent_surface_fetch", {
      surface: "llms-full.txt",
      agentClass: "openai",
      ua,
    });
  });

  it("does not capture normal browser traffic", () => {
    getLlmsFullTxt(request("Mozilla/5.0 Chrome/128.0.0.0 Safari/537.36"));
    expect(captureServerEvent).not.toHaveBeenCalled();
  });
});
