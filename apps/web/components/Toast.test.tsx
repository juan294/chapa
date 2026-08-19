// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Toast } from "./Toast";

describe("Toast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    // Remove portal elements from document.body
    document.body.querySelectorAll('[role="status"]').forEach((el) => el.remove());
    vi.useRealTimers();
  });

  it("renders via portal to document.body", () => {
    render(<Toast message="Test" type="success" />);
    expect(document.body.querySelector('[role="status"]')).toBeTruthy();
  });

  it("shows message and detail text", () => {
    render(
      <Toast message="Uploaded!" detail="Score: 58 → 61" type="success" />,
    );
    expect(screen.getByText("Uploaded!")).toBeTruthy();
    expect(screen.getByText("Score: 58 → 61")).toBeTruthy();
  });

  it("shows loading spinner for type=loading", () => {
    render(<Toast message="Processing…" type="loading" />);
    expect(document.body.querySelector(".animate-spin")).toBeTruthy();
  });

  it("auto-dismisses after duration", async () => {
    const onDismiss = vi.fn();
    render(
      <Toast
        message="Test"
        type="success"
        duration={100}
        onDismiss={onDismiss}
      />,
    );
    await vi.advanceTimersByTimeAsync(500);
    expect(onDismiss).toHaveBeenCalled();
  });

  it("does not auto-dismiss when duration=0", async () => {
    const onDismiss = vi.fn();
    render(
      <Toast
        message="Test"
        type="info"
        duration={0}
        onDismiss={onDismiss}
      />,
    );
    await vi.advanceTimersByTimeAsync(10000);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("shows dismiss button for non-loading types", () => {
    render(<Toast message="Done" type="success" onDismiss={() => {}} />);
    expect(screen.getByLabelText("Dismiss notification")).toBeTruthy();
  });

  it("hides dismiss button for loading type", () => {
    render(<Toast message="Loading…" type="loading" onDismiss={() => {}} />);
    expect(screen.queryByLabelText("Dismiss notification")).toBeNull();
  });

  it("has correct aria attributes", () => {
    render(<Toast message="Test" type="success" />);
    const toast = document.body.querySelector('[role="status"]');
    expect(toast?.getAttribute("aria-live")).toBe("polite");
  });

  // Phase 5 — shadow-card for toast elevation
  it("uses shadow-card for toast elevation", () => {
    render(<Toast message="Test" type="success" />);
    const toast = document.body.querySelector('[role="status"]');
    expect(toast?.className).toContain("shadow-card");
  });
});
