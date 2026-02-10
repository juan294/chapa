import { describe, it, expect } from "vitest";
import { GET } from "./route";

describe("llms.txt route", () => {
  it("returns a Response object", () => {
    const response = GET();
    expect(response).toBeInstanceOf(Response);
  });

  it("returns text/plain content type", () => {
    const response = GET();
    expect(response.headers.get("content-type")).toBe(
      "text/plain; charset=utf-8",
    );
  });

  it("returns 200 status", () => {
    const response = GET();
    expect(response.status).toBe(200);
  });

  it("contains Chapa description", async () => {
    const response = GET();
    const text = await response.text();
    expect(text).toContain("Chapa");
  });

  it("mentions key endpoints", async () => {
    const response = GET();
    const text = await response.text();
    expect(text).toContain("/u/{handle}/badge.svg");
    expect(text).toContain("/u/{handle}");
  });

  it("mentions GitHub", async () => {
    const response = GET();
    const text = await response.text();
    expect(text).toContain("GitHub");
  });

  it("mentions impact score", async () => {
    const response = GET();
    const text = await response.text();
    expect(text.toLowerCase()).toContain("impact");
  });

  it("includes caching headers", () => {
    const response = GET();
    const cacheControl = response.headers.get("cache-control");
    expect(cacheControl).toBeDefined();
    expect(cacheControl).toContain("public");
  });
});
