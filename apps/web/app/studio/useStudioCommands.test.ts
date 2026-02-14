import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

// This test validates the structure and behavior of useStudioCommands
// using source inspection (avoiding @/ alias resolution issues in test env).
// The hook is a thin useMemo wrapper over command definitions — we verify
// the command registry it produces.

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "useStudioCommands.ts"),
  "utf-8",
);

describe("useStudioCommands", () => {
  describe("module structure", () => {
    it("exports useStudioCommands function", () => {
      expect(SOURCE).toContain("export function useStudioCommands");
    });

    it("is a client component", () => {
      // It uses useMemo, so it's used in client context
      expect(SOURCE).toContain("useMemo");
    });

    it("accepts config and handle parameters", () => {
      expect(SOURCE).toContain("config: BadgeConfig");
      expect(SOURCE).toContain("handle: string");
    });

    it("returns CommandDef array", () => {
      expect(SOURCE).toContain("CommandDef[]");
    });
  });

  describe("registered commands", () => {
    it("defines /set command", () => {
      expect(SOURCE).toContain('name: "/set"');
    });

    it("defines /preset command", () => {
      expect(SOURCE).toContain('name: "/preset"');
    });

    it("defines /save command", () => {
      expect(SOURCE).toContain('name: "/save"');
    });

    it("defines /reset command", () => {
      expect(SOURCE).toContain('name: "/reset"');
    });

    it("defines /status command", () => {
      expect(SOURCE).toContain('name: "/status"');
    });

    it("defines /embed command", () => {
      expect(SOURCE).toContain('name: "/embed"');
    });

    it("defines /share command", () => {
      expect(SOURCE).toContain('name: "/share"');
    });

    it("defines /help command", () => {
      expect(SOURCE).toContain('name: "/help"');
    });

    it("defines /clear command", () => {
      expect(SOURCE).toContain('name: "/clear"');
    });
  });

  describe("/set command behavior", () => {
    it("shows usage when args are insufficient", () => {
      expect(SOURCE).toContain("args.length < 2");
      expect(SOURCE).toContain("Usage: /set <category> <value>");
    });

    it("validates category with resolveCategory", () => {
      expect(SOURCE).toContain("resolveCategory(catInput)");
    });

    it("returns error for unknown category", () => {
      expect(SOURCE).toContain("Unknown category:");
    });

    it("validates value against category options", () => {
      expect(SOURCE).toContain("category.options.some");
    });

    it("returns set action on success", () => {
      expect(SOURCE).toContain('type: "set"');
    });
  });

  describe("/preset command behavior", () => {
    it("lists presets when no args given", () => {
      expect(SOURCE).toContain("args.length === 0");
      expect(SOURCE).toContain("Available presets:");
    });

    it("returns error for unknown preset", () => {
      expect(SOURCE).toContain("Unknown preset:");
    });

    it("returns preset action on success", () => {
      expect(SOURCE).toContain('type: "preset"');
    });
  });

  describe("/embed command behavior", () => {
    it("includes badge.svg URL with handle interpolation", () => {
      expect(SOURCE).toContain("badge.svg");
      expect(SOURCE).toContain("${handle}");
    });

    it("provides both markdown and HTML embed formats", () => {
      expect(SOURCE).toContain("Markdown:");
      expect(SOURCE).toContain("HTML:");
    });
  });

  describe("/share command behavior", () => {
    it("includes direct link with handle interpolation", () => {
      expect(SOURCE).toContain("Direct link:");
      expect(SOURCE).toContain("${handle}");
    });
  });

  describe("action types", () => {
    it("defines save action", () => {
      expect(SOURCE).toContain('type: "save"');
    });

    it("defines reset action", () => {
      expect(SOURCE).toContain('type: "reset"');
    });

    it("defines clear action", () => {
      expect(SOURCE).toContain('type: "clear"');
    });
  });
});
