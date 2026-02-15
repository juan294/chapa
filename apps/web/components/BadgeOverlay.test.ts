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
