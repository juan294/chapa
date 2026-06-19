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

    it(`/${page} is static/ISR with force-static directive`, () => {
      expect(source).not.toContain("export const dynamic = 'force-dynamic'");
      expect(source).toContain("export const revalidate");
      expect(source).toContain("export const dynamic = 'force-static'");
    });

    it(`/${page} exports generateMetadata`, () => {
      expect(source).toContain("generateMetadata");
    });

    it(`/${page} uses DEFAULT_LOCALE and getServerT (no getServerLocale)`, () => {
      expect(source).toContain('from "@/lib/i18n/server"');
      expect(source).toContain('getServerT');
      expect(source).not.toContain('getServerLocale');
      expect(source).toContain('DEFAULT_LOCALE');
    });

    it(`/${page} does NOT use static metadata export`, () => {
      expect(source).not.toContain("export const metadata");
    });
  }
});
