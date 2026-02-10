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

  describe("arrow key navigation (W9)", () => {
    it("handles ArrowDown key to move focus to next menuitem", () => {
      expect(SOURCE).toContain("ArrowDown");
    });

    it("handles ArrowUp key to move focus to previous menuitem", () => {
      expect(SOURCE).toContain("ArrowUp");
    });

    it("handles Home key to move focus to first menuitem", () => {
      expect(SOURCE).toContain("Home");
    });

    it("handles End key to move focus to last menuitem", () => {
      expect(SOURCE).toContain("End");
    });

    it("uses refs to track menu item elements", () => {
      expect(SOURCE).toMatch(/useRef|itemsRef|menuItemsRef/);
    });

    it("implements wrapping navigation (last to first, first to last)", () => {
      // Wrapping is implemented via modulo arithmetic on the index
      expect(SOURCE).toMatch(/%\s*items\.length|% items\.length|% count|% len/);
    });
  });

  describe("avatar dimensions (R12)", () => {
    it("trigger avatar img has explicit width attribute", () => {
      // The trigger avatar (w-8 h-8 = 32px) must have width={32}
      expect(SOURCE).toMatch(/width=\{32\}/);
    });

    it("trigger avatar img has explicit height attribute", () => {
      expect(SOURCE).toMatch(/height=\{32\}/);
    });

    it("dropdown avatar img has explicit width attribute", () => {
      // The dropdown header avatar (w-10 h-10 = 40px) must have width={40}
      expect(SOURCE).toMatch(/width=\{40\}/);
    });

    it("dropdown avatar img has explicit height attribute", () => {
      expect(SOURCE).toMatch(/height=\{40\}/);
    });
  });

  describe("avatar fallback", () => {
    it("handles image error for avatar fallback", () => {
      expect(SOURCE).toContain("onError");
    });
  });
});
