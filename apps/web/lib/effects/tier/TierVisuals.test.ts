import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { tierPillClasses, TIER_VISUALS_CSS } from "./TierVisuals";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "TierVisuals.tsx"),
  "utf-8",
);

describe("TierVisuals (#247)", () => {
  describe("design system compliance (#233)", () => {
    it("uses bg-amber-light instead of bg-[#9D8FFF]", () => {
      expect(SOURCE).not.toContain("bg-[#9D8FFF]");
      expect(SOURCE).toContain("bg-amber-light");
    });

    it("uses bg-amber instead of bg-[#7C6AEF]", () => {
      expect(SOURCE).not.toContain("bg-[#7C6AEF]");
      expect(SOURCE).toContain("bg-amber");
    });
  });

  describe("tierPillClasses", () => {
    it("returns muted classes for Emerging tier", () => {
      const classes = tierPillClasses("Emerging");
      expect(classes).toContain("text-text-secondary");
      expect(classes).not.toContain("text-white");
    });

    it("returns primary text classes for Solid tier", () => {
      const classes = tierPillClasses("Solid");
      expect(classes).toContain("text-text-primary");
    });

    it("returns amber accent classes for High tier", () => {
      const classes = tierPillClasses("High");
      expect(classes).toContain("text-amber");
      expect(classes).toContain("bg-amber/10");
    });

    it("returns white text and bold for Elite tier", () => {
      const classes = tierPillClasses("Elite");
      expect(classes).toContain("text-white");
      expect(classes).toContain("font-bold");
    });

    it("uses tier-elite-pill class for Elite pill background", () => {
      const classes = tierPillClasses("Elite");
      expect(classes).toContain("tier-elite-pill");
    });

    it("includes border classes for all tiers", () => {
      const tiers = ["Emerging", "Solid", "High", "Elite"] as const;
      for (const tier of tiers) {
        const classes = tierPillClasses(tier);
        expect(classes).toContain("border-");
      }
    });

    it("includes background classes for non-Elite tiers", () => {
      const tiers = ["Emerging", "Solid", "High"] as const;
      for (const tier of tiers) {
        const classes = tierPillClasses(tier);
        expect(classes).toMatch(/bg-/);
      }
    });

    it("uses tier-elite-pill as background for Elite tier", () => {
      const classes = tierPillClasses("Elite");
      // Elite uses a custom CSS class instead of a standard bg- utility
      expect(classes).toContain("tier-elite-pill");
    });
  });

  describe("TIER_VISUALS_CSS", () => {
    it("exports a non-empty CSS string", () => {
      expect(typeof TIER_VISUALS_CSS).toBe("string");
      expect(TIER_VISUALS_CSS.length).toBeGreaterThan(0);
    });

    it("defines score classes for all four tiers", () => {
      expect(TIER_VISUALS_CSS).toContain(".tier-score-emerging");
      expect(TIER_VISUALS_CSS).toContain(".tier-score-solid");
      expect(TIER_VISUALS_CSS).toContain(".tier-score-high");
      expect(TIER_VISUALS_CSS).toContain(".tier-score-elite");
    });

    it("defines card classes for all four tiers", () => {
      expect(TIER_VISUALS_CSS).toContain(".tier-card-emerging");
      expect(TIER_VISUALS_CSS).toContain(".tier-card-solid");
      expect(TIER_VISUALS_CSS).toContain(".tier-card-high");
      expect(TIER_VISUALS_CSS).toContain(".tier-card-elite");
    });

    it("defines the tier-shimmer animation for elite score", () => {
      expect(TIER_VISUALS_CSS).toContain("@keyframes tier-shimmer");
    });

    it("defines the elite-border-glow class", () => {
      expect(TIER_VISUALS_CSS).toContain(".elite-border-glow");
    });

    it("defines the elite-border-rotate animation", () => {
      expect(TIER_VISUALS_CSS).toContain("@keyframes elite-border-rotate");
    });

    it("uses conic-gradient for elite border glow", () => {
      expect(TIER_VISUALS_CSS).toContain("conic-gradient");
    });

    it("includes @supports fallback for conic-gradient", () => {
      expect(TIER_VISUALS_CSS).toContain("@supports not");
      expect(TIER_VISUALS_CSS).toContain("elite-border-fallback");
    });

    it("defines tier-elite-pill gradient", () => {
      expect(TIER_VISUALS_CSS).toContain(".tier-elite-pill");
      expect(TIER_VISUALS_CSS).toContain("linear-gradient");
    });

    it("defines sparkle-dot animation", () => {
      expect(TIER_VISUALS_CSS).toContain(".sparkle-dot");
      expect(TIER_VISUALS_CSS).toContain("@keyframes sparkle-pulse");
    });

    it("supports prefers-reduced-motion", () => {
      expect(TIER_VISUALS_CSS).toContain(
        "@media (prefers-reduced-motion: reduce)",
      );
    });

    it("disables animations for reduced motion", () => {
      expect(TIER_VISUALS_CSS).toContain("animation: none !important");
    });

    it("uses background-clip text for gradient text effects", () => {
      expect(TIER_VISUALS_CSS).toContain("-webkit-background-clip: text");
      expect(TIER_VISUALS_CSS).toContain(
        "-webkit-text-fill-color: transparent",
      );
    });

    it("uses project accent colors in gradients", () => {
      // All gradients should use the project's purple palette
      expect(TIER_VISUALS_CSS).toContain("#5E4FCC"); // amber-dark
      expect(TIER_VISUALS_CSS).toContain("#7C6AEF"); // amber
      expect(TIER_VISUALS_CSS).toContain("#9D8FFF"); // amber-light
    });

    it("applies box-shadow glow to high and elite card tiers", () => {
      // High and Elite cards have glow effects
      expect(TIER_VISUALS_CSS).toMatch(
        /\.tier-card-high\s*\{[^}]*box-shadow/,
      );
      expect(TIER_VISUALS_CSS).toMatch(
        /\.tier-card-elite\s*\{[^}]*box-shadow/,
      );
    });
  });

  describe("SparkleDots component", () => {
    it("exports a SparkleDots component", () => {
      expect(SOURCE).toContain("export function SparkleDots()");
    });

    it("renders three sparkle dots", () => {
      const sparkleMatches = SOURCE.match(/sparkle-dot/g) || [];
      // .sparkle-dot class appears in CSS + 3 component usages
      expect(sparkleMatches.length).toBeGreaterThanOrEqual(3);
    });

    it("uses aria-hidden on decorative sparkle dots", () => {
      // Each sparkle dot should be marked as decorative
      const ariaHiddenCount = (
        SOURCE.match(/aria-hidden="true"/g) || []
      ).length;
      expect(ariaHiddenCount).toBeGreaterThanOrEqual(3);
    });

    it("uses staggered animation delays", () => {
      expect(SOURCE).toContain('animationDelay: "0s"');
      expect(SOURCE).toContain('animationDelay: "0.7s"');
      expect(SOURCE).toContain('animationDelay: "1.4s"');
    });

    it("positions dots with absolute positioning", () => {
      expect(SOURCE).toContain("absolute");
    });

    it("uses design system color tokens for dots", () => {
      expect(SOURCE).toContain("bg-amber-light");
      expect(SOURCE).toContain("bg-amber");
    });
  });

  describe("module structure", () => {
    it("has 'use client' directive", () => {
      expect(SOURCE).toMatch(/^["']use client["']/m);
    });

    it("imports ImpactTier type from shared package", () => {
      expect(SOURCE).toContain('import type { ImpactTier }');
      expect(SOURCE).toContain("@chapa/shared");
    });

    it("exports tierPillClasses function", () => {
      expect(SOURCE).toContain("export function tierPillClasses");
    });

    it("exports TIER_VISUALS_CSS constant", () => {
      expect(SOURCE).toContain("export const TIER_VISUALS_CSS");
    });

    it("exports SparkleDots component", () => {
      expect(SOURCE).toContain("export function SparkleDots");
    });
  });
});
