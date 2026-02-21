import { describe, it, expect } from "vitest";
import { GRADIENT_BORDER_CSS } from "./gradient-border-css";

describe("gradient-border-css", () => {
  it("exports a non-empty CSS string", () => {
    expect(typeof GRADIENT_BORDER_CSS).toBe("string");
    expect(GRADIENT_BORDER_CSS.length).toBeGreaterThan(0);
  });

  it("defines the @property for --gradient-angle", () => {
    expect(GRADIENT_BORDER_CSS).toContain("@property --gradient-angle");
  });

  it("contains rotate-gradient-border keyframes", () => {
    expect(GRADIENT_BORDER_CSS).toContain("@keyframes rotate-gradient-border");
  });

  it("defines the .animated-gradient-border class", () => {
    expect(GRADIENT_BORDER_CSS).toContain(".animated-gradient-border");
  });

  it("uses conic-gradient for the border effect", () => {
    expect(GRADIENT_BORDER_CSS).toContain("conic-gradient");
  });

  it("includes a fallback for browsers without @property support", () => {
    expect(GRADIENT_BORDER_CSS).toContain("@supports not");
    expect(GRADIENT_BORDER_CSS).toContain("linear-gradient");
    expect(GRADIENT_BORDER_CSS).toContain("gradient-shift-fallback");
  });

  it("includes reduced-motion media query", () => {
    expect(GRADIENT_BORDER_CSS).toContain("prefers-reduced-motion");
    expect(GRADIENT_BORDER_CSS).toContain("animation: none");
  });

  it("rotates from 0deg to 360deg", () => {
    expect(GRADIENT_BORDER_CSS).toContain("0deg");
    expect(GRADIENT_BORDER_CSS).toContain("360deg");
  });

  it("uses the project accent colors", () => {
    expect(GRADIENT_BORDER_CSS).toContain("#5E4FCC");
    expect(GRADIENT_BORDER_CSS).toContain("#7C6AEF");
    expect(GRADIENT_BORDER_CSS).toContain("#9D8FFF");
  });
});
