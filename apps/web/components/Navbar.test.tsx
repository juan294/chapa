import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "Navbar.tsx"),
  "utf-8",
);

/**
 * Navbar (server variant) is now a thin wrapper that sources session/locale
 * data via `headers()` and delegates all markup to `NavbarShell` (#1025).
 * Shared markup/design-system assertions live in NavbarShell.test.tsx —
 * this file only covers what's specific to the server data-sourcing path.
 */
describe("Navbar", () => {
  describe("server component", () => {
    it("is an async function (server component)", () => {
      expect(SOURCE).toMatch(/export\s+async\s+function\s+Navbar/);
    });

    it("does NOT have 'use client' directive", () => {
      expect(SOURCE).not.toMatch(/^["']use client["']/m);
    });
  });

  describe("navigation links prop", () => {
    it("accepts optional navLinks prop", () => {
      expect(SOURCE).toContain("navLinks?: NavLinkItem[]");
    });
  });

  describe("authentication", () => {
    it("reads session via the shared server session helper", () => {
      expect(SOURCE).toContain("getOptionalServerSessionFromHeaders");
    });

    it("computes admin status via isAdminHandle (single source of truth)", () => {
      expect(SOURCE).toContain("isAdminHandle(session.login)");
    });
  });

  describe("delegation to NavbarShell (#1025)", () => {
    it("renders NavbarShell instead of inlining nav markup", () => {
      expect(SOURCE).toContain("NavbarShell");
      expect(SOURCE).toMatch(/<NavbarShell\s/);
    });

    it("passes session, isAdmin, navLinks, and t down to NavbarShell", () => {
      expect(SOURCE).toContain("session={session}");
      expect(SOURCE).toContain("isAdmin={session ? isAdminHandle(session.login) : false}");
      expect(SOURCE).toContain("navLinks={navLinks}");
      expect(SOURCE).toContain("t={t}");
    });

    it("does NOT pass a loading prop (server variant always knows session synchronously)", () => {
      expect(SOURCE).not.toContain("loading=");
    });
  });
});
