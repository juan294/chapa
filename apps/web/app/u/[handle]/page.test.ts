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

  describe("archetype header", () => {
    it("renders the archetype name from impact data", () => {
      expect(SOURCE).toContain("impact.archetype");
    });

    it("renders the archetype description", () => {
      expect(SOURCE).toContain("getArchetypeProfile");
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

  // #234 — archetype name must be h3 (sub-section under "Impact Breakdown" h2)
  describe("archetype heading level", () => {
    it("renders archetype name as h3, not h2", () => {
      // Find the heading tag that directly wraps {impact.archetype}
      // It should be <h3 ...>{impact.archetype}</h3>
      const archetypeLineMatch = SOURCE.match(/<(h\d)[^>]*>\s*\{impact\.archetype\}\s*<\/\1>/);
      expect(archetypeLineMatch).not.toBeNull();
      expect(archetypeLineMatch![1]).toBe("h3");
    });

    it("does not use h2 for archetype name", () => {
      // There should be no <h2> that contains impact.archetype
      expect(SOURCE).not.toMatch(/<h2[^>]*>\s*\{impact\.archetype\}\s*<\/h2>/);
    });
  });

  describe("visitor CTA for non-owners", () => {
    it("shows a 'Discover your impact' CTA for non-owners", () => {
      expect(SOURCE).toContain("!isOwner");
      expect(SOURCE).toContain("Discover your impact");
    });

    it("CTA links to the homepage using Next.js Link", () => {
      expect(SOURCE).toContain('import Link from "next/link"');
      expect(SOURCE).toMatch(/href="\/"/);
    });

    it("uses curiosity-driven copy that focuses on the reader", () => {
      expect(SOURCE).toContain("Curious what your developer impact looks like");
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

  // #440 — embed snippet includes both width and height for proper aspect ratio
  describe("embed snippet dimensions", () => {
    it("embed HTML includes width=\"600\" and height=\"315\"", () => {
      expect(SOURCE).toContain('width="600"');
      expect(SOURCE).toContain('height="315"');
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
});
