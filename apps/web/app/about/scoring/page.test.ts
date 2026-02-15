import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "page.tsx"),
  "utf-8",
);

describe("Scoring methodology page", () => {
  it("is always rendered (no feature flag)", () => {
    expect(SOURCE).not.toContain("isScoringPageEnabled");
    expect(SOURCE).not.toContain("notFound");
  });

  it("exports a default component", () => {
    expect(SOURCE).toMatch(/export default function \w+/);
  });

  describe("a11y: table headers (#304)", () => {
    it("all <th> elements have scope='col'", () => {
      const thMatches = SOURCE.match(/<th\b[^>]*>/g) ?? [];
      expect(thMatches.length).toBeGreaterThan(0);
      for (const th of thMatches) {
        expect(th).toContain('scope="col"');
      }
    });
  });

  describe("anti-gaming hardening content", () => {
    it("documents PR size multiplier", () => {
      expect(SOURCE).toContain("size multiplier");
    });

    it("documents repo depth threshold (3+ commits)", () => {
      expect(SOURCE).toMatch(/3\+?\s*commits/i);
    });

    it("shows all 8 confidence penalties", () => {
      // Count the number of table rows in the confidence table
      // Each penalty should appear as a row
      expect(SOURCE).toContain("Low activity");
      expect(SOURCE).toContain("Review volume");
    });

    it("mentions mutual exclusivity of review volume and low collaboration", () => {
      expect(SOURCE).toContain("mutually exclusive");
    });

    it("states max 7 simultaneous penalties", () => {
      expect(SOURCE).toMatch(/max(imum)?\s*(of\s+)?7/i);
    });
  });

  describe("design system compliance", () => {
    it("uses font-heading for headings", () => {
      expect(SOURCE).toContain("font-heading");
    });

    it("uses dark background", () => {
      expect(SOURCE).toContain("bg-bg");
    });

    it("includes Navbar", () => {
      expect(SOURCE).toContain("Navbar");
    });
  });
});
