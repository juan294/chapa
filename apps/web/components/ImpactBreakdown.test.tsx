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
      const matches = SOURCE.match(/role="progressbar"/g);
      expect(matches).not.toBeNull();
      expect(matches!.length).toBeGreaterThanOrEqual(2);
    });

    it("dimension bars have aria-valuenow with the dimension score", () => {
      expect(SOURCE).toMatch(
        /aria-valuenow=\{dims\[key\]\}/,
      );
    });

    it("breakdown bars have aria-label with the signal name", () => {
      expect(SOURCE).toMatch(/aria-label=\{`.*score`\}/i);
    });
  });

  // Issue #202 — accepts StatsData for extended stats display
  describe("athlete dashboard (#202)", () => {
    it("accepts stats: StatsData prop", () => {
      expect(SOURCE).toContain("stats: StatsData");
    });

    it("displays forks and watchers", () => {
      expect(SOURCE).toContain("stats.totalForks");
      expect(SOURCE).toContain("stats.totalWatchers");
    });

    it("displays all 8 key stats", () => {
      expect(SOURCE).toContain("stats.totalStars");
      expect(SOURCE).toContain("stats.totalForks");
      expect(SOURCE).toContain("stats.totalWatchers");
      expect(SOURCE).toContain("stats.activeDays");
      expect(SOURCE).toContain("stats.commitsTotal");
      expect(SOURCE).toContain("stats.prsMergedCount");
      expect(SOURCE).toContain("stats.reviewsSubmittedCount");
      expect(SOURCE).toContain("stats.reposContributed");
    });

    it("has a circular score gauge SVG", () => {
      expect(SOURCE).toContain("GAUGE_CIRCUMFERENCE");
      expect(SOURCE).toContain("strokeDasharray");
      expect(SOURCE).toContain("strokeDashoffset");
    });

    it("renders dimension cards with gradient bars", () => {
      expect(SOURCE).toContain("bg-gradient-to-r from-amber-dark to-amber-light");
    });
  });
});
