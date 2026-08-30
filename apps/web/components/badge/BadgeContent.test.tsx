// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { render, screen, cleanup } from "@testing-library/react";
import type { StatsData, ImpactV6Result, ImpactTier } from "@chapa/shared";
import { getBadgeContentCSS, getRadarAxes, radarPoint } from "./BadgeContent";

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
  HeatmapGrid: ({ animation, data }: { animation: string; data?: unknown[] }) => (
    <div data-testid="heatmap-grid" data-animation={animation} data-count={data?.length ?? 0} />
  ),
  HEATMAP_GRID_CSS: ".heatmap-stub {}",
}));

vi.mock("@/lib/render/theme", () => ({
  WARM_AMBER: { accent: "#8B5CF6" },
}));

// Lazy import after mocks are set up
const { BadgeContent } = await import("./BadgeContent");

afterEach(() => {
  cleanup();
});

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "BadgeContent.tsx"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// Genuinely non-renderable checks — build-time/type-level or source-hygiene
// constraints with no observable difference in rendered output.
// ---------------------------------------------------------------------------

describe("BadgeContent", () => {
  describe("component directive", () => {
    it("has 'use client' directive", () => {
      // "use client" only affects the Next.js server/client bundling boundary —
      // it has no observable effect on jsdom render output.
      expect(SOURCE).toMatch(/^["']use client["']/m);
    });
  });

  // Issue #289 — no hardcoded accent hex in component; use WARM_AMBER.accent
  describe("accent color constant (#289)", () => {
    it("does not hardcode #8B5CF6 in SVG markup", () => {
      // The rendered SVG shows the same hex value either way (WARM_AMBER.accent
      // resolves to "#8B5CF6") — hardcoding vs. importing a constant is a
      // source-level distinction with no observable render difference.
      const withoutImports = SOURCE.replace(/^import .*/gm, "");
      expect(withoutImports).not.toContain('"#8B5CF6"');
    });

    it("imports WARM_AMBER from the render theme", () => {
      expect(SOURCE).toMatch(/import\s+.*WARM_AMBER.*from\s+["']@\/lib\/render\/theme["']/);
    });
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

// Uses the component's own exported axis definitions (getRadarAxes/radarPoint)
// rather than re-deriving the diamond-only formula, so pentagon layouts (with
// craft present) are covered too and there's a single source of truth for the
// angle math instead of two formulas that could silently drift apart.
function expectedDataPolygonPoints(dimensions: ImpactV6Result["dimensions"]): string {
  const cx = 70;
  const cy = 70;
  const r = 55;
  return getRadarAxes(dimensions)
    .map(({ key, angle }) => {
      const val = (dimensions[key] ?? 0) / 100;
      const [x, y] = radarPoint(cx, cy, angle, val * r);
      return `${x},${y}`;
    })
    .join(" ");
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

  describe("header branding", () => {
    it("renders the verified shield icon", () => {
      const { container } = render(
        <BadgeContent stats={makeStats()} impact={makeImpact()} />,
      );
      const shieldPath = container.querySelector(
        'path[d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5L12 1zm-1.5 14.5l-4-4 1.41-1.41L10.5 12.67l5.59-5.59L17.5 8.5l-7 7z"]',
      );
      expect(shieldPath).not.toBeNull();
    });

    it("renders the Chapa_ logo text with amber underscore", () => {
      render(<BadgeContent stats={makeStats()} impact={makeImpact()} />);
      expect(screen.getByText("Chapa")).toBeDefined();
      const underscore = screen.getByText("_");
      expect(underscore.className).toContain("text-amber");
    });

    it("shows the Last 12 months subtitle", () => {
      render(<BadgeContent stats={makeStats()} impact={makeImpact()} />);
      expect(screen.getByText("Last 12 months")).toBeDefined();
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

    it("does NOT render SparkleDots for High tier when tierTreatment is omitted (defaults to standard)", () => {
      render(
        <BadgeContent stats={makeStats()} impact={makeImpact({ tier: "High" })} />,
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

  // Issue #279 — confidence is internal-only, hidden from developer-facing UI
  describe("confidence hidden (#279)", () => {
    it("does not render confidence anywhere on the badge", () => {
      render(
        <BadgeContent
          stats={makeStats()}
          impact={makeImpact({ confidence: 99, confidencePenalties: [] })}
        />,
      );
      expect(screen.queryByText(/confidence/i)).toBeNull();
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
      expect(screen.getByText(/★/)).toBeDefined();
    });

    it("renders the tier pill with correct text", () => {
      render(
        <BadgeContent stats={makeStats()} impact={makeImpact({ tier: "High" })} />,
      );
      expect(screen.getByText("High")).toBeDefined();
    });

    it("applies tierPillClasses output as the tier pill's class", () => {
      const { container } = render(
        <BadgeContent stats={makeStats()} impact={makeImpact({ tier: "High" })} />,
      );
      // Mocked tierPillClasses returns `tier-pill-${tier.toLowerCase()}`
      expect(container.querySelector(".tier-pill-high")).not.toBeNull();
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

    // #1181 (UX-H3) — dimension stat card labels reuse the same words as the
    // radar axis labels; keep both translated consistently.
    it("renders translated dimension stat card labels under a Spanish LanguageProvider", async () => {
      const { LanguageProvider } = await import("@/lib/i18n");
      const { es } = await import("@/lib/i18n/dictionaries/es");
      render(
        <LanguageProvider initialLocale="es" dictionary={es}>
          <BadgeContent stats={makeStats()} impact={makeImpact()} />
        </LanguageProvider>,
      );
      expect(screen.getAllByText("Entrega").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Calidad").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Constancia").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Alcance").length).toBeGreaterThanOrEqual(1);
    });
  });

  // #1191 step 5 — the counting animation was a Studio-only flourish: the
  // shipped badge is a cached SVG whose numbers have always been static. The
  // preview now shows the same static numbers, and reaches for no counter hook
  // at all.
  describe("dimension numbers render statically", () => {
    it("shows each dimension value as plain text", () => {
      render(<BadgeContent stats={makeStats()} impact={makeImpact()} />);
      const impact = makeImpact();
      for (const value of Object.values(impact.dimensions)) {
        expect(screen.getAllByText(String(value)).length).toBeGreaterThan(0);
      }
    });

    it("does not import the counter hooks", () => {
      expect(SOURCE).not.toContain("effects/counters/use-animated-counter");
      expect(SOURCE).not.toContain("effects/counters/use-in-view");
    });
  });

  describe("heatmap", () => {
    it("passes heatmapData from stats to HeatmapGrid", () => {
      render(
        <BadgeContent
          stats={makeStats({
            heatmapData: [
              { date: "2025-01-01", count: 1 },
              { date: "2025-01-02", count: 2 },
              { date: "2025-01-03", count: 3 },
            ],
          })}
          impact={makeImpact()}
        />,
      );
      const grid = screen.getByTestId("heatmap-grid");
      expect(grid.getAttribute("data-count")).toBe("3");
    });

    it("labels the heatmap section 'Activity', not 'Contributions'", () => {
      render(<BadgeContent stats={makeStats()} impact={makeImpact()} />);
      expect(screen.getByText("Activity")).toBeDefined();
      expect(screen.queryByText(/Contributions/)).toBeNull();
    });

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

  describe("radar chart", () => {
    it("renders the radar SVG with viewBox 0 0 140 140", () => {
      const { container } = render(
        <BadgeContent stats={makeStats()} impact={makeImpact()} />,
      );
      expect(container.querySelector('svg[viewBox="0 0 140 140"]')).not.toBeNull();
    });

    it("renders 4 guide ring polygons", () => {
      const { container } = render(
        <BadgeContent stats={makeStats()} impact={makeImpact()} />,
      );
      const guideRings = container.querySelectorAll('svg polygon[fill="none"]');
      expect(guideRings.length).toBe(4);
    });

    it("renders the data polygon at coordinates derived from the impact dimensions", () => {
      const dimensions = { delivery: 90, quality: 40, consistency: 65, breadth: 10 };
      const { container } = render(
        <BadgeContent
          stats={makeStats()}
          impact={makeImpact({ dimensions })}
        />,
      );
      const dataPolygon = container.querySelector('svg polygon[fill="var(--color-purple-tint)"]');
      expect(dataPolygon).not.toBeNull();
      expect(dataPolygon!.getAttribute("points")).toBe(expectedDataPolygonPoints(dimensions));
    });

    it("shows the Developer Profile label", () => {
      render(<BadgeContent stats={makeStats()} impact={makeImpact()} />);
      expect(screen.getByText("Developer Profile")).toBeDefined();
    });

    // UX-M2 (#1173): the shipped SVG badge (apps/web/lib/render/RadarChart.ts)
    // renders the full word "Consistency", never the truncated "Consist".
    // Scoped to the radar's own <svg> since "Consistency" also legitimately
    // appears as a dimension-card label elsewhere in this component.
    it("renders the full 'Consistency' radar axis label, not the truncated 'Consist'", () => {
      const { container } = render(
        <BadgeContent stats={makeStats()} impact={makeImpact()} />,
      );
      const svg = container.querySelector('svg[viewBox="0 0 140 140"]');
      const labels = Array.from(svg!.querySelectorAll("text")).map(
        (el) => el.textContent,
      );
      expect(labels).toContain("Consistency");
      expect(labels).not.toContain("Consist");
    });

    // UX-M2 (#1173): RadarChart.ts renders a 5-axis pentagon (72° spacing)
    // when impact.dimensions.craft is present, and a 4-axis diamond (90°
    // spacing) otherwise. The Studio preview must match, or a Craft user
    // sees a four-sided preview of a five-sided public badge.
    it("renders a 5-axis pentagon (with a Craft label) when impact.dimensions.craft is present", () => {
      const dimensions = {
        delivery: 60,
        quality: 70,
        consistency: 80,
        breadth: 50,
        craft: 65,
      };
      const { container } = render(
        <BadgeContent stats={makeStats()} impact={makeImpact({ dimensions })} />,
      );
      const svg = container.querySelector('svg[viewBox="0 0 140 140"]');
      const labels = Array.from(svg!.querySelectorAll("text")).map(
        (el) => el.textContent,
      );
      expect(labels).toEqual(["Delivery", "Quality", "Consistency", "Breadth", "Craft"]);

      const dataPolygon = svg!.querySelector('polygon[fill="var(--color-purple-tint)"]');
      const points = dataPolygon!.getAttribute("points")!.trim().split(" ");
      expect(points).toHaveLength(5);
      expect(dataPolygon!.getAttribute("points")).toBe(
        expectedDataPolygonPoints(dimensions),
      );
    });

    it("falls back to a 4-axis diamond (no Craft label) when craft is absent", () => {
      const { container } = render(
        <BadgeContent stats={makeStats()} impact={makeImpact()} />,
      );
      const svg = container.querySelector('svg[viewBox="0 0 140 140"]');
      const labels = Array.from(svg!.querySelectorAll("text")).map(
        (el) => el.textContent,
      );
      expect(labels).toEqual(["Delivery", "Quality", "Consistency", "Breadth"]);
    });

    // UX-L1 (#1181, partial) — radar labels were text-[9px] (well below the
    // 4:1 minimum-legible-size guidance for small UI text). Bumped to 10px;
    // verified this doesn't push text into the data polygon since the label
    // position (radius 55 + 20px offset = 75 from center) leaves a 20px gap
    // from the polygon's own max radius (55) — a 1px font bump doesn't close it.
    it("renders radar axis labels at 10px or larger (was 9px)", () => {
      const { container } = render(
        <BadgeContent stats={makeStats()} impact={makeImpact()} />,
      );
      const svg = container.querySelector('svg[viewBox="0 0 140 140"]');
      const labelTexts = Array.from(svg!.querySelectorAll("text"));
      expect(labelTexts.length).toBeGreaterThan(0);
      for (const el of labelTexts) {
        expect(Number(el.getAttribute("font-size"))).toBeGreaterThanOrEqual(10);
      }
    });

    // #1181 (UX-H3) — RadarChart.ts (the shipped SVG badge) now renders
    // locale-resolved dimension labels; the Studio preview must stay
    // consistent rather than silently diverging into English-only.
    it("renders translated radar axis labels under a Spanish LanguageProvider", async () => {
      const { LanguageProvider } = await import("@/lib/i18n");
      const { es } = await import("@/lib/i18n/dictionaries/es");
      const { container } = render(
        <LanguageProvider initialLocale="es" dictionary={es}>
          <BadgeContent stats={makeStats()} impact={makeImpact()} />
        </LanguageProvider>,
      );
      const svg = container.querySelector('svg[viewBox="0 0 140 140"]');
      const labels = Array.from(svg!.querySelectorAll("text")).map(
        (el) => el.textContent,
      );
      expect(labels).toEqual(["Entrega", "Calidad", "Constancia", "Alcance"]);
    });

    it("renders 5 guide ring polygons' vertices and axis lines matching the pentagon axis count when craft is present", () => {
      const dimensions = {
        delivery: 60,
        quality: 70,
        consistency: 80,
        breadth: 50,
        craft: 65,
      };
      const { container } = render(
        <BadgeContent stats={makeStats()} impact={makeImpact({ dimensions })} />,
      );
      const svg = container.querySelector('svg[viewBox="0 0 140 140"]');
      // Still 4 concentric guide rings (one per ring level) — only the
      // vertex count per ring changes with the axis count.
      const guideRings = svg!.querySelectorAll('polygon[fill="none"]');
      expect(guideRings.length).toBe(4);
      expect(guideRings[0]!.getAttribute("points")!.trim().split(" ")).toHaveLength(5);
      // One axis line per axis (5 for the pentagon).
      expect(svg!.querySelectorAll("line").length).toBe(5);
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

  describe("footer", () => {
    it("shows the legacy footer by default", () => {
      render(<BadgeContent stats={makeStats()} impact={makeImpact()} />);
      expect(screen.getByText("Powered by GitHub")).toBeDefined();
      expect(screen.getByText("chapa.thecreativetoken.com")).toBeDefined();
    });

    it("omits the legacy footer when showFooter is false", () => {
      render(
        <BadgeContent
          stats={makeStats()}
          impact={makeImpact()}
          showFooter={false}
        />,
      );

      expect(screen.queryByText("Powered by GitHub")).toBeNull();
      expect(screen.queryByText("chapa.thecreativetoken.com")).toBeNull();
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
