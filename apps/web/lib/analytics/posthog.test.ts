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

// #1197 — trackEvent gates every event on `ph.__loaded`, and the provider
// loads posthog-js's SLIM build rather than its default entry. If that build
// ever stopped exposing `__loaded`, or `capture`, the gate would silently drop
// EVERY event with no error anywhere. These assertions run against the real
// module the provider imports, not a mock, which is the point.
describe("the slim posthog build satisfies the contract trackEvent depends on (#1197)", () => {
  it("exposes __loaded and capture on its default export", async () => {
    const { default: posthog } = await import("posthog-js/dist/module.slim.js");

    expect(posthog).toBeDefined();
    expect(typeof posthog.capture).toBe("function");
    // Present and false before init - the exact gate trackEvent reads.
    expect("__loaded" in posthog).toBe(true);
    expect(posthog.__loaded).toBe(false);
  });

  it("accepts the init options the provider passes", async () => {
    const { default: posthog } = await import("posthog-js/dist/module.slim.js");
    expect(typeof posthog.init).toBe("function");
    // capture_pageleave is the one option here whose behaviour lives in
    // posthog's own lifecycle listeners rather than in our code.
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync(
        new URL(
          "../../node_modules/posthog-js/dist/module.slim.js",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    expect(source).toContain("capture_pageleave");
  });

  it("is the build the provider actually imports", async () => {
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync(
        new URL("../../components/PostHogProvider.tsx", import.meta.url),
        "utf8",
      ),
    );
    expect(source).toContain('import("posthog-js/dist/module.slim.js")');
    expect(source).not.toMatch(/import\("posthog-js"\)/);
  });
});
