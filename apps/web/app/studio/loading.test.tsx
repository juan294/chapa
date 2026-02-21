import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "loading.tsx"),
  "utf-8",
);

describe("Studio loading.tsx", () => {
  it("renders a default export function", () => {
    expect(SOURCE).toMatch(/export default function/);
  });

  it("uses bg-bg for page background", () => {
    expect(SOURCE).toContain("bg-bg");
  });

  it("uses animate-pulse for skeleton effect", () => {
    expect(SOURCE).toContain("animate-pulse");
  });

  it("has role='status' and aria-label='Loading' on the main container", () => {
    expect(SOURCE).toContain('role="status"');
    expect(SOURCE).toContain('aria-label="Loading"');
  });

  it("has an sr-only loading text span", () => {
    expect(SOURCE).toContain('className="sr-only"');
    expect(SOURCE).toContain("Loading...");
  });
});
