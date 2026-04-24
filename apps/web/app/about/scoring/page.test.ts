import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "page.tsx"),
  "utf-8",
);

describe("Scoring methodology page (server component)", () => {
  describe("ISR configuration", () => {
    it("exports revalidate = 86400 (24h)", () => {
      expect(SOURCE).toContain("export const revalidate = 86400");
    });
  });

  describe("metadata", () => {
    it("exports metadata with title", () => {
      expect(SOURCE).toContain("Scoring Methodology");
    });

    it("includes OpenGraph metadata", () => {
      expect(SOURCE).toContain("openGraph");
    });
  });

  describe("rendering", () => {
    it("renders Navbar", () => {
      expect(SOURCE).toContain("Navbar");
    });

    it("renders the lazy command bar", () => {
      expect(SOURCE).toContain("GlobalCommandBarLazy");
      expect(SOURCE).not.toContain("<GlobalCommandBar ");
    });

    it("renders main content area", () => {
      expect(SOURCE).toContain('id="main-content"');
    });
  });

  describe("video explainer", () => {
    it("renders LiteYouTubeEmbed", () => {
      expect(SOURCE).toContain("LiteYouTubeEmbed");
    });

    it("has a YouTube video ID set", () => {
      expect(SOURCE).toMatch(/videoId="[a-zA-Z0-9_-]+"/);
    });
  });

  describe("scoring content sections", () => {
    it("covers Philosophy section", () => {
      expect(SOURCE).toContain("Philosophy");
    });

    it("covers Normalization section", () => {
      expect(SOURCE).toContain("Normalization");
    });

    it("covers all four core dimensions", () => {
      expect(SOURCE).toContain("Delivery");
      expect(SOURCE).toContain("Quality");
      expect(SOURCE).toContain("Consistency");
      expect(SOURCE).toContain("Breadth");
    });

    it("covers archetypes section", () => {
      expect(SOURCE).toContain("Developer archetypes");
    });

    it("covers confidence system", () => {
      expect(SOURCE).toContain("Confidence system");
    });

    it("covers score smoothing", () => {
      expect(SOURCE).toContain("Score smoothing");
    });

    it("covers tiers", () => {
      expect(SOURCE).toContain("Emerging");
      expect(SOURCE).toContain("Solid");
      expect(SOURCE).toContain("High");
      expect(SOURCE).toContain("Elite");
    });
  });
});
