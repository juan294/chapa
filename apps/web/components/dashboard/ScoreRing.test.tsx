// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScoreRing } from "./ScoreRing";

vi.mock("@/lib/effects/counters/use-in-view", () => ({
  useInView: () => true,
}));

describe("ScoreRing", () => {
  it("renders SVG at correct size", () => {
    const { container } = render(
      <ScoreRing value={50} size={200} color="#7C6AEF" />
    );

    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute("width")).toBe("200");
    expect(svg?.getAttribute("height")).toBe("200");
  });

  it("renders track circle with correct attributes", () => {
    const { container } = render(
      <ScoreRing value={50} size={200} strokeWidth={8} color="#7C6AEF" />
    );

    const circles = container.querySelectorAll("circle");
    // First circle is the track (background)
    const track = circles[0];
    expect(track).toBeTruthy();
    expect(track?.getAttribute("cx")).toBe("100");
    expect(track?.getAttribute("cy")).toBe("100");
    expect(track?.getAttribute("r")).toBe("96");
    expect(track?.getAttribute("fill")).toBe("none");
    expect(track?.getAttribute("stroke-width")).toBe("8");
  });

  it("calculates stroke-dashoffset correctly for value=75 out of 100", () => {
    const { container } = render(
      <ScoreRing value={75} size={200} strokeWidth={8} color="#7C6AEF" />
    );

    const circles = container.querySelectorAll("circle");
    // Second circle is the value arc
    const valueCircle = circles[1];
    expect(valueCircle).toBeTruthy();

    // radius = (200 - 8) / 2 = 96
    // circumference = 2 * PI * 96 = 603.18...
    const radius = 96;
    const circumference = 2 * Math.PI * radius;
    const expectedOffset = circumference * (1 - 75 / 100);

    expect(valueCircle?.style.strokeDasharray).toBe(String(circumference));
    expect(Number(valueCircle?.style.strokeDashoffset)).toBeCloseTo(
      expectedOffset,
      1
    );
  });

  it("renders children inside the ring", () => {
    render(
      <ScoreRing value={50} size={200} color="#7C6AEF">
        <span data-testid="inner-content">75</span>
      </ScoreRing>
    );

    expect(screen.getByTestId("inner-content")).toBeTruthy();
    expect(screen.getByTestId("inner-content").textContent).toBe("75");
  });

  it("applies the color prop to the value circle stroke", () => {
    const { container } = render(
      <ScoreRing value={50} size={200} color="#FF5500" />
    );

    const circles = container.querySelectorAll("circle");
    const valueCircle = circles[1];
    expect(valueCircle?.getAttribute("stroke")).toBe("#FF5500");
  });

  it("renders with default strokeWidth=8 when not specified", () => {
    const { container } = render(
      <ScoreRing value={50} size={200} color="#7C6AEF" />
    );

    const circles = container.querySelectorAll("circle");
    const track = circles[0];
    const valueCircle = circles[1];

    expect(track?.getAttribute("stroke-width")).toBe("8");
    expect(valueCircle?.getAttribute("stroke-width")).toBe("8");
  });

  it("calculates correctly for custom maxValue", () => {
    const { container } = render(
      <ScoreRing
        value={50}
        maxValue={200}
        size={200}
        strokeWidth={8}
        color="#7C6AEF"
      />
    );

    const circles = container.querySelectorAll("circle");
    const valueCircle = circles[1];

    // value=50, maxValue=200 -> 25% fill
    const radius = 96;
    const circumference = 2 * Math.PI * radius;
    const expectedOffset = circumference * (1 - 50 / 200);

    expect(Number(valueCircle?.style.strokeDashoffset)).toBeCloseTo(
      expectedOffset,
      1
    );
  });
});
