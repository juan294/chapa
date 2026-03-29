import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "NavbarClient.tsx"),
  "utf-8",
);

describe("NavbarClient", () => {
  describe("client component", () => {
    it("has 'use client' directive", () => {
      expect(SOURCE).toMatch(/^["']use client["']/m);
    });

    it("does NOT call headers() from next/headers", () => {
      expect(SOURCE).not.toContain("from \"next/headers\"");
      expect(SOURCE).not.toContain("from 'next/headers'");
    });

    it("fetches session from /api/auth/session", () => {
      expect(SOURCE).toContain("/api/auth/session");
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
  });

  describe("accessibility", () => {
    it("uses <nav> element with aria-label", () => {
      expect(SOURCE).toContain('aria-label="Main navigation"');
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
});
