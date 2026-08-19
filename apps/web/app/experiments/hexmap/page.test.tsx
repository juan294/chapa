// @vitest-environment jsdom
import { afterEach, describe, it, expect } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import HexmapExperimentPage from "./page";

afterEach(cleanup);

describe("HexmapExperimentPage — no hardcoded colors", () => {
  it("legend swatches use CSS variables for dimension colors, not hardcoded hex", () => {
    render(<HexmapExperimentPage />);

    const swatches = Array.from(
      document.querySelectorAll(".h-2\\.5.w-2\\.5.rounded-full"),
    ).filter((el) => (el as HTMLElement).style.backgroundColor);
    expect(swatches).toHaveLength(4);
    const expectedVars = [
      "var(--color-dimension-delivery)",
      "var(--color-dimension-quality)",
      "var(--color-dimension-consistency)",
      "var(--color-dimension-breadth)",
    ];
    swatches.forEach((swatch, i) => {
      const bg = (swatch as HTMLElement).style.backgroundColor;
      expect(bg).toBe(expectedVars[i]);
      expect(bg).not.toMatch(/^#/);
    });
  });

  it("uses bg-dark-section (not a hardcoded hex) for the glow variant's showcase background", () => {
    render(<HexmapExperimentPage />);

    fireEvent.click(
      screen.getAllByRole("button", { name: "Radial Glow" })[0]!,
    );

    const heading = screen.getByRole("heading", {
      level: 2,
      name: "Radial Glow",
    });
    const showcase = heading.closest("div")!.parentElement as HTMLElement;
    expect(showcase.className).toContain("bg-dark-section");
    expect(showcase.className).not.toMatch(/#06060A/i);
  });

  it("does not use hardcoded rgba() colors for cell backgrounds — uses CSS variable / color-mix tokens instead", () => {
    render(<HexmapExperimentPage />);

    // Sample every rendered hex cell across all 4 showcase grids (dominant,
    // blend, glow, and the "all variants" comparison row) — this would fail
    // if DIMENSION_COLORS or cssVarAlpha reverted to emitting raw rgba().
    const grids = screen.getAllByRole("img", { name: /Hexagonal heatmap/ });
    const cells = grids.flatMap((grid) =>
      Array.from(grid.querySelectorAll("div[style]")),
    );
    expect(cells.length).toBeGreaterThan(0);
    for (const cell of cells) {
      const bg = (cell as HTMLElement).style.background;
      if (bg) {
        expect(bg).not.toMatch(/^rgba\(/);
      }
    }
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
