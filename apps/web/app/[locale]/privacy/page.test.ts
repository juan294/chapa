import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * #1104: everything renderable (h1, sections, contact link, generateMetadata's
 * title/description/canonical, the main-content landmark) is now covered by
 * real render+query assertions in privacy.render.test.tsx / terms.render.test.tsx.
 * What remains here are checks with no runtime-observable equivalent:
 * route-segment config is read by Next.js's build/runtime infrastructure, not
 * any callable code path; "no static `metadata` export" and the
 * [locale]-param-vs-DEFAULT_LOCALE guard are both source-shape checks a
 * render test can't distinguish (the render tests mock getServerT to ignore
 * its argument, and a stray extra `metadata` export wouldn't break rendering
 * either way — generateMetadata always wins in Next.js, silently).
 */

const ARCHETYPE_DIR = join(__dirname);
const LEGAL_PAGES = ["privacy", "terms"] as const;

describe("legal pages — non-renderable architecture checks", () => {
  for (const page of LEGAL_PAGES) {
    const source = readFileSync(
      join(ARCHETYPE_DIR, "..", page, "page.tsx"),
      "utf-8",
    );

    it(`/${page} forces static rendering with hourly revalidation`, () => {
      expect(source).toContain('export const dynamic = "force-static"');
      expect(source).toContain("export const revalidate = 3600");
      expect(source).not.toContain("export const dynamic = 'force-dynamic'");
    });

    // #1023 (FE-H1) — locale comes from the route's [locale] segment param
    // (populated by proxy.ts), not a build-time DEFAULT_LOCALE constant or a
    // request-time getServerLocale() cookie/header read.
    it(`/${page} uses getServerT() with the [locale] route param`, () => {
      expect(source).toContain('from "@/lib/i18n/server"');
      expect(source).toContain("getServerT");
      expect(source).not.toContain("DEFAULT_LOCALE");
      expect(source).not.toContain("getServerLocale");
      expect(source).toContain("params");
    });

    it(`/${page} does NOT use a static metadata export (generateMetadata is dynamic per locale)`, () => {
      expect(source).not.toContain("export const metadata");
    });
  }
});
