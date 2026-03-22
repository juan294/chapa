// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { CopyButton } from "./CopyButton";

vi.mock("@/lib/analytics/posthog", () => ({
  trackEvent: vi.fn(),
}));

let mockWriteText: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  mockWriteText = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, {
    clipboard: { writeText: mockWriteText },
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("CopyButton", () => {
  // ─── Basic rendering ──────────────────────────────────────────────────

  it("renders with aria-label 'Copy embed snippet'", () => {
    render(<CopyButton text="some text" />);
    expect(
      screen.getByRole("button", { name: "Copy embed snippet" }),
    ).toBeDefined();
  });

  it("shows 'Copy' in aria-live region initially", () => {
    render(<CopyButton text="some text" />);
    expect(screen.getByText("Copy")).toBeDefined();
  });

  // ─── Copy behavior ───────────────────────────────────────────────────

  it("copies text to clipboard on click", async () => {
    render(<CopyButton text="embed code here" />);
    const button = screen.getByRole("button", { name: "Copy embed snippet" });

    await act(async () => {
      fireEvent.click(button);
    });

    expect(mockWriteText).toHaveBeenCalledWith("embed code here");
  });

  it("tracks embed_copied event on click", async () => {
    const { trackEvent } = await import("@/lib/analytics/posthog");
    render(<CopyButton text="some text" />);
    const button = screen.getByRole("button", { name: "Copy embed snippet" });

    await act(async () => {
      fireEvent.click(button);
    });

    expect(trackEvent).toHaveBeenCalledWith("embed_copied");
  });

  it("shows 'Copied!' in aria-live region after copy", async () => {
    render(<CopyButton text="some text" />);
    const button = screen.getByRole("button", { name: "Copy embed snippet" });

    await act(async () => {
      fireEvent.click(button);
    });

    expect(screen.getByText("Copied!")).toBeDefined();
  });

  // ─── Timeout reset ───────────────────────────────────────────────────

  it("resets to 'Copy' after 2s timeout", async () => {
    render(<CopyButton text="some text" />);
    const button = screen.getByRole("button", { name: "Copy embed snippet" });

    await act(async () => {
      fireEvent.click(button);
    });

    expect(screen.getByText("Copied!")).toBeDefined();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByText("Copy")).toBeDefined();
    expect(screen.queryByText("Copied!")).toBeNull();
  });

  it("still shows 'Copied!' before 2s elapses", async () => {
    render(<CopyButton text="some text" />);
    const button = screen.getByRole("button", { name: "Copy embed snippet" });

    await act(async () => {
      fireEvent.click(button);
    });

    act(() => {
      vi.advanceTimersByTime(1999);
    });

    expect(screen.getByText("Copied!")).toBeDefined();
  });
});
