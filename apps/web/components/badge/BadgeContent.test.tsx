import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "BadgeContent.tsx"),
  "utf-8",
);

describe("BadgeContent", () => {
  describe("component directive", () => {
    it("has 'use client' directive", () => {
      expect(SOURCE).toMatch(/^["']use client["']/m);
    });
  });

  describe("props interface", () => {
    it("accepts StatsData prop", () => {
      expect(SOURCE).toContain("stats: StatsData");
    });

    it("accepts ImpactV4Result prop", () => {
      expect(SOURCE).toContain("impact: ImpactV4Result");
    });

    it("has optional scoreEffect prop", () => {
      expect(SOURCE).toContain('scoreEffect?:');
    });

    it("has optional heatmapAnimation prop", () => {
      expect(SOURCE).toContain('heatmapAnimation?:');
    });

    it("has optional statsDisplay prop", () => {
      expect(SOURCE).toContain('statsDisplay?:');
    });

    it("has optional tierTreatment prop", () => {
      expect(SOURCE).toContain('tierTreatment?:');
    });

    it("has optional className prop", () => {
      expect(SOURCE).toContain('className?:');
    });

    it("has optional style prop", () => {
      expect(SOURCE).toContain('style?:');
    });
  });

  describe("default prop values", () => {
    it("defaults scoreEffect to standard", () => {
      expect(SOURCE).toContain('scoreEffect = "standard"');
    });

    it("defaults heatmapAnimation to fade-in", () => {
      expect(SOURCE).toContain('heatmapAnimation = "fade-in"');
    });

    it("defaults statsDisplay to static", () => {
      expect(SOURCE).toContain('statsDisplay = "static"');
    });

    it("defaults tierTreatment to standard", () => {
      expect(SOURCE).toContain('tierTreatment = "standard"');
    });
  });

  describe("testability", () => {
    it("has badge-content test id", () => {
      expect(SOURCE).toContain('data-testid="badge-content"');
    });

    it("tracks score effect via data attribute", () => {
      expect(SOURCE).toContain("data-score-effect={scoreEffect}");
    });
  });

  describe("header elements", () => {
    it("renders avatar with decorative empty alt", () => {
      expect(SOURCE).toContain('alt=""');
    });

    it("renders displayName with handle fallback", () => {
      expect(SOURCE).toContain("stats.displayName");
      expect(SOURCE).toMatch(/@.*stats\.handle/);
    });

    it("renders verified shield icon", () => {
      expect(SOURCE).toContain("M12 1L3 5v6c0 5.55");
    });

    it("renders Chapa_ logo text", () => {
      expect(SOURCE).toContain("Chapa");
      expect(SOURCE).toMatch(/Chapa.*_/);
    });

    it("shows Last 12 months subtitle", () => {
      expect(SOURCE).toContain("Last 12 months");
    });
  });

  describe("heatmap", () => {
    it("renders HeatmapGrid component", () => {
      expect(SOURCE).toContain("HeatmapGrid");
    });

    it("passes heatmap data from stats", () => {
      expect(SOURCE).toContain("stats.heatmapData");
    });

    it("uses Activity label", () => {
      expect(SOURCE).toContain("Activity");
      expect(SOURCE).not.toContain('"Contributions"');
    });
  });

  describe("radar chart", () => {
    it("renders SVG with correct viewBox", () => {
      expect(SOURCE).toContain('viewBox="0 0 140 140"');
    });

    it("renders 4 guide ring diamonds", () => {
      expect(SOURCE).toContain("[0.25, 0.5, 0.75, 1]");
    });

    it("renders data polygon from dimensions", () => {
      expect(SOURCE).toContain("impact.dimensions.building");
      expect(SOURCE).toContain("impact.dimensions.guarding");
      expect(SOURCE).toContain("impact.dimensions.consistency");
      expect(SOURCE).toContain("impact.dimensions.breadth");
    });

    it("renders axis labels", () => {
      expect(SOURCE).toContain("Build");
      expect(SOURCE).toContain("Guard");
      expect(SOURCE).toContain("Consist");
      expect(SOURCE).toContain("Breadth");
    });

    it("shows Developer Profile label", () => {
      expect(SOURCE).toContain("Developer Profile");
    });
  });

  describe("archetype display", () => {
    it("renders archetype from impact", () => {
      expect(SOURCE).toContain("impact.archetype");
    });

    it("renders tier symbol from TIER_SYMBOLS map", () => {
      expect(SOURCE).toContain("TIER_SYMBOLS[impact.tier]");
    });
  });

  describe("score rendering", () => {
    it("uses ScoreEffectText component", () => {
      expect(SOURCE).toContain("ScoreEffectText");
    });

    it("renders adjustedComposite from impact", () => {
      expect(SOURCE).toContain("impact.adjustedComposite");
    });
  });

  describe("tier display", () => {
    it("uses tierPillClasses", () => {
      expect(SOURCE).toContain("tierPillClasses");
    });
  });

  // Issue #279 — confidence is internal-only, hidden from developer-facing UI
  describe("confidence hidden (#279)", () => {
    it("does not show confidence percentage", () => {
      expect(SOURCE).not.toContain("impact.confidence");
      expect(SOURCE).not.toMatch(/Confidence/);
    });
  });

  describe("dimension cards", () => {
    it("renders 4 AnimatedStatCards", () => {
      expect(SOURCE).toContain('"Building"');
      expect(SOURCE).toContain('"Guarding"');
      expect(SOURCE).toContain('"Consistency"');
      expect(SOURCE).toContain('"Breadth"');
    });

    it("supports animated counters", () => {
      expect(SOURCE).toContain("useAnimatedCounter");
    });
  });

  describe("footer", () => {
    it("has GitHub branding", () => {
      expect(SOURCE).toContain("Powered by GitHub");
    });

    it("has domain URL", () => {
      expect(SOURCE).toContain("chapa.thecreativetoken.com");
    });
  });

  describe("tier sparkles", () => {
    it("conditionally renders SparkleDots for enhanced tier", () => {
      expect(SOURCE).toContain("SparkleDots");
      expect(SOURCE).toContain('tierTreatment === "enhanced"');
    });
  });

  // Issue #289 — no hardcoded accent hex in component; use WARM_AMBER.accent
  describe("accent color constant (#289)", () => {
    it("does not hardcode #7C6AEF in SVG markup", () => {
      // Remove import lines and string literals from consideration —
      // only SVG attributes should reference the accent color via the constant
      const withoutImports = SOURCE.replace(/^import .*/gm, "");
      expect(withoutImports).not.toContain('"#7C6AEF"');
    });

    it("imports WARM_AMBER from the render theme", () => {
      expect(SOURCE).toMatch(/import\s+.*WARM_AMBER.*from\s+["']@\/lib\/render\/theme["']/);
    });
  });
});

describe("getBadgeContentCSS", () => {
  it("is exported as a function", () => {
    expect(SOURCE).toContain("export function getBadgeContentCSS");
  });

  it("always includes HEATMAP_GRID_CSS in the output array", () => {
    expect(SOURCE).toMatch(/const css = \[HEATMAP_GRID_CSS\]/);
  });

  it("conditionally includes SCORE_EFFECT_CSS for non-standard effects", () => {
    expect(SOURCE).toMatch(/scoreEffect[\s\S]*!==[\s\S]*"standard"[\s\S]*SCORE_EFFECT_CSS/);
  });

  it("conditionally includes TIER_VISUALS_CSS for enhanced tier treatment", () => {
    expect(SOURCE).toMatch(/tierTreatment[\s\S]*===[\s\S]*"enhanced"[\s\S]*TIER_VISUALS_CSS/);
  });

  it("accepts scoreEffect and tierTreatment options", () => {
    expect(SOURCE).toContain('scoreEffect?: BadgeConfig["scoreEffect"]');
    expect(SOURCE).toContain('tierTreatment?: BadgeConfig["tierTreatment"]');
  });
});
