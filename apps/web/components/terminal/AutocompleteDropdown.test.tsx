import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "AutocompleteDropdown.tsx"),
  "utf-8",
);

describe("AutocompleteDropdown", () => {
  describe("component directive", () => {
    it("has 'use client' directive", () => {
      expect(SOURCE).toMatch(/^["']use client["']/m);
    });
  });

  describe("spacing", () => {
    it("uses compact padding on items (py-1.5, not py-2.5)", () => {
      expect(SOURCE).toContain("py-1.5");
      expect(SOURCE).not.toContain("py-2.5");
    });
  });

  describe("keyboard event handling", () => {
    it("uses capture phase for keydown listener to intercept before TerminalInput", () => {
      // The third argument `true` enables capture phase
      expect(SOURCE).toContain("addEventListener(\"keydown\", handleKeyDown, true)");
    });

    it("removes listener with capture phase flag", () => {
      expect(SOURCE).toContain("removeEventListener(\"keydown\", handleKeyDown, true)");
    });

    it("stops propagation on arrow keys to prevent TerminalInput history handling", () => {
      expect(SOURCE).toContain("stopPropagation");
    });
  });

  describe("accessibility", () => {
    it("has listbox role", () => {
      expect(SOURCE).toContain('role="listbox"');
    });

    it("has option role on items", () => {
      expect(SOURCE).toContain('role="option"');
    });

    it("marks active item with aria-selected", () => {
      expect(SOURCE).toContain("aria-selected");
    });
  });
});
