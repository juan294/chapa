import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockPosthog } = vi.hoisted(() => {
  const mockPosthog = {
    __loaded: false,
    capture: vi.fn(),
    identify: vi.fn(),
  };
  return { mockPosthog };
});

vi.mock("posthog-js", () => ({
  default: mockPosthog,
}));

import { trackEvent, identifyUser } from "./posthog";

describe("posthog analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPosthog.__loaded = false;
    // Simulate browser environment
    globalThis.window = {} as Window & typeof globalThis;
  });

  afterEach(() => {
    // @ts-expect-error — restore Node environment
    delete globalThis.window;
  });

  describe("trackEvent", () => {
    it("calls posthog.capture when loaded", () => {
      mockPosthog.__loaded = true;
      trackEvent("embed_copied", { format: "markdown" });
      expect(mockPosthog.capture).toHaveBeenCalledWith("embed_copied", {
        format: "markdown",
      });
    });

    it("is a no-op when posthog is not loaded", () => {
      trackEvent("embed_copied");
      expect(mockPosthog.capture).not.toHaveBeenCalled();
    });

    it("is a no-op on the server (no window)", () => {
      // @ts-expect-error — simulate server
      delete globalThis.window;
      mockPosthog.__loaded = true;
      trackEvent("embed_copied");
      expect(mockPosthog.capture).not.toHaveBeenCalled();
    });
  });

  describe("identifyUser", () => {
    it("calls posthog.identify when loaded", () => {
      mockPosthog.__loaded = true;
      identifyUser("juan294", { tier: "Gold" });
      expect(mockPosthog.identify).toHaveBeenCalledWith("juan294", {
        tier: "Gold",
      });
    });

    it("is a no-op when posthog is not loaded", () => {
      identifyUser("juan294");
      expect(mockPosthog.identify).not.toHaveBeenCalled();
    });

    it("is a no-op on the server (no window)", () => {
      // @ts-expect-error — simulate server
      delete globalThis.window;
      mockPosthog.__loaded = true;
      identifyUser("juan294");
      expect(mockPosthog.identify).not.toHaveBeenCalled();
    });
  });
});
