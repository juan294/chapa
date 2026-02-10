import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "ImpactBreakdown.tsx"),
  "utf-8",
);

describe("ImpactBreakdown", () => {
  // Issue #18 — "use client" should be removed (purely presentational)
  describe("server component (#18)", () => {
    it("does not have a 'use client' directive", () => {
      expect(SOURCE).not.toMatch(/^["']use client["']/m);
    });
  });

  // W4 — headings must use font-heading per design system
  describe("design system typography", () => {
    it("h3 elements include font-heading class", () => {
      const h3Matches = SOURCE.match(/<h3[^>]*>/g) ?? [];
      expect(h3Matches.length).toBeGreaterThan(0);
      for (const h3 of h3Matches) {
        expect(h3).toContain("font-heading");
      }
    });
  });

  // Issue #20 — progress bars need ARIA attributes
  describe("accessibility (#20)", () => {
    it("confidence bar has role=progressbar", () => {
      // The confidence bar is the inner div with bg-amber and width style
      expect(SOURCE).toContain('role="progressbar"');
    });

    it("confidence bar has aria-valuenow for confidence", () => {
      expect(SOURCE).toMatch(/aria-valuenow=\{impact\.confidence\}/);
    });

    it("confidence bar has aria-valuemin and aria-valuemax", () => {
      expect(SOURCE).toContain("aria-valuemin={0}");
      expect(SOURCE).toContain("aria-valuemax={100}");
    });

    it("confidence bar has aria-label", () => {
      expect(SOURCE).toContain('aria-label="Confidence score"');
    });

    it("breakdown bars have role=progressbar", () => {
      // There should be at least 2 progressbar roles: 1 for confidence + N for breakdown bars
      const matches = SOURCE.match(/role="progressbar"/g);
      expect(matches).not.toBeNull();
      expect(matches!.length).toBeGreaterThanOrEqual(2);
    });

    it("breakdown bars have aria-valuenow with the computed value", () => {
      // Breakdown bars show Math.round(value * 100), so aria-valuenow should use same
      expect(SOURCE).toMatch(
        /aria-valuenow=\{Math\.round\(value \* 100\)\}/,
      );
    });

    it("breakdown bars have aria-label with the signal name", () => {
      // The label should dynamically use the signal label
      expect(SOURCE).toMatch(/aria-label=\{`.*score`\}/i);
    });
  });
});
