import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "page.tsx"),
  "utf-8",
);

describe("Scoring methodology page", () => {
  describe("metadata", () => {
    it("exports metadata with title", () => {
      expect(SOURCE).toContain("title:");
      expect(SOURCE).toMatch(/title:.*[Ss]coring/);
    });

    it("exports metadata with description", () => {
      expect(SOURCE).toContain("description:");
    });

    it("has openGraph metadata", () => {
      expect(SOURCE).toContain("openGraph:");
    });
  });

  it("exports a default component", () => {
    expect(SOURCE).toMatch(/export default function \w+/);
  });

  describe("four dimensions", () => {
    it("documents Building dimension", () => {
      expect(SOURCE).toContain("Building");
      expect(SOURCE).toContain("70%");
    });

    it("documents Guarding dimension", () => {
      expect(SOURCE).toContain("Guarding");
      expect(SOURCE).toContain("60%");
    });

    it("documents Consistency dimension", () => {
      expect(SOURCE).toContain("Consistency");
      expect(SOURCE).toContain("50%");
    });

    it("documents Breadth dimension with forks and watchers", () => {
      expect(SOURCE).toContain("Breadth");
      expect(SOURCE).toContain("35%");
      expect(SOURCE).toContain("25%");
      expect(SOURCE).toContain("15%");
      expect(SOURCE).toContain("10%");
      expect(SOURCE).toContain("5%");
    });
  });

  describe("caps", () => {
    it("documents all signal caps", () => {
      expect(SOURCE).toContain("600");  // commits
      expect(SOURCE).toContain("120");  // PR weight
      expect(SOURCE).toContain("180");  // reviews
      expect(SOURCE).toContain("80");   // issues
      expect(SOURCE).toContain("15");   // repos
      expect(SOURCE).toContain("500");  // stars
      expect(SOURCE).toContain("200");  // forks
      expect(SOURCE).toContain("100");  // watchers
    });
  });

  describe("confidence system", () => {
    it("documents confidence penalties", () => {
      expect(SOURCE).toMatch(/[Bb]urst/);
      expect(SOURCE).toMatch(/[Mm]icro/);
      expect(SOURCE).toMatch(/[Cc]ollaboration/);
    });

    it("mentions confidence floor of 50", () => {
      expect(SOURCE).toContain("50");
    });
  });

  describe("archetypes", () => {
    it("documents all six archetypes", () => {
      expect(SOURCE).toContain("Builder");
      expect(SOURCE).toContain("Guardian");
      expect(SOURCE).toContain("Marathoner");
      expect(SOURCE).toContain("Polymath");
      expect(SOURCE).toContain("Balanced");
      expect(SOURCE).toContain("Emerging");
    });
  });

  describe("tiers", () => {
    it("documents all four tiers", () => {
      expect(SOURCE).toContain("Emerging");
      expect(SOURCE).toContain("Solid");
      expect(SOURCE).toContain("High");
      expect(SOURCE).toContain("Elite");
    });
  });

  describe("feedback CTA", () => {
    it("includes Twitter link", () => {
      expect(SOURCE).toContain("@juang294");
    });

    it("includes support email", () => {
      expect(SOURCE).toContain("support@chapa.thecreativetoken.com");
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
