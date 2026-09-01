import { describe, expect, it } from "vitest";
import { classifyAgentUserAgent } from "./agent-ua";

describe("classifyAgentUserAgent", () => {
  it.each([
    ["GPTBot/1.2", "openai"],
    ["ChatGPT-User/1.0", "openai"],
    ["OAI-SearchBot/1.0", "openai"],
    ["ClaudeBot/1.0", "anthropic"],
    ["Claude-User", "anthropic"],
    ["claude-web", "anthropic"],
    ["anthropic-ai", "anthropic"],
    ["PerplexityBot/1.0", "perplexity"],
    ["Perplexity-User/1.0", "perplexity"],
    ["Google-Extended", "google"],
    ["GoogleOther", "google"],
    ["meta-externalagent/1.1", "meta"],
    ["modelcontextprotocol-mcp-client/2.0", "mcp-client"],
    ["ExampleCrawler/1.0", "generic-bot"],
  ] as const)("classifies %s as %s", (ua, expected) => {
    expect(classifyAgentUserAgent(ua)).toBe(expected);
  });

  it("matches agent identifiers case-insensitively", () => {
    expect(classifyAgentUserAgent("gPtBoT/1.2")).toBe("openai");
  });

  it.each([
    null,
    "",
    "node-fetch/1.0 (+https://github.com/node-fetch/node-fetch)",
    "undici",
    "Mozilla/5.0 Chrome/128.0.0.0 Safari/537.36",
    "Mozilla/5.0 Version/17.6 Safari/605.1.15",
  ])("does not classify non-agent UA %s", (ua) => {
    expect(classifyAgentUserAgent(ua)).toBeNull();
  });
});
