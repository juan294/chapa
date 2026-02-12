import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "StudioClient.tsx"),
  "utf-8",
);

describe("StudioClient", () => {
  describe("component directive", () => {
    it("has 'use client' directive", () => {
      expect(SOURCE).toMatch(/^["']use client["']/m);
    });
  });

  describe("state management", () => {
    it("uses useState for config state", () => {
      expect(SOURCE).toContain("useState<BadgeConfig>");
    });

    it("accepts initial config as prop", () => {
      expect(SOURCE).toContain("initialConfig");
    });

    it("has save handler", () => {
      expect(SOURCE).toContain("/api/studio/config");
    });

    it("tracks saving state", () => {
      expect(SOURCE).toContain("saving");
    });
  });

  describe("layout", () => {
    it("renders BadgePreviewCard in preview pane", () => {
      expect(SOURCE).toContain("BadgePreviewCard");
    });

    it("renders terminal components", () => {
      expect(SOURCE).toContain("TerminalOutput");
      expect(SOURCE).toContain("TerminalInput");
    });

    it("renders QuickControls for mouse fallback", () => {
      expect(SOURCE).toContain("QuickControls");
    });

    it("has responsive split layout classes", () => {
      expect(SOURCE).toContain("lg:grid-cols");
    });
  });

  describe("accessibility", () => {
    it("has sr-only h1 heading for accessibility", () => {
      expect(SOURCE).toContain('className="sr-only"');
      expect(SOURCE).toContain("Creator Studio");
    });
  });

  describe("props interface", () => {
    it("accepts Stats90d prop", () => {
      expect(SOURCE).toContain("stats: Stats90d");
    });

    it("accepts ImpactV4Result prop", () => {
      expect(SOURCE).toContain("impact: ImpactV4Result");
    });

    it("accepts BadgeConfig initial config", () => {
      expect(SOURCE).toContain("initialConfig: BadgeConfig");
    });

    it("accepts handle prop", () => {
      expect(SOURCE).toContain("handle");
    });
  });

  describe("save functionality", () => {
    it("uses PUT method for saving", () => {
      expect(SOURCE).toContain('method: "PUT"');
    });

    it("sends JSON body", () => {
      expect(SOURCE).toContain("JSON.stringify");
    });
  });

  describe("reset functionality", () => {
    it("imports DEFAULT_BADGE_CONFIG for reset", () => {
      expect(SOURCE).toContain("DEFAULT_BADGE_CONFIG");
    });
  });

  describe("PostHog analytics", () => {
    it("imports trackEvent from posthog analytics", () => {
      expect(SOURCE).toContain("trackEvent");
    });

    it("tracks studio_opened on mount", () => {
      expect(SOURCE).toContain('"studio_opened"');
    });

    it("tracks effect_changed when config changes", () => {
      expect(SOURCE).toContain('"effect_changed"');
    });

    it("tracks preset_selected when a preset is chosen", () => {
      expect(SOURCE).toContain('"preset_selected"');
    });

    it("tracks config_saved on successful save", () => {
      expect(SOURCE).toContain('"config_saved"');
    });
  });

  describe("reduced motion", () => {
    it("has useReducedMotion hook", () => {
      expect(SOURCE).toContain("useReducedMotion");
    });

    it("detects prefers-reduced-motion media query", () => {
      expect(SOURCE).toContain("prefers-reduced-motion");
    });

    it("passes interactive flag based on reduced motion", () => {
      expect(SOURCE).toContain("interactive={!reducedMotion}");
    });

    it("shows reduced motion notice when detected", () => {
      expect(SOURCE).toContain("Reduced motion detected");
    });
  });

  describe("preview animation replay", () => {
    it("uses previewKey state for animation replay", () => {
      expect(SOURCE).toContain("previewKey");
    });

    it("passes previewKey as key to BadgePreviewCard", () => {
      expect(SOURCE).toContain("key={previewKey}");
    });
  });

  describe("terminal integration", () => {
    it("uses useStudioCommands hook", () => {
      expect(SOURCE).toContain("useStudioCommands");
    });

    it("uses executeCommand from command registry", () => {
      expect(SOURCE).toContain("executeCommand");
    });

    it("handles command actions", () => {
      expect(SOURCE).toContain("handleAction");
    });

    it("supports autocomplete", () => {
      expect(SOURCE).toContain("AutocompleteDropdown");
    });

    it("supports Cmd+K / Ctrl+K keyboard shortcut", () => {
      expect(SOURCE).toContain("metaKey");
      expect(SOURCE).toContain('"k"');
    });
  });
});
