import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "ShareButton.tsx"),
  "utf-8",
);

describe("ShareButton", () => {
  it("has 'use client' directive (uses onClick with trackEvent)", () => {
    expect(SOURCE).toMatch(/^["']use client["']/m);
  });

  it("tracks share_clicked event on click", () => {
    expect(SOURCE).toContain('trackEvent("share_clicked"');
  });
});
