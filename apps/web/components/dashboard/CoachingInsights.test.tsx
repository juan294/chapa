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

import type { ImpactV4Result } from "@chapa/shared";
import { generateInsights } from "@/lib/dashboard/generate-insights";

const mockGenerateInsights = vi.mocked(generateInsights);

const mockImpact: ImpactV4Result = {
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CoachingInsights", () => {
  // ----------------------------------------------------------------
  // 1. Renders InsightCards for generated insights
  // ----------------------------------------------------------------
  it("renders InsightCards for generated insights with staggered delays", () => {
    mockGenerateInsights.mockReturnValue(twoInsights);

    render(<CoachingInsights impact={mockImpact} trend={null} diff={null} />);

    // Both cards should be rendered
    const card1 = screen.getByTestId("insight-card-tip-archetype");
    const card2 = screen.getByTestId("insight-card-next-tier");

    expect(card1).toBeTruthy();
    expect(card2).toBeTruthy();

    // Check headlines are rendered
    expect(screen.getByText("You're a Builder")).toBeTruthy();
    expect(screen.getByText("17 points to High")).toBeTruthy();

    // Check staggered animation delays: 1600 + i * 150
    expect(card1.getAttribute("data-delay")).toBe("1600");
    expect(card2.getAttribute("data-delay")).toBe("1750");
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
});
