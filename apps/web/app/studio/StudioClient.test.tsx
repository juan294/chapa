import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "StudioClient.tsx"),
  "utf-8",
);

// The bulk of this file used to source-text-match logic that is now
// exercised behaviorally in StudioClient.render.test.tsx: state
// management, layout composition, props usage, save (PUT + body +
// config_saved tracking), reset, PostHog analytics, aria-busy while
// saving, the sr-only heading, and terminal/command-registry
// integration are all covered by rendering the real component and
// querying the DOM or asserting on mocked calls. What's left here is
// genuinely non-renderable: the client/server boundary directive, and
// React's `key` prop (consumed internally by React, never surfaced as
// a DOM attribute a render test can query) and the SSR-safe
// useSyncExternalStore pattern (jsdom only ever renders client-side,
// so it can't distinguish this from a hydration-unsafe alternative).
describe("StudioClient", () => {
  describe("component directive", () => {
    it("has 'use client' directive", () => {
      expect(SOURCE).toMatch(/^["']use client["']/m);
    });
  });

  describe("reduced motion", () => {
    it("avoids SSR hydration mismatch by using useSyncExternalStore with server snapshot returning false", () => {
      // Must use useSyncExternalStore — no useState initializer accessing window
      expect(SOURCE).toContain("useSyncExternalStore");
      // Server snapshot must always return false
      expect(SOURCE).toContain("getReducedMotionServerSnapshot");
      // Must NOT have window check inside a useState initializer
      expect(SOURCE).not.toMatch(
        /useState\(\s*\(\)\s*=>\s*\{[\s\S]*?window/,
      );
      expect(SOURCE).not.toMatch(
        /useState\(\(\)\s*=>\s*typeof window/,
      );
    });
  });

  describe("preview animation replay", () => {
    it("uses previewKey state for animation replay", () => {
      // React's `key` prop is consumed internally by the reconciler and
      // never appears on the rendered DOM node or the mocked child's
      // props snapshot, so this can't be observed via render + query.
      expect(SOURCE).toContain("previewKey");
    });

    it("passes previewKey as key to BadgePreviewCard", () => {
      expect(SOURCE).toContain("key={previewKey}");
    });

  });
});
