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
