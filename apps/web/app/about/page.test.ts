import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = [
  fs.readFileSync(path.resolve(__dirname, "page.tsx"), "utf-8"),
  fs.readFileSync(path.resolve(__dirname, "AboutPageClient.tsx"), "utf-8"),
].join("\n");

describe("About page", () => {
  describe("static/ISR rendering", () => {
    it("renders from DEFAULT_LOCALE instead of request-time locale APIs", () => {
      expect(SOURCE).toContain('export const dynamic = "force-static"');
      expect(SOURCE).toContain("export const revalidate = 3600");
      expect(SOURCE).toContain("DEFAULT_LOCALE");
      expect(SOURCE).not.toContain("getServerLocale");
    });
  });

  describe("metadata", () => {
    it("exports generateMetadata function", () => {
      expect(SOURCE).toContain("generateMetadata");
    });

    it("uses about.index.metadataTitle key", () => {
      expect(SOURCE).toContain("about.index.metadataTitle");
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

  describe("i18n integration", () => {
    it("uses getServerT() with the build-time default locale", () => {
      expect(SOURCE).toContain("DEFAULT_LOCALE");
      expect(SOURCE).toContain("getServerT");
      expect(SOURCE).toContain("@/lib/i18n/server");
    });

    it("imports LocaleSync", () => {
      expect(SOURCE).toContain("LocaleSync");
    });

    it("uses about.index translation keys", () => {
      expect(SOURCE).toContain("about.index.h1");
      expect(SOURCE).toContain("about.index.sectionDimensions");
      expect(SOURCE).toContain("about.index.sectionArchetypes");
      expect(SOURCE).toContain("about.index.sectionPrivacy");
      expect(SOURCE).toContain("about.index.sectionContact");
    });
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
    it("references dimension keys in translations", () => {
      expect(SOURCE).toContain("about.index.dimensionsBody");
    });

    it("links to all archetype pages", () => {
      expect(SOURCE).toContain('href="/archetypes/builder"');
      expect(SOURCE).toContain('href="/archetypes/guardian"');
      expect(SOURCE).toContain('href="/archetypes/marathoner"');
      expect(SOURCE).toContain('href="/archetypes/polymath"');
      expect(SOURCE).toContain('href="/archetypes/balanced"');
      expect(SOURCE).toContain('href="/archetypes/emerging"');
    });

    it("has privacy and fairness section key", () => {
      expect(SOURCE).toContain("about.index.sectionPrivacy");
    });

    it("links to badge verification page", () => {
      expect(SOURCE).toContain('href="/about/verification"');
    });
  });

  describe("logo branding", () => {
    it("uses underscore cursor instead of dot for Chapa logo", () => {
      expect(SOURCE).toContain("animate-cursor-blink");
      expect(SOURCE).toContain(">_</span>");
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

    it("uses NavbarClient (ISR-compatible)", () => {
      expect(SOURCE).toContain("NavbarClient");
    });

    it("uses the lazy command bar", () => {
      expect(SOURCE).toContain("GlobalCommandBarLazy");
      expect(SOURCE).not.toContain("<GlobalCommandBar ");
    });

    it("has main landmark with id", () => {
      expect(SOURCE).toContain('id="main-content"');
    });

    it("uses font-heading for headings", () => {
      expect(SOURCE).toContain("font-heading");
    });
  });
});
