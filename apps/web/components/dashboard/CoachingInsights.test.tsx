// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { CoachingInsights } from "./CoachingInsights";

vi.mock("@/lib/dashboard/generate-insights", () => ({
  generateInsights: vi.fn(),
}));

vi.mock("./InsightCard", () => ({
  InsightCard: (props: { insight: { id: string; headline: string }; animationDelay?: number }) => (
    <div data-testid={`insight-card-${props.insight.id}`} data-delay={props.animationDelay}>
      {props.insight.headline}
    </div>
  ),
}));

afterEach(cleanup);

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

import type { ImpactV6Result } from "@chapa/shared";
import { generateInsights } from "@/lib/dashboard/generate-insights";

const mockGenerateInsights = vi.mocked(generateInsights);

const mockImpact: ImpactV6Result = {
  handle: "testuser",
  profileType: "collaborative",
  dimensions: { delivery: 85, quality: 60, consistency: 70, breadth: 50 },
  archetype: "Builder",
  compositeScore: 66,
  confidence: 80,
  confidencePenalties: [],
  adjustedComposite: 53,
  tier: "Solid",
  computedAt: "2026-02-28T00:00:00Z",
};

const twoInsights = [
  {
    id: "tip-archetype",
    type: "tip" as const,
    icon: "target" as const,
    headline: "You're a Builder",
    body: "Your profile is driven by output.",
    priority: 6,
  },
  {
    id: "next-tier",
    type: "next-tier" as const,
    icon: "arrow-up" as const,
    headline: "17 points to High",
    body: "Focus on strongest dimension.",
    priority: 5,
  },
];

const mixedInsights = [
  {
    id: "achievement-tier",
    type: "achievement" as const,
    icon: "trophy" as const,
    headline: "You leveled up to High!",
    body: "Your consistent effort paid off.",
    priority: 1,
  },
  {
    id: "trend-quality",
    type: "trend" as const,
    icon: "trending-up" as const,
    headline: "Quality improved by +38",
    body: "Your quality score jumped.",
    dimension: "quality" as const,
    priority: 3,
  },
  {
    id: "trend-consistency",
    type: "trend" as const,
    icon: "trending-up" as const,
    headline: "Consistency improved by +6",
    body: "Your consistency score jumped.",
    dimension: "consistency" as const,
    priority: 3,
  },
  {
    id: "next-tier",
    type: "next-tier" as const,
    icon: "arrow-up" as const,
    headline: "4 points to High",
    body: "Focus on your strongest dimension.",
    priority: 5,
  },
  {
    id: "tip-archetype",
    type: "tip" as const,
    icon: "target" as const,
    headline: "You're a Builder",
    body: "Your profile is driven by output.",
    priority: 6,
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CoachingInsights", () => {
  // ----------------------------------------------------------------
  // 1. Renders InsightCards with type-grouped layout and staggered delays
  // ----------------------------------------------------------------
  it("renders InsightCards with type-grouped delays", () => {
    mockGenerateInsights.mockReturnValue(twoInsights);

    render(<CoachingInsights impact={mockImpact} trend={null} diff={null} />);

    // Both cards should be rendered
    const nextTierCard = screen.getByTestId("insight-card-next-tier");
    const archetypeCard = screen.getByTestId("insight-card-tip-archetype");

    expect(nextTierCard).toBeTruthy();
    expect(archetypeCard).toBeTruthy();

    // Check headlines are rendered
    expect(screen.getByText("You're a Builder")).toBeTruthy();
    expect(screen.getByText("17 points to High")).toBeTruthy();

    // Type grouping renders: achievements → trends → next-tier → coaching
    // next-tier renders before tip-archetype, so it gets the earlier delay
    expect(nextTierCard.getAttribute("data-delay")).toBe("1600");
    expect(archetypeCard.getAttribute("data-delay")).toBe("1750");
  });

  // ----------------------------------------------------------------
  // 2. Handles null trend/diff
  // ----------------------------------------------------------------
  it("handles null trend and diff by passing them to generateInsights", () => {
    mockGenerateInsights.mockReturnValue(twoInsights);

    render(<CoachingInsights impact={mockImpact} trend={null} diff={null} />);

    // generateInsights should have been called with null args
    expect(mockGenerateInsights).toHaveBeenCalledWith(mockImpact, null, null);

    // Cards should still render
    expect(screen.getByTestId("insight-card-tip-archetype")).toBeTruthy();
    expect(screen.getByTestId("insight-card-next-tier")).toBeTruthy();
  });

  // ----------------------------------------------------------------
  // 3. Renders section header
  // ----------------------------------------------------------------
  it("renders section header", () => {
    mockGenerateInsights.mockReturnValue(twoInsights);

    render(<CoachingInsights impact={mockImpact} trend={null} diff={null} />);

    expect(screen.getByText("Insights & Coaching")).toBeTruthy();
  });

  // ----------------------------------------------------------------
  // 4. Returns null when no insights
  // ----------------------------------------------------------------
  it("returns null when generateInsights returns empty array", () => {
    mockGenerateInsights.mockReturnValue([]);

    const { container } = render(
      <CoachingInsights impact={mockImpact} trend={null} diff={null} />,
    );

    // Nothing should be rendered
    expect(container.innerHTML).toBe("");
  });

  // ----------------------------------------------------------------
  // 5. Groups insights by type and renders all in correct order
  // ----------------------------------------------------------------
  it("renders all insight types in grouped layout", () => {
    mockGenerateInsights.mockReturnValue(mixedInsights);

    render(<CoachingInsights impact={mockImpact} trend={null} diff={null} />);

    // All 5 cards should be rendered
    expect(screen.getByTestId("insight-card-achievement-tier")).toBeTruthy();
    expect(screen.getByTestId("insight-card-trend-quality")).toBeTruthy();
    expect(screen.getByTestId("insight-card-trend-consistency")).toBeTruthy();
    expect(screen.getByTestId("insight-card-next-tier")).toBeTruthy();
    expect(screen.getByTestId("insight-card-tip-archetype")).toBeTruthy();

    // Delays should be monotonically increasing across groups
    const cards = [
      screen.getByTestId("insight-card-achievement-tier"),
      screen.getByTestId("insight-card-trend-quality"),
      screen.getByTestId("insight-card-trend-consistency"),
      screen.getByTestId("insight-card-next-tier"),
      screen.getByTestId("insight-card-tip-archetype"),
    ];
    const delays = cards.map((c) => Number(c.getAttribute("data-delay")));
    for (let i = 1; i < delays.length; i++) {
      expect(delays[i]!).toBeGreaterThan(delays[i - 1]!);
    }
  });

  // ----------------------------------------------------------------
  // 6. Trend cards are wrapped in a grid container
  // ----------------------------------------------------------------
  it("wraps multiple trend cards in a grid container", () => {
    mockGenerateInsights.mockReturnValue(mixedInsights);

    const { container } = render(
      <CoachingInsights impact={mockImpact} trend={null} diff={null} />,
    );

    // Find the grid container — it has the grid class
    const gridContainer = container.querySelector(".grid");
    expect(gridContainer).toBeTruthy();

    // Both trend cards should be inside the grid
    const trendQuality = screen.getByTestId("insight-card-trend-quality");
    const trendConsistency = screen.getByTestId("insight-card-trend-consistency");
    expect(gridContainer!.contains(trendQuality)).toBe(true);
    expect(gridContainer!.contains(trendConsistency)).toBe(true);
  });
});
