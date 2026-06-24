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

describe("archetype pages — dynamic (locale-aware per-request)", () => {
  for (const archetype of ARCHETYPE_DIRS) {
    it(`${archetype}/page.tsx does not use force-static (must read locale cookie)`, () => {
      const source = fs.readFileSync(
        path.resolve(__dirname, archetype, "page.tsx"),
        "utf-8",
      );
      expect(source).not.toContain("export const dynamic = 'force-static'");
      expect(source).not.toContain("export const dynamic = 'force-dynamic'");
    });

    it(`${archetype}/page.tsx uses getServerLocale() for per-request locale`, () => {
      const source = fs.readFileSync(
        path.resolve(__dirname, archetype, "page.tsx"),
        "utf-8",
      );
      expect(source).toContain("getServerLocale");
      expect(source).not.toContain("DEFAULT_LOCALE");
    });
  }
});
