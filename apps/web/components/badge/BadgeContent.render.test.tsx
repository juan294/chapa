// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { BadgeContent, getBadgeContentCSS } from "./BadgeContent";
import type { StatsData, ImpactV4Result } from "@chapa/shared";

vi.mock("next/image", () => ({
  default: ({ src, alt, ...props }: { src: string; alt: string; [key: string]: unknown }) =>
    <img src={src} alt={alt} />,
}));

vi.mock("@/lib/effects/counters/use-animated-counter", () => ({
  useAnimatedCounter: (target: number) => ({
    value: target,
    isAnimating: false,
    animate: vi.fn(),
  }),
}));

vi.mock("@/lib/effects/counters/use-in-view", () => ({
  useInView: () => true,
}));

afterEach(cleanup);

const STATS: StatsData = {
  handle: "testuser",
  displayName: "Test User",
  commitsTotal: 200,
  activeDays: 150,
  prsMergedCount: 40,
  prsMergedWeight: 50,
  reviewsSubmittedCount: 20,
  issuesClosedCount: 10,
  linesAdded: 20000,
  linesDeleted: 8000,
  reposContributed: 5,
  topRepoShare: 0.3,
  maxCommitsIn10Min: 2,
  totalStars: 300,
  totalForks: 60,
  totalWatchers: 25,
  heatmapData: [],
  fetchedAt: "2025-01-01T00:00:00Z",
  avatarUrl: "https://example.com/avatar.png",
};

const IMPACT: ImpactV4Result = {
  handle: "testuser",
  profileType: "collaborative",
  dimensions: { delivery: 80, quality: 55, consistency: 70, breadth: 45 },
  archetype: "Builder",
  compositeScore: 70,
  confidence: 88,
  confidencePenalties: [],
  adjustedComposite: 75,
  tier: "High",
  computedAt: "2025-01-01T00:00:00Z",
};

describe("getBadgeContentCSS", () => {
  it("always includes HEATMAP_GRID_CSS", () => {
    const css = getBadgeContentCSS({});
    expect(css.length).toBeGreaterThanOrEqual(1);
  });

  it("includes SCORE_EFFECT_CSS for non-standard scoreEffect", () => {
    const css = getBadgeContentCSS({ scoreEffect: "gold-shimmer" });
    expect(css.length).toBe(2);
  });

  it("does not include SCORE_EFFECT_CSS for standard scoreEffect", () => {
    const css = getBadgeContentCSS({ scoreEffect: "standard" });
    expect(css.length).toBe(1);
  });

  it("includes TIER_VISUALS_CSS for enhanced tierTreatment", () => {
    const css = getBadgeContentCSS({ tierTreatment: "enhanced" });
    expect(css.length).toBe(2);
  });

  it("includes both extra CSS when both are non-standard", () => {
    const css = getBadgeContentCSS({ scoreEffect: "chrome", tierTreatment: "enhanced" });
    expect(css.length).toBe(3);
  });
});

describe("BadgeContent", () => {
  it("renders with data-testid badge-content", () => {
    render(<BadgeContent stats={STATS} impact={IMPACT} />);
    expect(screen.getByTestId("badge-content")).toBeDefined();
  });

  it("renders display name", () => {
    render(<BadgeContent stats={STATS} impact={IMPACT} />);
    expect(screen.getByText("Test User")).toBeDefined();
  });

  it("renders archetype pill", () => {
    render(<BadgeContent stats={STATS} impact={IMPACT} />);
    // Should contain the archetype name
    expect(screen.getByText(/Builder/)).toBeDefined();
  });

  it("renders tier label", () => {
    render(<BadgeContent stats={STATS} impact={IMPACT} />);
    expect(screen.getByText("High")).toBeDefined();
  });

  it("renders adjusted composite score", () => {
    render(<BadgeContent stats={STATS} impact={IMPACT} />);
    expect(screen.getByText("75")).toBeDefined();
  });

  it("renders 4 dimension stat cards", () => {
    render(<BadgeContent stats={STATS} impact={IMPACT} />);
    // Each dimension label may appear multiple times (radar labels + stat cards)
    expect(screen.getAllByText("Delivery").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Quality").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Consist/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Breadth").length).toBeGreaterThanOrEqual(1);
  });

  it("renders GitHub branding footer", () => {
    render(<BadgeContent stats={STATS} impact={IMPACT} />);
    expect(screen.getByText("Powered by GitHub")).toBeDefined();
  });

  it("renders avatar when avatarUrl is present", () => {
    render(<BadgeContent stats={STATS} impact={IMPACT} />);
    expect(screen.getByAltText("testuser's avatar")).toBeDefined();
  });

  it("renders fallback when no avatarUrl", () => {
    const stats = { ...STATS, avatarUrl: undefined };
    render(<BadgeContent stats={stats} impact={IMPACT} />);
    expect(screen.queryByAltText("testuser's avatar")).toBeNull();
  });
});
