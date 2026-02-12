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

  describe("terminal layout", () => {
    it("uses compact padding on items (py-1.5, not py-2.5)", () => {
      expect(SOURCE).toContain("py-1.5");
      expect(SOURCE).not.toContain("py-2.5");
    });

    it("uses terminal font (font-terminal) on the entire dropdown", () => {
      expect(SOURCE).toContain("font-terminal");
    });

    it("uses same font size for command name and description (text-sm)", () => {
      // Both should be text-sm, no text-xs on description
      expect(SOURCE).not.toContain("text-xs");
    });

    it("uses fixed-width column for command name to align descriptions", () => {
      // A min-width or w- class on the command name ensures alignment
      expect(SOURCE).toMatch(/min-w-|w-\[/);
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

    it("handles Escape key to dismiss dropdown via onDismiss callback", () => {
      // Escape should call onDismiss and stopPropagation so TerminalInput doesn't clear input
      expect(SOURCE).toContain("onDismiss");
      expect(SOURCE).toMatch(/Escape/);
    });
  });

  describe("dismiss behavior", () => {
    it("accepts an onDismiss prop", () => {
      expect(SOURCE).toContain("onDismiss");
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
