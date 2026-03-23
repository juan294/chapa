import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const source = fs.readFileSync(
  path.resolve(__dirname, "not-found.tsx"),
  "utf-8",
);

describe("not-found page — source structure", () => {
  it("is NOT a client component", () => {
    expect(source).not.toMatch(/^["']use client["']/);
  });

  it("renders a heading with 404", () => {
    expect(source).toContain("404");
  });

  it("renders a descriptive message", () => {
    expect(source).toContain("Page not found");
  });

  it("has a link back to home", () => {
    expect(source).toContain('href="/"');
  });
});
