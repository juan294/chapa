import { describe, it, expect } from "vitest";
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

    expect(text).toContain("Building");
    expect(text).toContain("Guarding");
    expect(text).toContain("Consistency");
    expect(text).toContain("Breadth");
    expect(text).toContain("0-100");
  });

  it("contains archetype descriptions", async () => {
    const res = getLlmsFullTxt();
    const text = await res.text();

    expect(text).toContain("Builder");
    expect(text).toContain("Guardian");
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
});
