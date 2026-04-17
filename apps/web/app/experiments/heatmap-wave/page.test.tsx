// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

// Mock the animations module to avoid heavy imports
vi.mock("@/lib/effects/heatmap/animations", () => ({
  VARIANTS: [
    { id: "diagonal", label: "Diagonal", description: "test" },
  ],
  WEEKS: 13,
  DAYS: 7,
  getDelayFn: () => () => 0,
  generateMockHeatmap: () =>
    Array.from({ length: 13 }, () => Array.from({ length: 7 }, () => 0)),
  INTENSITY_COLORS: ["#eee", "#ddd", "#ccc", "#bbb", "#aaa"],
}));

describe("heatmap-wave experiment page", () => {
  it("renders without throwing", async () => {
    const { default: Page } = await import("./page");
    const { container } = render(<Page />);
    expect(container.querySelector("main")).toBeTruthy();
  }, 15000);
});
