import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const SRC = readFileSync(resolve(__dirname, "BadgeOverlay.tsx"), "utf-8");

describe("BadgeOverlay (source-reading a11y)", () => {
  it("outer div with aria-label also has role='group' (#308)", () => {
    // A div with aria-label but no role is ignored by screen readers.
    // The outer container should have role="group" so aria-label is announced.
    expect(SRC).toContain('role="group"');
  });

  it("has aria-label for the overlay container", () => {
    expect(SRC).toContain("aria-label");
  });
});

describe("BadgeOverlay hover-reveal behavior", () => {
  it("uses group/badge on the container for hover-reveal", () => {
    // The parent container needs group/badge so child info icons
    // can respond to parent hover via group-hover/badge:*
    expect(SRC).toContain("group/badge");
  });

  it("InfoTooltip icons are hidden by default (opacity-0)", () => {
    // Info icons should be invisible until the badge is hovered
    expect(SRC).toContain("opacity-0");
    expect(SRC).toContain("group-hover/badge:opacity-100");
  });
});

describe("BadgeOverlay GitHub disclaimer hotspot", () => {
  it("includes a hotspot for the Powered by GitHub area", () => {
    expect(SRC).toContain("badge-github");
  });

  it("has a disclaimer that GitHub is not affiliated", () => {
    expect(SRC).toMatch(/github.*not affiliated/i);
  });
});
