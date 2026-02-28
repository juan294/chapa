// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { InsightCard } from "./InsightCard";

afterEach(cleanup);

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const trendInsight = {
  id: "trend-overall",
  type: "trend" as const,
  icon: "trending-up" as const,
  headline: "Your impact is trending upward",
  body: "Score improved by +2.5/day.",
  priority: 2,
};

const trendDownInsight = {
  id: "trend-down",
  type: "trend" as const,
  icon: "trending-down" as const,
  headline: "Your impact is trending downward",
  body: "Score declined by -1.2/day recently.",
  priority: 2,
};

const tipInsight = {
  id: "tip-quality",
  type: "tip" as const,
  icon: "lightbulb" as const,
  headline: "Grow your quality",
  body: "Review more PRs to boost quality.",
  dimension: "quality" as const,
  priority: 4,
};

const tipNoDimensionInsight = {
  id: "tip-archetype",
  type: "tip" as const,
  icon: "target" as const,
  headline: "You're a Builder",
  body: "Your profile is driven by output.",
  priority: 6,
};

const achievementInsight = {
  id: "achievement-tier",
  type: "achievement" as const,
  icon: "trophy" as const,
  headline: "You leveled up to High!",
  body: "Your consistent effort paid off.",
  priority: 1,
};

const nextTierInsight = {
  id: "next-tier",
  type: "next-tier" as const,
  icon: "arrow-up" as const,
  headline: "17 points to High",
  body: "Focus on your strongest dimension.",
  priority: 5,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("InsightCard", () => {
  // ----------------------------------------------------------------
  // 1. Renders headline and body text
  // ----------------------------------------------------------------
  it("renders headline and body text", () => {
    render(<InsightCard insight={trendInsight} />);

    expect(screen.getByText("Your impact is trending upward")).toBeTruthy();
    expect(screen.getByText("Score improved by +2.5/day.")).toBeTruthy();
  });

  // ----------------------------------------------------------------
  // 2. Renders correct icon for each type (check SVG is present)
  // ----------------------------------------------------------------
  it("renders an SVG icon for each insight type", () => {
    // Trending up
    const { container: c1, unmount: u1 } = render(
      <InsightCard insight={trendInsight} />,
    );
    expect(c1.querySelector("svg[aria-hidden='true']")).toBeTruthy();
    u1();

    // Trending down
    const { container: c2, unmount: u2 } = render(
      <InsightCard insight={trendDownInsight} />,
    );
    expect(c2.querySelector("svg[aria-hidden='true']")).toBeTruthy();
    u2();

    // Tip with lightbulb
    const { container: c3, unmount: u3 } = render(
      <InsightCard insight={tipInsight} />,
    );
    expect(c3.querySelector("svg[aria-hidden='true']")).toBeTruthy();
    u3();

    // Tip with target
    const { container: c4, unmount: u4 } = render(
      <InsightCard insight={tipNoDimensionInsight} />,
    );
    expect(c4.querySelector("svg[aria-hidden='true']")).toBeTruthy();
    u4();

    // Achievement with trophy
    const { container: c5, unmount: u5 } = render(
      <InsightCard insight={achievementInsight} />,
    );
    expect(c5.querySelector("svg[aria-hidden='true']")).toBeTruthy();
    u5();

    // Next-tier with arrow-up
    const { container: c6 } = render(
      <InsightCard insight={nextTierInsight} />,
    );
    expect(c6.querySelector("svg[aria-hidden='true']")).toBeTruthy();
  });

  // ----------------------------------------------------------------
  // 3. Applies correct left border color for each type
  // ----------------------------------------------------------------
  it("applies correct left border color for each type", () => {
    // trend + trending-up => border-l-terminal-green
    const { container: c1, unmount: u1 } = render(
      <InsightCard insight={trendInsight} />,
    );
    const card1 = c1.querySelector("[role='article']") as HTMLElement;
    expect(card1.className).toContain("border-l-terminal-green");
    u1();

    // trend + trending-down => border-l-terminal-yellow
    const { container: c2, unmount: u2 } = render(
      <InsightCard insight={trendDownInsight} />,
    );
    const card2 = c2.querySelector("[role='article']") as HTMLElement;
    expect(card2.className).toContain("border-l-terminal-yellow");
    u2();

    // tip with dimension => inline borderLeftColor with CSS variable
    const { container: c3, unmount: u3 } = render(
      <InsightCard insight={tipInsight} />,
    );
    const card3 = c3.querySelector("[role='article']") as HTMLElement;
    expect(card3.style.borderLeftColor).toBe(
      "var(--color-dimension-quality)",
    );
    u3();

    // tip without dimension => border-l-amber
    const { container: c4, unmount: u4 } = render(
      <InsightCard insight={tipNoDimensionInsight} />,
    );
    const card4 = c4.querySelector("[role='article']") as HTMLElement;
    expect(card4.className).toContain("border-l-amber");
    u4();

    // achievement => border-l-terminal-green + bg-terminal-green/5
    const { container: c5, unmount: u5 } = render(
      <InsightCard insight={achievementInsight} />,
    );
    const card5 = c5.querySelector("[role='article']") as HTMLElement;
    expect(card5.className).toContain("border-l-terminal-green");
    expect(card5.className).toContain("bg-terminal-green/5");
    u5();

    // next-tier => border-l-amber
    const { container: c6 } = render(
      <InsightCard insight={nextTierInsight} />,
    );
    const card6 = c6.querySelector("[role='article']") as HTMLElement;
    expect(card6.className).toContain("border-l-amber");
  });

  // ----------------------------------------------------------------
  // 4. Has correct ARIA attributes (role="article", aria-label)
  // ----------------------------------------------------------------
  it("has correct ARIA attributes", () => {
    render(<InsightCard insight={achievementInsight} />);

    const article = screen.getByRole("article");
    expect(article).toBeTruthy();
    expect(article.getAttribute("aria-label")).toBe(
      "You leveled up to High! Your consistent effort paid off.",
    );
  });

  // ----------------------------------------------------------------
  // 5. Applies animation delay via inline style
  // ----------------------------------------------------------------
  it("applies animation delay via inline style", () => {
    const { container } = render(
      <InsightCard insight={trendInsight} animationDelay={200} />,
    );

    const article = container.querySelector("[role='article']") as HTMLElement;
    expect(article.style.animationDelay).toBe("200ms");
  });

  // ----------------------------------------------------------------
  // 6. Defaults animation delay to 0
  // ----------------------------------------------------------------
  it("defaults animation delay to 0", () => {
    const { container } = render(<InsightCard insight={trendInsight} />);

    const article = container.querySelector("[role='article']") as HTMLElement;
    expect(article.style.animationDelay).toBe("0ms");
  });
});
