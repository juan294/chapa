import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "global-error.tsx"),
  "utf-8",
);

describe("global-error.tsx — root error boundary", () => {
  it("has 'use client' directive", () => {
    expect(SOURCE).toContain('"use client"');
  });

  it("exports a default function", () => {
    expect(SOURCE).toContain("export default function");
  });

  it("contains <html> tag (replaces root layout)", () => {
    expect(SOURCE).toContain("<html");
  });

  it("contains <body> tag (replaces root layout)", () => {
    expect(SOURCE).toContain("<body");
  });

  it("contains a retry button", () => {
    expect(SOURCE).toContain("Try again");
  });

  it("calls reset on retry button click", () => {
    expect(SOURCE).toContain("onClick={reset}");
  });

  it("contains a 'go home' link", () => {
    expect(SOURCE).toContain("Go home");
  });

  it("links to the root path", () => {
    expect(SOURCE).toContain('href="/"');
  });
});
