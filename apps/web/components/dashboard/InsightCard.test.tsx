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

const trendDimensionInsight = {
  id: "trend-quality",
  type: "trend" as const,
  icon: "trending-up" as const,
  headline: "Quality improved by +38",
  body: "Your quality score jumped significantly this week.",
  dimension: "quality" as const,
  priority: 3,
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
  // 2. Renders an SVG icon for each insight type
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

    // Tip with target (archetype)
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
  // 3. Achievement card has green-themed container
  // ----------------------------------------------------------------
  it("achievement card has green-themed container", () => {
    const { container } = render(
      <InsightCard insight={achievementInsight} />,
    );
    const card = container.querySelector("[role='article']") as HTMLElement;
    expect(card.className).toContain("border-terminal-green");
  });

  // ----------------------------------------------------------------
  // 4. Trend-up card has green top border accent
  // ----------------------------------------------------------------
  it("trend-up card has green top border accent", () => {
    const { container } = render(
      <InsightCard insight={trendInsight} />,
    );
    const card = container.querySelector("[role='article']") as HTMLElement;
    expect(card.style.borderTopColor).toBe("var(--color-terminal-green)");
  });

  // ----------------------------------------------------------------
  // 5. Trend-down card has yellow top border accent
  // ----------------------------------------------------------------
  it("trend-down card has yellow top border accent", () => {
    const { container } = render(
      <InsightCard insight={trendDownInsight} />,
    );
    const card = container.querySelector("[role='article']") as HTMLElement;
    expect(card.style.borderTopColor).toBe("var(--color-terminal-yellow)");
  });

  // ----------------------------------------------------------------
  // 6. Trend card with dimension uses dimension color for top border
  // ----------------------------------------------------------------
  it("trend card with dimension uses dimension color for top border", () => {
    const { container } = render(
      <InsightCard insight={trendDimensionInsight} />,
    );
    const card = container.querySelector("[role='article']") as HTMLElement;
    expect(card.style.borderTopColor).toBe("var(--color-dimension-quality)");
  });

  // ----------------------------------------------------------------
  // 7. Next-tier card renders tier progress bar with labels
  // ----------------------------------------------------------------
  it("next-tier card renders tier progress bar with labels", () => {
    render(<InsightCard insight={nextTierInsight} />);
    expect(screen.getByText("Emerging")).toBeTruthy();
    expect(screen.getByText("Solid")).toBeTruthy();
    expect(screen.getByText("High")).toBeTruthy();
    expect(screen.getByText("Elite")).toBeTruthy();
  });

  // ----------------------------------------------------------------
  // 8. Archetype card applies archetype color accent bar
  // ----------------------------------------------------------------
  it("archetype card applies archetype color accent bar", () => {
    const { container } = render(
      <InsightCard insight={tipNoDimensionInsight} />,
    );
    const card = container.querySelector("[role='article']") as HTMLElement;
    // Archetype card has a top accent bar with the archetype color
    const accentBar = card.querySelector(
      ".absolute.top-0",
    ) as HTMLElement;
    expect(accentBar).toBeTruthy();
    expect(accentBar.style.backgroundColor).toBe(
      "var(--color-archetype-builder)",
    );
  });

  // ----------------------------------------------------------------
  // 9. Has correct ARIA attributes (role="article", aria-label)
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
  // 10. Applies animation delay via inline style
  // ----------------------------------------------------------------
  it("applies animation delay via inline style", () => {
    const { container } = render(
      <InsightCard insight={trendInsight} animationDelay={200} />,
    );

    const article = container.querySelector("[role='article']") as HTMLElement;
    expect(article.style.animationDelay).toBe("200ms");
  });

  // ----------------------------------------------------------------
  // 11. Defaults animation delay to 0
  // ----------------------------------------------------------------
  it("defaults animation delay to 0", () => {
    const { container } = render(<InsightCard insight={trendInsight} />);

    const article = container.querySelector("[role='article']") as HTMLElement;
    expect(article.style.animationDelay).toBe("0ms");
  });
});
