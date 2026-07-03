// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ClientErrorReporter } from "./ClientErrorReporter";
import { trackEvent } from "@/lib/analytics/posthog";

vi.mock("@/lib/analytics/posthog", () => ({
  trackEvent: vi.fn(),
}));

describe("ClientErrorReporter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
