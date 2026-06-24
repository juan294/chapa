import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const LEGAL_PAGES = ["privacy", "terms"] as const;

describe("legal pages — i18n server component", () => {
  for (const page of LEGAL_PAGES) {
    const source = fs.readFileSync(
      path.resolve(__dirname, "..", page, "page.tsx"),
      "utf-8",
    );

    it(`/${page} does not use force-static (page must be dynamic to read locale cookie)`, () => {
      expect(source).not.toContain("export const dynamic = 'force-static'");
      expect(source).not.toContain("export const dynamic = 'force-dynamic'");
    });

    it(`/${page} exports generateMetadata`, () => {
      expect(source).toContain("generateMetadata");
    });

    it(`/${page} uses getServerLocale() and getServerT for per-request locale`, () => {
      expect(source).toContain('from "@/lib/i18n/server"');
      expect(source).toContain('getServerT');
      expect(source).toContain('getServerLocale');
      expect(source).not.toContain('DEFAULT_LOCALE');
    });

    it(`/${page} does NOT use static metadata export`, () => {
      expect(source).not.toContain("export const metadata");
    });
  }
});
