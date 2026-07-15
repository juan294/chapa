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
describe("LandingContent (server component)", () => {
  describe("component type", () => {
    it("is NOT a client component (no 'use client')", () => {
      expect(SOURCE).not.toMatch(/^["']use client["']/m);
    });

    it("receives t as a prop instead of calling the useTranslation hook (#1023)", () => {
      expect(SOURCE).not.toContain("useTranslation()");
      expect(SOURCE).not.toContain('from "@/lib/i18n"');
      expect(SOURCE).toContain("t: TFunction");
    });

    it("accepts the server-computed demo badge SVG as a prop", () => {
      expect(SOURCE).toContain("demoBadgeSvg");
    });
  });

  // #982 / #1023 — query params (error, lang) are still read client-side via
  // window.location in an effect (isolated in LandingUrlEffects) so the page
  // stays statically renderable. useSearchParams is intentionally avoided
  // (it would require a Suspense boundary / CSR bailout).
  describe("client-side query param handling (#982) — isolated in LandingUrlEffects", () => {
    it("LandingContent delegates query-param handling to the LandingUrlEffects client leaf", () => {
      expect(SOURCE).toContain("LandingUrlEffects");
      expect(SOURCE).not.toContain("window.location");
    });

    it("LandingUrlEffects reads query params from window.location (no server searchParams)", () => {
      expect(URL_EFFECTS_SOURCE).toMatch(/^["']use client["']/m);
      expect(URL_EFFECTS_SOURCE).toContain("window.location");
    });

    it("LandingUrlEffects maps the OAuth error param to a message and renders ErrorBanner", () => {
      expect(URL_EFFECTS_SOURCE).toContain("getOAuthErrorMessage");
      expect(URL_EFFECTS_SOURCE).toContain("ErrorBanner");
    });

    it("LandingUrlEffects renders LocaleSync for the sticky ?lang= query override", () => {
      expect(URL_EFFECTS_SOURCE).toContain("LocaleSync");
    });
  });

  describe("rendering", () => {
    it("renders NavbarClient", () => {
      expect(SOURCE).toContain("NavbarClient");
    });

    it("renders the main content area", () => {
      expect(SOURCE).toContain('id="main-content"');
    });

    it("renders the badge preview via the demoBadgeSvg prop", () => {
      expect(SOURCE).toContain("demoBadgeSvg");
    });

    it("renders BadgeOverlay", () => {
      expect(SOURCE).toContain("BadgeOverlay");
    });

    it("renders the GitHub login CTA via LoginCtaButton", () => {
      expect(SOURCE).toContain("LoginCtaButton");
    });

    it("renders LandingTerminal", () => {
      expect(SOURCE).toContain("LandingTerminal");
    });

    it("renders the footer", () => {
      expect(SOURCE).toContain("<footer");
    });
  });

  // #740 — UX-M3: verification CTA uses complement (teal) tokens
  describe("verification CTA uses complement tokens (#740)", () => {
    it("Verify a Badge button uses bg-complement", () => {
      expect(SOURCE).toContain("bg-complement");
    });

    it("Verify a Badge button links to /verify", () => {
      expect(SOURCE).toContain('href="/verify"');
    });
  });

  describe("archetype links", () => {
    it("links to all seven archetype pages", () => {
      expect(SOURCE).toContain("/archetypes/builder");
      expect(SOURCE).toContain("/archetypes/guardian");
      expect(SOURCE).toContain("/archetypes/marathoner");
      expect(SOURCE).toContain("/archetypes/polymath");
      expect(SOURCE).toContain("/archetypes/artificer");
      expect(SOURCE).toContain("/archetypes/balanced");
      expect(SOURCE).toContain("/archetypes/emerging");
    });
  });

  // Phase 9 — optical icon alignment on CTA buttons
  describe("optical icon alignment (Phase 9)", () => {
    it("CTA buttons use asymmetric padding for optical icon alignment", () => {
      expect(SOURCE).toContain("pl-6 pr-5");
    });
  });

  // #741 — visible section labels for landmark sections
  describe("visible section labels (#741)", () => {
    it("Features section has a visible label element (not only sr-only)", () => {
      expect(SOURCE).toContain("tracking-widest");
    });

    it("section labels use text-text-secondary and font-heading", () => {
      expect(SOURCE).toContain("text-text-secondary");
      expect(SOURCE).toContain("font-heading");
    });
  });
});
