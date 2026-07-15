import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "NavbarClient.tsx"),
  "utf-8",
);

/**
 * NavbarClient is now a thin wrapper that sources session (via
 * `useSession()`) and locale-aware nav labels (via `tArray`), then
 * delegates all markup to `NavbarShell` (#1025). Shared markup/design-system
 * assertions live in NavbarShell.test.tsx — this file only covers what's
 * specific to the client data-sourcing path.
 */
describe("NavbarClient", () => {
  describe("client component", () => {
    it("has 'use client' directive", () => {
      expect(SOURCE).toMatch(/^["']use client["']/m);
    });

    it("does NOT call headers() from next/headers", () => {
      expect(SOURCE).not.toContain("from \"next/headers\"");
      expect(SOURCE).not.toContain("from 'next/headers'");
    });

    it("fetches session from /api/auth/session (via useSession)", () => {
      expect(SOURCE).toContain("/api/auth/session");
    });
  });

  describe("locale consistency", () => {
    it("derives nav link labels from active locale via t('landing.navLinks')", () => {
      // NavbarClient must use the live translation, not freeze server-passed prop labels,
      // so locale switches (LanguageProvider cookie read on mount) update the center nav.
      expect(SOURCE).toContain("landing.navLinks");
    });

    it("uses navLinks prop only as presence signal, with prop as fallback", () => {
      // The prop is still read to decide whether to show center nav at all,
      // and used as a fallback in case t() returns an empty array.
      expect(SOURCE).toContain("navLinks");
    });
  });

  describe("ISR compatibility", () => {
    it("does NOT import from next/headers", () => {
      expect(SOURCE).not.toContain("next/headers");
    });

    it("uses useSession hook for session (client-side)", () => {
      expect(SOURCE).toContain("useSession");
    });
  });

  describe("delegation to NavbarShell (#1025)", () => {
    it("renders NavbarShell instead of inlining nav markup", () => {
      expect(SOURCE).toContain("NavbarShell");
      expect(SOURCE).toMatch(/<NavbarShell\s/);
    });

    it("sources isAdmin from the session API's isAdmin field", () => {
      expect(SOURCE).toContain("session?.isAdmin");
    });

    it("passes the useSession loading flag down so NavbarShell can show a placeholder (#1025 / FE-L2)", () => {
      expect(SOURCE).toContain("loading={loading}");
    });
  });
});
