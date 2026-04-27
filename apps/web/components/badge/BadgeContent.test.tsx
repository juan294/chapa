// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { render, screen, cleanup } from "@testing-library/react";
import type { StatsData, ImpactV6Result, ImpactTier } from "@chapa/shared";
import { getBadgeContentCSS } from "./BadgeContent";

// ---------------------------------------------------------------------------
// Mock heavy dependencies to allow render-based tests in jsdom
// ---------------------------------------------------------------------------

vi.mock("next/image", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    const { fill, priority, ...rest } = props;
    void fill;
    void priority;
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...(rest as React.ImgHTMLAttributes<HTMLImageElement>)} />;
  },
}));

vi.mock("@/lib/effects/text/ScoreEffectText", () => ({
  ScoreEffectText: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span className={className} data-testid="score-effect-text">{children}</span>
  ),
  SCORE_EFFECT_CSS: ".score-effect-stub {}",
}));

vi.mock("@/lib/effects/tier/TierVisuals", () => ({
  tierPillClasses: (tier: string) => `tier-pill-${tier.toLowerCase()}`,
  SparkleDots: () => <div data-testid="sparkle-dots" />,
  TIER_VISUALS_CSS: ".tier-visuals-stub {}",
}));

vi.mock("@/lib/effects/heatmap/HeatmapGrid", () => ({
  HeatmapGrid: ({ animation }: { animation: string }) => (
    <div data-testid="heatmap-grid" data-animation={animation} />
  ),
  HEATMAP_GRID_CSS: ".heatmap-stub {}",
}));

vi.mock("@/lib/effects/counters/use-animated-counter", () => ({
  useAnimatedCounter: (target: number) => ({ value: target }),
}));

vi.mock("@/lib/effects/counters/use-in-view", () => ({
  useInView: () => true,
}));

vi.mock("@/lib/render/theme", () => ({
  WARM_AMBER: { accent: "#8B5CF6" },
}));

// Lazy import after mocks are set up
const { BadgeContent } = await import("./BadgeContent");

afterEach(cleanup);

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

    it("accepts ImpactV6Result prop", () => {
      expect(SOURCE).toContain("impact: ImpactV6Result");
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
    it("renders avatar with descriptive alt text", () => {
      expect(SOURCE).toContain("stats.handle");
      expect(SOURCE).toMatch(/alt=.*avatar/i);
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
      expect(SOURCE).toContain("impact.dimensions.delivery");
      expect(SOURCE).toContain("impact.dimensions.quality");
      expect(SOURCE).toContain("impact.dimensions.consistency");
      expect(SOURCE).toContain("impact.dimensions.breadth");
    });

    it("renders axis labels", () => {
      expect(SOURCE).toContain("Delivery");
      expect(SOURCE).toContain("Quality");
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
      expect(SOURCE).toContain('"Delivery"');
      expect(SOURCE).toContain('"Quality"');
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
    it("does not hardcode #8B5CF6 in SVG markup", () => {
      // Remove import lines and string literals from consideration —
      // only SVG attributes should reference the accent color via the constant
      const withoutImports = SOURCE.replace(/^import .*/gm, "");
      expect(withoutImports).not.toContain('"#8B5CF6"');
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

// ---------------------------------------------------------------------------
// Render-based tests — exercise actual component branches
// ---------------------------------------------------------------------------

function makeStats(overrides?: Partial<StatsData>): StatsData {
  return {
    handle: "testuser",
    displayName: "Test User",
    avatarUrl: "https://example.com/avatar.jpg",
    commitsTotal: 100,
    activeDays: 50,
    prsMergedCount: 20,
    prsMergedWeight: 40,
    reviewsSubmittedCount: 10,
    issuesClosedCount: 5,
    linesAdded: 5000,
    linesDeleted: 2000,
    reposContributed: 3,
    topRepoShare: 0.6,
    maxCommitsIn10Min: 5,
    totalStars: 100,
    totalForks: 20,
    totalWatchers: 15,
    heatmapData: [{ date: "2025-01-01", count: 5 }],
    fetchedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeImpact(overrides?: Partial<ImpactV6Result>): ImpactV6Result {
  return {
    handle: "testuser",
    profileType: "collaborative",
    dimensions: {
      delivery: 80,
      quality: 70,
      consistency: 60,
      breadth: 50,
    },
    archetype: "Builder",
    compositeScore: 65,
    confidence: 85,
    confidencePenalties: [],
    adjustedComposite: 62,
    tier: "Solid" as ImpactTier,
    computedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("BadgeContent — render-based", () => {
  describe("avatar rendering", () => {
    it("renders an img element when avatarUrl is present", () => {
      render(
        <BadgeContent stats={makeStats()} impact={makeImpact()} />,
      );
      const img = screen.getByAltText("testuser's avatar");
      expect(img).toBeDefined();
      expect(img.getAttribute("src")).toBe("https://example.com/avatar.jpg");
    });

    it("renders a placeholder div when avatarUrl is undefined", () => {
      const { container } = render(
        <BadgeContent stats={makeStats({ avatarUrl: undefined })} impact={makeImpact()} />,
      );
      // No img with avatar alt text
      expect(screen.queryByAltText("testuser's avatar")).toBeNull();
      // Placeholder div with bg-amber/20 class
      const placeholder = container.querySelector(".rounded-full.bg-amber\\/20");
      expect(placeholder).not.toBeNull();
    });
  });

  describe("displayName fallback", () => {
    it("shows displayName when present", () => {
      render(
        <BadgeContent stats={makeStats({ displayName: "Jane Doe" })} impact={makeImpact()} />,
      );
      expect(screen.getByText("Jane Doe")).toBeDefined();
    });

    it("falls back to @handle when displayName is undefined", () => {
      render(
        <BadgeContent stats={makeStats({ displayName: undefined })} impact={makeImpact()} />,
      );
      expect(screen.getByText("@testuser")).toBeDefined();
    });
  });

  describe("tier sparkle dots", () => {
    it("renders SparkleDots when tierTreatment=enhanced and tier=High", () => {
      render(
        <BadgeContent
          stats={makeStats()}
          impact={makeImpact({ tier: "High" })}
          tierTreatment="enhanced"
        />,
      );
      expect(screen.getByTestId("sparkle-dots")).toBeDefined();
    });

    it("renders SparkleDots when tierTreatment=enhanced and tier=Elite", () => {
      render(
        <BadgeContent
          stats={makeStats()}
          impact={makeImpact({ tier: "Elite" })}
          tierTreatment="enhanced"
        />,
      );
      expect(screen.getByTestId("sparkle-dots")).toBeDefined();
    });

    it("does NOT render SparkleDots when tierTreatment=enhanced but tier=Emerging", () => {
      render(
        <BadgeContent
          stats={makeStats()}
          impact={makeImpact({ tier: "Emerging" })}
          tierTreatment="enhanced"
        />,
      );
      expect(screen.queryByTestId("sparkle-dots")).toBeNull();
    });

    it("does NOT render SparkleDots when tierTreatment=enhanced but tier=Solid", () => {
      render(
        <BadgeContent
          stats={makeStats()}
          impact={makeImpact({ tier: "Solid" })}
          tierTreatment="enhanced"
        />,
      );
      expect(screen.queryByTestId("sparkle-dots")).toBeNull();
    });

    it("does NOT render SparkleDots when tierTreatment=standard even with High tier", () => {
      render(
        <BadgeContent
          stats={makeStats()}
          impact={makeImpact({ tier: "High" })}
          tierTreatment="standard"
        />,
      );
      expect(screen.queryByTestId("sparkle-dots")).toBeNull();
    });
  });

  describe("score effect data attribute", () => {
    it("sets data-score-effect to 'standard' by default", () => {
      const { container } = render(
        <BadgeContent stats={makeStats()} impact={makeImpact()} />,
      );
      const el = container.querySelector("[data-score-effect]");
      expect(el).not.toBeNull();
      expect(el!.getAttribute("data-score-effect")).toBe("standard");
    });

    it("sets data-score-effect to the provided scoreEffect prop", () => {
      const { container } = render(
        <BadgeContent stats={makeStats()} impact={makeImpact()} scoreEffect="gold-shimmer" />,
      );
      const el = container.querySelector("[data-score-effect]");
      expect(el).not.toBeNull();
      expect(el!.getAttribute("data-score-effect")).toBe("gold-shimmer");
    });
  });

  describe("adjusted composite score display", () => {
    it("renders the adjusted composite score", () => {
      render(
        <BadgeContent stats={makeStats()} impact={makeImpact({ adjustedComposite: 77 })} />,
      );
      const scoreEl = screen.getByTestId("score-effect-text");
      expect(scoreEl.textContent).toBe("77");
    });
  });

  describe("archetype and tier display", () => {
    it("renders archetype label", () => {
      render(
        <BadgeContent stats={makeStats()} impact={makeImpact({ archetype: "Marathoner" })} />,
      );
      expect(screen.getByText(/Marathoner/)).toBeDefined();
    });

    it("renders tier symbol and name in archetype pill", () => {
      render(
        <BadgeContent stats={makeStats()} impact={makeImpact({ tier: "Elite" })} />,
      );
      // TIER_SYMBOLS for Elite is ★
      expect(screen.getByText(/\u2605/)).toBeDefined();
    });

    it("renders the tier pill with correct text", () => {
      render(
        <BadgeContent stats={makeStats()} impact={makeImpact({ tier: "High" })} />,
      );
      expect(screen.getByText("High")).toBeDefined();
    });
  });

  describe("dimension stat cards", () => {
    it("renders all 4 dimension cards with correct values", () => {
      render(
        <BadgeContent
          stats={makeStats()}
          impact={makeImpact({
            dimensions: { delivery: 90, quality: 75, consistency: 60, breadth: 45 },
          })}
        />,
      );
      expect(screen.getByText("90")).toBeDefined();
      expect(screen.getByText("75")).toBeDefined();
      expect(screen.getByText("60")).toBeDefined();
      expect(screen.getByText("45")).toBeDefined();
    });

    it("renders dimension labels", () => {
      render(
        <BadgeContent stats={makeStats()} impact={makeImpact()} />,
      );
      // "Delivery" and "Quality" appear both as radar axis labels and stat card labels
      expect(screen.getAllByText("Delivery").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Quality").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Consistency").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Breadth").length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("heatmap animation prop passthrough", () => {
    it("passes heatmapAnimation to HeatmapGrid", () => {
      render(
        <BadgeContent stats={makeStats()} impact={makeImpact()} heatmapAnimation="ripple" />,
      );
      const grid = screen.getByTestId("heatmap-grid");
      expect(grid.getAttribute("data-animation")).toBe("ripple");
    });

    it("defaults heatmapAnimation to fade-in", () => {
      render(
        <BadgeContent stats={makeStats()} impact={makeImpact()} />,
      );
      const grid = screen.getByTestId("heatmap-grid");
      expect(grid.getAttribute("data-animation")).toBe("fade-in");
    });
  });

  describe("className and style passthrough", () => {
    it("applies className to the root element", () => {
      render(
        <BadgeContent stats={makeStats()} impact={makeImpact()} className="custom-class" />,
      );
      const root = screen.getByTestId("badge-content");
      expect(root.className).toContain("custom-class");
    });

    it("applies style to the root element", () => {
      render(
        <BadgeContent stats={makeStats()} impact={makeImpact()} style={{ maxWidth: "400px" }} />,
      );
      const root = screen.getByTestId("badge-content");
      expect(root.style.maxWidth).toBe("400px");
    });
  });

  // Issue #737 — avatar must apply .img-outline per design system
  describe("avatar design system compliance (#737)", () => {
    it("applies img-outline class to avatar image", () => {
      render(
        <BadgeContent stats={makeStats()} impact={makeImpact()} />,
      );
      const img = screen.getByAltText("testuser's avatar");
      expect(img.className).toContain("img-outline");
    });
  });
});

// ---------------------------------------------------------------------------
// getBadgeContentCSS — actual function call tests
// ---------------------------------------------------------------------------

describe("getBadgeContentCSS — invocation tests", () => {
  it("always includes heatmap CSS", () => {
    const css = getBadgeContentCSS({});
    expect(css.length).toBeGreaterThanOrEqual(1);
    expect(css[0]).toContain("heatmap");
  });

  it("includes score effect CSS for non-standard effect", () => {
    const css = getBadgeContentCSS({ scoreEffect: "gold-shimmer" });
    expect(css.some((s) => s.includes("score-effect"))).toBe(true);
  });

  it("does not include score effect CSS for standard effect", () => {
    const css = getBadgeContentCSS({ scoreEffect: "standard" });
    expect(css.some((s) => s.includes("score-effect"))).toBe(false);
  });

  it("does not include score effect CSS when scoreEffect is undefined", () => {
    const css = getBadgeContentCSS({});
    expect(css.some((s) => s.includes("score-effect"))).toBe(false);
  });

  it("includes tier visuals CSS for enhanced tier treatment", () => {
    const css = getBadgeContentCSS({ tierTreatment: "enhanced" });
    expect(css.some((s) => s.includes("tier-visuals"))).toBe(true);
  });

  it("does not include tier visuals CSS for standard tier treatment", () => {
    const css = getBadgeContentCSS({ tierTreatment: "standard" });
    expect(css.some((s) => s.includes("tier-visuals"))).toBe(false);
  });

  it("includes both when both options are non-default", () => {
    const css = getBadgeContentCSS({
      scoreEffect: "chrome",
      tierTreatment: "enhanced",
    });
    expect(css.length).toBe(3);
  });
});
