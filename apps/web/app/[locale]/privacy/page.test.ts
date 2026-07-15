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

    it(`/${page} forces static rendering with hourly revalidation`, () => {
      expect(source).toContain('export const dynamic = "force-static"');
      expect(source).toContain("export const revalidate = 3600");
      expect(source).not.toContain("export const dynamic = 'force-dynamic'");
    });

    it(`/${page} exports generateMetadata`, () => {
      expect(source).toContain("generateMetadata");
    });

    // #1023 (FE-H1) — locale now comes from the route's [locale] segment
    // param (populated by proxy.ts), not a build-time DEFAULT_LOCALE
    // constant or a request-time getServerLocale() cookie/header read.
    it(`/${page} uses getServerT() with the [locale] route param`, () => {
      expect(source).toContain('from "@/lib/i18n/server"');
      expect(source).toContain('getServerT');
      expect(source).not.toContain('DEFAULT_LOCALE');
      expect(source).not.toContain('getServerLocale');
      expect(source).toContain('params');
    });

    it(`/${page} does NOT use static metadata export`, () => {
      expect(source).not.toContain("export const metadata");
    });
  }
});
