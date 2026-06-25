// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { CraftResult } from "@chapa/shared";
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
  adjustedComposite: 52,
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

const craftResult: CraftResult = {
  tool: "claude-code",
  dimensions: {
    proficiency: 34,
    effectiveness: 82,
    sophistication: 91,
  },
  craftScore: 69,
  tier: "Expert",
  reportPeriod: {
    start: "2026-06-01",
    end: "2026-06-25",
  },
  computedAt: "2026-06-25T00:00:00.000Z",
};

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
    expect(screen.getByText("Your score")).toBeTruthy();
  });

  it("leads with the badge (adjusted) number, not the raw composite", () => {
    renderPanel(false);
    expandPanel();

    // Headline must match the badge number (adjustedComposite = 52), NOT the raw
    // dimension average (compositeScore = 47). The raw average is shown in the
    // breakdown line with an explanation of the difference.
    expect(screen.getByText("52 (Solid)")).toBeTruthy();
    expect(
      screen.getByText(
        "This is the score shown on your badge, built from your Delivery, Consistency, Breadth — which average to 47.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText("47 (Solid)")).toBeNull();
  });

  it("shows public formulas and data caveats to visitors but hides confidence", () => {
    renderPanel(false);
    expandPanel();

    expect(screen.getByText("52 (Solid)")).toBeTruthy();
    expect(screen.getByText("70% PR weight + 20% issues closed + 10% commits, with a ±5% lead-time modifier.")).toBeTruthy();
    expect(screen.getByText("45% active-day curve + 40% heatmap evenness + 15% week coverage.")).toBeTruthy();
    expect(screen.getByText("GitLab does not expose PR-description, branch, or issue-link signals, so your Quality dimension is based on limited data here.")).toBeTruthy();
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

  it("does not render ChallengeForm for visitors", () => {
    renderPanel(false);
    expandPanel();

    expect(
      screen.queryByRole("button", { name: /something seem off/i }),
    ).toBeNull();
  });

  it("renders ChallengeForm CTA for owners", () => {
    renderPanel(true);
    expandPanel();

    expect(
      screen.getByRole("button", { name: /something seem off/i }),
    ).toBeTruthy();
  });

  it("marks solo Quality as shown but not counted", () => {
    renderPanel(false);
    expandPanel();

    expect(screen.getByText("Quality")).toBeTruthy();
    expect(screen.getByText("shown, not counted")).toBeTruthy();
    expect(
      screen.getByText(
        "This is the score shown on your badge, built from your Delivery, Consistency, Breadth — which average to 47.",
      ),
    ).toBeTruthy();
  });

  it("renders the GitLab data-source line", () => {
    renderPanel(false);
    expandPanel();

    expect(screen.getByText("GitLab (mdburgos)")).toBeTruthy();
  });

  it("renders uploaded Craft sub-scores instead of the upload prompt", () => {
    render(
      <ScoreExplanationPanel
        impact={makeImpact({
          profileType: "collaborative",
          dimensions: {
            delivery: 80,
            quality: 70,
            consistency: 60,
            breadth: 50,
            craft: 69,
          },
        })}
        stats={makeStats()}
        craftResult={craftResult}
        isOwner={false}
      />,
    );

    expandPanel();

    expect(screen.getByText("Craft")).toBeTruthy();
    expect(screen.getByText("Craft subscore: 34/100")).toBeTruthy();
    expect(screen.getByText("Craft subscore: 82/100")).toBeTruthy();
    expect(screen.getByText("Craft subscore: 91/100")).toBeTruthy();
    expect(screen.queryByText("Upload insights report to compute")).toBeNull();
  });
});
