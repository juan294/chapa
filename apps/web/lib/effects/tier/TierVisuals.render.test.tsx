// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { SparkleDots, tierPillClasses } from "./TierVisuals";
import type { ImpactTier } from "@chapa/shared";

afterEach(cleanup);

describe("SparkleDots (render)", () => {
  it("renders three sparkle dot elements", () => {
    const { container } = render(<SparkleDots />);
    const dots = container.querySelectorAll(".sparkle-dot");
    expect(dots).toHaveLength(3);
  });

  it("marks all dots as aria-hidden", () => {
    const { container } = render(<SparkleDots />);
    const dots = container.querySelectorAll("[aria-hidden='true']");
    expect(dots).toHaveLength(3);
  });

  it("applies staggered animation delays to each dot", () => {
    const { container } = render(<SparkleDots />);
    const dots = container.querySelectorAll(".sparkle-dot");
    const delays = Array.from(dots).map((d) => (d as HTMLElement).style.animationDelay);
    expect(delays).toEqual(["0s", "0.7s", "1.4s"]);
  });

  it("positions dots with absolute positioning via className", () => {
    const { container } = render(<SparkleDots />);
    const dots = container.querySelectorAll(".sparkle-dot");
    for (const dot of dots) {
      expect(dot.className).toContain("absolute");
    }
  });

  it("applies rounded-full class to all dots", () => {
    const { container } = render(<SparkleDots />);
    const dots = container.querySelectorAll(".sparkle-dot");
    for (const dot of dots) {
      expect(dot.className).toContain("rounded-full");
    }
  });
});

describe("tierPillClasses (exhaustive)", () => {
  it("returns distinct class strings for each tier", () => {
    const tiers: ImpactTier[] = ["Emerging", "Solid", "High", "Elite"];
    const results = tiers.map(tierPillClasses);
    const unique = new Set(results);
    expect(unique.size).toBe(4);
  });

  it("Emerging tier uses token-based background and secondary text", () => {
    const classes = tierPillClasses("Emerging");
    // #1206 — token utilities, not hardcoded rgba: these now track the theme,
    // matching the High/Elite cases that already used bg-amber/10.
    expect(classes).toContain("bg-text-secondary/[0.08]");
    expect(classes).toContain("border-text-secondary/20");
    expect(classes).toContain("text-text-secondary");
  });

  it("Solid tier uses token-based background and primary text", () => {
    const classes = tierPillClasses("Solid");
    expect(classes).toContain("bg-text-primary/[0.06]");
    expect(classes).toContain("border-text-primary/15");
    expect(classes).toContain("text-text-primary");
  });

  it("High tier uses amber accent colors", () => {
    const classes = tierPillClasses("High");
    expect(classes).toContain("bg-amber/10");
    expect(classes).toContain("border-amber/25");
    expect(classes).toContain("text-amber");
  });

  it("Elite tier uses gradient pill and bold white text", () => {
    const classes = tierPillClasses("Elite");
    expect(classes).toContain("tier-elite-pill");
    expect(classes).toContain("border-amber/30");
    expect(classes).toContain("text-white");
    expect(classes).toContain("font-bold");
  });
});
