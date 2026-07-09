// @vitest-environment jsdom
import { render, cleanup } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ClientErrorReporter } from "./ClientErrorReporter";
import { trackEvent } from "@/lib/analytics/posthog";

vi.mock("@/lib/analytics/posthog", () => ({
  trackEvent: vi.fn(),
}));

const circularReason: Record<string, unknown> = {};
circularReason.self = circularReason;

describe("ClientErrorReporter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("forwards window error events to analytics", () => {
    render(<ClientErrorReporter />);

    window.dispatchEvent(
      new ErrorEvent("error", {
        message: "boom",
        error: new Error("boom"),
      }),
    );

    expect(trackEvent).toHaveBeenCalledWith(
      "client_error",
      expect.objectContaining({
        source: "window_error",
        message: "boom",
      }),
    );
  });

  it("forwards unhandled promise rejections to analytics", () => {
    render(<ClientErrorReporter />);

    window.dispatchEvent(
      new PromiseRejectionEvent("unhandledrejection", {
        promise: Promise.reject(new Error("async boom")).catch(() => undefined),
        reason: new Error("async boom"),
      }),
    );

    expect(trackEvent).toHaveBeenCalledWith(
      "client_error",
      expect.objectContaining({
        source: "unhandledrejection",
        message: "async boom",
      }),
    );
  });

  it("falls back to the message string when a window error has no error object", () => {
    render(<ClientErrorReporter />);

    window.dispatchEvent(new ErrorEvent("error", { message: "no error object" }));

    expect(trackEvent).toHaveBeenCalledWith(
      "client_error",
      expect.objectContaining({
        source: "window_error",
        message: "no error object",
      }),
    );
  });

  it.each([
    { label: "a string", reason: "string reason", expectedMessage: "string reason" },
    {
      label: "a JSON-serializable object",
      reason: { code: 42 },
      expectedMessage: JSON.stringify({ code: 42 }),
    },
    {
      label: "a non-JSON-serializable (circular) object",
      reason: circularReason,
      expectedMessage: String(circularReason),
    },
  ])("formats $label rejection reason correctly", ({ reason, expectedMessage }) => {
    render(<ClientErrorReporter />);

    window.dispatchEvent(
      new PromiseRejectionEvent("unhandledrejection", {
        promise: Promise.reject(reason).catch(() => undefined),
        reason,
      }),
    );

    expect(trackEvent).toHaveBeenCalledWith(
      "client_error",
      expect.objectContaining({
        source: "unhandledrejection",
        message: expectedMessage,
      }),
    );
  });

  it("stops forwarding events after unmount", () => {
    const { unmount } = render(<ClientErrorReporter />);
    unmount();

    // error events with no listener throw in jsdom (default action); the
    // shared cleanup effect removes both listeners together, so asserting
    // via unhandledrejection alone is enough to prove it ran.
    window.dispatchEvent(
      new PromiseRejectionEvent("unhandledrejection", {
        promise: Promise.reject(new Error("after unmount")).catch(() => undefined),
        reason: new Error("after unmount"),
      }),
    );

    expect(trackEvent).not.toHaveBeenCalled();
  });
});
