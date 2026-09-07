// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { StatsData } from "@chapa/shared";
import { DimensionCard } from "./DimensionCard";

vi.mock("@/lib/effects/counters/use-in-view", () => ({ useInView: () => true }));
vi.mock("@/lib/effects/counters/use-animated-counter", () => ({
  useAnimatedCounter: (target: number) => ({ value: target, isAnimating: false, animate: vi.fn() }),
}));
vi.mock("./SubMetricPanel", () => ({
  SubMetricPanel: (props: { isOpen: boolean }) => <div data-testid="sub-metric-panel" data-open={props.isOpen} />,
}));
vi.mock("@/components/InfoTooltip", () => ({
  InfoTooltip: (props: { id: string }) => <span data-testid="info-tooltip" data-id={props.id} />,
}));

afterEach(cleanup);

const STATS: StatsData = {
  handle: "testuser",
  displayName: "Test User",
  commitsTotal: 320,
  activeDays: 180,
  prsMergedCount: 65,
  prsMergedWeight: 72,
  reviewsSubmittedCount: 30,
  issuesClosedCount: 20,
  linesAdded: 40000,
  linesDeleted: 15000,
  reposContributed: 6,
  topRepoShare: 0.4,
  maxCommitsIn10Min: 3,
  totalStars: 120,
  totalForks: 15,
  totalWatchers: 8,
  heatmapData: [],
  fetchedAt: "2026-02-28T00:00:00Z",
};

/**
 * WCAG 2.5.3 (label in name): the toggle's accessible name must contain the
 * text a sighted user reads on it, or a voice-control user cannot activate
 * it by saying what they see. Lighthouse's label-content-name-mismatch flagged
 * all five cards on /u/juan294 (LE-8-3): "Toggle Delivery breakdown" named a
 * button whose visible text was "PRs merged · issues closed · commits".
 */
describe("DimensionCard — toggle accessible name contains its visible text (LE-8-3)", () => {
  it.each(["delivery", "quality", "consistency", "breadth", "craft"] as const)(
    "%s toggle: accessible name includes the visible subtitle and still names the dimension",
    (dimension) => {
      render(<DimensionCard dimension={dimension} score={70} stats={STATS} />);
      const toggle = screen.getByRole("button", { expanded: false });
      const visibleText = toggle.textContent?.trim() ?? "";
      expect(visibleText.length).toBeGreaterThan(0);
      const name = toggle.getAttribute("aria-label") ?? visibleText;
      expect(name.toLowerCase()).toContain(visibleText.toLowerCase());
      expect(name).toMatch(/^Toggle .+ breakdown/);
    },
  );
});
