// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { InlineBadgeSvg } from "./InlineBadgeSvg";
import { renderBadgeSvg } from "@/lib/render/BadgeSvg";
import { DEMO_STATS, DEMO_IMPACT } from "@/lib/render/demoData";
import { DEFAULT_BADGE_CONFIG } from "@chapa/shared";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  for (const name of ["pauseAnimations", "unpauseAnimations", "setCurrentTime"]) {
    Reflect.deleteProperty(SVGSVGElement.prototype, name);
  }
});

it("pauses every SMIL effect locally, handles live preference/config changes and preserves the renderer artifact", () => {
  let reduced = true;
  const listeners = new Set<() => void>();
  const remove = vi.fn((listener: () => void) => listeners.delete(listener));
  vi.stubGlobal("matchMedia", vi.fn(() => ({
    get matches() { return reduced; },
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => remove(listener),
  })));
  const pause = vi.fn();
  const unpause = vi.fn();
  const seek = vi.fn();
  Object.defineProperties(SVGSVGElement.prototype, {
    pauseAnimations: { configurable: true, value: pause },
    unpauseAnimations: { configurable: true, value: unpause },
    setCurrentTime: { configurable: true, value: seek },
  });
  const svg = renderBadgeSvg(DEMO_STATS, {
    scoring: DEMO_IMPACT,
    config: { ...DEFAULT_BADGE_CONFIG, background: "aurora", border: "gradient-rotating", scoreEffect: "gold-shimmer" },
  });
  expect(svg).toContain("animateTransform");
  const { container, rerender, unmount } = render(<InlineBadgeSvg svg={svg} />);
  const normalized = document.createElement("div");
  normalized.innerHTML = svg;
  expect(container.firstElementChild?.innerHTML).toBe(normalized.innerHTML);
  expect(pause).toHaveBeenCalledOnce();
  expect(seek).toHaveBeenCalledWith(0);
  reduced = false;
  listeners.forEach(listener => listener());
  expect(unpause).toHaveBeenCalledOnce();
  reduced = true;
  listeners.forEach(listener => listener());
  expect(pause).toHaveBeenCalledTimes(2);
  const next = renderBadgeSvg(DEMO_STATS, { scoring: DEMO_IMPACT, config: { ...DEFAULT_BADGE_CONFIG, background: "particles" } });
  rerender(<InlineBadgeSvg svg={next} />);
  expect(pause).toHaveBeenCalledTimes(3);
  expect(listeners.size).toBe(1);
  unmount();
  expect(listeners.size).toBe(0);
});
