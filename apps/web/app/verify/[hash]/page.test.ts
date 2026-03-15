import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "page.tsx"),
  "utf-8",
);

describe("VerifyPage", () => {
  describe("hash validation", () => {
    it("defines HASH_PATTERN for 8 or 16 hex characters", () => {
      expect(SOURCE).toContain("HASH_PATTERN");
      expect(SOURCE).toMatch(/\/\^.*[0-9a-f].*\$\//);
    });

    it("tests hash against HASH_PATTERN before fetching", () => {
      expect(SOURCE).toContain("HASH_PATTERN.test(hash)");
    });
  });

  describe("verification states", () => {
    it("renders VerifiedCard when record exists", () => {
      expect(SOURCE).toContain("<VerifiedCard");
    });

    it("renders NotFoundCard when record is null", () => {
      expect(SOURCE).toContain("<NotFoundCard");
    });

    it("renders InvalidHashCard for malformed hashes", () => {
      expect(SOURCE).toContain("<InvalidHashCard");
    });
  });

  describe("VerifiedCard content", () => {
    it("displays 'Verified Badge' heading", () => {
      expect(SOURCE).toContain("Verified Badge");
    });

    it("shows developer handle as a link to share page", () => {
      expect(SOURCE).toContain("href={`/u/${record.handle}`}");
    });

    it("shows impact score", () => {
      expect(SOURCE).toContain("{record.adjustedComposite}");
    });

    it("shows tier", () => {
      expect(SOURCE).toContain("{record.tier}");
    });

    it("shows archetype", () => {
      expect(SOURCE).toContain("{record.archetype}");
    });

    it("shows profile type", () => {
      expect(SOURCE).toContain("{record.profileType}");
    });

    it("shows display name when present", () => {
      expect(SOURCE).toContain("record.displayName &&");
      expect(SOURCE).toContain("{record.displayName}");
    });

    it("shows generation date", () => {
      expect(SOURCE).toContain("{record.generatedAt}");
    });

    it("links to badge SVG", () => {
      expect(SOURCE).toContain("href={`/u/${record.handle}/badge.svg`}");
    });
  });

  describe("NotFoundCard content", () => {
    it("displays 'Not Found' heading", () => {
      expect(SOURCE).toContain("Not Found");
    });

    it("mentions 30-day record retention", () => {
      expect(SOURCE).toContain("30 days");
    });

    it("shows the queried hash", () => {
      // NotFoundCard receives and displays the hash
      expect(SOURCE).toMatch(/function NotFoundCard\(\{.*hash.*\}/);
    });
  });

  describe("InvalidHashCard content", () => {
    it("displays 'Invalid Hash' heading", () => {
      expect(SOURCE).toContain("Invalid Hash");
    });

    it("explains the expected format", () => {
      expect(SOURCE).toContain("8 or 16 hex characters");
    });
  });

  describe("dimensions display", () => {
    it("renders all four dimension keys from record", () => {
      expect(SOURCE).toContain("Object.entries(record.dimensions)");
    });

    it("rounds dimension values to integers", () => {
      expect(SOURCE).toContain("Math.round(value)");
    });
  });

  describe("key metrics display", () => {
    it("shows commits total", () => {
      expect(SOURCE).toContain("{record.commitsTotal}");
    });

    it("shows PRs merged count", () => {
      expect(SOURCE).toContain("{record.prsMergedCount}");
    });

    it("shows reviews submitted count", () => {
      expect(SOURCE).toContain("{record.reviewsSubmittedCount}");
    });
  });

  describe("heading hierarchy (#288)", () => {
    it("uses <h2> for Dimensions section heading", () => {
      expect(SOURCE).toMatch(/<h2[^>]*>[\s\S]*?Dimensions[\s\S]*?<\/h2>/);
    });

    it("uses <h2> for Key Metrics section heading", () => {
      expect(SOURCE).toMatch(/<h2[^>]*>[\s\S]*?Key Metrics[\s\S]*?<\/h2>/);
    });

    it("section headings use font-heading class", () => {
      const h2Matches = SOURCE.match(/<h2[^>]*className="[^"]*font-heading[^"]*"/g) ?? [];
      expect(h2Matches.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("metadata generation", () => {
    it("exports generateMetadata function", () => {
      expect(SOURCE).toContain("export async function generateMetadata");
    });

    it("includes 'Chapa' in title for valid hashes", () => {
      expect(SOURCE).toContain("Chapa");
    });

    it("returns 'Invalid Hash' title for invalid hashes", () => {
      expect(SOURCE).toContain("Invalid Hash");
    });

    it("disables indexing with robots noindex", () => {
      expect(SOURCE).toContain("index: false");
    });
  });

  describe("data fetching", () => {
    it("imports getVerificationRecord", () => {
      expect(SOURCE).toContain("getVerificationRecord");
    });

    it("calls getVerificationRecord with the hash", () => {
      expect(SOURCE).toContain("getVerificationRecord(hash)");
    });
  });

  describe("design system compliance", () => {
    it("uses semantic background tokens", () => {
      expect(SOURCE).toContain("bg-bg");
      expect(SOURCE).toContain("bg-card");
    });

    it("uses terminal color tokens for status indicators", () => {
      expect(SOURCE).toContain("text-terminal-green");
      expect(SOURCE).toContain("text-terminal-yellow");
      expect(SOURCE).toContain("text-terminal-red");
    });

    it("uses stroke border token", () => {
      expect(SOURCE).toContain("border-stroke");
    });

    it("uses font-heading for headings", () => {
      expect(SOURCE).toContain("font-heading");
    });

    it("all three cards have h1 headings", () => {
      const h1Matches = SOURCE.match(/<h1\b/g) ?? [];
      expect(h1Matches.length).toBe(3);
    });
  });

  describe("accessibility", () => {
    it("has main landmark with id for skip link", () => {
      expect(SOURCE).toContain('id="main-content"');
    });

    it("decorative icons have aria-hidden", () => {
      const svgMatches = SOURCE.match(/<svg[\s\S]*?>/g) ?? [];
      for (const svg of svgMatches) {
        expect(svg).toContain('aria-hidden="true"');
      }
    });
  });
});
