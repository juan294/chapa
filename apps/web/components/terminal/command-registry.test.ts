import { describe, it, expect } from "vitest";
import {
  parseCommand,
  executeCommand,
  createCoreCommands,
  createLandingCommands,
  createNavigationCommands,
  getMatchingCommands,
  resolveCategory,
  makeLine,
} from "./command-registry";

describe("parseCommand", () => {
  it("parses a simple command", () => {
    expect(parseCommand("/help")).toEqual({ name: "/help", args: [] });
  });

  it("parses a command with args", () => {
    expect(parseCommand("/set bg aurora")).toEqual({
      name: "/set",
      args: ["bg", "aurora"],
    });
  });

  it("handles leading/trailing whitespace", () => {
    expect(parseCommand("  /clear  ")).toEqual({ name: "/clear", args: [] });
  });

  it("returns null for non-slash input", () => {
    expect(parseCommand("hello")).toBeNull();
  });

  it("lowercases the command name", () => {
    expect(parseCommand("/HELP")).toEqual({ name: "/help", args: [] });
  });
});

describe("resolveCategory", () => {
  it("resolves short aliases", () => {
    expect(resolveCategory("bg")).toBe("background");
    expect(resolveCategory("card")).toBe("cardStyle");
    expect(resolveCategory("score")).toBe("scoreEffect");
    expect(resolveCategory("heatmap")).toBe("heatmapAnimation");
    expect(resolveCategory("interact")).toBe("interaction");
    expect(resolveCategory("stats")).toBe("statsDisplay");
    expect(resolveCategory("tier")).toBe("tierTreatment");
    expect(resolveCategory("celebrate")).toBe("celebration");
  });

  it("resolves full key names", () => {
    expect(resolveCategory("background")).toBe("background");
    expect(resolveCategory("cardStyle")).toBe("cardStyle");
  });

  it("returns null for unknown categories", () => {
    expect(resolveCategory("unknown")).toBeNull();
    expect(resolveCategory("foo")).toBeNull();
  });
});

describe("executeCommand", () => {
  const commands = createCoreCommands();

  it("executes /help", () => {
    const result = executeCommand("/help", commands);
    expect(result.lines.length).toBeGreaterThan(0);
    expect(result.lines[0].type).toBe("system");
  });

  it("executes /clear with clear action", () => {
    const result = executeCommand("/clear", commands);
    expect(result.action).toEqual({ type: "clear" });
  });

  it("executes /login with navigate action", () => {
    const result = executeCommand("/login", commands);
    expect(result.action).toEqual({
      type: "navigate",
      path: "/api/auth/login",
    });
  });

  it("executes /studio with navigate action", () => {
    const result = executeCommand("/studio", commands);
    expect(result.action).toEqual({ type: "navigate", path: "/studio" });
  });

  it("executes /badge with handle", () => {
    const result = executeCommand("/badge juan294", commands);
    expect(result.action).toEqual({ type: "navigate", path: "/u/juan294" });
  });

  it("strips @ from /badge handle", () => {
    const result = executeCommand("/badge @juan294", commands);
    expect(result.action).toEqual({ type: "navigate", path: "/u/juan294" });
  });

  it("errors on /badge without handle", () => {
    const result = executeCommand("/badge", commands);
    expect(result.lines[0].type).toBe("error");
    expect(result.action).toBeUndefined();
  });

  it("executes /set with valid category", () => {
    const result = executeCommand("/set bg aurora", commands);
    expect(result.action).toEqual({
      type: "set",
      category: "background",
      value: "aurora",
    });
    expect(result.lines[0].type).toBe("success");
  });

  it("errors on /set with unknown category", () => {
    const result = executeCommand("/set unknown value", commands);
    expect(result.lines[0].type).toBe("error");
  });

  it("errors on /set without enough args", () => {
    const result = executeCommand("/set bg", commands);
    expect(result.lines[0].type).toBe("error");
  });

  it("executes /preset with valid name", () => {
    const result = executeCommand("/preset premium", commands);
    expect(result.action).toEqual({ type: "preset", name: "premium" });
  });

  it("errors on /preset with invalid name", () => {
    const result = executeCommand("/preset garbage", commands);
    expect(result.lines[0].type).toBe("error");
  });

  it("executes /save", () => {
    const result = executeCommand("/save", commands);
    expect(result.action).toEqual({ type: "save" });
  });

  it("executes /reset", () => {
    const result = executeCommand("/reset", commands);
    expect(result.action).toEqual({ type: "reset" });
  });

  it("executes /embed", () => {
    const result = executeCommand("/embed", commands);
    expect(result.lines.length).toBeGreaterThan(0);
  });

  it("executes /share", () => {
    const result = executeCommand("/share", commands);
    expect(result.lines.length).toBeGreaterThan(0);
  });

  it("returns error for unknown command", () => {
    const result = executeCommand("/foobar", commands);
    expect(result.lines[0].type).toBe("error");
  });

  it("returns error for non-slash input", () => {
    const result = executeCommand("hello world", commands);
    expect(result.lines[0].type).toBe("error");
  });
});

describe("getMatchingCommands", () => {
  const commands = createCoreCommands();

  it("returns matching commands for partial input", () => {
    const matches = getMatchingCommands("/s", commands);
    const names = matches.map((m) => m.name);
    expect(names).toContain("/set");
    expect(names).toContain("/save");
    expect(names).toContain("/share");
    expect(names).toContain("/status");
    expect(names).toContain("/studio");
  });

  it("returns empty for non-slash input", () => {
    expect(getMatchingCommands("help", commands)).toEqual([]);
  });

  it("returns all commands for just /", () => {
    const matches = getMatchingCommands("/", commands);
    expect(matches.length).toBe(commands.length);
  });

  it("narrows results as input gets more specific", () => {
    const matchesSt = getMatchingCommands("/st", commands);
    const matchesStu = getMatchingCommands("/stu", commands);
    expect(matchesStu.length).toBeLessThanOrEqual(matchesSt.length);
  });
});

describe("createNavigationCommands", () => {
  const commands = createNavigationCommands();

  it("returns 8 navigation commands", () => {
    expect(commands).toHaveLength(8);
  });

  it("includes all navigation commands", () => {
    const names = commands.map((c) => c.name);
    expect(names).toContain("/help");
    expect(names).toContain("/home");
    expect(names).toContain("/studio");
    expect(names).toContain("/login");
    expect(names).toContain("/badge");
    expect(names).toContain("/about");
    expect(names).toContain("/terms");
    expect(names).toContain("/privacy");
  });

  it("/help output does NOT mention studio-only commands", () => {
    const result = executeCommand("/help", commands);
    const allText = result.lines.map((l) => l.text).join("\n");
    expect(allText).not.toContain("/set");
    expect(allText).not.toContain("/preset");
    expect(allText).not.toContain("/save");
    expect(allText).not.toContain("/reset");
    expect(allText).not.toContain("/embed");
    expect(allText).not.toContain("/status");
  });

  it("/help lists all navigation commands", () => {
    const result = executeCommand("/help", commands);
    const allText = result.lines.map((l) => l.text).join("\n");
    expect(allText).toContain("/home");
    expect(allText).toContain("/studio");
    expect(allText).toContain("/login");
    expect(allText).toContain("/badge");
    expect(allText).toContain("/about");
    expect(allText).toContain("/terms");
    expect(allText).toContain("/privacy");
  });

  it("/home navigates to /", () => {
    const result = executeCommand("/home", commands);
    expect(result.action).toEqual({ type: "navigate", path: "/" });
  });

  it("/studio navigates to /studio", () => {
    const result = executeCommand("/studio", commands);
    expect(result.action).toEqual({ type: "navigate", path: "/studio" });
  });

  it("/login navigates to /api/auth/login", () => {
    const result = executeCommand("/login", commands);
    expect(result.action).toEqual({
      type: "navigate",
      path: "/api/auth/login",
    });
  });

  it("/badge navigates with handle", () => {
    const result = executeCommand("/badge juan294", commands);
    expect(result.action).toEqual({ type: "navigate", path: "/u/juan294" });
  });

  it("/badge errors without handle", () => {
    const result = executeCommand("/badge", commands);
    expect(result.lines[0].type).toBe("error");
    expect(result.action).toBeUndefined();
  });

  it("/b alias resolves to /badge", () => {
    const result = executeCommand("/b juan294", commands);
    expect(result.action).toEqual({ type: "navigate", path: "/u/juan294" });
  });

  it("/about navigates to /about", () => {
    const result = executeCommand("/about", commands);
    expect(result.action).toEqual({ type: "navigate", path: "/about" });
  });

  it("/terms navigates to /terms", () => {
    const result = executeCommand("/terms", commands);
    expect(result.action).toEqual({ type: "navigate", path: "/terms" });
  });

  it("/privacy navigates to /privacy", () => {
    const result = executeCommand("/privacy", commands);
    expect(result.action).toEqual({ type: "navigate", path: "/privacy" });
  });

  it("getMatchingCommands returns all 8 for /", () => {
    const matches = getMatchingCommands("/", commands);
    expect(matches).toHaveLength(8);
  });

  it("getMatchingCommands filters correctly", () => {
    const matches = getMatchingCommands("/b", commands);
    const names = matches.map((m) => m.name);
    expect(names).toContain("/badge");
    expect(names).not.toContain("/studio");
  });
});

describe("createLandingCommands (deprecated alias)", () => {
  it("returns the same commands as createNavigationCommands", () => {
    const landing = createLandingCommands();
    const nav = createNavigationCommands();
    expect(landing.map((c) => c.name)).toEqual(nav.map((c) => c.name));
  });
});

describe("makeLine", () => {
  it("creates a line with unique id", () => {
    const line1 = makeLine("info", "hello");
    const line2 = makeLine("info", "world");
    expect(line1.id).not.toBe(line2.id);
    expect(line1.type).toBe("info");
    expect(line1.text).toBe("hello");
  });
});
