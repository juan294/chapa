// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { StatsData } from "@chapa/shared";
import { StatsGrid } from "./StatsGrid";

vi.mock("@/components/InfoTooltip", () => ({
  InfoTooltip: (props: { id: string }) => <span data-testid="info-tooltip" data-id={props.id} />,
}));

afterEach(cleanup);

const STATS: StatsData = {
  handle: "testuser",
  displayName: "Test User",
  commitsTotal: 3500,
  activeDays: 212,
  prsMergedCount: 150,
  prsMergedWeight: 100,
  reviewsSubmittedCount: 83,
  issuesClosedCount: 30,
  linesAdded: 10000,
  linesDeleted: 4000,
  reposContributed: 14,
  topRepoShare: 0.4,
  maxCommitsIn10Min: 3,
  totalStars: 1500,
  totalForks: 207,
  totalWatchers: 55,
  heatmapData: [],
  fetchedAt: "2026-02-28T00:00:00Z",
};

/**
 * The dimension cards above this grid enter between 400ms and 700ms
 * (DimensionCardsRow). Lighthouse measures colour contrast once the page
 * settles, which in the 2026-09-07 mobile run was ~2.8s after first paint:
 * the REVIEWS and REPOS captions, still fading in from a 2.2s+ stagger,
 * measured 3.87:1 and 3.19:1 against the card even though the resolved
 * `text-text-secondary` on `bg-card` is 5.98:1 light and 7.78:1 dark. The
 * grid sits far below the fold, so nobody sees a long choreography here;
 * keeping its entrance inside the dimension cards' window is what makes
 * its captions opaque by the time anyone, auditor included, measures them.
 */
const ENTRANCE_DEADLINE_MS = 1000;

describe("StatsGrid — caption contrast is measured on the settled card (LE-8-3)", () => {
  it("captions use the text-secondary token, which clears 4.5:1 on bg-card in both themes", () => {
    render(<StatsGrid stats={STATS} diff={null} />);
    const caption = screen.getByText("Reviews");
    expect(caption.className).toContain("text-text-secondary");
    expect(caption.closest(".bg-card")).not.toBeNull();
  });

  it("every card finishes its entrance inside the dimension cards' window", () => {
    const { container } = render(<StatsGrid stats={STATS} diff={null} />);
    const cards = Array.from(container.querySelectorAll<HTMLElement>(".animate-fade-in-up"));
    expect(cards).toHaveLength(8);
    for (const card of cards) {
      const delay = Number.parseInt(card.style.animationDelay, 10);
      expect(Number.isNaN(delay)).toBe(false);
      expect(delay).toBeLessThanOrEqual(ENTRANCE_DEADLINE_MS);
    }
  });
});
