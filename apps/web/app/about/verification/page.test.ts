import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "page.tsx"),
  "utf-8",
);

describe("Verification explainer page (server component)", () => {
  describe("ISR configuration", () => {
    it("exports revalidate = 3600", () => {
      expect(SOURCE).toContain("export const revalidate = 3600");
    });
  });

  describe("metadata", () => {
    it("exports metadata with title", () => {
      expect(SOURCE).toContain("Badge Verification");
    });

    it("includes OpenGraph metadata", () => {
      expect(SOURCE).toContain("openGraph");
    });
  });

  describe("rendering", () => {
    it("renders Navbar", () => {
      expect(SOURCE).toContain("Navbar");
    });

    it("renders GlobalCommandBar", () => {
      expect(SOURCE).toContain("GlobalCommandBar");
    });

    it("renders main content area", () => {
      expect(SOURCE).toContain('id="main-content"');
    });
  });

  describe("content", () => {
    it("explains HMAC verification", () => {
      expect(SOURCE).toContain("HMAC");
    });
  });
});
