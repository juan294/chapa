import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "page.tsx"),
  "utf-8",
);

describe("SharePage", () => {
  // W1 — share page must have an h1 for WCAG 2.1 Level A compliance
  describe("heading hierarchy", () => {
    it("has an h1 element", () => {
      expect(SOURCE).toMatch(/<h1[\s>]/);
    });

    it("h1 is screen-reader only", () => {
      const h1Match = SOURCE.match(/<h1[^>]*>/);
      expect(h1Match).not.toBeNull();
      expect(h1Match![0]).toContain("sr-only");
    });
  });

  // W4 — h2 elements must use font-heading per design system
  describe("design system typography", () => {
    it("h2 elements include font-heading class", () => {
      const h2Matches = SOURCE.match(/<h2[^>]*>/g) ?? [];
      expect(h2Matches.length).toBeGreaterThan(0);
      for (const h2 of h2Matches) {
        expect(h2).toContain("font-heading");
      }
    });
  });

  // Phase 5 — Share page integration with Creator Studio
  describe("config-aware badge rendering", () => {
    it("fetches saved config from Redis", () => {
      expect(SOURCE).toContain("cacheGet");
      expect(SOURCE).toContain("config:");
    });

    it("renders ShareBadgePreview for interactive badge", () => {
      expect(SOURCE).toContain("ShareBadgePreview");
    });

    it("falls back to static SVG img when no config", () => {
      expect(SOURCE).toContain("badge.svg");
    });
  });

  describe("owner content delegation", () => {
    it("delegates owner/visitor sections to SharePageOwnerContent", () => {
      expect(SOURCE).toContain("SharePageOwnerContent");
    });

    it("passes stats, impact, and handle to SharePageOwnerContent", () => {
      expect(SOURCE).toContain("stats={stats}");
      expect(SOURCE).toContain("impact={impact}");
      expect(SOURCE).toContain("handle={handle}");
    });
  });

  describe("toolbar with share + customize", () => {
    it("uses BadgeToolbar component", () => {
      expect(SOURCE).toContain("BadgeToolbar");
    });

    it("passes studioEnabled to toolbar", () => {
      expect(SOURCE).toContain("studioEnabled");
    });

    it("passes isOwner to toolbar", () => {
      expect(SOURCE).toContain("isOwner");
    });
  });

  // #230 — badge img must have fetchpriority="high" (LCP element)
  describe("badge img fetchpriority", () => {
    it("has fetchpriority=\"high\" on the badge img tag", () => {
      // Find the JSX <img that contains badge.svg (multi-line JSX with \n between attrs)
      // Use \n after <img to distinguish from the single-line embed HTML string
      const imgMatch = SOURCE.match(/<img\n[\s\S]*?badge\.svg[\s\S]*?\/>/);
      expect(imgMatch).not.toBeNull();
      expect(imgMatch![0]).toContain('fetchPriority="high"');
    });
  });

  // #234 — archetype heading is now rendered inside ImpactDashboard (HeroScoreZone)
  describe("archetype heading delegation", () => {
    it("does not render archetype heading directly (delegated to ImpactDashboard)", () => {
      // The archetype heading was moved into HeroScoreZone via ImpactDashboard
      expect(SOURCE).not.toMatch(/<h3[^>]*>\s*\{impact\.archetype\}\s*<\/h3>/);
    });
  });

  describe("OG image cache busting", () => {
    it("appends a daily version parameter to og-image URL", () => {
      expect(SOURCE).toContain("og-image?v=");
    });
  });

  describe("Twitter meta description", () => {
    it("uses curiosity-driven description for Twitter cards", () => {
      expect(SOURCE).toContain("What does your developer DNA look like");
    });
  });

  // #120 — JSON-LD script injection prevention
  describe("JSON-LD security", () => {
    it("escapes < characters in JSON-LD to prevent script injection", () => {
      // The dangerouslySetInnerHTML for JSON-LD must use .replace to escape <
      expect(SOURCE).toContain("JSON.stringify(personJsonLd).replace(");
      expect(SOURCE).toContain("u003c");
    });
  });

  // #555 — ISR revalidation for share pages (cuts serverless invocations 80-90%)
  describe("ISR revalidation", () => {
    it("exports revalidate = 3600 for Incremental Static Regeneration", () => {
      expect(SOURCE).toContain("export const revalidate = 3600");
    });

    it("does NOT import headers from next/headers (ISR incompatible)", () => {
      expect(SOURCE).not.toContain('from "next/headers"');
      expect(SOURCE).not.toContain("from 'next/headers'");
    });

    it("does NOT call headers() anywhere (ISR incompatible)", () => {
      // Ensure no headers() call that would force dynamic rendering
      expect(SOURCE).not.toMatch(/\bheaders\(\)/);
    });

    it("does NOT import readSessionCookie (session is client-side)", () => {
      expect(SOURCE).not.toContain("readSessionCookie");
    });

    it("uses NavbarClient instead of server-side Navbar", () => {
      expect(SOURCE).toContain("NavbarClient");
      expect(SOURCE).not.toMatch(/from ["']@\/components\/Navbar["']/);
    });

    it("uses SharePageOwnerContent for client-side owner detection", () => {
      expect(SOURCE).toContain("SharePageOwnerContent");
    });
  });

  // #635 — Suspense boundary for streaming
  describe("Suspense streaming", () => {
    it("imports Suspense from react", () => {
      expect(SOURCE).toContain('import { Suspense }');
    });

    it("wraps content in Suspense with BadgeSkeleton fallback", () => {
      expect(SOURCE).toContain("<Suspense");
      expect(SOURCE).toContain("BadgeSkeleton");
    });

    it("extracts data-dependent content into SharePageContent", () => {
      expect(SOURCE).toContain("SharePageContent");
    });
  });
});
