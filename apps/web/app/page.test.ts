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

    it("delegates the body to the LandingPageClient client component", () => {
      expect(SOURCE).toContain("LandingPageClient");
    });
  });

  // #982 — the landing page must be statically renderable (ISR/CDN-cacheable).
  // It must NOT read cookies, headers, or searchParams at render time, since any
  // of those opts the route out of static generation. Locale + query-param
  // handling is delegated to the client (LandingPageClient / useTranslation /
  // window.location in an effect).
  describe("static rendering contract (#982)", () => {
    it("declares force-static so the route is ISR/CDN-cacheable", () => {
      expect(SOURCE).toContain('export const dynamic = "force-static"');
    });

    it("does not use force-dynamic directive", () => {
      expect(SOURCE).not.toContain("force-dynamic");
    });

    it("does not call getServerLocale (no cookie read at render time)", () => {
      expect(SOURCE).not.toContain("getServerLocale");
    });

    it("does not call getServerT (translation delegated to the client)", () => {
      expect(SOURCE).not.toContain("getServerT");
    });

    it("does not read searchParams server-side (would force dynamic rendering)", () => {
      expect(SOURCE).not.toContain("searchParams");
    });
  });

  describe("rendering", () => {
    it("computes the demo badge SVG server-side and passes it as a prop", () => {
      expect(SOURCE).toContain("renderBadgeSvg");
      expect(SOURCE).toContain("demoBadgeSvg");
    });
  });

  describe("i18n dictionary content (English)", () => {
    it("hero heading copy is in the English dictionary", () => {
      expect(EN_DICT).toContain("Developer impact,");
    });

    it("lists all five features in the English dictionary", () => {
      expect(EN_DICT).toContain("MULTI-DIMENSIONAL");
      expect(EN_DICT).toContain("DEVELOPER ARCHETYPE");
      expect(EN_DICT).toContain("VERIFIED METRICS");
      expect(EN_DICT).toContain("LIVING DOCUMENT");
      expect(EN_DICT).toContain("ONE-CLICK EMBED");
    });

    it("lists all four core dimensions in the English dictionary", () => {
      expect(EN_DICT).toContain("'DELIVERY'");
      expect(EN_DICT).toContain("'QUALITY'");
      expect(EN_DICT).toContain("'CONSISTENCY'");
      expect(EN_DICT).toContain("'BREADTH'");
    });

    it("section headings are present in the English dictionary", () => {
      expect(EN_DICT).toContain("Features");
      expect(EN_DICT).toContain("How it Works");
      expect(EN_DICT).toContain("Enterprise");
      expect(EN_DICT).toContain("Stats");
      expect(EN_DICT).toContain("Get started");
    });

    it("does not keep the old English acquisition CTAs in the dictionary", () => {
      expect(EN_DICT).not.toContain("Get Your Badge");
      expect(EN_DICT).not.toContain("Ready to prove your impact?");
    });
  });
});
