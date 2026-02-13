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

    it("accepts StatsData prop", () => {
      expect(SOURCE).toContain("stats: StatsData");
    });

    it("accepts ImpactV4Result prop", () => {
      expect(SOURCE).toContain("impact: ImpactV4Result");
    });

    it("has optional interactive flag", () => {
      expect(SOURCE).toContain("interactive?:");
    });
  });

  describe("delegates content to BadgeContent", () => {
    it("imports BadgeContent component", () => {
      expect(SOURCE).toContain("BadgeContent");
    });

    it("imports getBadgeContentCSS helper", () => {
      expect(SOURCE).toContain("getBadgeContentCSS");
    });

    it("passes scoreEffect to BadgeContent", () => {
      expect(SOURCE).toContain("scoreEffect={config.scoreEffect}");
    });

    it("passes heatmapAnimation to BadgeContent", () => {
      expect(SOURCE).toContain("heatmapAnimation={config.heatmapAnimation}");
    });

    it("passes statsDisplay to BadgeContent", () => {
      expect(SOURCE).toContain("statsDisplay={config.statsDisplay}");
    });

    it("passes tierTreatment to BadgeContent", () => {
      expect(SOURCE).toContain("tierTreatment={config.tierTreatment}");
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

    it("uses getBadgeContentCSS for content CSS", () => {
      expect(SOURCE).toContain("getBadgeContentCSS");
    });

    it("conditionally includes GRADIENT_BORDER_CSS", () => {
      expect(SOURCE).toContain("GRADIENT_BORDER_CSS");
    });

    it("conditionally includes HOLOGRAPHIC_CSS", () => {
      expect(SOURCE).toContain("HOLOGRAPHIC_CSS");
    });
  });
});
