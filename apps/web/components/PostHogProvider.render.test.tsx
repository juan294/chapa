// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, cleanup, fireEvent, act } from "@testing-library/react";
import PostHogProvider from "./PostHogProvider";

const { mockInit, mockSetPosthogInstance } = vi.hoisted(() => ({
  mockInit: vi.fn(),
  mockSetPosthogInstance: vi.fn(),
}));

vi.mock("@/lib/analytics/posthog", () => ({
  setPosthogInstance: mockSetPosthogInstance,
}));

// Hoisted (not `vi.doMock` inside a single test) so every test — regardless
// of shuffle order — sees the same mocked "posthog-js", never the real
// package. A scoped `vi.doMock` call used to only take effect for tests
// declared after it, which made dynamic-import resolution timing (and which
// tests observed the mock vs. the real module) depend on declaration order.
vi.mock("posthog-js", () => ({ default: { init: mockInit } }));

function renderProvider(children: React.ReactNode) {
  return render(<PostHogProvider>{children}</PostHogProvider>);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  // Default: env vars present
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test_key");
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://ph.example.com");
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("PostHogProvider", () => {
  it("renders children", () => {
    const { container } = renderProvider(
      <div data-testid="child">Hello</div>,
    );
    expect(container.querySelector("[data-testid='child']")).not.toBeNull();
  });

  it("renders PostHogInit component (returns null visually)", () => {
    const { container } = renderProvider(<span>Content</span>);
    // The children should be the only visible content
    expect(container.textContent).toBe("Content");
  });

  it("does not load PostHog when env vars are missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "");

    renderProvider(<span>Test</span>);

    // Trigger interaction — should not load PostHog
    fireEvent.click(document.body);
    await act(() => vi.advanceTimersByTimeAsync(6000));

    // No dynamic import should have been attempted
    expect(mockInit).not.toHaveBeenCalled();
  });

  it("adds event listeners for deferred loading when env vars are set", () => {
    const addSpy = vi.spyOn(window, "addEventListener");

    renderProvider(<span>Test</span>);

    const eventTypes = addSpy.mock.calls.map((c) => c[0]);
    expect(eventTypes).toContain("click");
    expect(eventTypes).toContain("scroll");
    expect(eventTypes).toContain("keydown");

    addSpy.mockRestore();
  });

  it("removes event listeners on unmount", () => {
    const removeSpy = vi.spyOn(window, "removeEventListener");

    const { unmount } = renderProvider(<span>Test</span>);
    unmount();

    const eventTypes = removeSpy.mock.calls.map((c) => c[0]);
    expect(eventTypes).toContain("click");
    expect(eventTypes).toContain("scroll");
    expect(eventTypes).toContain("keydown");

    removeSpy.mockRestore();
  });

  it("loads PostHog on user click interaction", async () => {
    renderProvider(<span>Test</span>);

    fireEvent.click(document.body);

    // Allow the dynamic import + its `.then()` to resolve
    await act(() => vi.advanceTimersByTimeAsync(0));

    expect(mockInit).toHaveBeenCalledWith(
      "phc_test_key",
      expect.objectContaining({ api_host: "https://ph.example.com" }),
    );
    expect(mockSetPosthogInstance).toHaveBeenCalledTimes(1);
  });

  it("loads PostHog via fallback timeout after 5 seconds", async () => {
    renderProvider(<span>Test</span>);

    // Advance past the 5-second fallback threshold
    await act(() => vi.advanceTimersByTimeAsync(5001));

    expect(mockInit).toHaveBeenCalledWith(
      "phc_test_key",
      expect.objectContaining({ api_host: "https://ph.example.com" }),
    );
  });
});
