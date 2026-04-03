// @vitest-environment jsdom
import { render, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock matchMedia before importing the component
const matchMediaMock = vi.fn().mockReturnValue({ matches: false });
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: matchMediaMock,
});

import { ClaudeCodeStar } from "./ClaudeCodeStar";

describe("ClaudeCodeStar", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    matchMediaMock.mockReturnValue({ matches: false });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the first frame (*) on initial mount", () => {
    const { container } = render(<ClaudeCodeStar />);
    expect(container.textContent).toBe("*");
  });

  it("advances to · after one interval", () => {
    const { container } = render(<ClaudeCodeStar />);
    act(() => { vi.advanceTimersByTime(400); });
    expect(container.textContent).toBe("·");
  });

  it("advances to | after two intervals", () => {
    const { container } = render(<ClaudeCodeStar />);
    act(() => { vi.advanceTimersByTime(800); });
    expect(container.textContent).toBe("|");
  });

  it("advances to L after three intervals", () => {
    const { container } = render(<ClaudeCodeStar />);
    act(() => { vi.advanceTimersByTime(1200); });
    expect(container.textContent).toBe("L");
  });

  it("wraps back to * after four intervals", () => {
    const { container } = render(<ClaudeCodeStar />);
    act(() => { vi.advanceTimersByTime(1600); });
    expect(container.textContent).toBe("*");
  });

  it("stays on * when prefers-reduced-motion is set", () => {
    matchMediaMock.mockReturnValue({ matches: true });

    const { container } = render(<ClaudeCodeStar />);
    act(() => { vi.advanceTimersByTime(1600); });
    expect(container.textContent).toBe("*");
  });
});
