import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "UserMenu.tsx"),
  "utf-8",
);

describe("UserMenu", () => {
  describe("client component", () => {
    it("has 'use client' directive", () => {
      expect(SOURCE).toMatch(/^["']use client["']/m);
    });
  });

  describe("accessibility", () => {
    it("trigger has aria-expanded attribute", () => {
      expect(SOURCE).toContain("aria-expanded");
    });

    it("trigger has aria-haspopup='true'", () => {
      expect(SOURCE).toContain('aria-haspopup="true"');
    });

    it("trigger has aria-label for user menu", () => {
      expect(SOURCE).toContain('aria-label="User menu"');
    });

    it("dropdown panel has role='menu'", () => {
      expect(SOURCE).toContain('role="menu"');
    });

    it("menu items have role='menuitem'", () => {
      expect(SOURCE).toContain('role="menuitem"');
    });
  });

  describe("dropdown structure", () => {
    it("has sign out link pointing to /api/auth/logout", () => {
      expect(SOURCE).toContain("/api/auth/logout");
    });

    it("has link to user badge page", () => {
      expect(SOURCE).toContain("Your Badge");
    });

    it("has About Chapa link", () => {
      expect(SOURCE).toContain("/about");
    });

    it("has Terms of Service link", () => {
      expect(SOURCE).toContain("/terms");
    });

    it("has Privacy Policy link", () => {
      expect(SOURCE).toContain("/privacy");
    });
  });

  describe("keyboard interaction", () => {
    it("listens for Escape key to close", () => {
      expect(SOURCE).toContain("Escape");
    });
  });

  describe("avatar fallback", () => {
    it("handles image error for avatar fallback", () => {
      expect(SOURCE).toContain("onError");
    });
  });
});
