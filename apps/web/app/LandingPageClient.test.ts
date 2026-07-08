import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "LandingPageClient.tsx"),
  "utf-8",
);

describe("LandingPageClient (client component)", () => {
  describe("component type", () => {
    it("is a client component ('use client')", () => {
      expect(SOURCE).toMatch(/^["']use client["']/m);
    });

    it("translates via useTranslation (client-side, not getServerT)", () => {
      expect(SOURCE).toContain("useTranslation");
      expect(SOURCE).not.toContain("getServerT");
      expect(SOURCE).not.toContain("getServerLocale");
    });

    it("accepts the server-computed demo badge SVG as a prop", () => {
      expect(SOURCE).toContain("demoBadgeSvg");
    });
  });

  // #982 — query params (error, lang) are read client-side via window.location
  // in an effect so the server component stays statically renderable. useSearchParams
  // is intentionally avoided (it would require a Suspense boundary / CSR bailout).
  describe("client-side query param handling (#982)", () => {
    it("reads query params from window.location (no server searchParams)", () => {
      expect(SOURCE).toContain("window.location");
    });

    it("maps the OAuth error param to a message and renders ErrorBanner", () => {
      expect(SOURCE).toContain("getOAuthErrorMessage");
      expect(SOURCE).toContain("ErrorBanner");
    });

    it("renders LocaleSync for the sticky ?lang= query override", () => {
      expect(SOURCE).toContain("LocaleSync");
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
