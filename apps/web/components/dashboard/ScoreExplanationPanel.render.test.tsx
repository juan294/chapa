// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { ImpactV6Result, StatsData } from "@chapa/shared";
import { ScoreExplanationPanel } from "./ScoreExplanationPanel";

vi.mock("./ChallengeForm", () => ({ ChallengeForm: () => <div data-testid="challenge-form" /> }));

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

const IMPACT: ImpactV6Result = {
  handle: "testuser",
  profileType: "collaborative",
  dimensions: { delivery: 85, quality: 42, consistency: 70, breadth: 55 },
  archetype: "Builder",
  compositeScore: 72,
  confidence: 90,
  confidencePenalties: [],
  adjustedComposite: 78,
  tier: "High",
  computedAt: "2026-01-01T00:00:00Z",
};

/**
 * The whole header (heading + intro) is the toggle. An aria-label of "Toggle
 * how your score is calculated" replaced that visible text in the accessible
 * name, which Lighthouse's label-content-name-mismatch flagged on /u/juan294
 * (LE-8-3, WCAG 2.5.3). The button is named by its content instead; its
 * aria-expanded state already says it toggles.
 */
describe("ScoreExplanationPanel — toggle is named by its visible content (LE-8-3)", () => {
  it("has no aria-label and its accessible name is the visible heading and intro", () => {
    render(<ScoreExplanationPanel impact={IMPACT} stats={STATS} isOwner={false} />);
    const toggle = screen.getByRole("button", { name: /how is my score calculated\?/i });
    expect(toggle.getAttribute("aria-label")).toBeNull();
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.textContent).toContain("How is my score calculated?");
  });
});
