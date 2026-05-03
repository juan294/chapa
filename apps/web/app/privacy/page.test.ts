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

    it(`/${page} exports dynamic = 'force-dynamic'`, () => {
      expect(source).toContain("export const dynamic = 'force-dynamic'");
    });

    it(`/${page} exports generateMetadata`, () => {
      expect(source).toContain("export async function generateMetadata");
    });

    it(`/${page} imports getServerT and getServerLocale from @/lib/i18n/server`, () => {
      expect(source).toContain('from "@/lib/i18n/server"');
      expect(source).toContain('getServerT');
      expect(source).toContain('getServerLocale');
    });

    it(`/${page} does NOT use static metadata export`, () => {
      expect(source).not.toContain("export const metadata");
    });

    it(`/${page} does NOT export revalidate`, () => {
      expect(source).not.toContain("export const revalidate");
    });
  }
});
