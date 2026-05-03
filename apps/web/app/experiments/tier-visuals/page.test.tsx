// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

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
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(performance.now() + 1000);
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

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

  it("lets users select tiers and toggle autoplay", async () => {
    const { default: Page } = await import("./page");
    render(<Page />);

    fireEvent.click(screen.getByRole("button", { name: "High" }));
    expect(screen.getByRole("button", { name: "Auto-play off" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Auto-play off" }));
    expect(screen.getByRole("button", { name: "Auto-cycling" })).toBeTruthy();

    await vi.advanceTimersByTimeAsync(3000);
    expect(window.requestAnimationFrame).toHaveBeenCalled();
  });
});
