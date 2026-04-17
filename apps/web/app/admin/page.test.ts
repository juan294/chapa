import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "page.tsx"),
  "utf-8",
);

describe("Admin page (server component)", () => {
  describe("component type", () => {
    it("is NOT a client component", () => {
      expect(SOURCE).not.toMatch(/^["']use client["']/m);
    });

    it("is an async function", () => {
      expect(SOURCE).toContain("async function");
    });
  });

  describe("authentication", () => {
    it("uses the shared server session helper", () => {
      expect(SOURCE).toContain("getOptionalServerSessionFromHeaders");
    });

    it("redirects unauthenticated users", () => {
      expect(SOURCE).toContain("redirect");
    });

    it("checks admin handle", () => {
      expect(SOURCE).toContain("isAdminHandle");
    });
  });

  describe("metadata", () => {
    it("exports metadata", () => {
      expect(SOURCE).toContain("metadata");
    });

    it("sets robots noindex", () => {
      expect(SOURCE).toContain("index: false");
    });
  });

  describe("rendering", () => {
    it("renders Navbar", () => {
      expect(SOURCE).toContain("Navbar");
    });

    it("renders AdminDashboardClient", () => {
      expect(SOURCE).toContain("AdminDashboardClient");
    });

    it("renders GlobalCommandBar with admin flag", () => {
      expect(SOURCE).toContain("GlobalCommandBar");
      expect(SOURCE).toContain("isAdmin");
    });

    it("has a screen-reader heading", () => {
      expect(SOURCE).toContain("sr-only");
      expect(SOURCE).toContain("Admin Dashboard");
    });
  });
});
