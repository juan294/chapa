import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "BadgeToolbar.tsx"),
  "utf-8",
);

describe("BadgeToolbar", () => {
  describe("client component", () => {
    it("has a 'use client' directive", () => {
      expect(SOURCE).toMatch(/^["']use client["']/m);
    });
  });

  describe("refresh button", () => {
    it("is owner-only", () => {
      expect(SOURCE).toContain("isOwner");
    });

    it("calls the refresh API endpoint", () => {
      expect(SOURCE).toContain("/api/refresh?handle=");
    });

    it("has aria-label for accessibility", () => {
      expect(SOURCE).toContain('aria-label="Refresh badge data"');
    });

    it("shows loading state with animate-spin", () => {
      expect(SOURCE).toContain("animate-spin");
    });
  });

  describe("share dropdown", () => {
    it("has aria-expanded attribute", () => {
      expect(SOURCE).toContain("aria-expanded");
    });

    it("has aria-haspopup attribute", () => {
      expect(SOURCE).toContain('aria-haspopup="true"');
    });

    it("dropdown menu has role=menu", () => {
      expect(SOURCE).toContain('role="menu"');
    });

    it("menu items have role=menuitem", () => {
      expect(SOURCE).toContain('role="menuitem"');
    });

    it("links to X/Twitter intent URL", () => {
      expect(SOURCE).toContain("x.com/intent/tweet");
    });

    it("tracks share event with PostHog", () => {
      expect(SOURCE).toContain("trackEvent");
      expect(SOURCE).toContain("share_clicked");
    });

    it("opens links in new tab with security attributes", () => {
      expect(SOURCE).toContain('target="_blank"');
      expect(SOURCE).toContain('rel="noopener noreferrer"');
    });
  });

  describe("customize link", () => {
    it("links to /studio", () => {
      expect(SOURCE).toContain('href="/studio"');
    });

    it("is gated behind studioEnabled", () => {
      expect(SOURCE).toContain("studioEnabled");
    });
  });

  describe("click-outside handling", () => {
    it("uses useRef for dropdown", () => {
      expect(SOURCE).toContain("useRef");
    });

    it("adds mousedown event listener", () => {
      expect(SOURCE).toContain("mousedown");
    });
  });
});
