// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

vi.mock("@/components/badge/BadgeContent", () => ({
  BadgeContent: () => <div data-testid="badge-content">badge</div>,
}));

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
}) as unknown as typeof HTMLCanvasElement.prototype.getContext;

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

describe("particles ParticleCanvas / ParticleSection", () => {
  beforeEach(() => {
    let rafCalls = 0;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      rafCalls += 1;
      if (rafCalls <= 2) cb(performance.now() + 16);
      return rafCalls;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders the canvas, badge overlay, and starts the animation loop", async () => {
    const { ParticleCanvas, CONSTELLATION_CONFIG } = await loadModule();
    const { container, unmount } = render(
      <ParticleCanvas config={CONSTELLATION_CONFIG} />,
    );
    expect(container.querySelector("canvas")).toBeTruthy();
    expect(container.querySelector('[data-testid="badge-content"]')).toBeTruthy();
    expect(window.requestAnimationFrame).toHaveBeenCalled();
    unmount();
    expect(window.cancelAnimationFrame).toHaveBeenCalled();
  });

  it("applies the height override (playground uses a taller canvas)", async () => {
    const { ParticleCanvas, DOTS_CONFIG } = await loadModule();
    const { container } = render(
      <ParticleCanvas config={DOTS_CONFIG} height="h-[460px]" />,
    );
    expect(container.querySelector(".h-\\[460px\\]")).toBeTruthy();
  });

  it("ParticleSection renders its title and description heading", async () => {
    const { ParticleSection, DOTS_CONFIG } = await loadModule();
    const { container } = render(
      <ParticleSection
        title="1. Floating Dots"
        description="Subtle floating dots."
        config={DOTS_CONFIG}
      />,
    );
    expect(container.querySelector("h2")?.textContent).toBe("1. Floating Dots");
    expect(container.textContent).toContain("Subtle floating dots.");
  });
});

async function loadModule() {
  const canvas = await import("./ParticleCanvas");
  const core = await import("./particle-core");
  return { ...canvas, ...core };
}
