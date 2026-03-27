// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";

// Mock requestAnimationFrame for counter animations
beforeEach(() => {
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
    cb(performance.now());
    return 0;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
});

// Mock matchMedia for reduced motion check
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: true, // Prefer reduced motion to skip animation loops
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver for useInView
vi.stubGlobal(
  "IntersectionObserver",
  class {
    observe = vi.fn();
    disconnect = vi.fn();
    unobserve = vi.fn();
  },
);

describe("number-counters experiment page", () => {
  it("renders without throwing", async () => {
    const { default: Page } = await import("./page");
    let container: HTMLElement;
    await act(async () => {
      const result = render(<Page />);
      container = result.container;
    });
    expect(container!.querySelector("div")).toBeTruthy();
  });

  it("renders h1 before any h2 in DOM order", async () => {
    const { default: Page } = await import("./page");
    let container: HTMLElement;
    await act(async () => {
      const result = render(<Page />);
      container = result.container;
    });
    const headings = container!.querySelectorAll("h1, h2");
    expect(headings.length).toBeGreaterThanOrEqual(2);
    expect(headings[0]!.tagName).toBe("H1");
    for (let i = 1; i < headings.length; i++) {
      expect(headings[i]!.tagName).toBe("H2");
    }
  });
});
