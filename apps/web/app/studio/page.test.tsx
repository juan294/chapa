import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "page.tsx"),
  "utf-8",
);

describe("Studio page (server component)", () => {
  describe("component type", () => {
    it("is NOT a client component (no 'use client')", () => {
      expect(SOURCE).not.toMatch(/^["']use client["']/m);
    });

    it("is an async function (server component)", () => {
      expect(SOURCE).toContain("async function");
    });
  });

  describe("authentication", () => {
    it("reads session cookie", () => {
      expect(SOURCE).toContain("readSessionCookie");
    });

    it("redirects unauthenticated users", () => {
      expect(SOURCE).toContain("redirect");
    });

    it("redirects to login", () => {
      expect(SOURCE).toContain("/api/auth/login");
    });
  });

  describe("data fetching", () => {
    it("fetches user stats", () => {
      expect(SOURCE).toContain("getStats90d");
    });

    it("computes impact score", () => {
      expect(SOURCE).toContain("computeImpactV4");
    });

    it("loads saved badge config", () => {
      expect(SOURCE).toContain("config:");
    });

    it("uses cacheGet for config", () => {
      expect(SOURCE).toContain("cacheGet");
    });
  });

  describe("rendering", () => {
    it("renders Navbar", () => {
      expect(SOURCE).toContain("Navbar");
    });

    it("renders StudioClient", () => {
      expect(SOURCE).toContain("StudioClient");
    });

    it("passes stats to client", () => {
      expect(SOURCE).toContain("stats=");
    });

    it("passes impact to client", () => {
      expect(SOURCE).toContain("impact=");
    });

    it("passes config to client", () => {
      expect(SOURCE).toContain("initialConfig");
    });
  });

  describe("metadata", () => {
    it("exports metadata", () => {
      expect(SOURCE).toContain("metadata");
    });
  });
});
