import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "CopyButton.tsx"),
  "utf-8",
);

describe("CopyButton", () => {
  it("has 'use client' directive (uses hooks)", () => {
    expect(SOURCE).toMatch(/^["']use client["']/m);
  });

  describe("accessibility (#19)", () => {
    it("has aria-label on the button element", () => {
      expect(SOURCE).toContain("aria-label=");
    });

    it("has aria-live=polite for state change announcement", () => {
      expect(SOURCE).toContain('aria-live="polite"');
    });
  });

  it("tracks embed_copied event on copy", () => {
    expect(SOURCE).toContain('trackEvent("embed_copied"');
  });
});
