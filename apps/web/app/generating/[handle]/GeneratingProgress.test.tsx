import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "GeneratingProgress.tsx"),
  "utf-8",
);

describe("GeneratingProgress", () => {
  it("has 'use client' directive", () => {
    expect(SOURCE).toMatch(/^["']use client["']/m);
  });

  describe("progress steps", () => {
    it("shows 'Authenticated with GitHub' step", () => {
      expect(SOURCE).toContain("Authenticated with GitHub");
    });

    it("shows 'Fetching contribution data' step", () => {
      expect(SOURCE).toContain("Fetching contribution data");
    });

    it("shows 'Computing Impact profile' step", () => {
      expect(SOURCE).toContain("Computing Impact profile");
    });

    it("shows 'Rendering badge' step", () => {
      expect(SOURCE).toContain("Rendering badge");
    });
  });

  describe("API integration", () => {
    it("calls POST /api/generate", () => {
      expect(SOURCE).toContain('"/api/generate"');
      expect(SOURCE).toContain('"POST"');
    });

    it("includes credentials for session cookie", () => {
      expect(SOURCE).toContain('"include"');
    });
  });

  describe("navigation", () => {
    it("uses useRouter for redirect", () => {
      expect(SOURCE).toContain("useRouter");
    });

    it("redirects to /u/:handle on success", () => {
      expect(SOURCE).toContain("/u/${handle}");
    });
  });

  describe("error handling", () => {
    it("has error state", () => {
      expect(SOURCE).toContain("error");
    });

    it("provides a retry mechanism", () => {
      expect(SOURCE).toMatch(/try again/i);
    });
  });

  describe("accessibility", () => {
    it("uses aria-live for progress announcements", () => {
      expect(SOURCE).toContain("aria-live");
    });

    it("uses role=status for progress area", () => {
      expect(SOURCE).toContain('role="status"');
    });
  });

  describe("design system compliance", () => {
    it("uses JetBrains Mono for terminal text (font-heading)", () => {
      expect(SOURCE).toContain("font-heading");
    });

    it("uses terminal-green for success checkmarks", () => {
      expect(SOURCE).toContain("terminal-green");
    });

    it("uses amber accent color", () => {
      expect(SOURCE).toContain("text-amber");
    });

    it("uses bg-bg for page background", () => {
      expect(SOURCE).toContain("bg-bg");
    });
  });
});
