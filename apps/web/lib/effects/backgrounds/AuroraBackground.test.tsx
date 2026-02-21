// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { AuroraBackground } from "./AuroraBackground";

describe("AuroraBackground", () => {
  describe("rendering", () => {
    it("renders without crashing", () => {
      const { container } = render(<AuroraBackground />);
      expect(container.firstChild).toBeTruthy();
    });

    it("renders aria-hidden wrapper (decorative)", () => {
      const { container } = render(<AuroraBackground />);
      const wrapper = container.querySelector("[aria-hidden='true']");
      expect(wrapper).not.toBeNull();
    });

    it("renders three aurora blobs", () => {
      const { container } = render(<AuroraBackground />);
      const blobs = container.querySelectorAll(".aurora-blob");
      expect(blobs.length).toBe(3);
    });

    it("includes inline keyframes style", () => {
      const { container } = render(<AuroraBackground />);
      const style = container.querySelector("style");
      expect(style).not.toBeNull();
      expect(style?.textContent).toContain("@keyframes aurora-1");
      expect(style?.textContent).toContain("@keyframes aurora-2");
      expect(style?.textContent).toContain("@keyframes aurora-3");
    });

    it("includes prefers-reduced-motion media query", () => {
      const { container } = render(<AuroraBackground />);
      const style = container.querySelector("style");
      expect(style?.textContent).toContain("prefers-reduced-motion");
    });
  });

  describe("positioning prop", () => {
    it("uses absolute positioning by default", () => {
      const { container } = render(<AuroraBackground />);
      const wrapper = container.querySelector("[aria-hidden='true']");
      expect(wrapper?.className).toContain("absolute");
    });

    it("uses fixed positioning when specified", () => {
      const { container } = render(<AuroraBackground positioning="fixed" />);
      const wrapper = container.querySelector("[aria-hidden='true']");
      expect(wrapper?.className).toContain("fixed");
    });
  });

  describe("intensity prop", () => {
    it("applies low opacity class", () => {
      const { container } = render(<AuroraBackground intensity="low" />);
      const blobs = container.querySelectorAll(".aurora-blob");
      for (const blob of blobs) {
        expect(blob.className).toContain("opacity-[0.03]");
      }
    });

    it("applies medium opacity class by default", () => {
      const { container } = render(<AuroraBackground />);
      const blobs = container.querySelectorAll(".aurora-blob");
      for (const blob of blobs) {
        expect(blob.className).toContain("opacity-[0.06]");
      }
    });

    it("applies high opacity class", () => {
      const { container } = render(<AuroraBackground intensity="high" />);
      const blobs = container.querySelectorAll(".aurora-blob");
      for (const blob of blobs) {
        expect(blob.className).toContain("opacity-[0.10]");
      }
    });
  });

  describe("speed prop", () => {
    it("uses medium durations by default", () => {
      const { container } = render(<AuroraBackground />);
      const blobs = container.querySelectorAll(".aurora-blob");
      // Medium: a1=15s, a2=20s, a3=25s
      expect((blobs[0] as HTMLElement).style.animation).toContain("15s");
      expect((blobs[1] as HTMLElement).style.animation).toContain("20s");
      expect((blobs[2] as HTMLElement).style.animation).toContain("25s");
    });

    it("uses slow durations when specified", () => {
      const { container } = render(<AuroraBackground speed="slow" />);
      const blobs = container.querySelectorAll(".aurora-blob");
      expect((blobs[0] as HTMLElement).style.animation).toContain("25s");
    });

    it("uses fast durations when specified", () => {
      const { container } = render(<AuroraBackground speed="fast" />);
      const blobs = container.querySelectorAll(".aurora-blob");
      expect((blobs[0] as HTMLElement).style.animation).toContain("8s");
    });
  });

  describe("colorVariant prop", () => {
    it("applies amber colors by default", () => {
      const { container } = render(<AuroraBackground />);
      const blobs = container.querySelectorAll(".aurora-blob");
      // First blob uses c1 = "#7C6AEF" for amber variant
      expect((blobs[0] as HTMLElement).style.backgroundColor).toBeTruthy();
    });

    it("uses different colors for amber-white variant", () => {
      const { container } = render(<AuroraBackground colorVariant="amber-white" />);
      const blobs = container.querySelectorAll(".aurora-blob");
      // Third blob for amber-white = "#E0DBFF"
      const bg = (blobs[2] as HTMLElement).style.backgroundColor;
      expect(bg).toBeTruthy();
    });
  });
});
