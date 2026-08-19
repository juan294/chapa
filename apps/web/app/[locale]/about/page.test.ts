import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(path.resolve(__dirname, "page.tsx"), "utf-8");

// #1023 (FE-H1) — About was previously split into a thin static page.tsx
// (rendered at DEFAULT_LOCALE / no getServerLocale) plus a whole-page "use
// client" AboutPageClient that read locale from useTranslation() client
// context (the source of the locale flash). It is now a single, fully
// server-rendered page under app/[locale]/, translating via
// getServerT(locale) with `locale` sourced from the route's [locale] segment
// param (populated by proxy.ts) — both locale variants are statically
// pre-rendered, so there's no client re-render/flash.
//
// #1104: everything this file used to check that IS runtime-observable
// (generateMetadata's title/description/openGraph/twitter/canonical
// payload, the h1/section headings, archetype and verification link
// hrefs, the main-content landmark) is now covered by real render+query
// assertions in about-pages.render.test.tsx. What remains here are checks
// with no runtime-observable equivalent:
//   - route-segment config (force-static/revalidate) is read by Next.js's
//     build/runtime infrastructure, not by any callable code path.
//   - the [locale]-param-vs-DEFAULT_LOCALE guard can't be distinguished by a
//     mocked render test (the mock ignores its locale argument).
//   - which of NavbarClient/Navbar and GlobalCommandBarLazy/GlobalCommandBar
//     is actually rendered can't be distinguished either — both pairs are
//     mocked to the same test id in about-pages.render.test.tsx (deliberately,
//     since the *content* they render is identical either way; only the
//     bundle-splitting/ISR-compatibility choice of which one is used differs).
describe("About page (locale-segmented RSC) — non-renderable architecture checks", () => {
  describe("static/ISR rendering", () => {
    it("declares force-static with hourly revalidation", () => {
      expect(SOURCE).toContain('export const dynamic = "force-static"');
      expect(SOURCE).toContain("export const revalidate = 3600");
      expect(SOURCE).not.toContain("force-dynamic");
    });
  });

  describe("i18n integration (#1023)", () => {
    it("uses getServerT() with the [locale] route param, not a hardcoded default", () => {
      expect(SOURCE).toContain("getServerT");
      expect(SOURCE).toContain("@/lib/i18n/server");
      expect(SOURCE).not.toContain("DEFAULT_LOCALE");
      expect(SOURCE).not.toContain("getServerLocale");
      expect(SOURCE).toContain("params");
    });
  });

  describe("design system compliance", () => {
    it("uses NavbarClient (ISR-compatible), not the non-ISR Navbar", () => {
      expect(SOURCE).toContain("NavbarClient");
    });

    it("uses the lazy command bar, not the eager GlobalCommandBar", () => {
      expect(SOURCE).toContain("GlobalCommandBarLazy");
      expect(SOURCE).not.toContain("<GlobalCommandBar ");
    });
  });
});
