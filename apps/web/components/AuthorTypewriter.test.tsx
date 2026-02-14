import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "AuthorTypewriter.tsx"),
  "utf-8",
);

describe("AuthorTypewriter", () => {
  describe("client component", () => {
    it("has 'use client' directive", () => {
      expect(SOURCE).toMatch(/^["']use client["']/m);
    });
  });

  describe("accessibility", () => {
    it("has aria-label on trigger pill", () => {
      expect(SOURCE).toContain("aria-label=");
    });

    it("social links have aria-label attributes", () => {
      expect(SOURCE).toContain('aria-label={link.label}');
    });

    it("decorative SVGs are aria-hidden", () => {
      expect(SOURCE).toContain('aria-hidden="true"');
    });
  });

  describe("keyboard accessibility (#219)", () => {
    it("popover becomes visible on focus-within (not just hover)", () => {
      // The popover container must use group-focus-within: alongside group-hover:
      // to make social links reachable by keyboard
      expect(SOURCE).toContain("group-focus-within:opacity-100");
    });

    it("popover becomes interactive on focus-within (pointer-events)", () => {
      // pointer-events must be auto on focus-within so links are clickable/tabbable
      expect(SOURCE).toContain("group-focus-within:pointer-events-auto");
    });

    it("popover translates into position on focus-within", () => {
      expect(SOURCE).toContain("group-focus-within:translate-y-0");
    });

    it("popover scales to full size on focus-within", () => {
      expect(SOURCE).toContain("group-focus-within:scale-100");
    });

    it("trigger pill has tabIndex to ensure focusability", () => {
      expect(SOURCE).toMatch(/tabIndex=\{0\}/);
    });
  });

  describe("existing hover behavior preserved", () => {
    it("still has group-hover:opacity-100", () => {
      expect(SOURCE).toContain("group-hover:opacity-100");
    });

    it("still has group-hover:pointer-events-auto", () => {
      expect(SOURCE).toContain("group-hover:pointer-events-auto");
    });

    it("still has group-hover:translate-y-0", () => {
      expect(SOURCE).toContain("group-hover:translate-y-0");
    });

    it("still has group-hover:scale-100", () => {
      expect(SOURCE).toContain("group-hover:scale-100");
    });
  });
});
