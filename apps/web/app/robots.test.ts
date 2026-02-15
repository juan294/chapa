import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  getBaseUrl: () => "https://chapa.thecreativetoken.com",
}));

import robots from "./robots";

describe("robots.ts", () => {
  it("returns a valid robots configuration", () => {
    const result = robots();

    expect(result).toHaveProperty("rules");
    expect(result).toHaveProperty("sitemap");
    expect(Array.isArray(result.rules)).toBe(true);
  });

  it("allows root and badge paths", () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    const mainRule = rules[0]!;

    expect(mainRule.userAgent).toBe("*");
    expect(mainRule.allow).toContain("/");
    expect(mainRule.allow).toContain("/u/*/badge.svg");
  });

  it("disallows /api/, /admin/, and /experiments/", () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    const mainRule = rules[0]!;

    expect(mainRule.disallow).toContain("/api/");
    expect(mainRule.disallow).toContain("/admin/");
    expect(mainRule.disallow).toContain("/experiments/");
  });

  it("disallows /generating/ and /cli/", () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    const mainRule = rules[0]!;

    expect(mainRule.disallow).toContain("/generating/");
    expect(mainRule.disallow).toContain("/cli/");
  });

  it("includes sitemap URL with production base", () => {
    const result = robots();

    expect(result.sitemap).toBe(
      "https://chapa.thecreativetoken.com/sitemap.xml",
    );
  });
});
