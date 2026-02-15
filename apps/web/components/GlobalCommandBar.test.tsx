import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "GlobalCommandBar.tsx"),
  "utf-8",
);

describe("GlobalCommandBar", () => {
  describe("component directive", () => {
    it("has 'use client' directive", () => {
      expect(SOURCE).toMatch(/^["']use client["']/m);
    });
  });

  describe("autoFocus on admin page (#283)", () => {
    it("passes autoFocus based on isAdmin prop so admin page gets focus", () => {
      // Admin page should auto-focus the command input; other pages should not.
      // Look for autoFocus={!!isAdmin} or autoFocus={isAdmin} in TerminalInput usage.
      expect(SOURCE).toMatch(/autoFocus=\{!{0,2}isAdmin\}/);
    });
  });

  describe("mobile responsiveness (#240)", () => {
    it("output popup uses max-h-48 sm:max-h-64 for responsive height", () => {
      expect(SOURCE).toContain("max-h-48 sm:max-h-64");
    });
  });

  describe("isAdmin prop", () => {
    it("accepts isAdmin prop in the function signature", () => {
      // Component should accept an optional isAdmin prop
      expect(SOURCE).toMatch(/isAdmin\??:\s*boolean/);
    });

    it("passes isAdmin to createNavigationCommands", () => {
      // Must call createNavigationCommands with { isAdmin }
      expect(SOURCE).toMatch(/createNavigationCommands\(\s*\{\s*isAdmin\s*\}\s*\)/);
    });

    it("handles custom event action type", () => {
      // Must handle action?.type === "custom" by dispatching a CustomEvent
      expect(SOURCE).toContain('action?.type === "custom"');
      expect(SOURCE).toContain("CustomEvent");
    });
  });

  describe("custom action output clearing (#283)", () => {
    it("clears output lines immediately after dispatching custom events", () => {
      // Custom action commands (/refresh, /sort) provide their own visual feedback
      // (spinning refresh icon, sorted table). Output lines should be cleared
      // immediately inside the custom action branch, not left to linger for
      // the full OUTPUT_TIMEOUT_MS.
      //
      // Extract the custom action branch block and verify setOutputLines([])
      // is called within it (not in a separate function like handlePartialChange).
      const customBlock = SOURCE.match(
        /else if\s*\(action\?\.type\s*===\s*["']custom["']\)\s*\{([\s\S]*?)\n\s{4}\}/,
      );
      expect(customBlock).not.toBeNull();
      expect(customBlock![1]).toContain("setOutputLines([])");
    });
  });

  describe("autocomplete select clears input (#283)", () => {
    it("uses a ref to TerminalInput for imperative control", () => {
      // GlobalCommandBar must hold a ref to TerminalInput so it can
      // clear the input when autocomplete selects a command (since
      // autocomplete's stopPropagation prevents TerminalInput from
      // seeing the Enter key).
      expect(SOURCE).toMatch(/TerminalInputHandle/);
      expect(SOURCE).toMatch(/useRef.*TerminalInputHandle/);
    });

    it("calls ref.clear() in handleAutocompleteSelect", () => {
      // After handleSubmit, autocomplete select must clear the input
      // via the imperative ref since TerminalInput's own Enter handler
      // was blocked by stopPropagation.
      const selectBlock = SOURCE.match(
        /handleAutocompleteSelect\s*=\s*useCallback\(\s*\n?\s*\(command[^)]*\)\s*=>\s*\{([\s\S]*?)\},\s*\n?\s*\[/,
      );
      expect(selectBlock).not.toBeNull();
      expect(selectBlock![1]).toMatch(/\.current\?\.clear\(\)/);
    });
  });
});
