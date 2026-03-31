import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "page.tsx"),
  "utf-8",
);

describe("About page", () => {
  describe("ISR", () => {
    it("exports revalidate = 86400 (24h)", () => {
      expect(SOURCE).toContain("export const revalidate = 86400");
    });
  });

  describe("metadata", () => {
    it("exports metadata with title", () => {
      expect(SOURCE).toContain('title: "About"');
    });

    it("exports metadata with description", () => {
      expect(SOURCE).toContain("description:");
    });

    it("includes openGraph metadata", () => {
      expect(SOURCE).toContain("openGraph:");
    });

    it("includes twitter card metadata", () => {
      expect(SOURCE).toContain("twitter:");
    });
  });

  it("exports a default component", () => {
    expect(SOURCE).toContain("export default function AboutPage");
  });

  describe("heading hierarchy", () => {
    it("has an h1 heading", () => {
      expect(SOURCE).toContain("<h1");
    });

    it("uses h2 for section headings", () => {
      const h2Matches = SOURCE.match(/<h2\b/g) ?? [];
      expect(h2Matches.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("content sections", () => {
    it("explains four dimensions", () => {
      expect(SOURCE).toContain("Delivery");
      expect(SOURCE).toContain("Quality");
      expect(SOURCE).toContain("Consistency");
      expect(SOURCE).toContain("Breadth");
    });

    it("explains developer archetypes", () => {
      expect(SOURCE).toContain("Developer archetypes");
    });

    it("links to all 6 archetype pages", () => {
      expect(SOURCE).toContain('href="/archetypes/builder"');
      expect(SOURCE).toContain('href="/archetypes/guardian"');
      expect(SOURCE).toContain('href="/archetypes/marathoner"');
      expect(SOURCE).toContain('href="/archetypes/polymath"');
      expect(SOURCE).toContain('href="/archetypes/balanced"');
      expect(SOURCE).toContain('href="/archetypes/emerging"');
    });

    it("has privacy and fairness section", () => {
      expect(SOURCE).toContain("Privacy and fairness");
    });

    it("has contact section", () => {
      expect(SOURCE).toContain("Contact");
    });

    it("links to badge verification page", () => {
      expect(SOURCE).toContain('href="/about/verification"');
    });
  });

  describe("logo branding", () => {
    it("uses underscore cursor instead of dot for Chapa logo", () => {
      expect(SOURCE).toContain("Chapa<span");
      expect(SOURCE).toContain("animate-cursor-blink");
      expect(SOURCE).toContain(">_</span>");
    });

    it("does NOT use the old dot logo", () => {
      expect(SOURCE).not.toMatch(/>About Chapa<span[^>]*>\.<\/span>/);
    });
  });

  describe("scoring methodology link", () => {
    it("links to the scoring methodology page", () => {
      expect(SOURCE).toContain('href="/about/scoring"');
    });
  });

  describe("design system compliance", () => {
    it("uses semantic background token", () => {
      expect(SOURCE).toContain("bg-bg");
    });

    it("uses Navbar", () => {
      expect(SOURCE).toContain("<Navbar");
    });

    it("uses GlobalCommandBar", () => {
      expect(SOURCE).toContain("<GlobalCommandBar");
    });

    it("has main landmark with id", () => {
      expect(SOURCE).toContain('id="main-content"');
    });

    it("uses font-heading for headings", () => {
      expect(SOURCE).toContain("font-heading");
    });
  });
});
