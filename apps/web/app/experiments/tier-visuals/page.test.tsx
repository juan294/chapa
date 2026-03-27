// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

// Mock matchMedia for reduced motion check (used in tier transition)
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

describe("tier-visuals experiment page", () => {
  it("renders without throwing", async () => {
    const { default: Page } = await import("./page");
    const { container } = render(<Page />);
    expect(container.querySelector("div")).toBeTruthy();
  });

  it("renders h1 before any h2 in DOM order", async () => {
    const { default: Page } = await import("./page");
    const { container } = render(<Page />);
    const headings = container.querySelectorAll("h1, h2");
    expect(headings.length).toBeGreaterThanOrEqual(2);
    expect(headings[0]!.tagName).toBe("H1");
    for (let i = 1; i < headings.length; i++) {
      expect(headings[i]!.tagName).toBe("H2");
    }
  });
});
