import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "Navbar.tsx"),
  "utf-8",
);

describe("Navbar", () => {
  describe("server component", () => {
    it("is an async function (server component)", () => {
      expect(SOURCE).toMatch(/export\s+async\s+function\s+Navbar/);
    });

    it("does NOT have 'use client' directive", () => {
      expect(SOURCE).not.toMatch(/^["']use client["']/m);
    });
  });

  describe("branding", () => {
    it("renders the Chapa logo text", () => {
      expect(SOURCE).toContain("Chapa");
    });

    it("has blinking cursor animation on logo", () => {
      expect(SOURCE).toContain("animate-cursor-blink");
    });

    it("logo links to home page", () => {
      expect(SOURCE).toContain('href="/"');
    });
  });

  describe("navigation links", () => {
    it("accepts optional navLinks prop", () => {
      expect(SOURCE).toContain("navLinks?: NavLink[]");
    });

    it("renders nav links with href", () => {
      expect(SOURCE).toContain("link.href");
    });

    it("renders nav links with label", () => {
      expect(SOURCE).toContain("link.label");
    });

    it("conditionally renders links only when navLinks is non-empty", () => {
      expect(SOURCE).toContain("navLinks.length > 0");
    });

    it("hides desktop nav links on mobile (md breakpoint)", () => {
      expect(SOURCE).toContain("hidden md:flex");
    });
  });

  describe("mobile nav", () => {
    it("renders MobileNav component", () => {
      expect(SOURCE).toContain("MobileNav");
    });

    it("passes links to MobileNav", () => {
      expect(SOURCE).toContain("links={navLinks}");
    });
  });

  describe("authentication", () => {
    it("reads session from cookie via readSessionCookie", () => {
      expect(SOURCE).toContain("readSessionCookie");
    });

    it("shows login link when session is null", () => {
      expect(SOURCE).toContain("/api/auth/login");
      expect(SOURCE).toContain("login");
    });

    it("renders UserMenu when session exists", () => {
      expect(SOURCE).toContain("UserMenu");
    });

    it("passes login prop to UserMenu", () => {
      expect(SOURCE).toContain("login={session.login}");
    });

    it("passes name prop to UserMenu", () => {
      expect(SOURCE).toContain("name={session.name}");
    });

    it("passes avatarUrl prop to UserMenu", () => {
      expect(SOURCE).toContain("avatarUrl={session.avatar_url}");
    });
  });

  describe("theme toggle", () => {
    it("renders ThemeToggle component", () => {
      expect(SOURCE).toContain("ThemeToggle");
    });
  });

  describe("accessibility", () => {
    it("uses <nav> element with aria-label", () => {
      expect(SOURCE).toContain('aria-label="Main navigation"');
    });
  });

  describe("design system compliance", () => {
    it("uses fixed positioning for sticky nav", () => {
      expect(SOURCE).toContain("fixed top-0");
    });

    it("uses dark glass background", () => {
      expect(SOURCE).toContain("bg-bg/80");
      expect(SOURCE).toContain("backdrop-blur-xl");
    });

    it("uses stroke border", () => {
      expect(SOURCE).toContain("border-stroke");
    });

    it("uses font-heading for logo", () => {
      expect(SOURCE).toContain("font-heading");
    });

    it("uses max-w-7xl container width", () => {
      expect(SOURCE).toContain("max-w-7xl");
    });

    it("login link uses terminal-dim color", () => {
      expect(SOURCE).toContain("text-terminal-dim");
    });

    it("login link uses amber/50 prefix slash", () => {
      expect(SOURCE).toContain("text-amber/50");
    });
  });
});
