// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { BadgeConfig, StatsData, ImpactV6Result } from "@chapa/shared";

vi.mock("next/dynamic", () => ({
  default: () => {
    const MockComponent = () => <div data-testid="share-badge-preview" />;
    MockComponent.displayName = "DynamicMock";
    return MockComponent;
  },
}));

import { ShareBadgePreviewLazy } from "./ShareBadgePreviewLazy";

afterEach(cleanup);

const config: BadgeConfig = {
  background: "solid",
  cardStyle: "flat",
  border: "solid-amber",
  scoreEffect: "standard",
  heatmapAnimation: "fade-in",
  interaction: "static",
  statsDisplay: "static",
  tierTreatment: "standard",
  celebration: "none",
};

const stats: StatsData = {
  handle: "testuser",
  commitsTotal: 100,
  activeDays: 50,
  prsMergedCount: 10,
  prsMergedWeight: 20,
  reviewsSubmittedCount: 5,
  issuesClosedCount: 3,
  linesAdded: 5000,
  linesDeleted: 2000,
  reposContributed: 4,
  topRepoShare: 0.5,
  maxCommitsIn10Min: 3,
  totalStars: 10,
  totalForks: 2,
  totalWatchers: 5,
  heatmapData: [],
  fetchedAt: new Date().toISOString(),
};

const impact: ImpactV6Result = {
  handle: "testuser",
  profileType: "solo",
  dimensions: { delivery: 60, quality: 70, consistency: 80, breadth: 50 },
  archetype: "Builder",
  compositeScore: 65,
  confidence: 85,
  confidencePenalties: [],
  adjustedComposite: 65,
  tier: "Solid",
  computedAt: new Date().toISOString(),
};

describe("ShareBadgePreviewLazy render", () => {
  it("renders the lazy-loaded component", () => {
    render(<ShareBadgePreviewLazy config={config} stats={stats} impact={impact} />);
    expect(screen.getByTestId("share-badge-preview")).toBeDefined();
  });
});
