import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "loading.tsx"),
  "utf-8",
);

describe("coming-soon loading.tsx — loading boundary", () => {
  it("exports a default function", () => {
    expect(SOURCE).toContain("export default function");
  });

  it("has role='status' for accessibility", () => {
    expect(SOURCE).toContain('role="status"');
  });

  it("has aria-label='Loading'", () => {
    expect(SOURCE).toContain('aria-label="Loading"');
  });

  it("contains a sr-only loading label", () => {
    expect(SOURCE).toContain("sr-only");
    expect(SOURCE).toContain("Loading...");
  });

  it("uses animate-pulse for the loading indicator", () => {
    expect(SOURCE).toContain("animate-pulse");
  });
});
