import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "page.tsx"),
  "utf-8",
);

describe("Generating page (server component)", () => {
  describe("component type", () => {
    it("is an async function (server component)", () => {
      expect(SOURCE).toContain("async function");
    });
  });

  describe("validation", () => {
    it("validates the handle parameter", () => {
      expect(SOURCE).toContain("isValidHandle");
    });

    it("calls notFound for invalid handles", () => {
      expect(SOURCE).toContain("notFound()");
    });
  });

  describe("metadata", () => {
    it("exports generateMetadata", () => {
      expect(SOURCE).toContain("generateMetadata");
    });

    it("sets robots noindex", () => {
      expect(SOURCE).toContain("index: false");
    });
  });

  describe("rendering", () => {
    it("renders GeneratingProgress component", () => {
      expect(SOURCE).toContain("GeneratingProgress");
    });

    it("passes handle to GeneratingProgress", () => {
      expect(SOURCE).toContain("handle={handle}");
    });
  });
});
