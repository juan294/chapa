// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  ScoreEffectText,
  SCORE_EFFECT_CSS,
  type ScoreEffect,
} from "./ScoreEffectText";

const ALL_EFFECTS: ScoreEffect[] = [
  "standard",
  "gold-shimmer",
  "gold-leaf",
  "chrome",
  "embossed",
  "neon-amber",
  "holographic",
];

describe("ScoreEffectText", () => {
  describe("rendering", () => {
    it("renders without crashing for all effects", () => {
      for (const effect of ALL_EFFECTS) {
        const { container } = render(
          <ScoreEffectText effect={effect}>42</ScoreEffectText>,
        );
        expect(container.firstChild).toBeTruthy();
      }
    });

    it("renders children text", () => {
      render(<ScoreEffectText effect="standard">99</ScoreEffectText>);
      expect(screen.getByText("99")).toBeTruthy();
    });
  });

  describe("standard effect", () => {
    it("renders a span with text-amber class", () => {
      const { container } = render(
        <ScoreEffectText effect="standard">50</ScoreEffectText>,
      );
      const span = container.querySelector("span");
      expect(span?.className).toContain("text-amber");
    });

    it("does not add aria-label for standard effect", () => {
      const { container } = render(
        <ScoreEffectText effect="standard">50</ScoreEffectText>,
      );
      const span = container.querySelector("span");
      expect(span?.getAttribute("aria-label")).toBeNull();
    });
  });

  describe("non-standard effects", () => {
    it("applies te-{effect} class for non-standard effects", () => {
      const nonStandard: ScoreEffect[] = ALL_EFFECTS.filter(
        (e) => e !== "standard",
      );
      for (const effect of nonStandard) {
        const { container } = render(
          <ScoreEffectText effect={effect}>42</ScoreEffectText>,
        );
        const span = container.querySelector("span");
        expect(span?.className).toContain(`te-${effect}`);
      }
    });

    it("sets aria-label with children text for non-standard effects", () => {
      const { container } = render(
        <ScoreEffectText effect="gold-shimmer">85</ScoreEffectText>,
      );
      const span = container.querySelector("span");
      expect(span?.getAttribute("aria-label")).toBe("85");
    });
  });

  describe("className prop", () => {
    it("passes custom className for standard effect", () => {
      const { container } = render(
        <ScoreEffectText effect="standard" className="my-class">
          50
        </ScoreEffectText>,
      );
      const span = container.querySelector("span");
      expect(span?.className).toContain("my-class");
    });

    it("passes custom className for non-standard effect", () => {
      const { container } = render(
        <ScoreEffectText effect="chrome" className="my-class">
          50
        </ScoreEffectText>,
      );
      const span = container.querySelector("span");
      expect(span?.className).toContain("my-class");
    });
  });
});

describe("SCORE_EFFECT_CSS", () => {
  it("is a non-empty string", () => {
    expect(typeof SCORE_EFFECT_CSS).toBe("string");
    expect(SCORE_EFFECT_CSS.length).toBeGreaterThan(0);
  });

  it("defines CSS classes for all non-standard effects", () => {
    const cssEffects = ["gold-leaf", "chrome", "embossed", "gold-shimmer", "neon-amber", "holographic"];
    for (const effect of cssEffects) {
      expect(SCORE_EFFECT_CSS).toContain(`.te-${effect}`);
    }
  });

  it("includes shimmer animation keyframes", () => {
    expect(SCORE_EFFECT_CSS).toContain("@keyframes te-shimmer");
  });

  it("includes holographic animation keyframes", () => {
    expect(SCORE_EFFECT_CSS).toContain("@keyframes te-holo-shift");
  });

  it("includes prefers-reduced-motion support", () => {
    expect(SCORE_EFFECT_CSS).toContain("prefers-reduced-motion");
    expect(SCORE_EFFECT_CSS).toContain("animation: none");
  });

  it("uses background-clip for gradient text effects", () => {
    expect(SCORE_EFFECT_CSS).toContain("background-clip: text");
    expect(SCORE_EFFECT_CSS).toContain("-webkit-background-clip: text");
  });
});
