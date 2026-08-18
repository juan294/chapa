import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "page.tsx"),
  "utf-8",
);
const EN_DICT = fs.readFileSync(
  path.resolve(__dirname, "../../lib/i18n/dictionaries/en.ts"),
  "utf-8",
);

describe("Landing page (server component)", () => {
  describe("component type", () => {
    it("is NOT a client component (no 'use client')", () => {
      expect(SOURCE).not.toMatch(/^["']use client["']/m);
    });

    it("delegates the body to the LandingContent server component", () => {
      expect(SOURCE).toContain("LandingContent");
    });
  });

  // #982 / #1023 (FE-H1) — the landing page is statically generated for BOTH
  // locales (app/[locale]/layout.tsx generateStaticParams), so it stays
  // ISR/CDN-cacheable while resolving translated copy server-side via
  // getServerT(locale) — no client-side re-render/flash. It must still NOT
  // read cookies, headers, or *query-string* searchParams at render time
  // (that would opt the route back into dynamic rendering); the `[locale]`
  // route *param* (not a searchParam) is what carries the resolved locale,
  // supplied by the proxy.ts rewrite.
  describe("static rendering contract (#982, #1023)", () => {
    it("declares force-static so the route is ISR/CDN-cacheable", () => {
      expect(SOURCE).toContain('export const dynamic = "force-static"');
    });

    it("does not use force-dynamic directive", () => {
      expect(SOURCE).not.toContain("force-dynamic");
    });

    it("does not call getServerLocale (locale comes from the route's [locale] param)", () => {
      expect(SOURCE).not.toContain("getServerLocale");
    });

    it("calls getServerT with the resolved [locale] route param (#1023 — no more locale flash)", () => {
      expect(SOURCE).toContain("getServerT");
      expect(SOURCE).toContain("params");
      expect(SOURCE).toContain("locale");
    });

    it("does not read query-string searchParams server-side (would force dynamic rendering)", () => {
      expect(SOURCE).not.toContain("searchParams");
    });
  });

  describe("canonical URL (#1065 / FE-H1)", () => {
    it("declares its own canonical for the unprefixed root path", () => {
      expect(SOURCE).toContain("generateMetadata");
      expect(SOURCE).toContain('canonical: "/"');
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
