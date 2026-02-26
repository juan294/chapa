import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "error.tsx"),
  "utf-8",
);

describe("SharePage error.tsx — error boundary", () => {
  it("has 'use client' directive", () => {
    expect(SOURCE).toContain('"use client"');
  });

  it("exports a default function", () => {
    expect(SOURCE).toContain("export default function");
  });

  it("contains a retry/reset button", () => {
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

  it("shows a badge-specific error message", () => {
    expect(SOURCE).toMatch(/badge|profile/i);
  });

  it("uses design system background token", () => {
    expect(SOURCE).toContain("bg-bg");
  });

  it("uses the amber accent color for the heading", () => {
    expect(SOURCE).toContain("text-amber");
  });
});
