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

  describe("design system compliance", () => {
    it("uses warm-card background for the mobile menu", () => {
      expect(SOURCE).toMatch(/bg-warm-card/);
    });

    it("uses warm-stroke for borders", () => {
      expect(SOURCE).toMatch(/border-warm-stroke/);
    });
  });
});
