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

    // #1023 (FE-H1) — locale now comes from the route's [locale] segment
    // param (populated by proxy.ts), not a build-time DEFAULT_LOCALE
    // constant or a request-time getServerLocale() cookie/header read.
    it(`${archetype}/page.tsx uses the [locale] route param instead of DEFAULT_LOCALE/getServerLocale()`, () => {
      const source = fs.readFileSync(
        path.resolve(__dirname, archetype, "page.tsx"),
        "utf-8",
      );
      expect(source).not.toContain("DEFAULT_LOCALE");
      expect(source).not.toContain("getServerLocale");
      expect(source).toContain("params");
      expect(source).toContain("getServerT");
    });

    it(`${archetype}/page.tsx uses ISR with no query-string searchParams (static-friendly)`, () => {
      const source = fs.readFileSync(
        path.resolve(__dirname, archetype, "page.tsx"),
        "utf-8",
      );
      expect(source).not.toContain("searchParams={searchParams}");
    });
  }
});
