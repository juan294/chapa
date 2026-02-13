import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "RefreshBadgeButton.tsx"),
  "utf-8",
);

describe("RefreshBadgeButton", () => {
  describe("client component", () => {
    it("has 'use client' directive", () => {
      expect(SOURCE).toMatch(/^["']use client["']/m);
    });
  });

  describe("props", () => {
    it("accepts handle prop", () => {
      expect(SOURCE).toContain("handle: string");
    });
  });

  describe("state management", () => {
    it("uses status state with idle initial value", () => {
      expect(SOURCE).toContain('"idle" | "loading" | "success" | "error"');
      expect(SOURCE).toContain('"idle")');
    });

    it("tracks loading state", () => {
      expect(SOURCE).toContain('"loading"');
    });

    it("tracks success state", () => {
      expect(SOURCE).toContain('"success"');
    });

    it("tracks error state", () => {
      expect(SOURCE).toContain('"error"');
    });
  });

  describe("icon-only button with title states (#202)", () => {
    it("shows 'Refresh badge data' title when idle", () => {
      expect(SOURCE).toContain('"Refresh badge data"');
    });

    it("shows refreshing title when loading", () => {
      expect(SOURCE).toMatch(/Refreshing/);
    });

    it("shows refreshed title on success", () => {
      expect(SOURCE).toContain('"Refreshed!"');
    });

    it("shows failed title on error", () => {
      expect(SOURCE).toMatch(/Failed.*try again/);
    });

    it("has aria-label for accessibility", () => {
      expect(SOURCE).toContain('aria-label="Refresh badge data"');
    });
  });

  describe("API interaction", () => {
    it("calls /api/refresh endpoint with POST method", () => {
      expect(SOURCE).toContain("/api/refresh?handle=");
      expect(SOURCE).toContain('method: "POST"');
    });

    it("encodes the handle in the URL", () => {
      expect(SOURCE).toContain("encodeURIComponent(handle)");
    });

    it("checks res.ok for success", () => {
      expect(SOURCE).toContain("res.ok");
    });

    it("reloads page on success after delay", () => {
      expect(SOURCE).toContain("window.location.reload()");
    });

    it("resets to idle on error after delay", () => {
      expect(SOURCE).toContain('setStatus("error")');
      expect(SOURCE).toContain('setStatus("idle")');
    });

    it("handles fetch exceptions (network errors)", () => {
      expect(SOURCE).toContain("catch");
    });
  });

  describe("disabled behavior", () => {
    it("disables button during loading", () => {
      expect(SOURCE).toContain('status === "loading"');
    });

    it("disables button on success", () => {
      expect(SOURCE).toContain('status === "success"');
    });

    it("has disabled styling", () => {
      expect(SOURCE).toContain("disabled:opacity-50");
      expect(SOURCE).toContain("disabled:cursor-not-allowed");
    });
  });

  describe("loading animation", () => {
    it("applies spin animation to icon when loading", () => {
      expect(SOURCE).toContain("animate-spin");
    });

    it("conditionally applies spin based on loading status", () => {
      expect(SOURCE).toContain('status === "loading" ? "animate-spin"');
    });
  });

  describe("icons", () => {
    it("uses inline SVG for refresh icon (no icon library)", () => {
      expect(SOURCE).toContain("<svg");
      expect(SOURCE).toContain("</svg>");
    });

    it("has aria-hidden on decorative icon", () => {
      expect(SOURCE).toContain('aria-hidden="true"');
    });
  });

  describe("design system compliance (#202)", () => {
    it("uses icon-only circular button style", () => {
      expect(SOURCE).toContain("border border-stroke");
      expect(SOURCE).toContain("rounded-full");
    });

    it("uses text-secondary color", () => {
      expect(SOURCE).toContain("text-text-secondary");
    });

    it("has hover state with amber accent", () => {
      expect(SOURCE).toContain("hover:border-amber/30");
      expect(SOURCE).toContain("hover:text-amber");
    });

    it("is positioned absolutely for badge overlay", () => {
      expect(SOURCE).toContain("absolute");
    });
  });
});
