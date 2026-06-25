// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { SubMetricPanel } from "./SubMetricPanel";
import type { StatsData } from "@chapa/shared";
import { makeStats } from "@/lib/test-helpers/fixtures";

afterEach(cleanup);

const mockStats: StatsData = makeStats({
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
});

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

      expect(screen.getByText("PR weight")).toBeTruthy();
      expect(screen.getByText("Issues closed")).toBeTruthy();
      expect(screen.getByText("Commits")).toBeTruthy();
    });
  });

  // ----------------------------------------------------------------
  // 2. Quality dimension sub-metrics
  // ----------------------------------------------------------------
  describe("Quality dimension", () => {
    it("renders Reviews, Review Ratio, and Batch Size sub-metrics", () => {
      render(
        <SubMetricPanel
          dimension="quality"
          stats={mockStats}
          isOpen={true}
          onClose={() => {}}
        />
      );

      expect(screen.getByText("Reviews")).toBeTruthy();
      expect(screen.getByText("Review-to-PR ratio")).toBeTruthy();
      expect(screen.getByText("Batch size")).toBeTruthy();
    });
  });

  // ----------------------------------------------------------------
  // 3. Consistency dimension sub-metrics
  // ----------------------------------------------------------------
  describe("Consistency dimension", () => {
    it("renders Active Days, Heatmap Evenness, and Week Coverage sub-metrics", () => {
      render(
        <SubMetricPanel
          dimension="consistency"
          stats={mockStats}
          isOpen={true}
          onClose={() => {}}
        />
      );

      expect(screen.getByText("Active days")).toBeTruthy();
      expect(screen.getByText("Heatmap evenness")).toBeTruthy();
      expect(screen.getByText("Week coverage")).toBeTruthy();
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

      expect(screen.getByText("Repos contributed")).toBeTruthy();
      expect(screen.getByText("Spread across repos")).toBeTruthy();
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

    // PR Weight: log-normalized against cap 60 → round to 94
    expect(prWeight!.getAttribute("aria-valuenow")).toBe("94");
    expect(prWeight!.getAttribute("aria-valuemin")).toBe("0");
    expect(prWeight!.getAttribute("aria-valuemax")).toBe("100");

    // Issues Closed: log-normalized against cap 40 → 69
    expect(issuesClosed!.getAttribute("aria-valuenow")).toBe("69");

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

    it("renders PR Descriptions, Feature Branches, Issue Linkage, and Batch Size", () => {
      render(
        <SubMetricPanel
          dimension="quality"
          stats={soloStats}
          isOpen={true}
          onClose={() => {}}
          profileType="solo"
        />
      );

      expect(screen.getByText("PR descriptions")).toBeTruthy();
      expect(screen.getByText("Feature branches")).toBeTruthy();
      expect(screen.getByText("Issue linkage")).toBeTruthy();
      expect(screen.getByText("Batch size")).toBeTruthy();
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
    it("renders Reviews, Review Ratio, and Batch Size when profileType is collaborative", () => {
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
      expect(screen.getByText("Review-to-PR ratio")).toBeTruthy();
      expect(screen.getByText("Batch size")).toBeTruthy();
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
      expect(screen.getByText("Review-to-PR ratio")).toBeTruthy();
    });
  });

  // ----------------------------------------------------------------
  // Craft dimension sub-metrics
  // ----------------------------------------------------------------
  describe("Craft dimension", () => {
    it("renders AI Tool Proficiency, Effectiveness, and Sophistication sub-metrics", () => {
      render(
        <SubMetricPanel
          dimension="craft"
          stats={mockStats}
          isOpen={true}
          onClose={() => {}}
        />
      );

      expect(screen.getByText("AI tool proficiency")).toBeTruthy();
      expect(screen.getByText("Effectiveness")).toBeTruthy();
      expect(screen.getByText("Sophistication")).toBeTruthy();
    });

    it("shows craft weight percentages", () => {
      render(
        <SubMetricPanel
          dimension="craft"
          stats={mockStats}
          isOpen={true}
          onClose={() => {}}
        />
      );

      expect(screen.getByText("34%")).toBeTruthy();
      expect(screen.getAllByText("33%").length).toBe(2);
    });

    it("shows 'Upload insights report to compute' for all craft sub-metrics", () => {
      render(
        <SubMetricPanel
          dimension="craft"
          stats={mockStats}
          isOpen={true}
          onClose={() => {}}
        />
      );

      expect(screen.getAllByText("Upload insights report to compute").length).toBe(3);
    });

    it("renders all craft progress bars at 0%", () => {
      render(
        <SubMetricPanel
          dimension="craft"
          stats={mockStats}
          isOpen={true}
          onClose={() => {}}
        />
      );

      const progressBars = screen.getAllByRole("progressbar");
      expect(progressBars.length).toBe(3);
      for (const bar of progressBars) {
        expect(bar.getAttribute("aria-valuenow")).toBe("0");
      }
    });

    it("has correct aria-label for craft dimension", () => {
      render(
        <SubMetricPanel
          dimension="craft"
          stats={mockStats}
          isOpen={true}
          onClose={() => {}}
        />
      );

      const region = screen.getByRole("region");
      expect(region.getAttribute("aria-label")).toBe("Craft dimension breakdown");
    });
  });

  // ----------------------------------------------------------------
  // Breadth dimension: raw stat labels
  // ----------------------------------------------------------------
  describe("Breadth dimension — raw labels", () => {
    it("shows raw stat values for breadth", () => {
      render(
        <SubMetricPanel
          dimension="breadth"
          stats={mockStats}
          isOpen={true}
          onClose={() => {}}
        />
      );

      expect(screen.getByText("6 repos")).toBeTruthy();
      expect(screen.getByText("Top repo: 45% of activity")).toBeTruthy();
      expect(screen.getByText("120 stars earned")).toBeTruthy();
      expect(screen.getByText("25 forks")).toBeTruthy();
      expect(screen.getByText("8% docs-only PRs")).toBeTruthy();
    });

    it("renders breadth progress bars with correct values", () => {
      render(
        <SubMetricPanel
          dimension="breadth"
          stats={mockStats}
          isOpen={true}
          onClose={() => {}}
        />
      );

      const progressBars = screen.getAllByRole("progressbar");
      expect(progressBars.length).toBe(5);

      // Repos: min(6/12, 1) = 0.5 → 50
      expect(progressBars[0]!.getAttribute("aria-valuenow")).toBe("50");
      // Spread: 1 - 0.45 = 0.55 → 55
      expect(progressBars[1]!.getAttribute("aria-valuenow")).toBe("55");
      // Stars: log-normalized against cap 150 → 96
      expect(progressBars[2]!.getAttribute("aria-valuenow")).toBe("96");
      // Forks: log-normalized against cap 80 → 74
      expect(progressBars[3]!.getAttribute("aria-valuenow")).toBe("74");
      // Docs: 0.08 → 8
      expect(progressBars[4]!.getAttribute("aria-valuenow")).toBe("8");
    });

    it("shows breadth weight percentages", () => {
      render(
        <SubMetricPanel
          dimension="breadth"
          stats={mockStats}
          isOpen={true}
          onClose={() => {}}
        />
      );

      expect(screen.getByText("40%")).toBeTruthy();
      expect(screen.getByText("25%")).toBeTruthy();
      expect(screen.getByText("10%")).toBeTruthy();
      expect(screen.getByText("5%")).toBeTruthy();
      expect(screen.getByText("15%")).toBeTruthy();
    });
  });

  // ----------------------------------------------------------------
  // Consistency dimension: raw stat labels and progress values
  // ----------------------------------------------------------------
  describe("Consistency dimension — raw labels and progress", () => {
    it("shows raw stat values for consistency", () => {
      render(
        <SubMetricPanel
          dimension="consistency"
          stats={mockStats}
          isOpen={true}
          onClose={() => {}}
        />
      );

      expect(screen.getByText("180 of 365 days")).toBeTruthy();
      expect(screen.getByText("Distribution across weeks")).toBeTruthy();
      expect(screen.getByText("0% active weeks")).toBeTruthy();
    });

    it("renders consistency progress bars with correct values", () => {
      render(
        <SubMetricPanel
          dimension="consistency"
          stats={mockStats}
          isOpen={true}
          onClose={() => {}}
        />
      );

      const progressBars = screen.getAllByRole("progressbar");
      expect(progressBars.length).toBe(3);

      // Active Days: sqrt(min(180/365, 1)) = sqrt(0.493...) ≈ 0.702 → 70
      expect(progressBars[0]!.getAttribute("aria-valuenow")).toBe("70");
      // Empty heatmap data → evenness 0 and week coverage 0
      expect(progressBars[1]!.getAttribute("aria-valuenow")).toBe("0");
      expect(progressBars[2]!.getAttribute("aria-valuenow")).toBe("0");
    });

    it("shows consistency weight percentages", () => {
      render(
        <SubMetricPanel
          dimension="consistency"
          stats={mockStats}
          isOpen={true}
          onClose={() => {}}
        />
      );

      expect(screen.getByText("45%")).toBeTruthy();
      expect(screen.getByText("40%")).toBeTruthy();
      expect(screen.getByText("15%")).toBeTruthy();
    });
  });

  // ----------------------------------------------------------------
  // Quality collaborative: raw stat labels and progress values
  // ----------------------------------------------------------------
  describe("Quality dimension — collaborative raw labels", () => {
    it("shows raw stat values for collaborative quality", () => {
      render(
        <SubMetricPanel
          dimension="quality"
          stats={mockStats}
          isOpen={true}
          onClose={() => {}}
          profileType="collaborative"
        />
      );

      expect(screen.getByText("35 reviews")).toBeTruthy();
      // Review ratio: min(35/47, 5)/5 = min(0.744, 5)/5 = 0.744/5 = 0.149 → 0.7:1
      expect(screen.getByText("0.7:1 reviews per PR")).toBeTruthy();
      expect(screen.getByText("30% of PRs in reviewable batch size")).toBeTruthy();
    });

    it("renders quality collaborative progress bars with correct values", () => {
      render(
        <SubMetricPanel
          dimension="quality"
          stats={mockStats}
          isOpen={true}
          onClose={() => {}}
          profileType="collaborative"
        />
      );

      const progressBars = screen.getAllByRole("progressbar");
      expect(progressBars.length).toBe(3);

      // Reviews: log-normalized against cap 80 → 82
      expect(progressBars[0]!.getAttribute("aria-valuenow")).toBe("82");
      // Review Ratio: min(35/47, 5)/5 ≈ 0.149 → 15
      expect(progressBars[1]!.getAttribute("aria-valuenow")).toBe("15");
      // Batch Size: defaults to 0.3 when unavailable → 30
      expect(progressBars[2]!.getAttribute("aria-valuenow")).toBe("30");
    });

    it("shows collaborative quality weight percentages", () => {
      render(
        <SubMetricPanel
          dimension="quality"
          stats={mockStats}
          isOpen={true}
          onClose={() => {}}
          profileType="collaborative"
        />
      );

      expect(screen.getByText("60%")).toBeTruthy();
      expect(screen.getByText("25%")).toBeTruthy();
      expect(screen.getByText("15%")).toBeTruthy();
    });
  });

  // ----------------------------------------------------------------
  // Quality solo: raw stat labels and progress values
  // ----------------------------------------------------------------
  describe("Quality dimension — solo raw labels and progress", () => {
    const soloStats: StatsData = {
      ...mockStats,
      prDescriptionRate: 0.75,
      featureBranchRate: 0.9,
      issueLinkageRate: 0.4,
      microCommitRatio: 0.15,
    };

    it("shows raw stat values for solo quality", () => {
      render(
        <SubMetricPanel
          dimension="quality"
          stats={soloStats}
          isOpen={true}
          onClose={() => {}}
          profileType="solo"
        />
      );

      expect(screen.getByText("75% of PRs have descriptions")).toBeTruthy();
      expect(screen.getByText("90% from feature branches")).toBeTruthy();
      expect(screen.getByText("40% linked to issues")).toBeTruthy();
      expect(screen.getByText("30% of PRs in reviewable batch size")).toBeTruthy();
    });

    it("renders solo quality progress bars with correct values", () => {
      render(
        <SubMetricPanel
          dimension="quality"
          stats={soloStats}
          isOpen={true}
          onClose={() => {}}
          profileType="solo"
        />
      );

      const progressBars = screen.getAllByRole("progressbar");
      expect(progressBars.length).toBe(4);

      // PR Descriptions: 0.75 → 75
      expect(progressBars[0]!.getAttribute("aria-valuenow")).toBe("75");
      // Feature Branches: 0.9 → 90
      expect(progressBars[1]!.getAttribute("aria-valuenow")).toBe("90");
      // Issue Linkage: 0.4 → 40
      expect(progressBars[2]!.getAttribute("aria-valuenow")).toBe("40");
      // Batch Size: defaults to 0.3 when unavailable → 30
      expect(progressBars[3]!.getAttribute("aria-valuenow")).toBe("30");
    });
  });

  // ----------------------------------------------------------------
  // Quality solo: fallback to defaults for undefined optional fields
  // ----------------------------------------------------------------
  describe("Quality dimension — solo with undefined optional fields", () => {
    it("defaults to 0 for description, branch, linkage rates when undefined", () => {
      const soloStatsNoOptionals = {
        ...mockStats,
        reviewsSubmittedCount: 0,
        prDescriptionRate: undefined,
        featureBranchRate: undefined,
        issueLinkageRate: undefined,
        microCommitRatio: undefined,
      } as unknown as StatsData;

      render(
        <SubMetricPanel
          dimension="quality"
          stats={soloStatsNoOptionals}
          isOpen={true}
          onClose={() => {}}
          profileType="solo"
        />
      );

      expect(screen.getByText("0% of PRs have descriptions")).toBeTruthy();
      expect(screen.getByText("0% from feature branches")).toBeTruthy();
      expect(screen.getByText("0% linked to issues")).toBeTruthy();
      // batchSizeScore defaults to 0.3 when unavailable.
      expect(screen.getByText("30% of PRs in reviewable batch size")).toBeTruthy();
    });

    it("uses default batchSizeScore of 0.3 when undefined", () => {
      const soloStatsNoOptionals = {
        ...mockStats,
        reviewsSubmittedCount: 0,
        prDescriptionRate: undefined,
        featureBranchRate: undefined,
        issueLinkageRate: undefined,
        microCommitRatio: undefined,
      } as unknown as StatsData;

      render(
        <SubMetricPanel
          dimension="quality"
          stats={soloStatsNoOptionals}
          isOpen={true}
          onClose={() => {}}
          profileType="solo"
        />
      );

      const progressBars = screen.getAllByRole("progressbar");
      // Batch Size: defaults to 0.3 when unavailable → 30
      expect(progressBars[3]!.getAttribute("aria-valuenow")).toBe("30");
    });
  });

  // ----------------------------------------------------------------
  // Quality collaborative: edge cases for review ratio
  // ----------------------------------------------------------------
  describe("Quality dimension — collaborative review ratio edge cases", () => {
    it("review ratio is 1 when prsMergedCount is 0 but reviews exist", () => {
      const statsZeroPrs: StatsData = {
        ...mockStats,
        prsMergedCount: 0,
        prsMergedWeight: 0,
        reviewsSubmittedCount: 10,
      };

      render(
        <SubMetricPanel
          dimension="quality"
          stats={statsZeroPrs}
          isOpen={true}
          onClose={() => {}}
          profileType="collaborative"
        />
      );

      const progressBars = screen.getAllByRole("progressbar");
      // Review Ratio: prsMergedCount === 0 && reviewsSubmittedCount > 0 → 1 → 100
      expect(progressBars[1]!.getAttribute("aria-valuenow")).toBe("100");
    });

    it("review ratio is 0 when both prsMergedCount and reviews are 0", () => {
      const statsZeroBoth: StatsData = {
        ...mockStats,
        prsMergedCount: 0,
        prsMergedWeight: 0,
        reviewsSubmittedCount: 0,
      };

      render(
        <SubMetricPanel
          dimension="quality"
          stats={statsZeroBoth}
          isOpen={true}
          onClose={() => {}}
          profileType="collaborative"
        />
      );

      const progressBars = screen.getAllByRole("progressbar");
      // Review Ratio: prsMergedCount === 0 && reviewsSubmittedCount === 0 → 0
      expect(progressBars[1]!.getAttribute("aria-valuenow")).toBe("0");
    });

    it("uses default batchSizeScore 0.3 for collaborative when undefined", () => {
      const statsNoMicro: StatsData = {
        ...mockStats,
        batchSizeScore: undefined,
      };

      render(
        <SubMetricPanel
          dimension="quality"
          stats={statsNoMicro}
          isOpen={true}
          onClose={() => {}}
          profileType="collaborative"
        />
      );

      expect(screen.getByText("30% of PRs in reviewable batch size")).toBeTruthy();
    });
  });

  // ----------------------------------------------------------------
  // Breadth dimension: edge case with undefined docsOnlyPrRatio
  // ----------------------------------------------------------------
  describe("Breadth dimension — undefined docsOnlyPrRatio", () => {
    it("defaults to 0 for docsOnlyPrRatio when undefined", () => {
      const statsNoDocs: StatsData = {
        ...mockStats,
        docsOnlyPrRatio: undefined as unknown as number,
      };

      render(
        <SubMetricPanel
          dimension="breadth"
          stats={statsNoDocs}
          isOpen={true}
          onClose={() => {}}
        />
      );

      expect(screen.getByText("0% docs-only PRs")).toBeTruthy();
      const progressBars = screen.getAllByRole("progressbar");
      // Docs: 0 → 0
      expect(progressBars[4]!.getAttribute("aria-valuenow")).toBe("0");
    });
  });

  // ----------------------------------------------------------------
  // Non-Escape key does not close the panel
  // ----------------------------------------------------------------
  it("does not close on non-Escape key", () => {
    const onClose = vi.fn();
    render(
      <SubMetricPanel
        dimension="delivery"
        stats={mockStats}
        isOpen={true}
        onClose={onClose}
      />
    );

    fireEvent.keyDown(document, { key: "Enter" });
    expect(onClose).not.toHaveBeenCalled();
  });

  // ----------------------------------------------------------------
  // Dimension heading uses dimension color
  // ----------------------------------------------------------------
  it("renders dimension heading with correct label text", () => {
    render(
      <SubMetricPanel
        dimension="consistency"
        stats={mockStats}
        isOpen={true}
        onClose={() => {}}
      />
    );

    expect(screen.getByText("Consistency Breakdown")).toBeTruthy();
  });

  it("renders breadth dimension heading", () => {
    render(
      <SubMetricPanel
        dimension="breadth"
        stats={mockStats}
        isOpen={true}
        onClose={() => {}}
      />
    );

    expect(screen.getByText("Breadth Breakdown")).toBeTruthy();
  });

  it("renders craft dimension heading", () => {
    render(
      <SubMetricPanel
        dimension="craft"
        stats={mockStats}
        isOpen={true}
        onClose={() => {}}
      />
    );

    expect(screen.getByText("Craft Breakdown")).toBeTruthy();
  });

  // ----------------------------------------------------------------
  // Delivery dimension: boundary values (clamped at 1)
  // ----------------------------------------------------------------
  describe("Delivery dimension — boundary values", () => {
    it("clamps values at 100% for high input values", () => {
      const highStats: StatsData = {
        ...mockStats,
        prsMergedWeight: 200,    // 200/60 >> 1, clamped to 1
        prsMergedCount: 200,
        issuesClosedCount: 100,  // 100/40 >> 1, clamped to 1
        commitsTotal: 500,       // 500/300 >> 1, clamped to 1
      };

      render(
        <SubMetricPanel
          dimension="delivery"
          stats={highStats}
          isOpen={true}
          onClose={() => {}}
        />
      );

      const progressBars = screen.getAllByRole("progressbar");
      expect(progressBars[0]!.getAttribute("aria-valuenow")).toBe("100");
      expect(progressBars[1]!.getAttribute("aria-valuenow")).toBe("100");
      expect(progressBars[2]!.getAttribute("aria-valuenow")).toBe("100");
    });

    it("shows 0% for zero input values", () => {
      const zeroStats: StatsData = {
        ...mockStats,
        prsMergedWeight: 0,
        prsMergedCount: 0,
        issuesClosedCount: 0,
        commitsTotal: 0,
      };

      render(
        <SubMetricPanel
          dimension="delivery"
          stats={zeroStats}
          isOpen={true}
          onClose={() => {}}
        />
      );

      const progressBars = screen.getAllByRole("progressbar");
      expect(progressBars[0]!.getAttribute("aria-valuenow")).toBe("0");
      expect(progressBars[1]!.getAttribute("aria-valuenow")).toBe("0");
      expect(progressBars[2]!.getAttribute("aria-valuenow")).toBe("0");
    });
  });

  // ----------------------------------------------------------------
  // WCAG #667 — W6: progressbar containers have aria-label
  // ----------------------------------------------------------------
  describe("WCAG progressbar aria-label (#667)", () => {
    it("each progressbar has an aria-label describing what it measures", () => {
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

      // Each progressbar container must have an aria-label
      for (const bar of progressBars) {
        const label = bar.getAttribute("aria-label");
        expect(label).not.toBeNull();
        expect(label!.length).toBeGreaterThan(0);
      }
    });

    it("progressbar aria-labels match the sub-metric labels for delivery", () => {
      render(
        <SubMetricPanel
          dimension="delivery"
          stats={mockStats}
          isOpen={true}
          onClose={() => {}}
        />
      );

      const progressBars = screen.getAllByRole("progressbar");
      expect(progressBars[0]!.getAttribute("aria-label")).toBe("PR weight");
      expect(progressBars[1]!.getAttribute("aria-label")).toBe("Issues closed");
      expect(progressBars[2]!.getAttribute("aria-label")).toBe("Commits");
    });

    it("progressbar aria-labels match the sub-metric labels for quality collaborative", () => {
      render(
        <SubMetricPanel
          dimension="quality"
          stats={mockStats}
          isOpen={true}
          onClose={() => {}}
          profileType="collaborative"
        />
      );

      const progressBars = screen.getAllByRole("progressbar");
      expect(progressBars[0]!.getAttribute("aria-label")).toBe("Reviews");
      expect(progressBars[1]!.getAttribute("aria-label")).toBe("Review-to-PR ratio");
      expect(progressBars[2]!.getAttribute("aria-label")).toBe("Batch size");
    });
  });
});
