import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "page.tsx"),
  "utf-8",
);

describe("Studio page (server component)", () => {
  describe("component type", () => {
    it("is NOT a client component", () => {
      expect(SOURCE).not.toMatch(/^["']use client["']/m);
    });

    it("is an async function", () => {
      expect(SOURCE).toContain("async function");
    });

    it("is force-dynamic", () => {
      expect(SOURCE).toMatch(/export\s+const\s+dynamic\s*=\s*["']force-dynamic["']/);
    });
  });

  describe("feature flag gate", () => {
    it("checks isStudioEnabled", () => {
      expect(SOURCE).toContain("isStudioEnabled");
    });

    it("redirects when studio is disabled", () => {
      expect(SOURCE).toContain("redirect");
    });
  });

  describe("authentication", () => {
    it("reads NEXTAUTH_SECRET from env", () => {
      expect(SOURCE).toContain("NEXTAUTH_SECRET");
    });

    it("trims the secret", () => {
      expect(SOURCE).toContain(".trim()");
    });

    it("reads session cookie", () => {
      expect(SOURCE).toContain("readSessionCookie");
    });

    it("redirects unauthenticated users to login", () => {
      expect(SOURCE).toContain("/api/auth/login");
    });

    it("reads headers for cookie extraction", () => {
      expect(SOURCE).toContain("headers()");
    });
  });

  describe("data fetching", () => {
    it("fetches stats and config in parallel with Promise.all", () => {
      expect(SOURCE).toContain("Promise.all");
    });

    it("fetches stats via getStats", () => {
      expect(SOURCE).toContain("getStats");
    });

    it("fetches saved config from cache", () => {
      expect(SOURCE).toContain("cacheGet");
      expect(SOURCE).toContain("config:");
    });

    it("computes impact with computeImpactV6", () => {
      expect(SOURCE).toContain("computeImpactV6");
    });

    it("falls back to empty stats when fetch fails", () => {
      expect(SOURCE).toContain("buildEmptyStats");
    });

    it("falls back to DEFAULT_BADGE_CONFIG when no saved config", () => {
      expect(SOURCE).toContain("DEFAULT_BADGE_CONFIG");
    });
  });

  describe("rendering", () => {
    it("renders Navbar", () => {
      expect(SOURCE).toContain("Navbar");
    });

    it("renders StudioClient with required props", () => {
      expect(SOURCE).toContain("StudioClient");
      expect(SOURCE).toContain("initialConfig");
      expect(SOURCE).toContain("stats=");
      expect(SOURCE).toContain("impact=");
      expect(SOURCE).toContain("handle=");
    });

    it("has a main element", () => {
      expect(SOURCE).toContain('id="main-content"');
    });
  });

  describe("metadata", () => {
    it("exports metadata", () => {
      expect(SOURCE).toContain("metadata");
    });

    it("has title", () => {
      expect(SOURCE).toContain("Creator Studio");
    });
  });

  describe("buildEmptyStats helper", () => {
    it("generates 366 heatmap entries", () => {
      expect(SOURCE).toContain("366");
    });

    it("sets all counts to 0", () => {
      expect(SOURCE).toContain("commitsTotal: 0");
      expect(SOURCE).toContain("activeDays: 0");
    });
  });
});
