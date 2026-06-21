import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "page.tsx"),
  "utf-8",
);
const EN_DICT = fs.readFileSync(
  path.resolve(__dirname, "../lib/i18n/dictionaries/en.ts"),
  "utf-8",
);

describe("Landing page (server component)", () => {
  describe("component type", () => {
    it("is NOT a client component (no 'use client')", () => {
      expect(SOURCE).not.toMatch(/^["']use client["']/m);
    });

    it("is an async function (server component)", () => {
      expect(SOURCE).toContain("async function");
    });
  });

  describe("dynamic rendering (locale-aware per-request)", () => {
    it("does not use force-static (page is dynamic to read locale cookie)", () => {
      expect(SOURCE).not.toContain("export const dynamic = 'force-static'");
    });

    it("does not use force-dynamic directive", () => {
      expect(SOURCE).not.toContain("export const dynamic = 'force-dynamic'");
    });
  });

  describe("rendering", () => {
    it("renders NavbarClient (ISR-compatible, no headers() call)", () => {
      expect(SOURCE).toContain("NavbarClient");
    });

    it("renders main content area", () => {
      expect(SOURCE).toContain('id="main-content"');
    });

    it("hero heading copy is in the English dictionary", () => {
      expect(EN_DICT).toContain("Developer Impact,");
    });

    it("renders badge preview", () => {
      expect(SOURCE).toContain("demoBadgeSvg");
    });

    it("renders BadgeOverlay", () => {
      expect(SOURCE).toContain("BadgeOverlay");
    });

    it("renders GitHub login CTA (via LoginCtaButton, which links to /api/auth/login)", () => {
      expect(SOURCE).toContain("LoginCtaButton");
    });

    it("renders LandingTerminal", () => {
      expect(SOURCE).toContain("LandingTerminal");
    });

    it("renders footer", () => {
      expect(SOURCE).toContain("<footer");
    });
  });

  describe("features section", () => {
    it("lists all five features in the English dictionary", () => {
      expect(EN_DICT).toContain("MULTI-DIMENSIONAL");
      expect(EN_DICT).toContain("DEVELOPER ARCHETYPE");
      expect(EN_DICT).toContain("VERIFIED METRICS");
      expect(EN_DICT).toContain("LIVING DOCUMENT");
      expect(EN_DICT).toContain("ONE-CLICK EMBED");
    });
  });

  describe("dimensions section", () => {
    it("lists all four core dimensions in the English dictionary", () => {
      expect(EN_DICT).toContain("'DELIVERY'");
      expect(EN_DICT).toContain("'QUALITY'");
      expect(EN_DICT).toContain("'CONSISTENCY'");
      expect(EN_DICT).toContain("'BREADTH'");
    });
  });

  describe("i18n integration", () => {
    it("uses getServerT() for translations", () => {
      expect(SOURCE).toContain("getServerT");
    });

    it("uses getServerLocale() to detect locale from cookie at request time", () => {
      expect(SOURCE).toContain("getServerLocale");
      expect(SOURCE).not.toContain("DEFAULT_LOCALE");
    });

    it("renders LocaleSync for sticky lang override", () => {
      expect(SOURCE).toContain("LocaleSync");
    });

    it("does not use the old SPANISH_PUBLIC_COPY import", () => {
      expect(SOURCE).not.toContain("SPANISH_PUBLIC_COPY");
    });

    it("does not keep the old English acquisition CTAs on the landing page", () => {
      expect(SOURCE).not.toContain("Get Your Badge");
      expect(SOURCE).not.toContain("Verify a Badge");
      expect(SOURCE).not.toContain("Ready to prove your impact?");
      expect(EN_DICT).not.toContain("Get Your Badge");
      // "Verify a Badge" is legitimately used as a CTA in the verification page namespace
      // (about.verification.ctaButton), so we only check landing-specific keys
      expect(EN_DICT).not.toContain("Ready to prove your impact?");
    });
  });

  describe("error handling", () => {
    it("reads searchParams for OAuth errors", () => {
      expect(SOURCE).toContain("searchParams");
    });

    it("uses getOAuthErrorMessage", () => {
      expect(SOURCE).toContain("getOAuthErrorMessage");
    });

    it("renders ErrorBanner conditionally", () => {
      expect(SOURCE).toContain("ErrorBanner");
    });
  });

  // #740 — UX-M3: verification CTA uses complement (teal) tokens
  describe("verification CTA uses complement tokens (#740)", () => {
    it("Verify a Badge button uses bg-complement", () => {
      expect(SOURCE).toContain("bg-complement");
    });

    it("Verify a Badge button links to /verify", () => {
      expect(SOURCE).toContain('href="/verify"');
    });
  });

  describe("archetype links", () => {
    it("links to all seven archetype pages", () => {
      expect(SOURCE).toContain("/archetypes/builder");
      expect(SOURCE).toContain("/archetypes/guardian");
      expect(SOURCE).toContain("/archetypes/marathoner");
      expect(SOURCE).toContain("/archetypes/polymath");
      expect(SOURCE).toContain("/archetypes/artificer");
      expect(SOURCE).toContain("/archetypes/balanced");
      expect(SOURCE).toContain("/archetypes/emerging");
    });
  });

  // Phase 9 — optical icon alignment on CTA buttons
  describe("optical icon alignment (Phase 9)", () => {
    it("CTA buttons use asymmetric padding for optical icon alignment", () => {
      // Hero buttons should have pl-6 pr-5 (not symmetric px-6)
      expect(SOURCE).toContain("pl-6 pr-5");
    });
  });

  // #741 — visible section labels for landmark sections
  describe("visible section labels (#741)", () => {
    it("Features section has a visible label element (not only sr-only)", () => {
      // There should be a visible label with font-heading + tracking-widest or similar
      expect(SOURCE).toContain("tracking-widest");
    });

    it("section labels use text-text-secondary and font-heading", () => {
      expect(SOURCE).toContain("text-text-secondary");
      expect(SOURCE).toContain("font-heading");
    });

    it("section headings are present in the English dictionary", () => {
      expect(EN_DICT).toContain("Features");
      expect(EN_DICT).toContain("How it Works");
      expect(EN_DICT).toContain("Enterprise");
      expect(EN_DICT).toContain("Stats");
      expect(EN_DICT).toContain("Get started");
    });
  });
});
