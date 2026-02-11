import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "LandingTerminal.tsx"),
  "utf-8",
);

describe("LandingTerminal", () => {
  describe("component directive", () => {
    it("has 'use client' directive", () => {
      expect(SOURCE).toMatch(/^["']use client["']/m);
    });
  });

  describe("autocomplete integration", () => {
    it("imports AutocompleteDropdown", () => {
      expect(SOURCE).toContain("AutocompleteDropdown");
    });

    it("imports createLandingCommands", () => {
      expect(SOURCE).toContain("createLandingCommands");
    });

    it("imports executeCommand", () => {
      expect(SOURCE).toContain("executeCommand");
    });

    it("has partial state for autocomplete filtering", () => {
      expect(SOURCE).toContain("partial");
      expect(SOURCE).toContain("setPartial");
    });

    it("has showAutocomplete state", () => {
      expect(SOURCE).toContain("showAutocomplete");
      expect(SOURCE).toContain("setShowAutocomplete");
    });

    it("uses createLandingCommands via useMemo", () => {
      expect(SOURCE).toContain("createLandingCommands");
      expect(SOURCE).toContain("useMemo");
    });

    it("passes onPartialChange to TerminalInput", () => {
      expect(SOURCE).toContain("onPartialChange");
    });

    it("renders AutocompleteDropdown with correct props", () => {
      expect(SOURCE).toContain("visible={showAutocomplete}");
    });
  });

  describe("command execution", () => {
    it("uses executeCommand instead of manual switch", () => {
      expect(SOURCE).toContain("executeCommand");
      expect(SOURCE).not.toContain("switch (parsed.name)");
    });

    it("handles OAuth redirect via window.location.href", () => {
      expect(SOURCE).toContain("window.location.href");
    });

    it("handles SPA navigation via router.push", () => {
      expect(SOURCE).toContain("router.push");
    });
  });

  describe("layout", () => {
    it("has relative container for dropdown positioning", () => {
      expect(SOURCE).toContain("relative");
    });
  });
});
