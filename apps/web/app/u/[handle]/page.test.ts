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

  describe("customize badge CTA", () => {
    it("has Customize Badge link", () => {
      expect(SOURCE).toContain("/studio");
    });

    it("only shows CTA for badge owner", () => {
      expect(SOURCE).toContain("isOwner");
    });
  });
});
