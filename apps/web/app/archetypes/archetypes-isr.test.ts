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
];

describe("archetype pages — ISR", () => {
  for (const archetype of ARCHETYPE_DIRS) {
    it(`${archetype}/page.tsx exports revalidate = 604800`, () => {
      const source = fs.readFileSync(
        path.resolve(__dirname, archetype, "page.tsx"),
        "utf-8",
      );
      expect(source).toContain("export const revalidate = 604800");
    });
  }
});
