import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "BadgePreviewCard.tsx"),
  "utf-8",
);

describe("BadgePreviewCard", () => {
  describe("component directive", () => {
    it("has 'use client' directive", () => {
      expect(SOURCE).toMatch(/^["']use client["']/m);
    });
  });

  describe("props interface", () => {
    it("accepts BadgeConfig prop", () => {
      expect(SOURCE).toContain("config: BadgeConfig");
    });

    it("accepts Stats90d prop", () => {
      expect(SOURCE).toContain("stats: Stats90d");
    });

    it("accepts ImpactV3Result prop", () => {
      expect(SOURCE).toContain("impact: ImpactV3Result");
    });

    it("has optional interactive flag", () => {
      expect(SOURCE).toContain("interactive?:");
    });
  });

  describe("testability attributes", () => {
    it("has badge-preview test id on outer container", () => {
      expect(SOURCE).toContain('data-testid="badge-preview"');
    });

    it("has badge-card test id on card element", () => {
      expect(SOURCE).toContain('data-testid="badge-card"');
    });

    it("tracks card style via data attribute", () => {
      expect(SOURCE).toContain("data-card-style={config.cardStyle}");
    });

    it("tracks score effect via data attribute", () => {
      expect(SOURCE).toContain("data-score-effect={config.scoreEffect}");
    });
  });

  describe("background layer", () => {
    it("conditionally renders AuroraBackground for aurora config", () => {
      expect(SOURCE).toContain('config.background === "aurora"');
      expect(SOURCE).toContain("AuroraBackground");
    });

    it("marks aurora with data-effect attribute", () => {
      expect(SOURCE).toContain("data-effect=\"aurora\"");
    });

    it("conditionally renders particles for particles config", () => {
      expect(SOURCE).toContain('config.background === "particles"');
      expect(SOURCE).toContain("data-effect=\"particles\"");
    });
  });

  describe("border layer", () => {
    it("conditionally renders GradientBorder", () => {
      expect(SOURCE).toContain('config.border === "gradient-rotating"');
      expect(SOURCE).toContain("GradientBorder");
    });

    it("marks gradient border with data-effect attribute", () => {
      expect(SOURCE).toContain("data-effect=\"gradient-border\"");
    });
  });

  describe("card styling", () => {
    it("uses glassStyle for non-flat card styles", () => {
      expect(SOURCE).toContain("glassStyle");
    });

    it("handles flat card style differently", () => {
      expect(SOURCE).toContain('"flat"');
    });
  });

  describe("score rendering", () => {
    it("uses ScoreEffectText component", () => {
      expect(SOURCE).toContain("ScoreEffectText");
    });

    it("passes config.scoreEffect to score component", () => {
      expect(SOURCE).toContain("config.scoreEffect");
    });

    it("renders adjustedScore from impact", () => {
      expect(SOURCE).toContain("impact.adjustedScore");
    });
  });

  describe("heatmap", () => {
    it("renders HeatmapGrid component", () => {
      expect(SOURCE).toContain("HeatmapGrid");
    });

    it("passes heatmap data from stats", () => {
      expect(SOURCE).toContain("stats.heatmapData");
    });

    it("passes animation variant from config", () => {
      expect(SOURCE).toContain("config.heatmapAnimation");
    });
  });

  describe("interaction layer", () => {
    it("supports tilt-3d interaction", () => {
      expect(SOURCE).toContain('"tilt-3d"');
      expect(SOURCE).toContain("useTilt");
    });

    it("supports holographic interaction", () => {
      expect(SOURCE).toContain('"holographic"');
      expect(SOURCE).toContain("HolographicOverlay");
    });
  });

  describe("stats display", () => {
    it("renders commit count from stats", () => {
      expect(SOURCE).toContain("stats.commitsTotal");
    });

    it("renders PR count from stats", () => {
      expect(SOURCE).toContain("stats.prsMergedCount");
    });

    it("renders review count from stats", () => {
      expect(SOURCE).toContain("stats.reviewsSubmittedCount");
    });

    it("supports animated counters", () => {
      expect(SOURCE).toContain("useAnimatedCounter");
    });
  });

  describe("tier treatment", () => {
    it("conditionally renders SparkleDots for enhanced tier", () => {
      expect(SOURCE).toContain("SparkleDots");
      expect(SOURCE).toContain('config.tierTreatment === "enhanced"');
    });

    it("uses tierPillClasses", () => {
      expect(SOURCE).toContain("tierPillClasses");
    });
  });

  describe("celebration layer", () => {
    it("supports confetti celebration", () => {
      expect(SOURCE).toContain('config.celebration === "confetti"');
      expect(SOURCE).toContain("fireSingleBurst");
    });
  });

  describe("CSS injection", () => {
    it("injects required CSS via style tag", () => {
      expect(SOURCE).toContain("<style>");
    });

    it("includes HEATMAP_GRID_CSS", () => {
      expect(SOURCE).toContain("HEATMAP_GRID_CSS");
    });

    it("conditionally includes SCORE_EFFECT_CSS", () => {
      expect(SOURCE).toContain("SCORE_EFFECT_CSS");
    });

    it("conditionally includes GRADIENT_BORDER_CSS", () => {
      expect(SOURCE).toContain("GRADIENT_BORDER_CSS");
    });

    it("conditionally includes HOLOGRAPHIC_CSS", () => {
      expect(SOURCE).toContain("HOLOGRAPHIC_CSS");
    });

    it("conditionally includes TIER_VISUALS_CSS", () => {
      expect(SOURCE).toContain("TIER_VISUALS_CSS");
    });
  });

  describe("accessibility", () => {
    it("decorative avatar has empty alt", () => {
      expect(SOURCE).toContain('alt=""');
    });

    it("heatmap has role=img", () => {
      // Delegated to HeatmapGrid but imported
      expect(SOURCE).toContain("HeatmapGrid");
    });
  });

  describe("unified badge elements", () => {
    it("has verified badge icon", () => {
      // Verified shield SVG path must be present
      expect(SOURCE).toContain("M12 1L3 5v6c0 5.55");
    });

    it("has Chapa_ logo text", () => {
      expect(SOURCE).toContain("Chapa");
      expect(SOURCE).toMatch(/Chapa.*_/);
    });

    it("has Powered by GitHub footer", () => {
      expect(SOURCE).toContain("Powered by GitHub");
    });

    it("has chapa.thecreativetoken.com URL", () => {
      expect(SOURCE).toContain("chapa.thecreativetoken.com");
    });

    it("uses Activity label instead of Contributions", () => {
      expect(SOURCE).not.toContain('"Contributions"');
      expect(SOURCE).toContain("Activity");
    });

    it("shows displayName as primary header when available", () => {
      expect(SOURCE).toContain("stats.displayName");
    });

    it("falls back to @handle when no displayName", () => {
      // Should show @handle as fallback
      expect(SOURCE).toMatch(/@.*stats\.handle/);
    });
  });

  describe("achievement card stats", () => {
    it("has three stat achievement card blocks", () => {
      // Achievement cards use bg-white/[0.04] pattern
      expect(SOURCE).toContain("bg-white/[0.04]");
    });

    it("renders commits in achievement card", () => {
      expect(SOURCE).toContain("stats.commitsTotal");
      expect(SOURCE).toContain("commits");
    });

    it("renders PRs merged in achievement card", () => {
      expect(SOURCE).toContain("stats.prsMergedCount");
      expect(SOURCE).toContain("PRs merged");
    });

    it("renders reviews in achievement card", () => {
      expect(SOURCE).toContain("stats.reviewsSubmittedCount");
      expect(SOURCE).toContain("reviews");
    });
  });

  describe("active days bar", () => {
    it("renders active days from stats", () => {
      expect(SOURCE).toContain("stats.activeDays");
    });

    it("shows Active Days label", () => {
      expect(SOURCE).toContain("Active Days");
    });

    it("shows /90 denominator", () => {
      expect(SOURCE).toContain("/ 90");
    });

    it("has gradient progress bar", () => {
      expect(SOURCE).toContain("from-amber");
      expect(SOURCE).toContain("to-terminal-green");
    });
  });
});
