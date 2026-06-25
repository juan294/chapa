// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  act,
} from "@testing-library/react";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "page.tsx"),
  "utf-8",
);

// Mock requestAnimationFrame for counter animations
beforeEach(() => {
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
    cb(performance.now());
    return 0;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
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

  it("updates global animation controls and replays all counters", async () => {
    const { default: Page } = await import("./page");
    render(<Page />);

    fireEvent.click(screen.getByRole("button", { name: "Spring" }));
    fireEvent.change(screen.getByLabelText(/Duration:/), {
      target: { value: "3000" },
    });
    fireEvent.change(screen.getByLabelText("Target Value"), {
      target: { value: "91" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Replay All" }));

    expect(screen.getByText("3000ms")).toBeTruthy();
    expect(screen.getByDisplayValue("91")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Target Value"), {
      target: { value: "10000" },
    });
    expect(screen.getByDisplayValue("91")).toBeTruthy();
  });

  it("hero score aria-label uses i18n key (not hardcoded English)", () => {
    // Verify the page uses the i18n aria.impactScoreValue key instead of a
    // hardcoded template literal `Impact score: ${hero.value}`.
    expect(SOURCE).toContain("aria.impactScoreValue");
    expect(SOURCE).not.toMatch(/aria-label=\{`Impact score: \$/);
  });

  it("animates in-view counters when sections intersect", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(
          private readonly callback: IntersectionObserverCallback,
        ) {}

        observe = vi.fn(() => {
          this.callback(
            [{ isIntersecting: true } as IntersectionObserverEntry],
            this as unknown as IntersectionObserver,
          );
        });
        disconnect = vi.fn();
        unobserve = vi.fn();
      },
    );

    const { default: Page } = await import("./page");
    render(<Page />);

    await act(() => vi.runAllTimersAsync());

    expect(screen.getByText("Stars")).toBeTruthy();
    expect(screen.getAllByText("Confidence").length).toBeGreaterThan(1);
  });
});
