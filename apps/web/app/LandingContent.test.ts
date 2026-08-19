import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "LandingContent.tsx"),
  "utf-8",
);
const URL_EFFECTS_SOURCE = fs.readFileSync(
  path.resolve(__dirname, "LandingUrlEffects.tsx"),
  "utf-8",
);

// #1023 (FE-H1) — LandingContent was LandingPageClient before this fix: a
// whole-page "use client" component that only needed client rendering
// because it called useTranslation(). It is now a real server component
// that receives already-resolved `t` (getServerT(locale), from the
// [locale] route param) as a prop — eliminating the locale flash and the
// unnecessary client hydration cost for this large, mostly-static page body.
// The one remaining genuinely-interactive piece (the ?lang=/error
// query-param handling, which must stay client-side to preserve the #982
// static/ISR contract) is isolated in the LandingUrlEffects client leaf.
//
// #1104: everything renderable this file used to check (NavbarClient,
// main-content landmark, the demo badge SVG, BadgeOverlay, LandingTerminal,
// footer, the verification CTA's href/styling, and the error-banner flow
// through LandingUrlEffects/getOAuthErrorMessage/ErrorBanner) is now covered
// by real render+query assertions in app/[locale]/page.render.test.tsx,
// which renders the actual page tree. What remains here has no
// render-observable equivalent: whether LandingContent is a server or
// client component, and whether it reads window.location directly vs.
// delegating to LandingUrlEffects, can't be told apart by a jsdom render —
// both would render identically either way. LocaleSync is mocked to a no-op
// across the render-test suite, so its presence inside LandingUrlEffects
// (the sticky ?lang= query override) isn't render-observable there either.
describe("LandingContent (server component) — non-renderable architecture checks", () => {
  describe("component type", () => {
    it("is NOT a client component (no 'use client')", () => {
      expect(SOURCE).not.toMatch(/^["']use client["']/m);
    });

    it("receives t as a prop instead of calling the useTranslation hook (#1023)", () => {
      expect(SOURCE).not.toContain("useTranslation()");
      expect(SOURCE).not.toContain('from "@/lib/i18n"');
      expect(SOURCE).toContain("t: TFunction");
    });
  });

  // #982 / #1023 — query params (error, lang) are still read client-side via
  // window.location in an effect (isolated in LandingUrlEffects) so the page
  // stays statically renderable. useSearchParams is intentionally avoided
  // (it would require a Suspense boundary / CSR bailout).
  describe("client-side query param handling (#982) — isolated in LandingUrlEffects", () => {
    it("LandingContent delegates query-param handling to the LandingUrlEffects client leaf, not window.location directly", () => {
      expect(SOURCE).toContain("LandingUrlEffects");
      expect(SOURCE).not.toContain("window.location");
    });

    it("LandingUrlEffects renders LocaleSync for the sticky ?lang= query override", () => {
      expect(URL_EFFECTS_SOURCE).toContain("LocaleSync");
    });
  });
});
