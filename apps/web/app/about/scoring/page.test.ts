import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "page.tsx"),
  "utf-8",
);

describe("Scoring methodology page (server component)", () => {
  describe("dynamic rendering (locale-aware per-request)", () => {
    it("does not use force-static (page must be dynamic to read locale cookie)", () => {
      expect(SOURCE).not.toContain("export const dynamic = 'force-static'");
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
  });

  describe("i18n integration", () => {
    it("uses getServerLocale() to detect locale from cookie at request time", () => {
      expect(SOURCE).toContain("getServerLocale");
      expect(SOURCE).not.toContain("DEFAULT_LOCALE");
      expect(SOURCE).toContain("getServerT");
      expect(SOURCE).toContain("@/lib/i18n/server");
    });

    it("generateMetadata is async (required to call getServerLocale)", () => {
      expect(SOURCE).toMatch(/async function generateMetadata/);
    });

    it("imports LocaleSync", () => {
      expect(SOURCE).toContain("LocaleSync");
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
