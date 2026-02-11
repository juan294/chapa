import { describe, it, expect } from "vitest";
import { computeTilt } from "./use-tilt";

const RECT = { left: 100, top: 200, width: 600, height: 300 };

describe("computeTilt", () => {
  it("returns zero rotation when mouse is at center", () => {
    // Center of the rect: left+width/2 = 400, top+height/2 = 350
    const result = computeTilt(400, 350, RECT, 15);
    expect(result.rotateX).toBeCloseTo(0);
    expect(result.rotateY).toBeCloseTo(0);
    expect(result.isHovering).toBe(true);
  });

  it("tilts forward (negative rotateX) when mouse is at bottom edge", () => {
    // Bottom center: x=400, y=500 (top + height)
    const result = computeTilt(400, 500, RECT, 15);
    expect(result.rotateX).toBeCloseTo(-15);
    expect(result.rotateY).toBeCloseTo(0);
  });

  it("tilts backward (positive rotateX) when mouse is at top edge", () => {
    // Top center: x=400, y=200 (top)
    const result = computeTilt(400, 200, RECT, 15);
    expect(result.rotateX).toBeCloseTo(15);
    expect(result.rotateY).toBeCloseTo(0);
  });

  it("tilts right (positive rotateY) when mouse is at right edge", () => {
    // Right center: x=700 (left + width), y=350
    const result = computeTilt(700, 350, RECT, 15);
    expect(result.rotateX).toBeCloseTo(0);
    expect(result.rotateY).toBeCloseTo(15);
  });

  it("tilts left (negative rotateY) when mouse is at left edge", () => {
    // Left center: x=100 (left), y=350
    const result = computeTilt(100, 350, RECT, 15);
    expect(result.rotateX).toBeCloseTo(0);
    expect(result.rotateY).toBeCloseTo(-15);
  });

  it("respects maxTilt parameter", () => {
    const result = computeTilt(700, 500, RECT, 25);
    expect(result.rotateX).toBeCloseTo(-25);
    expect(result.rotateY).toBeCloseTo(25);
  });

  it("computes mouse position percentages for glare", () => {
    // Top-left corner: x=100, y=200 -> 0%, 0%
    const topLeft = computeTilt(100, 200, RECT, 15);
    expect(topLeft.mouseX).toBe("0%");
    expect(topLeft.mouseY).toBe("0%");

    // Bottom-right corner: x=700, y=500 -> 100%, 100%
    const bottomRight = computeTilt(700, 500, RECT, 15);
    expect(bottomRight.mouseX).toBe("100%");
    expect(bottomRight.mouseY).toBe("100%");

    // Center: 50%, 50%
    const center = computeTilt(400, 350, RECT, 15);
    expect(center.mouseX).toBe("50%");
    expect(center.mouseY).toBe("50%");
  });

  it("always returns isHovering true", () => {
    const result = computeTilt(400, 350, RECT, 15);
    expect(result.isHovering).toBe(true);
  });
});
