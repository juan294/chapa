import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "ShareBadgePreviewLazy.tsx"),
  "utf-8",
);

describe("ShareBadgePreviewLazy (#579)", () => {
  it("has 'use client' directive (required for next/dynamic ssr:false)", () => {
    expect(SOURCE).toMatch(/^["']use client["']/m);
  });

  it("uses next/dynamic for lazy loading", () => {
    expect(SOURCE).toContain("from \"next/dynamic\"");
  });

  it("exports ShareBadgePreviewLazy function", () => {
    expect(SOURCE).toContain("export function ShareBadgePreviewLazy");
  });
});

describe("ShareBadgePreviewLazy skeleton (#734)", () => {
  it("skeleton uses aspect-[1200/630] class to avoid CLS (not a fixed height)", () => {
    // The skeleton must use an aspect ratio class so it matches the badge's
    // 1200x630 dimensions and does not cause Cumulative Layout Shift on load.
    expect(SOURCE).toContain("aspect-[1200/630]");
  });

  it("skeleton does not use fixed h-[400px] height that mismatches badge ratio", () => {
    // h-[400px] doesn't match 1200x630 and causes layout shift when badge loads.
    expect(SOURCE).not.toContain("h-[400px]");
  });
});
