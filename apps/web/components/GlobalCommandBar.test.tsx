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

  describe("autoFocus is not passed (#228)", () => {
    it("does not pass autoFocus prop to TerminalInput", () => {
      // GlobalCommandBar should NOT pass autoFocus (or pass autoFocus={false})
      // to prevent focus stealing on every page load.
      // It must NOT have a bare `autoFocus` (which is shorthand for autoFocus={true}).
      expect(SOURCE).not.toMatch(/\bautoFocus\b(?!\s*=\s*\{false\})/);
    });
  });

  describe("mobile responsiveness (#240)", () => {
    it("output popup uses max-h-48 sm:max-h-64 for responsive height", () => {
      expect(SOURCE).toContain("max-h-48 sm:max-h-64");
    });
  });
});
