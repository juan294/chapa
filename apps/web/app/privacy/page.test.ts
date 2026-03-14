import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const LEGAL_PAGES = ["privacy", "terms"] as const;

describe("legal pages — ISR", () => {
  for (const page of LEGAL_PAGES) {
    const source = fs.readFileSync(
      path.resolve(__dirname, "..", page, "page.tsx"),
      "utf-8",
    );

    it(`/${page} exports revalidate = 86400`, () => {
      expect(source).toContain("export const revalidate = 86400");
    });

    it(`/${page} does NOT import headers from next/headers`, () => {
      expect(source).not.toContain('from "next/headers"');
      expect(source).not.toContain("from 'next/headers'");
    });

    it(`/${page} does NOT call headers()`, () => {
      expect(source).not.toMatch(/\bheaders\(\)/);
    });
  }
});
