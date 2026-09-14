// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { InsightCard } from "./InsightCard";
import { compositeColor, contrastRatio, themedTokenValue } from "@/lib/test-helpers/css-tokens";

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
  archetypeName: "Builder",
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
  nextTierMeta: {
    gap: 17,
    nextTierKey: "High" as const,
    currentIndex: 1, // Solid
    nextIndex: 2,    // High
    tierLabels: ["Emerging", "Solid", "High", "Elite"],
  },
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
  // 4. Trend-up card uses green accent on icon container
  // ----------------------------------------------------------------
  it("trend-up card uses green accent on icon container", () => {
    const { container } = render(
      <InsightCard insight={trendInsight} />,
    );
    const iconBox = container.querySelector("[data-testid='trend-icon']") as HTMLElement;
    expect(iconBox).toBeTruthy();
    // Icon is rendered in green
    const iconWrapper = iconBox.querySelector("div:last-child") as HTMLElement;
    expect(iconWrapper.style.color).toBe("var(--color-terminal-green)");
  });

  // ----------------------------------------------------------------
  // 5. Trend-down card uses yellow accent on icon container
  // ----------------------------------------------------------------
  it("trend-down card uses yellow accent on icon container", () => {
    const { container } = render(
      <InsightCard insight={trendDownInsight} />,
    );
    const iconBox = container.querySelector("[data-testid='trend-icon']") as HTMLElement;
    const iconWrapper = iconBox.querySelector("div:last-child") as HTMLElement;
    expect(iconWrapper.style.color).toBe("var(--color-terminal-yellow)");
  });

  // ----------------------------------------------------------------
  // 6. Trend card keeps dimension tint with a readable glyph
  // ----------------------------------------------------------------
  it("trend card keeps dimension tint with a readable glyph", () => {
    const { container } = render(
      <InsightCard insight={trendDimensionInsight} />,
    );
    const iconBox = container.querySelector("[data-testid='trend-icon']") as HTMLElement;
    const iconWrapper = iconBox.querySelector("div:last-child") as HTMLElement;
    expect(iconWrapper.style.color).toBe("var(--color-text-primary)");
    expect((iconBox.querySelector(".absolute") as HTMLElement).style.backgroundColor).toBe("var(--color-dimension-quality)");
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
  // 8. Archetype card retains its tint and uses the text-safe headline role
  // ----------------------------------------------------------------
  it("archetype card retains its tint and uses the text-safe headline role", () => {
    const { container } = render(
      <InsightCard insight={tipNoDimensionInsight} />,
    );
    // Icon container has tinted background
    const iconBox = container.querySelector("[data-testid='archetype-icon']") as HTMLElement;
    expect(iconBox).toBeTruthy();
    const tint = iconBox.querySelector(".absolute") as HTMLElement;
    expect(tint.style.backgroundColor).toBe("var(--color-archetype-builder)");
    // Headline uses the text-safe role for the same archetype hue
    const headline = container.querySelector("p.font-heading") as HTMLElement;
    expect(headline.style.color).toBe("var(--color-archetype-builder-text)");
  });

  it.each(["Builder", "Quality Champion", "Marathoner", "Polymath", "Balanced", "Emerging", "Artificer", "Unknown", undefined])("keeps %s archetype text and tinted glyph readable in both themes", (archetypeName) => {
    const { container } = render(<InsightCard insight={{ ...tipNoDimensionInsight, archetypeName }} />);
    const headline = screen.getByText(tipNoDimensionInsight.headline);
    const icon = container.querySelector("[data-testid='archetype-icon']")!;
    const tint = icon.querySelector<HTMLElement>(".absolute")!;
    const glyph = icon.querySelector<HTMLElement>("div:last-child")!;
    const resolve = (value: string, theme: "light" | "dark") => themedTokenValue(value.slice(4, -1))[theme];
    for (const theme of ["light", "dark"] as const) {
      const card = themedTokenValue("--color-card")[theme];
      expect(contrastRatio(resolve(headline.style.color, theme), card)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(resolve(glyph.style.color, theme), compositeColor(resolve(tint.style.backgroundColor, theme), card, 0.15))).toBeGreaterThanOrEqual(3);
    }
  });

  it.each(["delivery", "quality", "consistency", "breadth", "craft"] as const)("keeps the %s trend glyph readable on its dimension tint", (dimension) => {
    const { container } = render(<InsightCard insight={{ ...trendDimensionInsight, dimension }} />);
    const icon = container.querySelector("[data-testid='trend-icon']")!;
    const tint = icon.querySelector<HTMLElement>(".absolute")!;
    const glyph = icon.querySelector<HTMLElement>("div:last-child")!;
    for (const theme of ["light", "dark"] as const) {
      const color = themedTokenValue(glyph.style.color.slice(4, -1))[theme];
      const background = compositeColor(themedTokenValue(tint.style.backgroundColor.slice(4, -1))[theme], themedTokenValue("--color-card")[theme], 0.15);
      expect(contrastRatio(color, background)).toBeGreaterThanOrEqual(3);
    }
  });

  // ----------------------------------------------------------------
  // 9. Does not duplicate visible text into aria-label (#1113)
  // ----------------------------------------------------------------
  it("does not set an aria-label duplicating the visible headline and body", () => {
    render(<InsightCard insight={achievementInsight} />);

    const article = screen.getByRole("article");
    expect(article).toBeTruthy();
    // No aria-label at all — the visible headline/body provide the
    // accessible name, so a screen reader announces the content once.
    expect(article.hasAttribute("aria-label")).toBe(false);
    expect(screen.getByText("You leveled up to High!")).toBeTruthy();
    expect(screen.getByText("Your consistent effort paid off.")).toBeTruthy();
  });

  // ----------------------------------------------------------------
  // 9b. No card variant sets a redundant full-text aria-label (#1113)
  // ----------------------------------------------------------------
  it("never sets aria-label to headline+body text for any card variant", () => {
    const variants = [
      trendInsight,
      trendDownInsight,
      trendDimensionInsight,
      tipInsight,
      tipNoDimensionInsight,
      achievementInsight,
      nextTierInsight,
    ];

    for (const insight of variants) {
      const { container, unmount } = render(<InsightCard insight={insight} />);
      const article = container.querySelector("[role='article']") as HTMLElement;
      expect(article).toBeTruthy();
      expect(article.hasAttribute("aria-label")).toBe(false);
      unmount();
    }
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
