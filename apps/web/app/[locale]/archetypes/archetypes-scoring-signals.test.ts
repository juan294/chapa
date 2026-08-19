import { describe, expect, it } from "vitest";
import { en } from "@/lib/i18n/dictionaries/en";

/**
 * These tests verify that each archetype's key signals appear in the EN dictionary.
 *
 * Note: Content is now in the i18n dictionaries, not in the page.tsx wrappers
 * (#1023 / FE-H1) — importing the dictionary module directly (rather than
 * reading dictionaries/en.ts as text) asserts against the actual runtime
 * translation values, not source comments/formatting.
 */

const ARCHETYPES = [
  {
    name: "builder",
    signals: ["Merged pull requests", "Closed issues", "Commit volume"],
  },
  {
    name: "guardian",
    signals: ["Code reviews submitted", "Review-to-PR ratio", "Batch size"],
  },
  {
    name: "marathoner",
    signals: ["Active days", "Heatmap evenness", "Week coverage"],
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
] as const;

describe("Archetype scoring signals — in EN dictionary", () => {
  const dictContent = JSON.stringify(en.archetypes);

  for (const archetype of ARCHETYPES) {
    describe(archetype.name, () => {
      for (const signal of archetype.signals) {
        it(`EN dictionary mentions signal: "${signal}"`, () => {
          expect(dictContent).toContain(signal);
        });
      }
    });
  }
});
