import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = [
  fs.readFileSync(path.resolve(__dirname, "page.tsx"), "utf-8"),
  fs.readFileSync(
    path.resolve(__dirname, "ScoringMethodologyContent.tsx"),
    "utf-8",
  ),
].join("\n");

describe("Scoring methodology page (server component)", () => {
  describe("static/ISR rendering", () => {
    it("forces static rendering with hourly revalidation", () => {
      expect(SOURCE).toContain('export const dynamic = "force-static"');
      expect(SOURCE).toContain("export const revalidate = 3600");
      expect(SOURCE).not.toContain("export const dynamic = 'force-dynamic'");
    });
  });

  describe("metadata", () => {
    it("exports generateMetadata function", () => {
      expect(SOURCE).toContain("generateMetadata");
    });

    it("uses about.scoring.metadataTitle key", () => {
      expect(SOURCE).toContain("about.scoring.metadataTitle");
    });

    it("includes OpenGraph metadata", () => {
      expect(SOURCE).toContain("openGraph");
    });

    it("declares the unprefixed public path as its canonical (#1065 / FE-H1)", () => {
      expect(SOURCE).toContain('canonical: "/about/scoring"');
    });
  });

  // #1023 (FE-H1) — locale now comes from the route's [locale] segment
  // param (populated by proxy.ts), not a build-time DEFAULT_LOCALE
  // constant or a request-time getServerLocale() cookie/header read.
  describe("i18n integration (#1023)", () => {
    it("uses getServerT() with the [locale] route param", () => {
      expect(SOURCE).not.toContain("DEFAULT_LOCALE");
      expect(SOURCE).not.toContain("getServerLocale");
      expect(SOURCE).toContain("getServerT");
      expect(SOURCE).toContain("@/lib/i18n/server");
      expect(SOURCE).toContain("params");
    });

    it("generateMetadata is async", () => {
      expect(SOURCE).toMatch(/async function generateMetadata/);
    });

    it("uses about.scoring translation keys for sections", () => {
      expect(SOURCE).toContain("about.scoring.sectionPhilosophy");
      expect(SOURCE).toContain("about.scoring.sectionNormalization");
      expect(SOURCE).toContain("about.scoring.sectionDimensions");
      expect(SOURCE).toContain("about.scoring.sectionCraft");
      expect(SOURCE).toContain("about.scoring.sectionArchetypes");
      expect(SOURCE).toContain("about.scoring.sectionComposite");
      expect(SOURCE).toContain("about.scoring.sectionConfidence");
      expect(SOURCE).toContain("about.scoring.sectionSmoothing");
      expect(SOURCE).toContain("about.scoring.sectionExcludes");
    });
  });

  describe("rendering", () => {
    it("renders NavbarClient (ISR-compatible)", () => {
      expect(SOURCE).toContain("NavbarClient");
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

  describe("scoring content keys", () => {
    it("covers delivery dimension key", () => {
      expect(SOURCE).toContain("about.scoring.deliveryHeading");
    });

    it("covers quality dimension key", () => {
      expect(SOURCE).toContain("about.scoring.qualityHeading");
    });

    it("covers consistency dimension key", () => {
      expect(SOURCE).toContain("about.scoring.consistencyHeading");
    });

    it("covers breadth dimension key", () => {
      expect(SOURCE).toContain("about.scoring.breadthHeading");
    });

    it("covers archetypes section key", () => {
      expect(SOURCE).toContain("about.scoring.sectionArchetypes");
    });

    it("covers confidence system key", () => {
      expect(SOURCE).toContain("about.scoring.sectionConfidence");
    });

    it("covers score smoothing key", () => {
      expect(SOURCE).toContain("about.scoring.sectionSmoothing");
    });

    it("covers tiers table", () => {
      expect(SOURCE).toContain("about.scoring.tiersTableRows");
    });
  });
});
