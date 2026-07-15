import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * These tests verify that each archetype's key signals appear in the EN dictionary,
 * and that the ArchetypePage component links to /about/scoring.
 *
 * Note: Content is now in the i18n dictionaries, not in the page.tsx wrappers.
 */

const ARCHETYPE_DIR = join(__dirname);
const DICT_PATH = join(__dirname, "../../../lib/i18n/dictionaries/en.ts");

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
];

describe("Archetype scoring signals — in EN dictionary", () => {
  const dictContent = readFileSync(DICT_PATH, "utf-8");

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

describe("ArchetypePage component — scoring links", () => {
  const componentContent = [
    readFileSync(join(ARCHETYPE_DIR, "_components/ArchetypePage.tsx"), "utf-8"),
    readFileSync(
      join(ARCHETYPE_DIR, "_components/ArchetypePageClient.tsx"),
      "utf-8",
    ),
  ].join("\n");

  it("links to /about/scoring", () => {
    expect(componentContent).toMatch(/href="\/about\/scoring"/);
  });

  it("links to /#features", () => {
    expect(componentContent).toMatch(/href="\/#features"/);
  });
});

describe("Archetype page wrappers — structural compliance", () => {
  for (const archetype of ARCHETYPES) {
    it(`${archetype.name}/page.tsx delegates to ArchetypePage`, () => {
      const filePath = join(ARCHETYPE_DIR, archetype.name, "page.tsx");
      const content = readFileSync(filePath, "utf-8");
      expect(content).toContain("ArchetypePage");
    });
  }
});
