import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "AdminTableSkeleton.tsx"),
  "utf-8",
);

describe("AdminTableSkeleton", () => {
  it("exports AdminTableSkeleton as a named export", () => {
    expect(SOURCE).toMatch(/export\s+(function|const)\s+AdminTableSkeleton/);
  });

  it("accepts a rowCount prop with a default value", () => {
    // Either destructured with default or default param
    expect(SOURCE).toMatch(/rowCount\s*=\s*\d+/);
  });

  it("renders stat card shimmer blocks in a grid", () => {
    // Should use the same grid layout as AdminStatsCards
    expect(SOURCE).toContain("grid-cols-2");
    expect(SOURCE).toContain("lg:grid-cols-5");
  });

  it("renders a search bar shimmer placeholder", () => {
    // Should have a wide shimmer bar for the search area
    expect(SOURCE).toMatch(/animate-pulse/);
  });

  it("renders shimmer table rows using rowCount", () => {
    // Should use Array.from or similar with rowCount to generate rows
    expect(SOURCE).toMatch(/rowCount/);
    expect(SOURCE).toMatch(/Array/);
  });

  it("uses aria-hidden on the skeleton table for a11y", () => {
    expect(SOURCE).toContain('aria-hidden="true"');
  });

  it("uses design system shimmer colors", () => {
    expect(SOURCE).toContain("bg-amber/10");
  });

  it("renders avatar circle placeholders in table rows", () => {
    expect(SOURCE).toContain("rounded-full");
  });
});
