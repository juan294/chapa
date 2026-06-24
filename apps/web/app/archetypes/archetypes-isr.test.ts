import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ARCHETYPE_DIRS = [
  "balanced",
  "builder",
  "emerging",
  "guardian",
  "marathoner",
  "polymath",
  "artificer",
];

describe("archetype pages — static/ISR", () => {
  for (const archetype of ARCHETYPE_DIRS) {
    it(`${archetype}/page.tsx forces static rendering with hourly revalidation`, () => {
      const source = fs.readFileSync(
        path.resolve(__dirname, archetype, "page.tsx"),
        "utf-8",
      );
      expect(source).toContain("export const dynamic = 'force-static'");
      expect(source).toContain("export const revalidate = 3600");
      expect(source).not.toContain("export const dynamic = 'force-dynamic'");
    });

    it(`${archetype}/page.tsx uses DEFAULT_LOCALE instead of getServerLocale()`, () => {
      const source = fs.readFileSync(
        path.resolve(__dirname, archetype, "page.tsx"),
        "utf-8",
      );
      expect(source).toContain("DEFAULT_LOCALE");
      expect(source).not.toContain("getServerLocale");
    });
  }
});
