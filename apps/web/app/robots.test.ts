import { describe, it, expect } from "vitest";
import robots from "./robots";

describe("robots.ts", () => {
  it("exports a default function that returns robots config", () => {
    const result = robots();
    expect(result).toBeDefined();
    expect(result.rules).toBeDefined();
  });

  it("allows all user agents by default", () => {
    const result = robots();
    // rules can be an array or single object
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    const wildcardRule = rules.find(
      (r) => r.userAgent === "*" || (Array.isArray(r.userAgent) && r.userAgent.includes("*")),
    );
    expect(wildcardRule).toBeDefined();
    expect(wildcardRule!.allow).toBe("/");
  });

  it("includes sitemap URL", () => {
    const result = robots();
    expect(result.sitemap).toContain("/sitemap.xml");
  });

  it("uses production base URL in sitemap", () => {
    const result = robots();
    expect(result.sitemap).toBe(
      "https://chapa.thecreativetoken.com/sitemap.xml",
    );
  });

  it("disallows /api/ paths", () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    const wildcardRule = rules.find(
      (r) => r.userAgent === "*" || (Array.isArray(r.userAgent) && r.userAgent.includes("*")),
    );
    expect(wildcardRule!.disallow).toContain("/api/");
  });

  it("disallows /experiments/ paths", () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    const wildcardRule = rules.find(
      (r) => r.userAgent === "*" || (Array.isArray(r.userAgent) && r.userAgent.includes("*")),
    );
    const disallows = Array.isArray(wildcardRule!.disallow)
      ? wildcardRule!.disallow
      : [wildcardRule!.disallow];
    expect(disallows).toContain("/experiments/");
  });

  it("explicitly allows AI/LLM crawlers", () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    const aiCrawlers = [
      "GPTBot",
      "ChatGPT-User",
      "ClaudeBot",
      "Claude-Web",
      "Applebot",
      "Bytespider",
    ];
    for (const crawler of aiCrawlers) {
      const rule = rules.find(
        (r) => r.userAgent === crawler || (Array.isArray(r.userAgent) && r.userAgent.includes(crawler)),
      );
      expect(rule, `Expected rule for ${crawler}`).toBeDefined();
      expect(rule!.allow).toBe("/");
    }
  });
});
