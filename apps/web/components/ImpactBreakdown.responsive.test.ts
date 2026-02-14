import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "ImpactBreakdown.tsx"),
  "utf-8",
);

describe("ImpactBreakdown", () => {
  describe("mobile responsiveness (#240)", () => {
    it("dimension cards grid uses single column on mobile with sm:grid-cols-2", () => {
      expect(SOURCE).toContain("grid-cols-1 sm:grid-cols-2");
    });
  });
});
