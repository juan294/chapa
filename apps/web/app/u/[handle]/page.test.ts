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
    it("does not fetch Studio config on the public share route", () => {
      expect(SOURCE).not.toContain("cacheGet<BadgeConfig>");
      expect(SOURCE).not.toContain("config:");
    });

    it("does not import the Studio-coupled share preview runtime", () => {
      expect(SOURCE).not.toContain("ShareBadgePreview");
      expect(SOURCE).not.toContain("@/app/studio/BadgePreviewCard");
    });

    it("renders the public badge with server SVG output", () => {
      expect(SOURCE).toContain("renderBadgeSvg");
      expect(SOURCE).toContain("dangerouslySetInnerHTML");
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

    it("passes handle to toolbar", () => {
      expect(SOURCE).toContain("handle=");
    });
  });

  // #230 — badge img must have fetchpriority="high" (LCP element)
  describe("badge img fetchpriority", () => {
    it("has fetchpriority=\"high\" on the badge img tag", () => {
      expect(SOURCE).toContain("badgeImageSrc");
      expect(SOURCE).toContain("badge.svg?");
      // Find the fallback badge JSX <img (multi-line JSX with \n between attrs).
      const imgMatch = SOURCE.match(/<img\n[\s\S]*?src=\{badgeImageSrc\}[\s\S]*?\/>/);
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
    it("uses i18n key for Twitter card description (sharePage.metadataDescription)", () => {
      // Description is now loaded from i18n — not hardcoded
      expect(SOURCE).toContain("sharePage.metadataDescription");
    });
  });

  // #120/#731 — JSON-LD script injection prevention via shared renderJsonLd helper
  describe("JSON-LD security", () => {
    it("uses renderJsonLd to escape <, >, & in JSON-LD", () => {
      // renderJsonLd() unicode-escapes <, >, and & — covers </script> injection
      // and &-based vectors that bare JSON.stringify misses.
      expect(SOURCE).toContain("renderJsonLd(personJsonLd)");
      expect(SOURCE).toContain("renderJsonLd");
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
