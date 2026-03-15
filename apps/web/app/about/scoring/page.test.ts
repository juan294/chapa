import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "page.tsx"),
  "utf-8",
);

describe("Scoring methodology page", () => {
  describe("ISR", () => {
    it("exports revalidate = 3600", () => {
      expect(SOURCE).toContain("export const revalidate = 3600");
    });
  });

  it("is always rendered (no feature flag)", () => {
    expect(SOURCE).not.toContain("isScoringPageEnabled");
    expect(SOURCE).not.toContain("notFound");
  });

  it("exports a default component", () => {
    expect(SOURCE).toMatch(/export default function \w+/);
  });

  describe("metadata", () => {
    it("exports metadata with title", () => {
      expect(SOURCE).toContain('title: "Scoring Methodology"');
    });

    it("includes openGraph metadata", () => {
      expect(SOURCE).toContain("openGraph:");
    });

    it("includes twitter card metadata", () => {
      expect(SOURCE).toContain("twitter:");
    });
  });

  describe("heading hierarchy", () => {
    it("has an h1 heading", () => {
      expect(SOURCE).toContain("<h1");
    });

    it("uses SectionHeading component for h2 headings", () => {
      expect(SOURCE).toContain("<SectionHeading>");
    });

    it("uses SubHeading component for h3 headings", () => {
      expect(SOURCE).toContain("<SubHeading>");
    });
  });

  describe("content sections", () => {
    it("covers all four dimensions", () => {
      expect(SOURCE).toContain("Delivery");
      expect(SOURCE).toContain("Quality");
      expect(SOURCE).toContain("Consistency");
      expect(SOURCE).toContain("Breadth");
    });

    it("explains collaborative vs solo quality", () => {
      expect(SOURCE).toContain("Collaborative Quality");
      expect(SOURCE).toContain("Solo Quality");
    });

    it("documents archetypes", () => {
      expect(SOURCE).toContain("Developer archetypes");
    });

    it("documents composite score and tiers", () => {
      expect(SOURCE).toContain("Composite score and tiers");
    });

    it("documents confidence system", () => {
      expect(SOURCE).toContain("Confidence system");
    });

    it("documents score smoothing (EMA)", () => {
      expect(SOURCE).toContain("Score smoothing");
      expect(SOURCE).toContain("exponential moving average");
    });

    it("documents what is deliberately excluded", () => {
      expect(SOURCE).toContain("What we deliberately exclude");
    });
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

    it("uses semantic background token", () => {
      expect(SOURCE).toContain("bg-bg");
    });

    it("includes Navbar", () => {
      expect(SOURCE).toContain("<Navbar");
    });

    it("includes GlobalCommandBar", () => {
      expect(SOURCE).toContain("<GlobalCommandBar");
    });

    it("has main landmark with id", () => {
      expect(SOURCE).toContain('id="main-content"');
    });
  });
});
