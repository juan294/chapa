import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "loading.tsx"),
  "utf-8",
);

describe("Root loading.tsx", () => {
  describe("accessibility", () => {
    it("has role='status' for screen reader announcement", () => {
      expect(SOURCE).toContain('role="status"');
    });

    it("has sr-only text for screen readers", () => {
      expect(SOURCE).toContain("sr-only");
    });

    it("has aria-hidden on decorative elements", () => {
      expect(SOURCE).toContain('aria-hidden="true"');
    });
  });

  describe("landmark", () => {
    it("has id='main-content' on the main element", () => {
      expect(SOURCE).toContain('id="main-content"');
    });

    it("uses a <main> element", () => {
      expect(SOURCE).toContain("<main");
    });
  });

  describe("design system compliance", () => {
    it("uses font-heading for terminal elements", () => {
      expect(SOURCE).toContain("font-heading");
    });

    it("uses bg-bg for page background", () => {
      expect(SOURCE).toContain("bg-bg");
    });

    it("uses text-amber accent color", () => {
      expect(SOURCE).toContain("text-amber");
    });

    it("uses text-terminal-dim for dim text", () => {
      expect(SOURCE).toContain("text-terminal-dim");
    });

    it("uses text-text-secondary for secondary text", () => {
      expect(SOURCE).toContain("text-text-secondary");
    });

    it("uses border-stroke for terminal-style borders", () => {
      expect(SOURCE).toContain("border-stroke");
    });
  });

  describe("terminal aesthetic", () => {
    it("uses animate-cursor-blink for blinking cursor", () => {
      expect(SOURCE).toContain("animate-cursor-blink");
    });

    it("uses animate-terminal-fade-in for fade-in effect", () => {
      expect(SOURCE).toContain("animate-terminal-fade-in");
    });

    it("contains terminal-style prompt character", () => {
      // Terminal prompt uses $ or > character
      expect(SOURCE).toMatch(/[>$]/);
    });

    it("simulates terminal command output lines", () => {
      // Should have multiple skeleton lines that simulate terminal output
      expect(SOURCE).toContain("bg-text-secondary/");
    });
  });

  describe("reduced motion support", () => {
    it("references motion-reduce for reduced motion support", () => {
      expect(SOURCE).toContain("motion-reduce:");
    });
  });

  describe("lightweight implementation", () => {
    it("renders a default export function", () => {
      expect(SOURCE).toMatch(/export default function/);
    });

    it("is a server component (no 'use client' directive)", () => {
      expect(SOURCE).not.toMatch(/^["']use client["']/m);
    });

    it("does not import heavy dependencies", () => {
      expect(SOURCE).not.toContain("useState");
      expect(SOURCE).not.toContain("useEffect");
      expect(SOURCE).not.toContain("useRef");
    });
  });
});
