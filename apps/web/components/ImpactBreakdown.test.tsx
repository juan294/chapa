import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "ImpactBreakdown.tsx"),
  "utf-8",
);

// Assertions that duplicated ImpactBreakdown.render.test.tsx (progressbar
// role/aria-valuenow, the null-guard branches, props/exports/type imports
// implicit in the render test's typed usage, craft-dimension count,
// DataSources link/URL construction, and the confidence-absence invariant)
// have been converted to real render + query assertions there, or deleted
// as no-ops. What's left is either genuinely non-renderable (the client
// directive, CSS-class-only design-system checks with no behavioral
// signal, the specific SVG icon path data, an implementation-detail
// variable name) or not yet worth the render-test investment (tooltip ID
// wiring — InfoTooltip itself isn't rendered by these tests).
describe("ImpactBreakdown", () => {
  // Issue #18 — now a client component (uses useTranslation hook for i18n)
  describe("client component (i18n)", () => {
    it("has 'use client' directive for useTranslation hook", () => {
      expect(SOURCE).toMatch(/^["']use client["']/m);
    });
  });

  // W4 — headings must use font-heading per design system
  describe("design system typography", () => {
    it("h3 elements include font-heading class", () => {
      const h3Matches = SOURCE.match(/<h3[^>]*>/g) ?? [];
      expect(h3Matches.length).toBeGreaterThan(0);
      for (const h3 of h3Matches) {
        expect(h3).toContain("font-heading");
      }
    });
  });

  // Issue #279 — confidence is internal-only, hidden from developer-facing UI
  describe("confidence hidden (#279)", () => {
    it("does not render confidence penalties", () => {
      expect(SOURCE).not.toContain("confidencePenalties");
    });
  });

  // Issue #202 — accepts StatsData for extended stats display
  describe("athlete dashboard (#202)", () => {
    it("does not contain a circular score gauge (score shown in badge)", () => {
      expect(SOURCE).not.toContain("GAUGE_CIRCUMFERENCE");
      expect(SOURCE).not.toContain("strokeDasharray");
    });

    it("has unique colors per dimension (DIMENSION_COLORS)", () => {
      expect(SOURCE).toContain("DIMENSION_COLORS");
      expect(SOURCE).toContain("linear-gradient");
    });
  });

  // Issue #281 — explanatory tooltips for badge elements
  describe("info tooltips (#281)", () => {
    it("imports InfoTooltip component", () => {
      expect(SOURCE).toContain("InfoTooltip");
    });

    it("has tooltip IDs for all four dimensions", () => {
      expect(SOURCE).toContain('"dim-delivery"');
      expect(SOURCE).toContain('"dim-quality"');
      expect(SOURCE).toContain('"dim-consistency"');
      expect(SOURCE).toContain('"dim-breadth"');
    });

    it("has tooltip IDs for all stats", () => {
      expect(SOURCE).toContain('"stat-stars"');
      expect(SOURCE).toContain('"stat-forks"');
      expect(SOURCE).toContain('"stat-watchers"');
      expect(SOURCE).toContain('"stat-active-days"');
      expect(SOURCE).toContain('"stat-commits"');
      expect(SOURCE).toContain('"stat-prs-merged"');
      expect(SOURCE).toContain('"stat-reviews"');
      expect(SOURCE).toContain('"stat-repos"');
    });
  });

  describe("tooltip z-index elevation (#285)", () => {
    it("dimension cards elevate z-index on hover and focus-within", () => {
      // Cards with animate-fade-in-up create stacking contexts that trap
      // tooltip z-index. Cards must elevate on interaction so the active
      // tooltip renders above adjacent cards.
      const dimCardMatch = SOURCE.match(
        /className="[^"]*rounded-xl bg-card shadow-card p-4 animate-fade-in-up[^"]*"/,
      );
      expect(dimCardMatch).not.toBeNull();
      expect(dimCardMatch![0]).toContain("hover:z-10");
      expect(dimCardMatch![0]).toContain("focus-within:z-10");
    });

    it("stat cards elevate z-index on hover and focus-within", () => {
      const statCardMatch = SOURCE.match(
        /className="[^"]*rounded-xl bg-card shadow-card px-3 py-4 text-center animate-fade-in-up[^"]*"/,
      );
      expect(statCardMatch).not.toBeNull();
      expect(statCardMatch![0]).toContain("hover:z-10");
      expect(statCardMatch![0]).toContain("focus-within:z-10");
    });
  });

  // Data Sources is a standalone exported component (rendered on share page above breakdown)
  describe("data sources component", () => {
    it("includes GitHub and Bitbucket SVG paths", () => {
      expect(SOURCE).toContain("M8 0c4.42 0 8 3.58 8 8");
      expect(SOURCE).toContain("M.778 1.211");
    });

    it("platform cards use design system tokens", () => {
      expect(SOURCE).toContain("border-stroke");
      expect(SOURCE).toContain("bg-card");
    });
  });

  describe("design system tokens (#233)", () => {
    it("uses CSS variables for dimension colors, not hardcoded hex", () => {
      expect(SOURCE).toContain("var(--color-dimension-delivery)");
      expect(SOURCE).toContain("var(--color-dimension-quality)");
      expect(SOURCE).toContain("var(--color-dimension-consistency)");
      expect(SOURCE).toContain("var(--color-dimension-breadth)");
    });

    it("does not contain hardcoded dimension hex colors", () => {
      expect(SOURCE).not.toContain('"#22c55e"');
      expect(SOURCE).not.toContain('"#f97316"');
      expect(SOURCE).not.toContain('"#06b6d4"');
      expect(SOURCE).not.toContain('"#ec4899"');
    });
  });

  // Phase 1 — tabular-nums for stable score display
  describe("tabular numbers (Phase 1)", () => {
    it("dimension scores use tabular-nums", () => {
      expect(SOURCE).toContain("tabular-nums");
    });
  });

  // Phase 2 — text-balance on section headings
  describe("text wrap balance (Phase 2)", () => {
    it("section headings use text-balance for even line distribution", () => {
      expect(SOURCE).toContain("text-balance");
    });
  });

  // Phase 5 — shadow-card on dimension and stat cards
  describe("layered shadows (Phase 5)", () => {
    it("dimension cards use shadow-card for elevation", () => {
      expect(SOURCE).toContain("shadow-card");
    });
  });

  describe("craft dimension (Impact v6)", () => {
    it("has craft entries in dimension colors and tooltips", () => {
      // Craft label is sourced via dynamic translation key: t(`dimensions.${key}.label`)
      // The craft color CSS variable must be present in the DIMENSION_COLORS map
      expect(SOURCE).toContain("dimensions.${key}.label");
      expect(SOURCE).toContain("var(--color-dimension-craft)");
    });
  });
});
