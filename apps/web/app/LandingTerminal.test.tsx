import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const REEXPORT_SOURCE = fs.readFileSync(
  path.resolve(__dirname, "LandingTerminal.tsx"),
  "utf-8",
);

const GLOBAL_SOURCE = fs.readFileSync(
  path.resolve(__dirname, "../components/GlobalCommandBar.tsx"),
  "utf-8",
);

describe("LandingTerminal", () => {
  describe("re-export", () => {
    it("re-exports GlobalCommandBar", () => {
      expect(REEXPORT_SOURCE).toContain("GlobalCommandBar");
      expect(REEXPORT_SOURCE).toContain("LandingTerminal");
    });
  });
});

describe("GlobalCommandBar", () => {
  describe("component directive", () => {
    it("has 'use client' directive", () => {
      expect(GLOBAL_SOURCE).toMatch(/^["']use client["']/m);
    });
  });

  describe("autocomplete integration", () => {
    it("imports AutocompleteDropdown", () => {
      expect(GLOBAL_SOURCE).toContain("AutocompleteDropdown");
    });

    it("imports createNavigationCommands", () => {
      expect(GLOBAL_SOURCE).toContain("createNavigationCommands");
    });

    it("imports executeCommand", () => {
      expect(GLOBAL_SOURCE).toContain("executeCommand");
    });

    it("has partial state for autocomplete filtering", () => {
      expect(GLOBAL_SOURCE).toContain("partial");
      expect(GLOBAL_SOURCE).toContain("setPartial");
    });

    it("has showAutocomplete state", () => {
      expect(GLOBAL_SOURCE).toContain("showAutocomplete");
      expect(GLOBAL_SOURCE).toContain("setShowAutocomplete");
    });

    it("uses createNavigationCommands via useMemo", () => {
      expect(GLOBAL_SOURCE).toContain("createNavigationCommands");
      expect(GLOBAL_SOURCE).toContain("useMemo");
    });

    it("passes onPartialChange to TerminalInput", () => {
      expect(GLOBAL_SOURCE).toContain("onPartialChange");
    });

    it("renders AutocompleteDropdown with correct props", () => {
      expect(GLOBAL_SOURCE).toContain("visible={showAutocomplete}");
    });
  });

  describe("command execution", () => {
    it("uses executeCommand instead of manual switch", () => {
      expect(GLOBAL_SOURCE).toContain("executeCommand");
      expect(GLOBAL_SOURCE).not.toContain("switch (parsed.name)");
    });

    it("handles OAuth redirect via window.location.href", () => {
      expect(GLOBAL_SOURCE).toContain("window.location.href");
    });

    it("handles SPA navigation via router.push", () => {
      expect(GLOBAL_SOURCE).toContain("router.push");
    });
  });

  describe("layout", () => {
    it("has relative container for dropdown positioning", () => {
      expect(GLOBAL_SOURCE).toContain("relative");
    });

    it("includes AuthorTypewriter pill", () => {
      expect(GLOBAL_SOURCE).toContain("AuthorTypewriter");
    });
  });
});
