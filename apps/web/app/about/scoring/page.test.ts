import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "page.tsx"),
  "utf-8",
);

describe("Scoring methodology page", () => {
  it("gates on isScoringPageEnabled feature flag", () => {
    expect(SOURCE).toContain("isScoringPageEnabled");
  });

  it("calls notFound when flag is disabled", () => {
    expect(SOURCE).toContain("notFound");
  });

  it("exports a default component", () => {
    expect(SOURCE).toMatch(/export default function \w+/);
  });

  describe("design system compliance", () => {
    it("uses font-heading for headings", () => {
      expect(SOURCE).toContain("font-heading");
    });

    it("uses dark background", () => {
      expect(SOURCE).toContain("bg-bg");
    });

    it("includes Navbar", () => {
      expect(SOURCE).toContain("Navbar");
    });
  });
});
