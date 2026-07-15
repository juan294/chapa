import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "NavbarShell.tsx"),
  "utf-8",
);

/**
 * NavbarShell is the single presentational component shared by the
 * server-side `Navbar` and client-side `NavbarClient` (#1025). Markup,
 * ARIA, and design-system assertions live here instead of being duplicated
 * across both wrapper components' test files.
 */
describe("NavbarShell", () => {
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
      expect(SOURCE).toContain("navLinks?: NavLinkItem[]");
    });

    it("renders nav links with href", () => {
      expect(SOURCE).toContain("link.href");
    });

    it("renders nav links with label", () => {
      expect(SOURCE).toContain("link.label");
    });

    it("keys nav links by href (stable across locale-driven label changes)", () => {
      expect(SOURCE).toContain("key={link.href}");
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

  describe("authentication slot", () => {
    it("shows login link when session is null and not loading", () => {
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

    it("passes a single isAdmin prop to UserMenu (unified admin source, #1025)", () => {
      expect(SOURCE).toContain("isAdmin={isAdmin}");
    });
  });

  describe("loading placeholder (#1025 / FE-L2)", () => {
    it("renders a placeholder instead of the logged-out UI while loading", () => {
      expect(SOURCE).toContain("loading ?");
      expect(SOURCE).toContain('data-testid="navbar-auth-placeholder"');
    });

    it("placeholder is decorative and reserves slot width to avoid CLS", () => {
      expect(SOURCE).toContain('aria-hidden="true"');
      expect(SOURCE).toMatch(/h-8 w-20/);
    });

    it("wraps the auth-dependent slot in suppressHydrationWarning", () => {
      expect(SOURCE).toContain("suppressHydrationWarning");
    });

    it("defaults loading to false (server variant never passes it)", () => {
      expect(SOURCE).toContain("loading = false");
    });
  });

  describe("theme toggle", () => {
    it("renders ThemeToggle component", () => {
      expect(SOURCE).toContain("ThemeToggle");
    });
  });

  describe("language switcher", () => {
    it("renders LanguageSwitcher component", () => {
      expect(SOURCE).toContain("LanguageSwitcher");
    });
  });

  describe("accessibility", () => {
    it("uses <nav> element with aria-label", () => {
      expect(SOURCE).toContain("aria.mainNavigation");
    });

    it("uses NavLink component for nav links (supports aria-current)", () => {
      expect(SOURCE).toContain("NavLink");
      expect(SOURCE).toMatch(/<NavLink\s/);
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

    it("right controls container uses tighter gap on mobile (gap-1 sm:gap-2, #240)", () => {
      expect(SOURCE).toContain("gap-1 sm:gap-2");
    });
  });
});
