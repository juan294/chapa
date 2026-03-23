import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const source = fs.readFileSync(
  path.resolve(__dirname, "ThemeProvider.tsx"),
  "utf-8",
);

describe("ThemeProvider — source structure", () => {
  it("is a client component (has 'use client')", () => {
    expect(source).toMatch(/^["']use client["']/);
  });

  it("imports from next-themes", () => {
    expect(source).toContain("from \"next-themes\"");
  });

  it("exports ThemeProvider", () => {
    expect(source).toContain("export function ThemeProvider");
  });

  it("configures data-theme attribute", () => {
    expect(source).toContain('attribute="data-theme"');
  });

  it("sets light as the default theme", () => {
    expect(source).toContain('defaultTheme="light"');
  });
});
