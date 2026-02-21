// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { GradientBorder, GRADIENT_BORDER_CSS } from "./GradientBorder";

describe("GradientBorder", () => {
  describe("rendering", () => {
    it("renders without crashing", () => {
      const { container } = render(
        <GradientBorder>
          <div>Child content</div>
        </GradientBorder>,
      );
      expect(container.firstChild).toBeTruthy();
    });

    it("renders children", () => {
      render(
        <GradientBorder>
          <span data-testid="child">Hello</span>
        </GradientBorder>,
      );
      expect(screen.getByTestId("child")).toBeTruthy();
    });

    it("renders an aria-hidden gradient border element", () => {
      const { container } = render(
        <GradientBorder>
          <div>content</div>
        </GradientBorder>,
      );
      const border = container.querySelector("[aria-hidden='true']");
      expect(border).not.toBeNull();
      expect(border?.className).toContain("animated-gradient-border");
    });

    it("applies wrapper class", () => {
      const { container } = render(
        <GradientBorder>
          <div>content</div>
        </GradientBorder>,
      );
      expect(container.firstChild).toHaveProperty("className");
      const wrapper = container.querySelector(".animated-border-wrapper");
      expect(wrapper).not.toBeNull();
    });
  });

  describe("enabled prop", () => {
    it("does not pause animation when enabled (default)", () => {
      const { container } = render(
        <GradientBorder>
          <div>content</div>
        </GradientBorder>,
      );
      const border = container.querySelector(".animated-gradient-border") as HTMLElement;
      expect(border.style.animationPlayState).not.toBe("paused");
    });

    it("pauses animation when disabled", () => {
      const { container } = render(
        <GradientBorder enabled={false}>
          <div>content</div>
        </GradientBorder>,
      );
      const border = container.querySelector(".animated-gradient-border") as HTMLElement;
      expect(border.style.animationPlayState).toBe("paused");
    });
  });

  describe("speed prop", () => {
    it("uses default speed of 4s", () => {
      const { container } = render(
        <GradientBorder>
          <div>content</div>
        </GradientBorder>,
      );
      const border = container.querySelector(".animated-gradient-border") as HTMLElement;
      expect(border.style.animationDuration).toBe("4s");
    });

    it("uses custom speed", () => {
      const { container } = render(
        <GradientBorder speed={8}>
          <div>content</div>
        </GradientBorder>,
      );
      const border = container.querySelector(".animated-gradient-border") as HTMLElement;
      expect(border.style.animationDuration).toBe("8s");
    });
  });

  describe("className prop", () => {
    it("passes custom className to wrapper", () => {
      const { container } = render(
        <GradientBorder className="my-custom-class">
          <div>content</div>
        </GradientBorder>,
      );
      const wrapper = container.querySelector(".animated-border-wrapper");
      expect(wrapper?.className).toContain("my-custom-class");
    });
  });

  describe("re-export", () => {
    it("re-exports GRADIENT_BORDER_CSS", () => {
      expect(typeof GRADIENT_BORDER_CSS).toBe("string");
      expect(GRADIENT_BORDER_CSS.length).toBeGreaterThan(0);
    });
  });
});
