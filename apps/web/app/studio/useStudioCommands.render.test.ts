// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useStudioCommands } from "./useStudioCommands";
import type { BadgeConfig } from "@chapa/shared";

vi.mock("../../lib/feature-flags", () => ({
  isStudioEnabledSync: () => true,
}));

afterEach(() => {
  vi.unstubAllEnvs();
});

const DEFAULT_CONFIG: BadgeConfig = {
  background: "solid",
  cardStyle: "flat",
  border: "solid-amber",
  scoreEffect: "standard",
  heatmapAnimation: "fade-in",
  interaction: "static",
  statsDisplay: "static",
  tierTreatment: "standard",
  celebration: "none",
};

function getCommands(config = DEFAULT_CONFIG, handle = "testuser") {
  const { result } = renderHook(() => useStudioCommands({ config, handle }));
  return result.current;
}

function findCommand(name: string, commands = getCommands()) {
  return commands.find((c) => c.name === name);
}

describe("useStudioCommands (render)", () => {
  it("returns an array of 9 command definitions", () => {
    const commands = getCommands();
    expect(commands).toHaveLength(9);
  });

  it("includes all expected command names", () => {
    const names = getCommands().map((c) => c.name);
    expect(names).toContain("/set");
    expect(names).toContain("/preset");
    expect(names).toContain("/save");
    expect(names).toContain("/reset");
    expect(names).toContain("/status");
    expect(names).toContain("/embed");
    expect(names).toContain("/share");
    expect(names).toContain("/help");
    expect(names).toContain("/clear");
  });

  describe("/set", () => {
    it("shows usage with category list when called with <2 args", () => {
      const cmd = findCommand("/set")!;
      const result = cmd.execute([]);
      expect(result.lines[0]!.type).toBe("system");
      expect(result.lines[0]!.text).toContain("Usage:");
      // Should list categories
      expect(result.lines.length).toBeGreaterThan(2);
    });

    it("shows usage when called with 1 arg", () => {
      const cmd = findCommand("/set")!;
      const result = cmd.execute(["bg"]);
      expect(result.lines[0]!.type).toBe("system");
    });

    it("returns error for unknown category", () => {
      const cmd = findCommand("/set")!;
      const result = cmd.execute(["foobar", "value"]);
      expect(result.lines[0]!.type).toBe("error");
      expect(result.lines[0]!.text).toContain("Unknown category");
    });

    it("returns error for invalid value in known category", () => {
      const cmd = findCommand("/set")!;
      const result = cmd.execute(["bg", "nonexistent-value-xyz"]);
      expect(result.lines[0]!.type).toBe("error");
      expect(result.lines[0]!.text).toContain("Invalid value");
    });

    it("returns success with set action for valid input", () => {
      const cmd = findCommand("/set")!;
      const result = cmd.execute(["bg", "solid"]);
      expect(result.lines[0]!.type).toBe("success");
      expect(result.action).toEqual({
        type: "set",
        category: "background",
        value: "solid",
      });
    });

    it("resolves alias to full key name", () => {
      const cmd = findCommand("/set")!;
      const result = cmd.execute(["score", "standard"]);
      expect(result.action).toMatchObject({
        type: "set",
        category: "scoreEffect",
      });
    });
  });

  describe("/preset", () => {
    it("lists presets when no args given", () => {
      const cmd = findCommand("/preset")!;
      const result = cmd.execute([]);
      expect(result.lines[0]!.type).toBe("system");
      expect(result.lines[0]!.text).toContain("Available presets");
    });

    it("returns error for unknown preset", () => {
      const cmd = findCommand("/preset")!;
      const result = cmd.execute(["nonexistent"]);
      expect(result.lines[0]!.type).toBe("error");
    });

    it("applies known preset", () => {
      const cmd = findCommand("/preset")!;
      const result = cmd.execute(["minimal"]);
      expect(result.lines[0]!.type).toBe("success");
      expect(result.action).toEqual({ type: "preset", name: "minimal" });
    });
  });

  describe("/save", () => {
    it("returns save action", () => {
      const result = findCommand("/save")!.execute([]);
      expect(result.action).toEqual({ type: "save" });
    });
  });

  describe("/reset", () => {
    it("returns reset action with warning", () => {
      const result = findCommand("/reset")!.execute([]);
      expect(result.lines[0]!.type).toBe("warning");
      expect(result.action).toEqual({ type: "reset" });
    });
  });

  describe("/status", () => {
    it("shows current config", () => {
      const result = findCommand("/status")!.execute([]);
      expect(result.lines[0]!.type).toBe("system");
      expect(result.lines[0]!.text).toContain("Current configuration");
      // Should have lines for each category
      expect(result.lines.length).toBeGreaterThan(1);
    });
  });

  describe("/embed", () => {
    it("shows markdown and HTML with handle", () => {
      const cmds = getCommands(DEFAULT_CONFIG, "myhandle");
      const result = cmds.find((c) => c.name === "/embed")!.execute([]);
      const text = result.lines.map((l) => l.text).join("\n");
      expect(text).toContain("myhandle");
      expect(text).toContain("badge.svg");
      expect(text).toContain("Markdown:");
      expect(text).toContain("HTML:");
    });
  });

  describe("/share", () => {
    it("shows share links with handle", () => {
      const cmds = getCommands(DEFAULT_CONFIG, "myhandle");
      const result = cmds.find((c) => c.name === "/share")!.execute([]);
      const text = result.lines.map((l) => l.text).join("\n");
      expect(text).toContain("myhandle");
    });
  });

  it("uses NEXT_PUBLIC_BASE_URL for embed and share output", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://studio.test");
    const commands = getCommands(DEFAULT_CONFIG, "myhandle");

    for (const name of ["/embed", "/share"]) {
      const text = commands
        .find((command) => command.name === name)!
        .execute([])
        .lines.map((line) => line.text)
        .join("\n");

      expect(text).toContain("https://studio.test");
      expect(text).not.toContain("https://chapa.thecreativetoken.com");
    }
  });

  describe("/help", () => {
    it("lists all studio commands", () => {
      const result = findCommand("/help")!.execute([]);
      const text = result.lines.map((l) => l.text).join("\n");
      expect(text).toContain("/set");
      expect(text).toContain("/preset");
      expect(text).toContain("/save");
      expect(text).toContain("/reset");
      expect(text).toContain("/status");
      expect(text).toContain("/embed");
      expect(text).toContain("/share");
      expect(text).toContain("/clear");
    });
  });

  describe("/clear", () => {
    it("returns empty lines with clear action", () => {
      const result = findCommand("/clear")!.execute([]);
      expect(result.lines).toEqual([]);
      expect(result.action).toEqual({ type: "clear" });
    });
  });
});
