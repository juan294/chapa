// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { SubMetricPanel } from "./SubMetricPanel";
import type { StatsData } from "@chapa/shared";

afterEach(cleanup);

const mockStats: StatsData = {
  handle: "testuser",
  prsMergedWeight: 47,
  prsMergedCount: 47,
  issuesClosedCount: 12,
  commitsTotal: 312,
  reviewsSubmittedCount: 35,
  microCommitRatio: 0.15,
  activeDays: 180,
  maxCommitsIn10Min: 8,
  heatmapData: [],
  reposContributed: 6,
  topRepoShare: 0.45,
  totalStars: 120,
  totalForks: 25,
  totalWatchers: 50,
  docsOnlyPrRatio: 0.08,
  linesAdded: 15000,
  linesDeleted: 5000,
  fetchedAt: "2026-02-28T00:00:00Z",
};

describe("SubMetricPanel", () => {
  // ----------------------------------------------------------------
  // 1. Delivery dimension sub-metrics
  // ----------------------------------------------------------------
  describe("Delivery dimension", () => {
    it("renders PR Weight, Issues Closed, and Commits sub-metrics", () => {
      render(
        <SubMetricPanel
          dimension="delivery"
          stats={mockStats}
          isOpen={true}
          onClose={() => {}}
        />
      );

      expect(screen.getByText("PR Weight")).toBeTruthy();
      expect(screen.getByText("Issues Closed")).toBeTruthy();
      expect(screen.getByText("Commits")).toBeTruthy();
    });
  });

  // ----------------------------------------------------------------
  // 2. Quality dimension sub-metrics
  // ----------------------------------------------------------------
  describe("Quality dimension", () => {
    it("renders Reviews, Review Ratio, and Code Cleanliness sub-metrics", () => {
      render(
        <SubMetricPanel
          dimension="quality"
          stats={mockStats}
          isOpen={true}
          onClose={() => {}}
        />
      );

      expect(screen.getByText("Reviews")).toBeTruthy();
      expect(screen.getByText("Review Ratio")).toBeTruthy();
      expect(screen.getByText("Code Cleanliness")).toBeTruthy();
    });
  });

  // ----------------------------------------------------------------
  // 3. Consistency dimension sub-metrics
  // ----------------------------------------------------------------
  describe("Consistency dimension", () => {
    it("renders Active Days, Weekly Evenness, and Low Burst Activity sub-metrics", () => {
      render(
        <SubMetricPanel
          dimension="consistency"
          stats={mockStats}
          isOpen={true}
          onClose={() => {}}
        />
      );

      expect(screen.getByText("Active Days")).toBeTruthy();
      expect(screen.getByText("Weekly Evenness")).toBeTruthy();
      expect(screen.getByText("Low Burst Activity")).toBeTruthy();
    });
  });

  // ----------------------------------------------------------------
  // 4. Breadth dimension sub-metrics
  // ----------------------------------------------------------------
  describe("Breadth dimension", () => {
    it("renders Repos Contributed, Spread, Stars, Forks, and Docs PRs sub-metrics", () => {
      render(
        <SubMetricPanel
          dimension="breadth"
          stats={mockStats}
          isOpen={true}
          onClose={() => {}}
        />
      );

      expect(screen.getByText("Repos Contributed")).toBeTruthy();
      expect(screen.getByText("Spread")).toBeTruthy();
      expect(screen.getByText("Stars")).toBeTruthy();
      expect(screen.getByText("Forks")).toBeTruthy();
      expect(screen.getByText("Docs PRs")).toBeTruthy();
    });
  });

  // ----------------------------------------------------------------
  // 5. Weight percentage labels
  // ----------------------------------------------------------------
  it("shows weight percentage labels", () => {
    render(
      <SubMetricPanel
        dimension="delivery"
        stats={mockStats}
        isOpen={true}
        onClose={() => {}}
      />
    );

    expect(screen.getByText("70%")).toBeTruthy();
    expect(screen.getByText("20%")).toBeTruthy();
    expect(screen.getByText("10%")).toBeTruthy();
  });

  // ----------------------------------------------------------------
  // 6. Raw stat values
  // ----------------------------------------------------------------
  it("shows raw stat values for delivery", () => {
    render(
      <SubMetricPanel
        dimension="delivery"
        stats={mockStats}
        isOpen={true}
        onClose={() => {}}
      />
    );

    expect(screen.getByText("47 PRs merged")).toBeTruthy();
    expect(screen.getByText("12 issues closed")).toBeTruthy();
    expect(screen.getByText("312 commits")).toBeTruthy();
  });

  // ----------------------------------------------------------------
  // 7. Progress bars with role="progressbar" and aria-valuenow
  // ----------------------------------------------------------------
  it("renders progress bars with role=progressbar and aria-valuenow", () => {
    render(
      <SubMetricPanel
        dimension="delivery"
        stats={mockStats}
        isOpen={true}
        onClose={() => {}}
      />
    );

    const progressBars = screen.getAllByRole("progressbar");
    expect(progressBars.length).toBe(3);

    const [prWeight, issuesClosed, commits] = progressBars;

    // PR Weight: min(47/60, 1) = 0.783... → round to 78
    expect(prWeight!.getAttribute("aria-valuenow")).toBe("78");
    expect(prWeight!.getAttribute("aria-valuemin")).toBe("0");
    expect(prWeight!.getAttribute("aria-valuemax")).toBe("100");

    // Issues Closed: min(12/40, 1) = 0.3 → 30
    expect(issuesClosed!.getAttribute("aria-valuenow")).toBe("30");

    // Commits: min(312/300, 1) = 1 → 100
    expect(commits!.getAttribute("aria-valuenow")).toBe("100");
  });

  // ----------------------------------------------------------------
  // 8. Close button fires onClose
  // ----------------------------------------------------------------
  it("close button fires onClose", () => {
    const onClose = vi.fn();
    render(
      <SubMetricPanel
        dimension="delivery"
        stats={mockStats}
        isOpen={true}
        onClose={onClose}
      />
    );

    const closeButton = screen.getByLabelText("Close breakdown panel");
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ----------------------------------------------------------------
  // 9. Escape key fires onClose
  // ----------------------------------------------------------------
  it("Escape key fires onClose", () => {
    const onClose = vi.fn();
    render(
      <SubMetricPanel
        dimension="delivery"
        stats={mockStats}
        isOpen={true}
        onClose={onClose}
      />
    );

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ----------------------------------------------------------------
  // 10. ARIA attributes
  // ----------------------------------------------------------------
  it('has role="region" with correct aria-label', () => {
    render(
      <SubMetricPanel
        dimension="delivery"
        stats={mockStats}
        isOpen={true}
        onClose={() => {}}
      />
    );

    const region = screen.getByRole("region");
    expect(region.getAttribute("aria-label")).toBe(
      "Delivery dimension breakdown"
    );
  });

  it('uses dimension name in aria-label (e.g. "Quality dimension breakdown")', () => {
    render(
      <SubMetricPanel
        dimension="quality"
        stats={mockStats}
        isOpen={true}
        onClose={() => {}}
      />
    );

    const region = screen.getByRole("region");
    expect(region.getAttribute("aria-label")).toBe(
      "Quality dimension breakdown"
    );
  });

  // ----------------------------------------------------------------
  // Returns null when not open
  // ----------------------------------------------------------------
  it("returns null when isOpen is false", () => {
    const { container } = render(
      <SubMetricPanel
        dimension="delivery"
        stats={mockStats}
        isOpen={false}
        onClose={() => {}}
      />
    );

    expect(container.innerHTML).toBe("");
  });

  // ----------------------------------------------------------------
  // Solo profile quality sub-metrics
  // ----------------------------------------------------------------
  describe("Quality dimension — solo profile", () => {
    const soloStats: StatsData = {
      ...mockStats,
      reviewsSubmittedCount: 0,
      prDescriptionRate: 0.75,
      featureBranchRate: 0.9,
      issueLinkageRate: 0.4,
      microCommitRatio: 0.15,
    };

    it("renders PR Descriptions, Feature Branches, Issue Linkage, and Commit Cleanliness", () => {
      render(
        <SubMetricPanel
          dimension="quality"
          stats={soloStats}
          isOpen={true}
          onClose={() => {}}
          profileType="solo"
        />
      );

      expect(screen.getByText("PR Descriptions")).toBeTruthy();
      expect(screen.getByText("Feature Branches")).toBeTruthy();
      expect(screen.getByText("Issue Linkage")).toBeTruthy();
      expect(screen.getByText("Commit Cleanliness")).toBeTruthy();
    });

    it("shows solo weight percentages", () => {
      render(
        <SubMetricPanel
          dimension="quality"
          stats={soloStats}
          isOpen={true}
          onClose={() => {}}
          profileType="solo"
        />
      );

      expect(screen.getByText("40%")).toBeTruthy();
      expect(screen.getByText("25%")).toBeTruthy();
      expect(screen.getByText("20%")).toBeTruthy();
      expect(screen.getByText("15%")).toBeTruthy();
    });
  });

  // ----------------------------------------------------------------
  // Collaborative profile quality (unchanged)
  // ----------------------------------------------------------------
  describe("Quality dimension — collaborative profile", () => {
    it("renders Reviews, Review Ratio, and Code Cleanliness when profileType is collaborative", () => {
      render(
        <SubMetricPanel
          dimension="quality"
          stats={mockStats}
          isOpen={true}
          onClose={() => {}}
          profileType="collaborative"
        />
      );

      expect(screen.getByText("Reviews")).toBeTruthy();
      expect(screen.getByText("Review Ratio")).toBeTruthy();
      expect(screen.getByText("Code Cleanliness")).toBeTruthy();
    });
  });

  // ----------------------------------------------------------------
  // Default profileType is collaborative
  // ----------------------------------------------------------------
  describe("Quality dimension — default profileType", () => {
    it("defaults to collaborative (shows Reviews) when profileType is not specified", () => {
      render(
        <SubMetricPanel
          dimension="quality"
          stats={mockStats}
          isOpen={true}
          onClose={() => {}}
        />
      );

      expect(screen.getByText("Reviews")).toBeTruthy();
      expect(screen.getByText("Review Ratio")).toBeTruthy();
    });
  });
});
