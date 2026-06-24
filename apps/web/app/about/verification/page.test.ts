import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "page.tsx"),
  "utf-8",
);

describe("Verification explainer page (server component)", () => {
  describe("dynamic rendering (locale-aware per-request)", () => {
    it("does not use force-static (page must be dynamic to read locale cookie)", () => {
      expect(SOURCE).not.toContain("export const dynamic = 'force-static'");
      expect(SOURCE).not.toContain("export const dynamic = 'force-dynamic'");
    });
  });

  describe("metadata", () => {
    it("exports generateMetadata function", () => {
      expect(SOURCE).toContain("generateMetadata");
    });

    it("uses about.verification.metadataTitle key", () => {
      expect(SOURCE).toContain("about.verification.metadataTitle");
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

    it("imports LocaleSync", () => {
      expect(SOURCE).toContain("LocaleSync");
    });

    it("uses about.verification translation keys", () => {
      expect(SOURCE).toContain("about.verification.sectionWhy");
      expect(SOURCE).toContain("about.verification.sectionHow");
      expect(SOURCE).toContain("about.verification.sectionWhat");
      expect(SOURCE).toContain("about.verification.sectionGuarantees");
      expect(SOURCE).toContain("about.verification.sectionLimits");
      expect(SOURCE).toContain("about.verification.sectionHowTo");
      expect(SOURCE).toContain("about.verification.sectionDesign");
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

  describe("content", () => {
    it("references HMAC key in translations", () => {
      expect(SOURCE).toContain("about.verification.howHighlight");
    });

    it("uses what table rows key", () => {
      expect(SOURCE).toContain("about.verification.whatTableRows");
    });

    it("uses design table rows key", () => {
      expect(SOURCE).toContain("about.verification.designTableRows");
    });
  });
});
