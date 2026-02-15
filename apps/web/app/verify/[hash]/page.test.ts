import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "page.tsx"),
  "utf-8",
);

describe("VerifyPage", () => {
  describe("heading hierarchy (#288)", () => {
    it("uses <h2> for Dimensions section heading", () => {
      // The "Dimensions" label should be an <h2>, not a <p>
      expect(SOURCE).toMatch(/<h2[^>]*>[\s\S]*?Dimensions[\s\S]*?<\/h2>/);
    });

    it("uses <h2> for Key Metrics section heading", () => {
      // The "Key Metrics" label should be an <h2>, not a <p>
      expect(SOURCE).toMatch(/<h2[^>]*>[\s\S]*?Key Metrics[\s\S]*?<\/h2>/);
    });

    it("section headings use font-heading class", () => {
      // Both section headings should use font-heading per design system
      const h2Matches = SOURCE.match(/<h2[^>]*className="[^"]*font-heading[^"]*"/g) ?? [];
      expect(h2Matches.length).toBeGreaterThanOrEqual(2);
    });
  });
});
