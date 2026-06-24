// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { makeImpact, makeStats } from "@/lib/test-helpers/fixtures";
import { ScoreExplanationPanel } from "./ScoreExplanationPanel";

afterEach(cleanup);

const soloImpact = makeImpact({
  profileType: "solo",
  dimensions: {
    delivery: 98,
    quality: 5,
    consistency: 40,
    breadth: 3,
  },
  compositeScore: 47,
  adjustedComposite: 46,
  tier: "Solid",
  confidence: 95,
  confidencePenalties: [
    {
      flag: "single_repo_concentration",
      penalty: 5,
      reason: "Most activity is concentrated in one repo.",
    },
    {
      flag: "platform_linked",
      penalty: 0,
      reason: "Includes verified data from a linked platform account.",
    },
  ],
});

const soloStats = makeStats({
  handle: "mdburgos",
  linkedPlatforms: ["gitlab"],
  linkedPlatformLogins: { gitlab: "mdburgos" },
  prDescriptionRate: undefined,
  featureBranchRate: undefined,
  issueLinkageRate: undefined,
  batchSizeScore: undefined,
});

function renderPanel(isOwner: boolean) {
  return render(
    <ScoreExplanationPanel
      impact={soloImpact}
      stats={soloStats}
      isOwner={isOwner}
    />,
  );
}

function expandPanel() {
  const toggle = screen.getByRole("button", {
    name: "Toggle how your score is calculated",
  });
  fireEvent.click(toggle);
  return toggle;
}

describe("ScoreExplanationPanel", () => {
  it("renders the toggle and expands on click", () => {
    renderPanel(false);

    const toggle = screen.getByRole("button", {
      name: "Toggle how your score is calculated",
    });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(toggle);

    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Your composite score (solo profile)")).toBeTruthy();
  });

  it("shows public formulas and data caveats to visitors but hides confidence", () => {
    renderPanel(false);
    expandPanel();

    expect(screen.getByText("47 (Solid) = average of Delivery, Consistency, Breadth")).toBeTruthy();
    expect(screen.getByText("70% PR weight + 20% issues closed + 10% commits, with a ±5% lead-time modifier.")).toBeTruthy();
    expect(screen.getByText("45% active-day curve + 40% heatmap evenness + 15% week coverage.")).toBeTruthy();
    expect(screen.getByText("Gitlab does not expose PR-description, branch, or issue-link signals, so your Quality dimension is based on limited data here.")).toBeTruthy();
    expect(screen.queryByText("Confidence")).toBeNull();
    expect(screen.queryByText("Confidence: 95%")).toBeNull();
  });

  it("shows confidence details only to the owner", () => {
    renderPanel(true);
    expandPanel();

    expect(screen.getByText("Confidence")).toBeTruthy();
    expect(screen.getByText("Confidence: 95%")).toBeTruthy();
    expect(screen.getByText("Most activity is concentrated in one repo — not bad, just less cross-repo signal.")).toBeTruthy();
    expect(screen.getByText("-5")).toBeTruthy();
  });

  it("marks solo Quality as shown but not counted", () => {
    renderPanel(false);
    expandPanel();

    expect(screen.getByText("Quality")).toBeTruthy();
    expect(screen.getByText("shown, not counted")).toBeTruthy();
    expect(screen.getByText("47 (Solid) = average of Delivery, Consistency, Breadth")).toBeTruthy();
  });

  it("renders the GitLab data-source line", () => {
    renderPanel(false);
    expandPanel();

    expect(screen.getByText("Gitlab (mdburgos)")).toBeTruthy();
  });
});
