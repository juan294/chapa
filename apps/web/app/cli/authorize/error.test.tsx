import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "error.tsx"),
  "utf-8",
);

describe("cli/authorize error.tsx — error boundary", () => {
  it("has 'use client' directive", () => {
    expect(SOURCE).toContain('"use client"');
  });

  it("exports a default function", () => {
    expect(SOURCE).toContain("export default function");
  });

  it("uses useTranslation for i18n", () => {
    expect(SOURCE).toContain("useTranslation");
  });

  it("uses cliAuthorize.errorBoundaryHeading key", () => {
    expect(SOURCE).toContain("cliAuthorize.errorBoundaryHeading");
  });

  it("uses cliAuthorize.errorBoundaryBody key", () => {
    expect(SOURCE).toContain("cliAuthorize.errorBoundaryBody");
  });

  it("uses common.tryAgain key for retry button", () => {
    expect(SOURCE).toContain("common.tryAgain");
  });

  it("uses common.goHome key for home link", () => {
    expect(SOURCE).toContain("common.goHome");
  });

  it("calls reset on retry button click", () => {
    expect(SOURCE).toContain("onClick={reset}");
  });

  it("links to the root path", () => {
    expect(SOURCE).toContain('href="/"');
  });
});
