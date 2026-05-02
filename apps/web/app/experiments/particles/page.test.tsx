// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/components/badge/BadgeContent", () => ({
  BadgeContent: () => <div data-testid="badge-content">badge</div>,
  getBadgeContentCSS: () => [""],
}));

// Mock matchMedia for reduced motion check
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

// Mock canvas 2D context
HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
  clearRect: vi.fn(),
  beginPath: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  setTransform: vi.fn(),
  fillStyle: "",
  strokeStyle: "",
  lineWidth: 0,
});

HTMLCanvasElement.prototype.getBoundingClientRect = vi.fn(
  () =>
    ({
      left: 0,
      top: 0,
      width: 420,
      height: 240,
      right: 420,
      bottom: 240,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect,
);

describe("particles experiment page", () => {
  beforeEach(() => {
    let rafCalls = 0;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      rafCalls += 1;
      if (rafCalls <= 2) {
        cb(performance.now() + 16);
      }
      return rafCalls;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders without throwing", async () => {
    const { default: Page } = await import("./page");
    const { container } = render(<Page />);
    expect(container.querySelector("div")).toBeTruthy();
  });

  it("updates playground controls and handles canvas interactions", async () => {
    const { default: Page } = await import("./page");
    const { container, unmount } = render(<Page />);

    fireEvent.change(screen.getByLabelText(/Particles:/), {
      target: { value: "120" },
    });
    fireEvent.change(screen.getByLabelText(/Speed:/), {
      target: { value: "0.8" },
    });
    fireEvent.change(screen.getByLabelText(/Size:/), {
      target: { value: "4" },
    });
    fireEvent.change(screen.getByLabelText("Max radius"), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Gold" }));
    fireEvent.click(screen.getByLabelText("Connections"));
    fireEvent.click(screen.getByLabelText("Mouse Repulsion"));

    expect(screen.getByText("120")).toBeTruthy();
    expect(screen.getByText("0.8")).toBeTruthy();
    expect(screen.getByText("2-2px")).toBeTruthy();

    const canvas = container.querySelector("canvas")!;
    fireEvent.mouseMove(canvas, { clientX: 120, clientY: 90 });
    fireEvent.mouseLeave(canvas);
    fireEvent(window, new Event("resize"));

    expect(window.requestAnimationFrame).toHaveBeenCalled();

    unmount();
    expect(window.cancelAnimationFrame).toHaveBeenCalled();
  });
});
