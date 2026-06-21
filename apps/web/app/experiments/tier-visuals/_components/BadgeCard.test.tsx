// @vitest-environment jsdom
import { afterEach, describe, it, expect } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { BadgeCard } from "./BadgeCard";
import { TIERS } from "./tier-data";

afterEach(cleanup);

describe("tier-visuals BadgeCard", () => {
  it("renders every tier without throwing", () => {
    for (const data of TIERS) {
      const { container, unmount } = render(<BadgeCard data={data} />);
      // Heatmap grid present with descriptive aria label
      expect(
        container.querySelector(`[aria-label="Activity heatmap for ${data.handle}"]`),
      ).toBeTruthy();
      // Tier pill shows the tier name
      expect(container.textContent).toContain(data.tier);
      unmount();
    }
  });

  it("renders Elite tier with sparkle dots and animated border glow", () => {
    const elite = TIERS.find((t) => t.tier === "Elite")!;
    const { container } = render(<BadgeCard data={elite} />);
    expect(container.querySelector(".elite-border-glow")).toBeTruthy();
    expect(container.querySelectorAll(".sparkle-dot").length).toBe(3);
  });

  it("honors score and tier overrides used by the transition demo", () => {
    const emerging = TIERS.find((t) => t.tier === "Emerging")!;
    const { container } = render(
      <BadgeCard data={emerging} scoreOverride={88.6} tierOverride="Elite" />,
    );
    // Rounds the overridden score
    expect(container.textContent).toContain("89");
    // Applies the overridden tier class
    expect(container.querySelector(".tier-card-elite")).toBeTruthy();
  });
});
