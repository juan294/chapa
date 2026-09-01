import { describe, it, expect } from "vitest";
import { SITE_TOOL_MAP } from "@/lib/webmcp/site-tool-map";
import { GET as getLlmsFullTxt } from "./route";

describe("GET /llms-full.txt", () => {
  it("returns text/plain with correct cache headers", () => {
    const res = getLlmsFullTxt();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(res.headers.get("cache-control")).toContain("s-maxage=86400");
  });

  it("is substantially longer than basic llms.txt", async () => {
    const res = getLlmsFullTxt();
    const text = await res.text();

    // llms-full.txt should be significantly more detailed
    expect(text.length).toBeGreaterThan(2000);
  });

  it("contains detailed scoring methodology", async () => {
    const res = getLlmsFullTxt();
    const text = await res.text();

    expect(text).toContain("Delivery");
    expect(text).toContain("Quality");
    expect(text).toContain("Consistency");
    expect(text).toContain("Breadth");
    expect(text).toContain("0-100");
  });

  it("contains archetype descriptions", async () => {
    const res = getLlmsFullTxt();
    const text = await res.text();

    expect(text).toContain("Builder");
    expect(text).toContain("Quality Champion");
    expect(text).toContain("Marathoner");
    expect(text).toContain("Polymath");
    expect(text).toContain("Balanced");
    expect(text).toContain("Emerging");
  });

  it("contains API and embedding documentation", async () => {
    const res = getLlmsFullTxt();
    const text = await res.text();

    expect(text).toContain("badge.svg");
    expect(text).toContain("Markdown");
    expect(text).toContain("HTML");
    expect(text).toContain("Creator Studio");
  });

  it("lists every registered WebMCP tool", async () => {
    const text = await getLlmsFullTxt().text();

    for (const entry of SITE_TOOL_MAP) {
      for (const tool of entry.tools) {
        expect(text).toContain(tool);
      }
    }
  });

  it("mentions WebMCP by name", async () => {
    expect(await getLlmsFullTxt().text()).toContain("WebMCP");
  });

  it("advertises the remote Streamable HTTP MCP endpoint", async () => {
    const text = await getLlmsFullTxt().text();
    expect(text).toContain("https://chapa.thecreativetoken.com/api/mcp");
    expect(text).toContain("Streamable HTTP");
    expect(text).toContain("same 9 public read-only tools");
  });

  it("lists all seven Creator Studio badge categories", async () => {
    const res = getLlmsFullTxt();
    const text = await res.text();

    expect(text).toContain(
      "Creator Studio**: Visual customization tool at /studio with 7 categories (background, card style, border, score effect, heatmap animation, tier treatment, color palette), every one of which renders in the embeddable badge.",
    );
  });

  it("limits cryptographic claims to badges marked Verified metrics", async () => {
    const res = getLlmsFullTxt();
    const text = await res.text();

    expect(text).toContain('Badges marked "Verified metrics"');
    expect(text).toContain('Badges marked "Public metrics"');
    expect(text).not.toContain(
      "Each badge includes a cryptographic verification hash",
    );
  });
});
