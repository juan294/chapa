// @vitest-environment jsdom
import { afterEach, describe, it, expect } from "vitest";
import fs from "fs";
import { resolve } from "path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import HexmapExperimentPage from "./page";

const SOURCE = fs.readFileSync(
  resolve(__dirname, "page.tsx"),
  "utf-8"
);

afterEach(cleanup);

describe("HexmapExperimentPage — no hardcoded colors", () => {
  it("uses CSS variables for dimension colors, not hardcoded hex", () => {
    expect(SOURCE).toContain("var(--color-dimension-delivery)");
    expect(SOURCE).toContain("var(--color-dimension-quality)");
    expect(SOURCE).toContain("var(--color-dimension-consistency)");
    expect(SOURCE).toContain("var(--color-dimension-breadth)");

    const dimColorsBlock = SOURCE.match(
      /DIMENSION_COLORS[\s\S]*?};/
    )?.[0] ?? "";
    expect(dimColorsBlock).not.toContain('"#22c55e"');
    expect(dimColorsBlock).not.toContain('"#f97316"');
    expect(dimColorsBlock).not.toContain('"#06b6d4"');
    expect(dimColorsBlock).not.toContain('"#ec4899"');
  });

  it("does not use hardcoded bg-[#06060A] — uses bg-dark-section instead", () => {
    expect(SOURCE).not.toContain("bg-[#06060A]");
  });

  it("does not use hardcoded rgba() colors — uses CSS variable tokens instead", () => {
    // The glow variant's empty cell color should use a CSS variable, not raw rgba()
    // Allowed: rgba() inside cssVarAlpha() calls (those reference CSS variables already)
    // Disallowed: raw string literals like "rgba(255, 255, 255, 0.03)"
    const lines = SOURCE.split("\n");
    const rawRgbaLiterals = lines.filter(
      (line) =>
        line.includes("rgba(") &&
        !line.includes("cssVarAlpha") &&
        !line.includes("//") &&
        !line.includes("/*") &&
        !line.includes("var(--")
    );
    expect(rawRgbaLiterals).toHaveLength(0);
  });
});

describe("HexmapExperimentPage — render behavior", () => {
  it("renders the experiment controls and all heatmap variants", () => {
    render(<HexmapExperimentPage />);

    expect(
      screen.getByRole("heading", { name: "Hexagonal Heatmap" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Dominant Dimension" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Dimension Blend" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Radial Glow" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Replay/ })).toBeTruthy();

    expect(screen.getAllByRole("img", { name: /Hexagonal heatmap/ })).toHaveLength(4);
  });

  it("switches variants and updates the selected showcase", () => {
    render(<HexmapExperimentPage />);

    fireEvent.click(
      screen.getAllByRole("button", { name: "Radial Glow" })[0]!,
    );

    expect(
      screen.getByRole("heading", { level: 2, name: "Radial Glow" }),
    ).toBeTruthy();
    expect(screen.getAllByText(/Dark mode with glowing hexes/).length).toBe(2);
  });

  it("updates the hex size from the slider", () => {
    render(<HexmapExperimentPage />);

    const slider = screen.getByLabelText("Hex Size");
    fireEvent.change(slider, { target: { value: "20" } });

    expect(screen.getByText("20px")).toBeTruthy();
  });

  it("shows and hides a tooltip for contribution cells", () => {
    render(<HexmapExperimentPage />);

    const firstCell = screen
      .getAllByRole("img", { name: /Hexagonal heatmap/ })[0]!
      .querySelector("div")!;

    firstCell.getBoundingClientRect = () =>
      ({
        left: 20,
        top: 160,
        bottom: 182,
        width: 28,
        height: 24,
        right: 48,
        x: 20,
        y: 160,
        toJSON: () => ({}),
      }) as DOMRect;

    fireEvent.mouseEnter(firstCell);
    expect(screen.getByRole("tooltip")).toBeTruthy();

    fireEvent.mouseLeave(firstCell);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});
