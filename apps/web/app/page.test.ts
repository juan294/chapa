import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "page.tsx"),
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

  describe("ISR configuration", () => {
    it("exports revalidate = 3600", () => {
      expect(SOURCE).toContain("export const revalidate = 3600");
    });
  });

  describe("rendering", () => {
    it("renders Navbar", () => {
      expect(SOURCE).toContain("Navbar");
    });

    it("renders main content area", () => {
      expect(SOURCE).toContain('id="main-content"');
    });

    it("renders hero heading", () => {
      expect(SOURCE).toContain("Developer Impact,");
    });

    it("renders badge preview", () => {
      expect(SOURCE).toContain("demoBadgeSvg");
    });

    it("renders BadgeOverlay", () => {
      expect(SOURCE).toContain("BadgeOverlay");
    });

    it("renders GitHub login CTA", () => {
      expect(SOURCE).toContain("/api/auth/login");
    });

    it("renders LandingTerminal", () => {
      expect(SOURCE).toContain("LandingTerminal");
    });

    it("renders footer", () => {
      expect(SOURCE).toContain("<footer");
    });
  });

  describe("features section", () => {
    it("lists all five features", () => {
      expect(SOURCE).toContain("MULTI-DIMENSIONAL");
      expect(SOURCE).toContain("DEVELOPER ARCHETYPE");
      expect(SOURCE).toContain("VERIFIED METRICS");
      expect(SOURCE).toContain("LIVING DOCUMENT");
      expect(SOURCE).toContain("ONE-CLICK EMBED");
    });
  });

  describe("dimensions section", () => {
    it("lists all four core dimensions", () => {
      expect(SOURCE).toContain('"DELIVERY"');
      expect(SOURCE).toContain('"QUALITY"');
      expect(SOURCE).toContain('"CONSISTENCY"');
      expect(SOURCE).toContain('"BREADTH"');
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
});
