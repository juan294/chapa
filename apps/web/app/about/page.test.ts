import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "page.tsx"),
  "utf-8",
);

describe("About page", () => {
  describe("metadata", () => {
    it("exports metadata with title", () => {
      expect(SOURCE).toContain('title: "About"');
    });

    it("exports metadata with description", () => {
      expect(SOURCE).toContain("description:");
    });
  });

  it("exports a default component", () => {
    expect(SOURCE).toContain("export default function AboutPage");
  });

  describe("logo branding", () => {
    it("uses underscore cursor instead of dot for Chapa logo", () => {
      // The logo should use "Chapa_" with blinking cursor, not "Chapa."
      expect(SOURCE).toContain("Chapa<span");
      expect(SOURCE).toContain("animate-cursor-blink");
      expect(SOURCE).toContain(">_</span>");
    });

    it("does NOT use the old dot logo", () => {
      // Ensure the old "Chapa." pattern with just a dot is not present in the heading
      expect(SOURCE).not.toMatch(/>About Chapa<span[^>]*>\.<\/span>/);
    });
  });

  describe("scoring methodology link", () => {
    it("does NOT link to the scoring methodology page", () => {
      expect(SOURCE).not.toContain('href="/about/scoring"');
      expect(SOURCE).not.toContain("full scoring methodology");
    });

    it("does NOT mention publishing weights or caps", () => {
      expect(SOURCE).not.toContain("Every weight, cap, and decision");
    });
  });
});
