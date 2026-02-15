import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "PostHogProvider.tsx"),
  "utf-8",
);

describe("PostHogProvider — deferred loading (#324)", () => {
  it("registers click listener for deferred loading", () => {
    expect(SOURCE).toContain('addEventListener("click"');
  });

  it("registers scroll listener for deferred loading", () => {
    expect(SOURCE).toContain('addEventListener("scroll"');
  });

  it("registers keydown listener for deferred loading", () => {
    expect(SOURCE).toContain('addEventListener("keydown"');
  });

  it("has a 5-second fallback timeout", () => {
    expect(SOURCE).toContain("setTimeout(loadPostHog, 5000)");
  });

  it("removes event listeners on cleanup", () => {
    expect(SOURCE).toContain('removeEventListener("click"');
    expect(SOURCE).toContain('removeEventListener("scroll"');
    expect(SOURCE).toContain('removeEventListener("keydown"');
  });

  it("clears timeout on cleanup", () => {
    expect(SOURCE).toContain("clearTimeout(timeout)");
  });

  it("uses a loaded guard to prevent double initialization", () => {
    expect(SOURCE).toContain("let loaded = false");
    expect(SOURCE).toContain("if (loaded) return");
    expect(SOURCE).toContain("loaded = true");
  });

  it("wraps the dynamic import inside a loadPostHog function", () => {
    // The old pattern was: import("posthog-js").then(...) directly inside useEffect
    // The new pattern wraps it inside loadPostHog which is triggered by events
    expect(SOURCE).toContain("const loadPostHog = ()");
    // The import should be inside loadPostHog
    const loadPostHogMatch = SOURCE.match(
      /const loadPostHog = \(\) => \{([\s\S]*?)\n    \};/,
    );
    expect(loadPostHogMatch).not.toBeNull();
    expect(loadPostHogMatch![1]).toContain('import("posthog-js")');
  });

  it("keeps capture_pageview: false in init config", () => {
    expect(SOURCE).toContain("capture_pageview: false");
  });

  it("keeps capture_pageleave: true in init config", () => {
    expect(SOURCE).toContain("capture_pageleave: true");
  });

  it("calls setPosthogInstance after init", () => {
    expect(SOURCE).toContain("setPosthogInstance(posthog)");
  });

  it("uses scroll listener with passive: true option", () => {
    expect(SOURCE).toContain("passive: true");
  });
});
