// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { computeTilt, useTilt } from "./use-tilt";

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

describe("useTilt", () => {
  it("returns a ref object", () => {
    const { result } = renderHook(() => useTilt());
    expect(result.current.ref).toBeDefined();
    expect(result.current.ref.current).toBeNull();
  });

  it("returns initial idle tilt state", () => {
    const { result } = renderHook(() => useTilt());
    expect(result.current.tilt).toEqual({
      rotateX: 0,
      rotateY: 0,
      mouseX: "50%",
      mouseY: "50%",
      isHovering: false,
    });
  });

  it("returns handleMouseMove function", () => {
    const { result } = renderHook(() => useTilt());
    expect(typeof result.current.handleMouseMove).toBe("function");
  });

  it("returns handleMouseLeave function", () => {
    const { result } = renderHook(() => useTilt());
    expect(typeof result.current.handleMouseLeave).toBe("function");
  });

  it("accepts custom maxTilt parameter", () => {
    const { result } = renderHook(() => useTilt(25));
    // Hook should still return the same structure
    expect(result.current.tilt.rotateX).toBe(0);
    expect(result.current.tilt.rotateY).toBe(0);
  });

  it("resets tilt state on mouse leave", () => {
    const { result } = renderHook(() => useTilt());

    act(() => {
      result.current.handleMouseLeave();
    });

    expect(result.current.tilt).toEqual({
      rotateX: 0,
      rotateY: 0,
      mouseX: "50%",
      mouseY: "50%",
      isHovering: false,
    });
  });

  it("updates tilt state on mouse move when ref has an element", () => {
    const { result } = renderHook(() => useTilt(15));

    // Attach a div to the ref with a mocked getBoundingClientRect
    const div = document.createElement("div");
    Object.defineProperty(div, "getBoundingClientRect", {
      value: () => ({
        left: 100,
        top: 200,
        width: 600,
        height: 300,
        right: 700,
        bottom: 500,
        x: 100,
        y: 200,
        toJSON: () => {},
      }),
    });

    // Set the ref manually
    (result.current.ref as { current: HTMLDivElement }).current = div;

    // Simulate mouse move at the center
    act(() => {
      result.current.handleMouseMove({
        clientX: 400,
        clientY: 350,
      } as React.MouseEvent);
    });

    expect(result.current.tilt.isHovering).toBe(true);
    expect(result.current.tilt.rotateX).toBeCloseTo(0);
    expect(result.current.tilt.rotateY).toBeCloseTo(0);
    expect(result.current.tilt.mouseX).toBe("50%");
    expect(result.current.tilt.mouseY).toBe("50%");
  });

  it("ignores mouse move when ref is null", () => {
    const { result } = renderHook(() => useTilt());

    // Ref is null by default; handleMouseMove should not crash
    act(() => {
      result.current.handleMouseMove({
        clientX: 200,
        clientY: 300,
      } as React.MouseEvent);
    });

    // Tilt should remain at idle
    expect(result.current.tilt.isHovering).toBe(false);
  });

  it("computes tilt proportional to mouse offset from center", () => {
    const { result } = renderHook(() => useTilt(15));

    const div = document.createElement("div");
    Object.defineProperty(div, "getBoundingClientRect", {
      value: () => ({
        left: 0,
        top: 0,
        width: 200,
        height: 200,
        right: 200,
        bottom: 200,
        x: 0,
        y: 0,
        toJSON: () => {},
      }),
    });
    (result.current.ref as { current: HTMLDivElement }).current = div;

    // Mouse at bottom-right corner: full tilt in both axes
    act(() => {
      result.current.handleMouseMove({
        clientX: 200,
        clientY: 200,
      } as React.MouseEvent);
    });

    expect(result.current.tilt.rotateX).toBeCloseTo(-15);
    expect(result.current.tilt.rotateY).toBeCloseTo(15);
  });
});
