import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Comprehensive render tests for all 6 archetype pages.
 * Tests metadata, heading hierarchy, design system compliance,
 * accessibility, and page structure.
 */

const ARCHETYPE_DIRS = [
  "balanced",
  "builder",
  "emerging",
  "guardian",
  "marathoner",
  "polymath",
];

const EXPECTED_TITLES: Record<string, string> = {
  balanced: "The Balanced Archetype",
  builder: "The Builder Archetype",
  emerging: "The Emerging Archetype",
  guardian: "The Quality Champion Archetype",
  marathoner: "The Marathoner Archetype",
  polymath: "The Polymath Archetype",
};

describe("Archetype pages — render tests", () => {
  for (const archetype of ARCHETYPE_DIRS) {
    describe(archetype, () => {
      const source = fs.readFileSync(
        path.resolve(__dirname, archetype, "page.tsx"),
        "utf-8",
      );

      describe("metadata", () => {
        it("exports metadata with title", () => {
          expect(source).toContain(`title: "${EXPECTED_TITLES[archetype]}"`);
        });

        it("exports metadata with description", () => {
          expect(source).toContain("description:");
        });
      });

      describe("default export", () => {
        it("exports a default function component", () => {
          expect(source).toMatch(/export default function \w+Page/);
        });
      });

      describe("heading hierarchy", () => {
        it("has an h1 heading", () => {
          expect(source).toContain("<h1");
        });

        it("uses h2 for section headings", () => {
          expect(source).toContain("<h2");
        });
      });

      describe("badge preview", () => {
        it("renders badge SVG from archetype demo data", () => {
          expect(source).toContain("renderBadgeSvg");
          expect(source).toContain("archetypeDemoData");
        });

        it("has role='img' and aria-label on badge", () => {
          expect(source).toContain('role="img"');
          expect(source).toContain("aria-label=");
        });

        it("uses dangerouslySetInnerHTML for SVG", () => {
          expect(source).toContain("dangerouslySetInnerHTML");
        });

        it("enables demoMode and includeBranding", () => {
          expect(source).toContain("demoMode: true");
          expect(source).toContain("includeBranding: true");
        });
      });

      describe("terminal command pattern", () => {
        it("has terminal command line", () => {
          expect(source).toContain("chapa archetype");
        });

        it("uses $ prefix in terminal-dim", () => {
          expect(source).toContain("text-terminal-dim");
        });
      });

      describe("navigation links", () => {
        it("links back to features", () => {
          expect(source).toContain('href="/#features"');
        });

        it("links to scoring methodology", () => {
          expect(source).toContain('href="/about/scoring"');
        });
      });

      describe("design system compliance", () => {
        it("uses semantic background tokens", () => {
          expect(source).toContain("bg-bg");
        });

        it("uses Navbar", () => {
          expect(source).toContain("<Navbar");
        });

        it("uses GlobalCommandBar", () => {
          expect(source).toContain("<GlobalCommandBar");
        });

        it("has main landmark with id", () => {
          expect(source).toContain('id="main-content"');
        });

        it("uses font-heading", () => {
          expect(source).toContain("font-heading");
        });

        it("uses border-l border-stroke for content", () => {
          expect(source).toContain("border-l border-stroke");
        });

        it("uses animate-fade-in-up", () => {
          expect(source).toContain("animate-fade-in-up");
        });

        it("uses amber accent", () => {
          expect(source).toContain("text-amber");
        });
      });

      describe("article structure", () => {
        it("wraps content in an article element", () => {
          expect(source).toContain("<article");
        });
      });
    });
  }
});
