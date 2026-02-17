import { describe, it, expect } from "vitest";
import { GET as getLlmsTxt } from "./route";

describe("GET /llms.txt", () => {
  it("returns text/plain with correct cache headers", () => {
    const res = getLlmsTxt();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(res.headers.get("cache-control")).toContain("s-maxage=86400");
  });

  it("contains key SEO terms for discoverability", async () => {
    const res = getLlmsTxt();
    const text = await res.text();

    // Core product terms
    expect(text).toContain("developer impact");
    expect(text).toContain("GitHub");
    expect(text).toContain("badge");
    expect(text).toContain("SVG");

    // Impact dimensions
    expect(text).toContain("Building");
    expect(text).toContain("Guarding");
    expect(text).toContain("Consistency");
    expect(text).toContain("Breadth");

    // Archetypes
    expect(text).toContain("Builder");
    expect(text).toContain("Guardian");
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
    const res = getLlmsTxt();
    const text = await res.text();

    expect(text).toContain("/u/{handle}/badge.svg");
    expect(text).toContain("/about/scoring");
    expect(text).toContain("/llms-full.txt");
  });
});
