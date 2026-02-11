import { describe, it, expect } from "vitest";
import { shouldRedirect } from "./proxy";

describe("shouldRedirect", () => {
  describe("when COMING_SOON is false", () => {
    it("never redirects any route", () => {
      expect(shouldRedirect("/", false)).toBe(false);
      expect(shouldRedirect("/u/juan294", false)).toBe(false);
      expect(shouldRedirect("/studio", false)).toBe(false);
    });
  });

  describe("when COMING_SOON is true", () => {
    // Routes that SHOULD be blocked
    it("redirects the home page", () => {
      expect(shouldRedirect("/", true)).toBe(true);
    });

    it("redirects share pages", () => {
      expect(shouldRedirect("/u/juan294", true)).toBe(true);
    });

    it("redirects studio", () => {
      expect(shouldRedirect("/studio", true)).toBe(true);
    });

    it("redirects experiments", () => {
      expect(shouldRedirect("/experiments/heatmap-wave", true)).toBe(true);
    });

    // Routes that MUST pass through (allowlist)
    it("does not redirect /coming-soon", () => {
      expect(shouldRedirect("/coming-soon", true)).toBe(false);
    });

    it("does not redirect badge SVGs", () => {
      expect(shouldRedirect("/u/juan294/badge.svg", true)).toBe(false);
    });

    it("does not redirect API routes", () => {
      expect(shouldRedirect("/api/health", true)).toBe(false);
      expect(shouldRedirect("/api/auth/callback", true)).toBe(false);
      expect(shouldRedirect("/api/studio/config", true)).toBe(false);
    });

    it("does not redirect Next.js assets", () => {
      expect(shouldRedirect("/_next/static/chunk.js", true)).toBe(false);
      expect(shouldRedirect("/_next/image?url=...", true)).toBe(false);
    });

    it("does not redirect favicon", () => {
      expect(shouldRedirect("/favicon.svg", true)).toBe(false);
      expect(shouldRedirect("/favicon.ico", true)).toBe(false);
    });

    it("does not redirect logo assets", () => {
      expect(shouldRedirect("/logo-512.png", true)).toBe(false);
      expect(shouldRedirect("/logo.svg", true)).toBe(false);
    });

    it("does not redirect site.webmanifest", () => {
      expect(shouldRedirect("/site.webmanifest", true)).toBe(false);
    });

    it("does not redirect robots.txt", () => {
      expect(shouldRedirect("/robots.txt", true)).toBe(false);
    });

    it("does not redirect sitemap.xml", () => {
      expect(shouldRedirect("/sitemap.xml", true)).toBe(false);
    });
  });
});
