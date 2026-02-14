import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "QuickControls.tsx"),
  "utf-8",
);

describe("QuickControls", () => {
  describe("mobile responsiveness (#240)", () => {
    it("categories container uses reduced max-height on mobile (max-h-48 sm:max-h-64)", () => {
      expect(SOURCE).toContain("max-h-48 sm:max-h-64");
    });
  });
});
