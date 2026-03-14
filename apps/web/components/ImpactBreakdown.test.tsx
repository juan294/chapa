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

  // Issue #279 — confidence is internal-only, hidden from developer-facing UI
  describe("confidence hidden (#279)", () => {
    it("does not render confidence score or label", () => {
      expect(SOURCE).not.toContain("impact.confidence");
      expect(SOURCE).not.toContain("Confidence");
    });

    it("does not render confidence penalties", () => {
      expect(SOURCE).not.toContain("confidencePenalties");
    });
  });

  // Issue #20 — progress bars need ARIA attributes
  describe("accessibility (#20)", () => {
    it("dimension bars have role=progressbar", () => {
      const matches = SOURCE.match(/role="progressbar"/g);
      expect(matches).not.toBeNull();
      expect(matches!.length).toBeGreaterThanOrEqual(1);
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

    it("does not contain a circular score gauge (score shown in badge)", () => {
      expect(SOURCE).not.toContain("GAUGE_CIRCUMFERENCE");
      expect(SOURCE).not.toContain("strokeDasharray");
    });

    it("has unique colors per dimension (DIMENSION_COLORS)", () => {
      expect(SOURCE).toContain("DIMENSION_COLORS");
      expect(SOURCE).toContain("linear-gradient");
    });
  });

  // Issue #281 — explanatory tooltips for badge elements
  describe("info tooltips (#281)", () => {
    it("imports InfoTooltip component", () => {
      expect(SOURCE).toContain("InfoTooltip");
    });

    it("has tooltip IDs for all four dimensions", () => {
      expect(SOURCE).toContain('"dim-delivery"');
      expect(SOURCE).toContain('"dim-quality"');
      expect(SOURCE).toContain('"dim-consistency"');
      expect(SOURCE).toContain('"dim-breadth"');
    });

    it("has tooltip IDs for all stats", () => {
      expect(SOURCE).toContain('"stat-stars"');
      expect(SOURCE).toContain('"stat-forks"');
      expect(SOURCE).toContain('"stat-watchers"');
      expect(SOURCE).toContain('"stat-active-days"');
      expect(SOURCE).toContain('"stat-commits"');
      expect(SOURCE).toContain('"stat-prs-merged"');
      expect(SOURCE).toContain('"stat-reviews"');
      expect(SOURCE).toContain('"stat-repos"');
    });

    it("does not add 'use client' directive (server component preserved)", () => {
      expect(SOURCE).not.toMatch(/^["']use client["']/m);
    });
  });

  describe("tooltip z-index elevation (#285)", () => {
    it("dimension cards elevate z-index on hover and focus-within", () => {
      // Cards with animate-fade-in-up create stacking contexts that trap
      // tooltip z-index. Cards must elevate on interaction so the active
      // tooltip renders above adjacent cards.
      const dimCardMatch = SOURCE.match(
        /className="[^"]*rounded-xl border border-stroke bg-card p-4 animate-fade-in-up[^"]*"/,
      );
      expect(dimCardMatch).not.toBeNull();
      expect(dimCardMatch![0]).toContain("hover:z-10");
      expect(dimCardMatch![0]).toContain("focus-within:z-10");
    });

    it("stat cards elevate z-index on hover and focus-within", () => {
      const statCardMatch = SOURCE.match(
        /className="[^"]*rounded-xl border border-stroke bg-card px-3 py-4 text-center animate-fade-in-up[^"]*"/,
      );
      expect(statCardMatch).not.toBeNull();
      expect(statCardMatch![0]).toContain("hover:z-10");
      expect(statCardMatch![0]).toContain("focus-within:z-10");
    });
  });

  // Data Sources is a standalone exported component (rendered on share page above breakdown)
  describe("data sources component", () => {
    it("exports a DataSources component", () => {
      expect(SOURCE).toContain("export function DataSources");
    });

    it("imports Platform type from @chapa/shared", () => {
      expect(SOURCE).toContain("Platform");
      expect(SOURCE).toMatch(/from\s+["']@chapa\/shared["']/);
    });

    it("has a PLATFORM_DISPLAY config map", () => {
      expect(SOURCE).toContain("PLATFORM_DISPLAY");
    });

    it("includes GitHub and Bitbucket SVG paths", () => {
      expect(SOURCE).toContain("M8 0c4.42 0 8 3.58 8 8");
      expect(SOURCE).toContain("M.778 1.211");
    });

    it("references stats.linkedPlatforms for additional platforms", () => {
      expect(SOURCE).toContain("stats.linkedPlatforms");
    });

    it("platform cards use design system tokens", () => {
      expect(SOURCE).toContain("border-stroke");
      expect(SOURCE).toContain("bg-card");
    });

    it("does not render Data Sources inside ImpactBreakdown", () => {
      // The ImpactBreakdown function body should not contain "Data Sources"
      const fnBody = SOURCE.slice(SOURCE.indexOf("export function ImpactBreakdown"));
      expect(fnBody).not.toContain("Data Sources");
    });

    it("accepts a handle prop for building profile URLs", () => {
      expect(SOURCE).toContain("handle: string");
    });

    it("renders GitHub as a clickable link", () => {
      expect(SOURCE).toContain("github.com/");
      expect(SOURCE).toMatch(/<a\s/);
    });

    it("has URL builders for all three platforms", () => {
      // PLATFORM_URLS should contain builders for github, bitbucket, and codeberg.
      // Bitbucket/Codeberg use the platform-specific username from linkedPlatformLogins.
      const urlsStart = SOURCE.indexOf("PLATFORM_URLS");
      const urlsEnd = SOURCE.indexOf("};", urlsStart);
      const urlsBlock = SOURCE.slice(urlsStart, urlsEnd);
      expect(urlsBlock).toContain("github");
      expect(urlsBlock).toContain("bitbucket");
      expect(urlsBlock).toContain("codeberg");
    });

    it("uses linkedPlatformLogins for platform-specific usernames", () => {
      // DataSources must read stats.linkedPlatformLogins to resolve the correct
      // username per platform (GitHub handle !== Bitbucket/Codeberg username).
      expect(SOURCE).toContain("linkedPlatformLogins");
    });

    it("builds Bitbucket profile URL with bitbucket.org", () => {
      expect(SOURCE).toContain("bitbucket.org/");
    });

    it("builds Codeberg profile URL with codeberg.org", () => {
      expect(SOURCE).toContain("codeberg.org/");
    });
  });

  describe("design system tokens (#233)", () => {
    it("uses CSS variables for dimension colors, not hardcoded hex", () => {
      expect(SOURCE).toContain("var(--color-dimension-delivery)");
      expect(SOURCE).toContain("var(--color-dimension-quality)");
      expect(SOURCE).toContain("var(--color-dimension-consistency)");
      expect(SOURCE).toContain("var(--color-dimension-breadth)");
    });

    it("does not contain hardcoded dimension hex colors", () => {
      expect(SOURCE).not.toContain('"#22c55e"');
      expect(SOURCE).not.toContain('"#f97316"');
      expect(SOURCE).not.toContain('"#06b6d4"');
      expect(SOURCE).not.toContain('"#ec4899"');
    });
  });

  describe("null safety (#QA-4)", () => {
    it("guards stats values with ?? 0 fallback for formatCompact", () => {
      // formatCompact(undefined) would produce "NaNM" — stats fields must
      // default to 0 when absent. Each stat.value must use ?? 0 or similar.
      const statFields = [
        "stats.totalStars",
        "stats.totalForks",
        "stats.totalWatchers",
        "stats.activeDays",
        "stats.commitsTotal",
        "stats.prsMergedCount",
        "stats.reviewsSubmittedCount",
        "stats.reposContributed",
      ];
      for (const field of statFields) {
        expect(SOURCE).toContain(`${field} ?? 0`);
      }
    });
  });

  describe("craft dimension (Impact v6)", () => {
    it("iterates only active dimensions — 4 when craft absent", () => {
      // The dimension iteration must filter based on craft presence.
      // When craft is absent, only delivery/quality/consistency/breadth render.
      // Source should NOT hardcode the 4 keys without a filter mechanism.
      const fnBody = SOURCE.slice(SOURCE.indexOf("export function ImpactBreakdown"));
      // Must have craft label and color entries
      expect(SOURCE).toContain('"craft"');
      // Must have a filtering mechanism for active dimensions
      expect(fnBody).toMatch(/filter|dimensions\.craft|craft\s*!=|craft\s*!==|hasCraft/);
    });

    it("has craft entries in dimension labels, colors, and tooltips", () => {
      expect(SOURCE).toContain('"Craft"');
      expect(SOURCE).toContain("var(--color-dimension-craft)");
    });
  });
});
