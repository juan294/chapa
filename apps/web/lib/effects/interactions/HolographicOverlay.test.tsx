// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HolographicOverlay, HOLOGRAPHIC_CSS } from "./HolographicOverlay";

describe("HolographicOverlay", () => {
  describe("rendering", () => {
    it("renders without crashing", () => {
      const { container } = render(
        <HolographicOverlay>
          <div>content</div>
        </HolographicOverlay>,
      );
      expect(container.firstChild).toBeTruthy();
    });

    it("renders children", () => {
      render(
        <HolographicOverlay>
          <span data-testid="child">Hello</span>
        </HolographicOverlay>,
      );
      expect(screen.getByTestId("child")).toBeTruthy();
    });

    it("renders an aria-hidden overlay element", () => {
      const { container } = render(
        <HolographicOverlay>
          <div>content</div>
        </HolographicOverlay>,
      );
      const overlay = container.querySelector("[aria-hidden='true']");
      expect(overlay).not.toBeNull();
      expect(overlay?.className).toContain("holo-overlay");
    });

    it("wraps children in a holo-card container", () => {
      const { container } = render(
        <HolographicOverlay>
          <div>content</div>
        </HolographicOverlay>,
      );
      const card = container.querySelector(".holo-card");
      expect(card).not.toBeNull();
    });
  });

  describe("variant prop", () => {
    it("uses amber variant by default", () => {
      const { container } = render(
        <HolographicOverlay>
          <div>content</div>
        </HolographicOverlay>,
      );
      const overlay = container.querySelector(".holo-overlay");
      expect(overlay?.className).toContain("holo-amber");
    });

    it("applies rainbow variant when specified", () => {
      const { container } = render(
        <HolographicOverlay variant="rainbow">
          <div>content</div>
        </HolographicOverlay>,
      );
      const overlay = container.querySelector(".holo-overlay");
      expect(overlay?.className).toContain("holo-rainbow");
    });
  });

  describe("autoAnimate prop", () => {
    it("adds auto-animate class when autoAnimate is true (default)", () => {
      const { container } = render(
        <HolographicOverlay>
          <div>content</div>
        </HolographicOverlay>,
      );
      const overlay = container.querySelector(".holo-overlay");
      expect(overlay?.className).toContain("auto-animate");
      expect(overlay?.className).toContain("active");
    });

    it("does not add auto-animate class when autoAnimate is false", () => {
      const { container } = render(
        <HolographicOverlay autoAnimate={false}>
          <div>content</div>
        </HolographicOverlay>,
      );
      const overlay = container.querySelector(".holo-overlay");
      expect(overlay?.className).not.toContain("auto-animate");
    });
  });

  describe("CSS custom properties", () => {
    it("sets --holo-intensity custom property", () => {
      const { container } = render(
        <HolographicOverlay intensity={0.7}>
          <div>content</div>
        </HolographicOverlay>,
      );
      const card = container.querySelector(".holo-card") as HTMLElement;
      expect(card.style.getPropertyValue("--holo-intensity")).toBe("0.7");
    });

    it("sets --holo-speed custom property", () => {
      const { container } = render(
        <HolographicOverlay speed={5}>
          <div>content</div>
        </HolographicOverlay>,
      );
      const card = container.querySelector(".holo-card") as HTMLElement;
      expect(card.style.getPropertyValue("--holo-speed")).toBe("5s");
    });

    it("sets initial --holo-angle", () => {
      const { container } = render(
        <HolographicOverlay>
          <div>content</div>
        </HolographicOverlay>,
      );
      const card = container.querySelector(".holo-card") as HTMLElement;
      expect(card.style.getPropertyValue("--holo-angle")).toBe("115deg");
    });
  });

  describe("className prop", () => {
    it("passes custom className to card wrapper", () => {
      const { container } = render(
        <HolographicOverlay className="my-custom">
          <div>content</div>
        </HolographicOverlay>,
      );
      const card = container.querySelector(".holo-card");
      expect(card?.className).toContain("my-custom");
    });
  });

  describe("mouse interactions", () => {
    it("sets hovering state on mouse enter", () => {
      const { container } = render(
        <HolographicOverlay autoAnimate={false}>
          <div>content</div>
        </HolographicOverlay>,
      );
      const card = container.querySelector(".holo-card") as HTMLElement;
      fireEvent.mouseEnter(card);
      const overlay = container.querySelector(".holo-overlay");
      expect(overlay?.className).toContain("active");
    });

    it("clears hovering state on mouse leave", () => {
      const { container } = render(
        <HolographicOverlay autoAnimate={false}>
          <div>content</div>
        </HolographicOverlay>,
      );
      const card = container.querySelector(".holo-card") as HTMLElement;
      fireEvent.mouseEnter(card);
      fireEvent.mouseLeave(card);
      const overlay = container.querySelector(".holo-overlay");
      expect(overlay?.className).not.toContain("active");
    });
  });

  describe("re-export", () => {
    it("re-exports HOLOGRAPHIC_CSS", () => {
      expect(typeof HOLOGRAPHIC_CSS).toBe("string");
      expect(HOLOGRAPHIC_CSS.length).toBeGreaterThan(0);
    });
  });
});
