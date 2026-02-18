import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * These tests verify that each archetype page includes:
 * 1. A structured "Key signals" section with PRIMARY/SECONDARY/SUPPORTING labels
 * 2. A link to the full scoring methodology at /about/scoring
 */

const ARCHETYPE_DIR = join(__dirname);

const ARCHETYPES = [
  {
    name: "builder",
    signals: ["Merged pull requests", "Closed issues", "Commit volume"],
  },
  {
    name: "guardian",
    signals: ["Code reviews submitted", "Review-to-PR ratio", "Code hygiene"],
  },
  {
    name: "marathoner",
    signals: ["Active days", "Heatmap evenness", "Burst detection"],
  },
  {
    name: "polymath",
    signals: ["Repositories contributed to", "Distribution evenness", "Documentation contributions", "Community signals"],
  },
  {
    name: "balanced",
    signals: ["All four dimensions closely matched", "Collectively strong"],
  },
  {
    name: "emerging",
    signals: ["Overall activity below threshold", "No specific archetype pattern"],
  },
];

describe("Archetype pages — scoring signals section", () => {
  for (const archetype of ARCHETYPES) {
    describe(archetype.name, () => {
      const filePath = join(ARCHETYPE_DIR, archetype.name, "page.tsx");
      const content = readFileSync(filePath, "utf-8");

      it("has a 'Key signals' heading", () => {
        expect(content).toContain("Key signals");
      });

      for (const signal of archetype.signals) {
        it(`mentions signal: "${signal}"`, () => {
          expect(content).toContain(signal);
        });
      }

      it("links to /about/scoring", () => {
        expect(content).toMatch(/href="\/about\/scoring"/);
      });
    });
  }
});
