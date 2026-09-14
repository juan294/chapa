import { describe, it, expect } from "vitest";
import { createLandingCommands, LANDING_SECTIONS } from "./landing-commands";
import { executeCommand } from "../terminal/command-registry";

describe("landing command scope", () => {
  const commands = createLandingCommands();
  it("selects all seven known archetypes and five dimensions", () => {
    for (const id of ["builder", "guardian", "marathoner", "polymath", "artificer", "balanced", "emerging"]) {
      expect(executeCommand(`/archetypes ${id}`, commands).action).toEqual({type: "custom", event: "chapa:landing-archetype", detail: {id}});
    }
    for (const id of ["delivery", "quality", "consistency", "breadth", "craft"]) {
      expect(executeCommand(`/dimensions ${id}`, commands).action).toEqual({type: "custom", event: "chapa:landing-dimension", detail: {id}});
    }
  });
  it("rejects unknown IDs, inherited keys and surplus arguments", () => {
    for (const input of ["/section constructor", "/section unknown", "/dimensions wat", "/archetypes builder extra"]) {
      expect(executeCommand(input, commands).action).toBeUndefined();
      expect(executeCommand(input, commands).lines[0]?.type).toBe("error");
    }
  });
  it("uses the fixed section map and honest sample identity", () => {
    expect(Object.keys(LANDING_SECTIONS)).toEqual(["hero", "identity", "features", "scoring", "how-it-works", "embed", "enterprise", "agent-tools", "trust", "closing"]);
    for (const [id, target] of Object.entries(LANDING_SECTIONS)) expect(executeCommand(`/section ${id}`, commands).action).toEqual({type: "custom", event: "chapa:landing-section", detail: {id: target}});
    expect(executeCommand("/whoami", commands).lines[0]?.text).toContain("sample");
    expect(executeCommand("/copy", commands).action).toEqual({type: "custom", event: "chapa:landing-copy"});
  });
});
