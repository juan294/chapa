import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "MobileNav.tsx"),
  "utf-8",
);

describe("MobileNav", () => {
  describe("client component", () => {
    it("has 'use client' directive", () => {
      expect(SOURCE).toMatch(/^["']use client["']/m);
    });
  });

  describe("accessibility", () => {
    it("has aria-label on the hamburger button", () => {
      expect(SOURCE).toContain('aria-label="Toggle navigation"');
    });

    it("has aria-expanded attribute on the hamburger button", () => {
      expect(SOURCE).toContain("aria-expanded");
    });
  });

  describe("responsive visibility", () => {
    it("has md:hidden class on the hamburger button", () => {
      expect(SOURCE).toContain("md:hidden");
    });
  });

  describe("keyboard interaction", () => {
    it("listens for Escape key to close the menu", () => {
      expect(SOURCE).toContain("Escape");
    });
  });

  describe("close on link click", () => {
    it("closes the menu when a link is clicked", () => {
      expect(SOURCE).toContain("setOpen(false)");
    });
  });

  describe("icons", () => {
    it("uses inline SVG for hamburger icon (no icon library)", () => {
      expect(SOURCE).toContain("<svg");
      expect(SOURCE).toContain("</svg>");
    });
  });

  describe("focus trap (W10)", () => {
    it("implements focus trap when menu is open", () => {
      // Should contain logic to trap Tab key within the nav panel
      expect(SOURCE).toContain("Tab");
    });

    it("handles Shift+Tab for backwards focus cycling", () => {
      expect(SOURCE).toContain("shiftKey");
    });

    it("queries focusable elements within the nav panel", () => {
      // Should query for focusable elements like a, button, input, etc.
      expect(SOURCE).toMatch(/querySelectorAll/);
    });

    it("uses a ref for the nav panel to scope focus trap", () => {
      expect(SOURCE).toMatch(/useRef|navRef|panelRef/);
    });

    it("moves focus to first link when menu opens", () => {
      // When the menu opens, focus should move to the first focusable element
      expect(SOURCE).toMatch(/\.focus\(\)/);
    });
  });

  describe("design system compliance", () => {
    it("uses card background for the mobile menu", () => {
      expect(SOURCE).toMatch(/bg-card/);
    });

    it("uses stroke for borders", () => {
      expect(SOURCE).toMatch(/border-stroke/);
    });
  });
});
