import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "TerminalInput.tsx"),
  "utf-8",
);

describe("TerminalInput", () => {
  describe("component directive", () => {
    it("has 'use client' directive", () => {
      expect(SOURCE).toMatch(/^["']use client["']/m);
    });
  });

  describe("autoFocus default (#228)", () => {
    it("defaults autoFocus to false so it does not steal focus on mount", () => {
      // The destructured default for autoFocus must be `false`
      expect(SOURCE).toMatch(/autoFocus\s*=\s*false/);
    });

    it("does NOT default autoFocus to true", () => {
      expect(SOURCE).not.toMatch(/autoFocus\s*=\s*true/);
    });
  });

  describe("wrapper div keyboard accessibility (#231)", () => {
    it("does not have onClick on the wrapper div without keyboard equivalent", () => {
      // The wrapper div should either:
      // (a) have no onClick at all, OR
      // (b) have onClick + onKeyDown + role="button" + tabIndex={0}
      // We chose option (a): remove onClick since <input> is directly focusable.
      // Check that the wrapper div does NOT have a bare onClick without onKeyDown.
      const hasOnClick = SOURCE.includes("onClick={() => inputRef.current?.focus()}");
      const hasOnKeyDown = SOURCE.includes("onKeyDown");

      // If there's an onClick on the wrapper that focuses the input,
      // there must also be an onKeyDown handler for keyboard parity
      if (hasOnClick) {
        expect(hasOnKeyDown).toBe(true);
      }
      // If no onClick, that's also fine (simpler fix)
    });
  });

  describe("accessibility", () => {
    it("has aria-label on the input", () => {
      expect(SOURCE).toContain("aria-label=");
    });
  });
});
