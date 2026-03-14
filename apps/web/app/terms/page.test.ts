import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "page.tsx"),
  "utf-8",
);

describe("/terms page — ISR", () => {
  it("exports revalidate = 86400 for Incremental Static Regeneration", () => {
    expect(SOURCE).toContain("export const revalidate = 86400");
  });

  it("does NOT import headers from next/headers (ISR incompatible)", () => {
    expect(SOURCE).not.toContain('from "next/headers"');
    expect(SOURCE).not.toContain("from 'next/headers'");
  });

  it("does NOT call headers() anywhere (ISR incompatible)", () => {
    expect(SOURCE).not.toMatch(/\bheaders\(\)/);
  });
});
