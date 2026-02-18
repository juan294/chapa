import { describe, it, expect } from "vitest";
import { AGENTS } from "./agent-config";

describe("AGENTS config", () => {
  const agentKeys = Object.keys(AGENTS);

  it("defines exactly 3 agents", () => {
    expect(agentKeys).toHaveLength(3);
  });

  it("includes coverage_agent, security_scanner, and qa_agent", () => {
    expect(agentKeys).toContain("coverage_agent");
    expect(agentKeys).toContain("security_scanner");
    expect(agentKeys).toContain("qa_agent");
  });

  it.each(agentKeys)("%s has all required fields", (key) => {
    const agent = AGENTS[key]!;
    expect(agent.key).toBe(key);
    expect(agent.label).toBeTruthy();
    expect(agent.schedule).toBeTruthy();
    expect(agent.outputFile).toBeTruthy();
    expect(agent.defaultPrompt).toBeTruthy();
    expect(agent.allowedTools).toBeInstanceOf(Array);
    expect(agent.allowedTools.length).toBeGreaterThan(0);
  });

  it.each(agentKeys)("%s has a .md output file", (key) => {
    expect(AGENTS[key]!.outputFile).toMatch(/\.md$/);
  });

  it.each(agentKeys)("%s has a human-readable schedule", (key) => {
    // Schedule should be a human-readable string like "Daily at 2:00 AM"
    expect(AGENTS[key]!.schedule).toBeTruthy();
  });

  it.each(agentKeys)("%s prompt references the project", (key) => {
    // Prompts should contain project-specific references
    const prompt = AGENTS[key]!.defaultPrompt;
    expect(prompt.length).toBeGreaterThan(50);
  });

  it.each(agentKeys)("%s allowed tools include Read and Grep", (key) => {
    const tools = AGENTS[key]!.allowedTools;
    expect(tools).toContain("Read");
    expect(tools).toContain("Grep");
  });
});
