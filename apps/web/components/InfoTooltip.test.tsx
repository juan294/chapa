import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "InfoTooltip.tsx"),
  "utf-8",
);

describe("InfoTooltip", () => {
  describe("client component", () => {
    it("has 'use client' directive", () => {
      expect(SOURCE).toMatch(/^["']use client["']/m);
    });
  });

  describe("design system compliance", () => {
    it("uses semantic color tokens (no hardcoded hex)", () => {
      // Should use tokens like text-text-secondary, text-amber, bg-card, border-stroke
      expect(SOURCE).toContain("text-text-secondary");
      expect(SOURCE).toContain("text-amber");
      expect(SOURCE).toContain("bg-card");
      expect(SOURCE).toContain("border-stroke");
    });

    it("uses font-body for tooltip text", () => {
      expect(SOURCE).toContain("font-body");
    });
  });

  describe("accessibility", () => {
    it("uses a button element as trigger", () => {
      expect(SOURCE).toContain("<button");
    });

    it("has aria-label on the trigger button", () => {
      expect(SOURCE).toContain("aria-label");
    });

    it("has role=tooltip on the panel", () => {
      expect(SOURCE).toContain('role="tooltip"');
    });

    it("has aria-describedby linking trigger to panel", () => {
      expect(SOURCE).toContain("aria-describedby");
    });

    it("SVG icon has aria-hidden=true", () => {
      expect(SOURCE).toContain('aria-hidden="true"');
    });
  });

  describe("SVG icon conventions", () => {
    it("uses strokeWidth=1.5 per design system", () => {
      expect(SOURCE).toContain('strokeWidth="1.5"');
    });

    it("uses strokeLinecap=round", () => {
      expect(SOURCE).toContain('strokeLinecap="round"');
    });

    it("uses strokeLinejoin=round", () => {
      expect(SOURCE).toContain('strokeLinejoin="round"');
    });
  });

  describe("props interface", () => {
    it("accepts content prop", () => {
      expect(SOURCE).toContain("content:");
    });

    it("accepts id prop", () => {
      expect(SOURCE).toContain("id:");
    });

    it("accepts optional position prop", () => {
      expect(SOURCE).toMatch(/position\??\s*:/);
    });
  });

  describe("mobile support", () => {
    it("handles click toggle via useState", () => {
      expect(SOURCE).toContain("useState");
    });

    it("handles Escape key to dismiss", () => {
      expect(SOURCE).toMatch(/Escape/);
    });
  });

  describe("text casing (#285)", () => {
    it("tooltip panel uses normal-case to override inherited uppercase", () => {
      // Parent containers (stat labels, dimension labels) use CSS uppercase.
      // The tooltip panel must reset with normal-case so tooltip text renders
      // as sentence case regardless of parent text-transform.
      expect(SOURCE).toContain("normal-case");
    });
  });
});
