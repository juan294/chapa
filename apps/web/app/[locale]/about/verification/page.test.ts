import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = [
  fs.readFileSync(path.resolve(__dirname, "page.tsx"), "utf-8"),
  fs.readFileSync(
    path.resolve(__dirname, "VerificationPageContent.tsx"),
    "utf-8",
  ),
].join("\n");

describe("Verification explainer page (server component)", () => {
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

    it("uses about.verification.metadataTitle key", () => {
      expect(SOURCE).toContain("about.verification.metadataTitle");
    });

    it("includes OpenGraph metadata", () => {
      expect(SOURCE).toContain("openGraph");
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
