import { describe, it, expect, afterEach } from "vitest";
import {
  parseCommand,
  executeCommand,
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
  const commands = createNavigationCommands();

  it("executes /help", () => {
    const result = executeCommand("/help", commands);
    expect(result.lines.length).toBeGreaterThan(0);
    expect(result.lines[0].type).toBe("system");
  });

  it("executes /login with navigate action", () => {
    const result = executeCommand("/login", commands);
    expect(result.action).toEqual({
      type: "navigate",
      path: "/api/auth/login",
    });
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
  const commands = createNavigationCommands();

  it("returns empty for non-slash input", () => {
    expect(getMatchingCommands("help", commands)).toEqual([]);
  });

  it("returns all commands for just /", () => {
    const matches = getMatchingCommands("/", commands);
    expect(matches.length).toBe(commands.length);
  });

  it("matches aliases (/b matches /badge)", () => {
    const matches = getMatchingCommands("/b", commands);
    const names = matches.map((m) => m.name);
    expect(names).toContain("/badge");
  });
});

describe("createNavigationCommands (studio disabled)", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_STUDIO_ENABLED;
  });

  it("excludes /studio when flag is not set", () => {
    delete process.env.NEXT_PUBLIC_STUDIO_ENABLED;
    const commands = createNavigationCommands();
    const names = commands.map((c) => c.name);
    expect(names).not.toContain("/studio");
  });

  it("returns 7 commands when studio is disabled", () => {
    delete process.env.NEXT_PUBLIC_STUDIO_ENABLED;
    const commands = createNavigationCommands();
    expect(commands).toHaveLength(7);
  });

  it("/help does not mention /studio when disabled", () => {
    delete process.env.NEXT_PUBLIC_STUDIO_ENABLED;
    const commands = createNavigationCommands();
    const result = executeCommand("/help", commands);
    const allText = result.lines.map((l) => l.text).join("\n");
    expect(allText).not.toContain("/studio");
  });

  it("/studio returns unknown command when disabled", () => {
    delete process.env.NEXT_PUBLIC_STUDIO_ENABLED;
    const commands = createNavigationCommands();
    const result = executeCommand("/studio", commands);
    expect(result.lines[0].type).toBe("error");
  });

  it("getMatchingCommands returns 7 for / when disabled", () => {
    delete process.env.NEXT_PUBLIC_STUDIO_ENABLED;
    const commands = createNavigationCommands();
    const matches = getMatchingCommands("/", commands);
    expect(matches).toHaveLength(7);
  });

  it("/s does not match /studio when disabled", () => {
    delete process.env.NEXT_PUBLIC_STUDIO_ENABLED;
    const commands = createNavigationCommands();
    const matches = getMatchingCommands("/s", commands);
    const names = matches.map((m) => m.name);
    expect(names).not.toContain("/studio");
  });
});

describe("createNavigationCommands (studio enabled)", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_STUDIO_ENABLED;
  });

  it("includes /studio when flag is set to true", () => {
    process.env.NEXT_PUBLIC_STUDIO_ENABLED = "true";
    const commands = createNavigationCommands();
    const names = commands.map((c) => c.name);
    expect(names).toContain("/studio");
  });

  it("returns 8 commands when studio is enabled", () => {
    process.env.NEXT_PUBLIC_STUDIO_ENABLED = "true";
    const commands = createNavigationCommands();
    expect(commands).toHaveLength(8);
  });

  it("/studio navigates to /studio when enabled", () => {
    process.env.NEXT_PUBLIC_STUDIO_ENABLED = "true";
    const commands = createNavigationCommands();
    const result = executeCommand("/studio", commands);
    expect(result.action).toEqual({ type: "navigate", path: "/studio" });
  });

  it("/help lists /studio when enabled", () => {
    process.env.NEXT_PUBLIC_STUDIO_ENABLED = "true";
    const commands = createNavigationCommands();
    const result = executeCommand("/help", commands);
    const allText = result.lines.map((l) => l.text).join("\n");
    expect(allText).toContain("/studio");
  });

  it("includes all navigation commands", () => {
    process.env.NEXT_PUBLIC_STUDIO_ENABLED = "true";
    const commands = createNavigationCommands();
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
    process.env.NEXT_PUBLIC_STUDIO_ENABLED = "true";
    const commands = createNavigationCommands();
    const result = executeCommand("/help", commands);
    const allText = result.lines.map((l) => l.text).join("\n");
    expect(allText).not.toContain("/set");
    expect(allText).not.toContain("/preset");
    expect(allText).not.toContain("/save");
    expect(allText).not.toContain("/reset");
    expect(allText).not.toContain("/embed");
    expect(allText).not.toContain("/status");
  });

  it("/home navigates to /", () => {
    process.env.NEXT_PUBLIC_STUDIO_ENABLED = "true";
    const commands = createNavigationCommands();
    const result = executeCommand("/home", commands);
    expect(result.action).toEqual({ type: "navigate", path: "/" });
  });

  it("/login navigates to /api/auth/login", () => {
    process.env.NEXT_PUBLIC_STUDIO_ENABLED = "true";
    const commands = createNavigationCommands();
    const result = executeCommand("/login", commands);
    expect(result.action).toEqual({
      type: "navigate",
      path: "/api/auth/login",
    });
  });

  it("/badge navigates with handle", () => {
    process.env.NEXT_PUBLIC_STUDIO_ENABLED = "true";
    const commands = createNavigationCommands();
    const result = executeCommand("/badge juan294", commands);
    expect(result.action).toEqual({ type: "navigate", path: "/u/juan294" });
  });

  it("/badge errors without handle", () => {
    process.env.NEXT_PUBLIC_STUDIO_ENABLED = "true";
    const commands = createNavigationCommands();
    const result = executeCommand("/badge", commands);
    expect(result.lines[0].type).toBe("error");
    expect(result.action).toBeUndefined();
  });

  it("/b alias resolves to /badge", () => {
    process.env.NEXT_PUBLIC_STUDIO_ENABLED = "true";
    const commands = createNavigationCommands();
    const result = executeCommand("/b juan294", commands);
    expect(result.action).toEqual({ type: "navigate", path: "/u/juan294" });
  });

  it("getMatchingCommands returns all 8 for /", () => {
    process.env.NEXT_PUBLIC_STUDIO_ENABLED = "true";
    const commands = createNavigationCommands();
    const matches = getMatchingCommands("/", commands);
    expect(matches).toHaveLength(8);
  });

  it("getMatchingCommands filters correctly", () => {
    process.env.NEXT_PUBLIC_STUDIO_ENABLED = "true";
    const commands = createNavigationCommands();
    const matches = getMatchingCommands("/b", commands);
    const names = matches.map((m) => m.name);
    expect(names).toContain("/badge");
    expect(names).not.toContain("/studio");
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
