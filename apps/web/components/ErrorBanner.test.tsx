import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "ErrorBanner.tsx"),
  "utf-8",
);

describe("ErrorBanner", () => {
  describe("client component", () => {
    it("has 'use client' directive", () => {
      expect(SOURCE).toMatch(/^["']use client["']/m);
    });
  });

  describe("props", () => {
    it("accepts message prop", () => {
      expect(SOURCE).toContain("message: string");
    });

    it("renders the message text", () => {
      expect(SOURCE).toContain("{message}");
    });
  });

  describe("accessibility", () => {
    it("has role='alert' for screen reader announcement", () => {
      expect(SOURCE).toContain('role="alert"');
    });

    it("has aria-label on dismiss button", () => {
      // Now uses t('aria.dismissError') via useTranslation()
      expect(SOURCE).toContain("aria.dismissError");
    });

    it("has aria-hidden on decorative icons", () => {
      expect(SOURCE).toContain('aria-hidden="true"');
    });
  });

  describe("dismiss behavior", () => {
    it("uses useState for dismissed state", () => {
      expect(SOURCE).toContain("useState(false)");
    });

    it("has a dismiss button", () => {
      expect(SOURCE).toContain('type="button"');
    });

    it("sets dismissed to true on click", () => {
      expect(SOURCE).toContain("setDismissed(true)");
    });

    it("returns null when dismissed", () => {
      expect(SOURCE).toContain("if (dismissed) return null");
    });
  });

  describe("icons", () => {
    it("uses inline SVG for warning icon (no icon library)", () => {
      expect(SOURCE).toContain("<svg");
      expect(SOURCE).toContain("</svg>");
    });

    it("has a warning triangle path (exclamation icon)", () => {
      // The warning icon path for the triangle
      expect(SOURCE).toContain("L1.82 18");
    });

    it("has a close/X icon for dismiss button", () => {
      // X icon has two crossing lines
      expect(SOURCE).toContain('x1="18" y1="6" x2="6" y2="18"');
      expect(SOURCE).toContain('x1="6" y1="6" x2="18" y2="18"');
    });
  });

  describe("design system compliance", () => {
    it("uses terminal-red color scheme for the banner (#739)", () => {
      expect(SOURCE).toContain("bg-terminal-red/10");
      expect(SOURCE).toContain("text-terminal-red");
    });

    it("uses terminal-red-tinted border (#739)", () => {
      expect(SOURCE).toContain("border-terminal-red/30");
    });

    it("does NOT use amber colors for error banner (#739)", () => {
      expect(SOURCE).not.toContain("bg-amber/10");
      expect(SOURCE).not.toContain("border-amber/30");
    });

    it("uses fixed positioning below navbar", () => {
      expect(SOURCE).toContain("fixed top-[73px]");
    });

    it("uses backdrop blur for glass effect", () => {
      expect(SOURCE).toContain("backdrop-blur-sm");
    });
  });
});
