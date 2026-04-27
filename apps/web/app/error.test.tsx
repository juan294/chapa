import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "error.tsx"),
  "utf-8",
);

describe("error.tsx — error boundary", () => {
  it("has 'use client' directive", () => {
    expect(SOURCE).toContain('"use client"');
  });

  it("exports a default function", () => {
    expect(SOURCE).toContain("export default function");
  });

  it("contains a retry/reset button", () => {
    expect(SOURCE).toContain("COPY.tryAgain");
  });

  it("calls reset on retry button click", () => {
    expect(SOURCE).toContain("onClick={reset}");
  });

  it("contains a 'go home' link", () => {
    expect(SOURCE).toContain("COPY.goHome");
  });

  it("links to the root path", () => {
    expect(SOURCE).toContain('href="/"');
  });

  it("uses terminal-red semantics for error state", () => {
    expect(SOURCE).toContain("StatusCallout");
    expect(SOURCE).toContain('variant="error"');
    expect(SOURCE).toContain("text-terminal-red");
    expect(SOURCE).not.toContain("amber");
  });
});
