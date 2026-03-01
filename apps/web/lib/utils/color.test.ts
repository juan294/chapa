import { describe, it, expect } from "vitest";
import { hexToRgba } from "./color";

describe("hexToRgba", () => {
  it("converts a hex color to rgba with full opacity", () => {
    expect(hexToRgba("#FF0000", 1)).toBe("rgba(255, 0, 0, 1)");
  });

  it("converts a hex color to rgba with partial opacity", () => {
    expect(hexToRgba("#7C6AEF", 0.5)).toBe("rgba(124, 106, 239, 0.5)");
  });

  it("handles black", () => {
    expect(hexToRgba("#000000", 0.1)).toBe("rgba(0, 0, 0, 0.1)");
  });

  it("handles white", () => {
    expect(hexToRgba("#FFFFFF", 1)).toBe("rgba(255, 255, 255, 1)");
  });
});
