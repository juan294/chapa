import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "page.tsx"),
  "utf-8",
);

describe("VerificationPage", () => {
  describe("a11y: table headers (#333)", () => {
    it("all <th> elements have scope='col'", () => {
      // Every <th> in the Table component must have scope="col"
      const thMatches = SOURCE.match(/<th\b[^>]*>/g) ?? [];
      expect(thMatches.length).toBeGreaterThan(0);
      for (const th of thMatches) {
        expect(th).toContain('scope="col"');
      }
    });
  });
});
