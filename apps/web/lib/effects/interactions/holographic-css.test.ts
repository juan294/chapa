import { describe, it, expect } from "vitest";
import { HOLOGRAPHIC_CSS } from "./holographic-css";

describe("holographic-css", () => {
  it("exports a non-empty CSS string", () => {
    expect(typeof HOLOGRAPHIC_CSS).toBe("string");
    expect(HOLOGRAPHIC_CSS.length).toBeGreaterThan(0);
  });

  it("defines .holo-card class", () => {
    expect(HOLOGRAPHIC_CSS).toContain(".holo-card");
  });

  it("defines .holo-overlay class", () => {
    expect(HOLOGRAPHIC_CSS).toContain(".holo-overlay");
  });

  it("defines .holo-amber variant", () => {
    expect(HOLOGRAPHIC_CSS).toContain(".holo-amber");
  });

  it("defines .holo-rainbow variant", () => {
    expect(HOLOGRAPHIC_CSS).toContain(".holo-rainbow");
  });

  it("defines active state with opacity", () => {
    expect(HOLOGRAPHIC_CSS).toContain(".holo-overlay.active");
    expect(HOLOGRAPHIC_CSS).toContain("--holo-intensity");
  });

  it("defines auto-animate animation", () => {
    expect(HOLOGRAPHIC_CSS).toContain(".holo-overlay.auto-animate.active");
    expect(HOLOGRAPHIC_CSS).toContain("holo-shift");
  });

  it("contains holo-shift keyframes", () => {
    expect(HOLOGRAPHIC_CSS).toContain("@keyframes holo-shift");
  });

  it("includes prefers-reduced-motion media query", () => {
    expect(HOLOGRAPHIC_CSS).toContain("prefers-reduced-motion");
    expect(HOLOGRAPHIC_CSS).toContain("animation: none");
  });

  it("uses --holo-angle CSS variable for gradient direction", () => {
    expect(HOLOGRAPHIC_CSS).toContain("var(--holo-angle");
  });

  it("uses --holo-speed CSS variable for animation duration", () => {
    expect(HOLOGRAPHIC_CSS).toContain("var(--holo-speed");
  });

  it("holo-card hover shows accent border color", () => {
    expect(HOLOGRAPHIC_CSS).toContain(".holo-card:hover");
    expect(HOLOGRAPHIC_CSS).toContain("border-color");
  });

  it("overlay uses mix-blend-mode for effect", () => {
    expect(HOLOGRAPHIC_CSS).toContain("mix-blend-mode");
  });

  it("overlay is pointer-events-none", () => {
    expect(HOLOGRAPHIC_CSS).toContain("pointer-events: none");
  });
});
