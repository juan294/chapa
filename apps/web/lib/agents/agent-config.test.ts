import { describe, it, expect } from "vitest";
import { AGENTS } from "./agent-config";

describe("AGENTS config", () => {
  const agentKeys = Object.keys(AGENTS);

  it("defines exactly 7 agents", () => {
    expect(agentKeys).toHaveLength(7);
  });

  it("includes all 7 agent keys", () => {
    expect(agentKeys).toContain("coverage_agent");
    expect(agentKeys).toContain("security_scanner");
    expect(agentKeys).toContain("qa_agent");
    expect(agentKeys).toContain("performance_agent");
    expect(agentKeys).toContain("documentation_agent");
    expect(agentKeys).toContain("cost_analyst");
    expect(agentKeys).toContain("localization_agent");
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
    expect(AGENTS[key]!.schedule).toBeTruthy();
  });

  it.each(agentKeys)("%s prompt references the project", (key) => {
    const prompt = AGENTS[key]!.defaultPrompt;
    expect(prompt.length).toBeGreaterThan(50);
  });

  it.each(agentKeys)("%s allowed tools include Read and Grep", (key) => {
    const tools = AGENTS[key]!.allowedTools;
    expect(tools).toContain("Read");
    expect(tools).toContain("Grep");
  });

  // Agent-specific schedule tests
  it("performance_agent runs weekly", () => {
    expect(AGENTS.performance_agent!.schedule).toMatch(/weekly/i);
  });

  it("documentation_agent runs weekly", () => {
    expect(AGENTS.documentation_agent!.schedule).toMatch(/weekly/i);
  });

  it("cost_analyst runs daily", () => {
    expect(AGENTS.cost_analyst!.schedule).toMatch(/daily/i);
  });

  it("localization_agent runs weekly", () => {
    expect(AGENTS.localization_agent!.schedule).toMatch(/weekly/i);
  });
});
