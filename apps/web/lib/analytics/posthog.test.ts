import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("posthog analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    // Simulate browser environment
    globalThis.window = {} as Window & typeof globalThis;
  });

  afterEach(() => {
    // @ts-expect-error — restore Node environment
    delete globalThis.window;
  });

  describe("trackEvent", () => {
    it("calls posthog.capture when instance is set and loaded", async () => {
      const { trackEvent, setPosthogInstance } = await import("./posthog");
      const mockPosthog = {
        __loaded: true,
        capture: vi.fn(),
      };
      setPosthogInstance(mockPosthog as never);

      trackEvent("embed_copied", { format: "markdown" });
      expect(mockPosthog.capture).toHaveBeenCalledWith("embed_copied", {
        format: "markdown",
      });
    });

    it("is a no-op when posthog instance is not set", async () => {
      const { trackEvent } = await import("./posthog");
      // No setPosthogInstance call — _posthog is null
      trackEvent("embed_copied");
      // Should not throw, just silently skip
    });

    it("is a no-op when posthog is set but not loaded", async () => {
      const { trackEvent, setPosthogInstance } = await import("./posthog");
      const mockPosthog = {
        __loaded: false,
        capture: vi.fn(),
      };
      setPosthogInstance(mockPosthog as never);

      trackEvent("embed_copied");
      expect(mockPosthog.capture).not.toHaveBeenCalled();
    });

    it("is a no-op on the server (no window)", async () => {
      // @ts-expect-error — simulate server
      delete globalThis.window;

      const { trackEvent, setPosthogInstance } = await import("./posthog");
      const mockPosthog = {
        __loaded: true,
        capture: vi.fn(),
      };
      setPosthogInstance(mockPosthog as never);

      trackEvent("embed_copied");
      expect(mockPosthog.capture).not.toHaveBeenCalled();
    });
  });

  describe("setPosthogInstance", () => {
    it("stores the instance for subsequent trackEvent calls", async () => {
      const { trackEvent, setPosthogInstance } = await import("./posthog");
      const mockPosthog = {
        __loaded: true,
        capture: vi.fn(),
      };

      // Before setting instance, trackEvent is a no-op
      trackEvent("before_set");
      // No error, no capture

      setPosthogInstance(mockPosthog as never);

      // After setting instance, trackEvent works
      trackEvent("after_set", { key: "value" });
      expect(mockPosthog.capture).toHaveBeenCalledTimes(1);
      expect(mockPosthog.capture).toHaveBeenCalledWith("after_set", {
        key: "value",
      });
    });
  });
});
