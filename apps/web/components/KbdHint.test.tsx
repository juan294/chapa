// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = readFileSync(
  join(__dirname, "KbdHint.tsx"),
  "utf-8",
);

describe("KbdHint", () => {
  describe("source structure", () => {
    it("is a client component", () => {
      expect(SRC).toMatch(/^"use client"/);
    });

    it("exports KbdHint as a named export", () => {
      expect(SRC).toMatch(/export\s+function\s+KbdHint/);
    });

    it("accepts keys prop (string array)", () => {
      expect(SRC).toMatch(/keys\s*:\s*string\[\]/);
    });

    it("accepts optional className prop", () => {
      expect(SRC).toMatch(/className\s*\?\s*:\s*string/);
    });
  });

  describe("rendering", () => {
    it("renders a <kbd> element for each key", () => {
      expect(SRC).toMatch(/keys\.map/);
      expect(SRC).toMatch(/<kbd\b/);
    });

    it("uses font-heading for monospace consistency", () => {
      expect(SRC).toMatch(/font-heading/);
    });

    it("uses terminal-dim color for subtlety", () => {
      expect(SRC).toMatch(/text-terminal-dim/);
    });

    it("has a small text size", () => {
      expect(SRC).toMatch(/text-\[10px\]|text-\[11px\]|text-xs/);
    });
  });

  describe("platform awareness", () => {
    it("detects macOS for modifier symbols", () => {
      expect(SRC).toMatch(/navigator\s*\.?\s*platform|userAgent|mac/i);
    });

    it("maps modifier symbols for non-Mac", () => {
      // Should convert ⌘ → Ctrl, ⇧ → Shift on non-Mac
      expect(SRC).toMatch(/Ctrl/);
    });
  });

  describe("accessibility", () => {
    it("hides hint from screen readers (decorative)", () => {
      expect(SRC).toMatch(/aria-hidden/);
    });
  });

  describe("responsive", () => {
    it("is hidden on mobile (md breakpoint)", () => {
      expect(SRC).toMatch(/hidden\s+md:inline-flex|hidden\s+md:flex|hidden\s+md:inline/);
    });
  });
});
