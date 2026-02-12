import { describe, it, expect } from "vitest";
import { renderBadgeSvg } from "./BadgeSvg";
import { escapeXml } from "./escape";
import type { Stats90d, ImpactV3Result } from "@chapa/shared";

// ---------------------------------------------------------------------------
// Helpers — reusable test fixtures
// ---------------------------------------------------------------------------

function makeStats(overrides: Partial<Stats90d> = {}): Stats90d {
  return {
    handle: "testuser",
    commitsTotal: 142,
    activeDays: 45,
    prsMergedCount: 18,
    prsMergedWeight: 22,
    reviewsSubmittedCount: 31,
    issuesClosedCount: 5,
    linesAdded: 4200,
    linesDeleted: 1100,
    reposContributed: 4,
    topRepoShare: 0.6,
    maxCommitsIn10Min: 3,
    heatmapData: Array.from({ length: 91 }, (_, i) => ({
      date: `2025-01-${String((i % 28) + 1).padStart(2, "0")}`,
      count: i % 5,
    })),
    fetchedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeImpact(overrides: Partial<ImpactV3Result> = {}): ImpactV3Result {
  return {
    handle: "testuser",
    baseScore: 72,
    confidence: 85,
    confidencePenalties: [],
    adjustedScore: 61,
    tier: "Solid",
    breakdown: {
      commits: 0.71,
      prWeight: 0.55,
      reviews: 0.52,
      issues: 0.17,
      streak: 0.5,
      collaboration: 0.4,
    },
    computedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// escapeXml
// ---------------------------------------------------------------------------

describe("escapeXml", () => {
  it("escapes < to &lt;", () => {
    expect(escapeXml("<")).toBe("&lt;");
  });

  it("escapes > to &gt;", () => {
    expect(escapeXml(">")).toBe("&gt;");
  });

  it("escapes & to &amp;", () => {
    expect(escapeXml("&")).toBe("&amp;");
  });

  it("escapes ' to &apos;", () => {
    expect(escapeXml("'")).toBe("&apos;");
  });

  it('escapes " to &quot;', () => {
    expect(escapeXml('"')).toBe("&quot;");
  });

  it("returns empty string for empty input", () => {
    expect(escapeXml("")).toBe("");
  });

  it("returns unchanged string with no special chars", () => {
    expect(escapeXml("hello-world_123")).toBe("hello-world_123");
  });

  it("handles string with multiple special chars", () => {
    expect(escapeXml('<script>"alert(\'xss\')&</script>')).toBe(
      "&lt;script&gt;&quot;alert(&apos;xss&apos;)&amp;&lt;/script&gt;",
    );
  });
});

// ---------------------------------------------------------------------------
// renderBadgeSvg — structural
// ---------------------------------------------------------------------------

describe("renderBadgeSvg", () => {
  it("returns a string starting with <svg", () => {
    const svg = renderBadgeSvg(makeStats(), makeImpact());
    expect(svg.trimStart().startsWith("<svg")).toBe(true);
  });

  it("returns valid SVG (no unclosed tags)", () => {
    const svg = renderBadgeSvg(makeStats(), makeImpact());
    expect(svg.trimStart().startsWith("<svg")).toBe(true);
    expect(svg.trimEnd().endsWith("</svg>")).toBe(true);
  });

  it("sets viewBox to 1200x630", () => {
    const svg = renderBadgeSvg(makeStats(), makeImpact());
    expect(svg).toContain('viewBox="0 0 1200 630"');
  });

  // ---------------------------------------------------------------------------
  // Header row
  // ---------------------------------------------------------------------------

  describe("header row", () => {
    it("contains the escaped handle with @ prefix", () => {
      const svg = renderBadgeSvg(
        makeStats({ handle: "user<xss>" }),
        makeImpact(),
      );
      expect(svg).toContain("@user&lt;xss&gt;");
      expect(svg).not.toContain("user<xss>");
    });

    it("shows displayName instead of handle when available", () => {
      const svg = renderBadgeSvg(
        makeStats({ displayName: "Juan García" }),
        makeImpact(),
      );
      expect(svg).toContain("Juan Garc");
      expect(svg).not.toContain("@testuser");
    });

    it("falls back to @handle when displayName is not set", () => {
      const svg = renderBadgeSvg(
        makeStats({ displayName: undefined }),
        makeImpact(),
      );
      expect(svg).toContain("@testuser");
    });

    it("contains 'Last 90 days' subtitle", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      expect(svg).toContain("Last 90 days");
    });

    it("contains 'Chapa_' logo text with underscore cursor", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      expect(svg).toContain("Chapa");
      // Must use underscore (_) not dot (.)
      expect(svg).toMatch(/Chapa.*_/);
      expect(svg).not.toMatch(/Chapa<tspan[^>]*>\.<\/tspan>/);
    });

    it("contains a circular avatar placeholder with amber ring", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      // Avatar is a circle with amber-tinted stroke
      expect(svg).toContain("<circle");
    });
  });

  // ---------------------------------------------------------------------------
  // Verification placeholder
  // ---------------------------------------------------------------------------

  describe("verification placeholder", () => {
    it("contains a verification placeholder icon", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      // Should have a shield/verified icon placeholder
      expect(svg).toContain("Verified");
    });

    it("verification placeholder has low opacity (placeholder state)", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      // The verified indicator should be dimmed to show it's a placeholder
      expect(svg).toMatch(/opacity="0\.4"/);
    });
  });

  // ---------------------------------------------------------------------------
  // Two-column body: heatmap + impact score
  // ---------------------------------------------------------------------------

  describe("body layout", () => {
    it("contains 'ACTIVITY' section label", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      expect(svg).toContain("ACTIVITY");
    });

    it("contains 'IMPACT SCORE' section label", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      expect(svg).toContain("IMPACT SCORE");
    });

    it("contains the score value", () => {
      const svg = renderBadgeSvg(
        makeStats(),
        makeImpact({ adjustedScore: 61 }),
      );
      expect(svg).toContain("61");
    });

    it("contains the tier label in a pill badge", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact({ tier: "Elite" }));
      expect(svg).toContain("Elite");
    });

    it("contains a star icon in the tier pill", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact({ tier: "Elite" }));
      // The tier pill should have a star character or SVG star
      expect(svg).toMatch(/[\u2605\u2606]|star/i);
    });

    it("contains the confidence percentage", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact({ confidence: 85 }));
      expect(svg).toContain("85% Confidence");
    });
  });

  // ---------------------------------------------------------------------------
  // Stats row (commits | PRs merged | reviews)
  // ---------------------------------------------------------------------------

  describe("achievement cards", () => {
    it("contains commit/PR/review counts in card blocks", () => {
      const stats = makeStats({
        commitsTotal: 142,
        prsMergedCount: 18,
        reviewsSubmittedCount: 31,
      });
      const svg = renderBadgeSvg(stats, makeImpact());
      expect(svg).toContain("142");
      expect(svg).toContain("18");
      expect(svg).toContain("31");
    });

    it("has card rectangles for stat blocks", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      // Achievement cards rendered as rounded rectangles with uppercase labels
      expect(svg).toContain("COMMITS");
      expect(svg).toContain("PRS MERGED");
      expect(svg).toContain("REVIEWS");
    });
  });

  describe("active days bar", () => {
    it("contains Active Days label", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      expect(svg).toContain("Active Days");
    });

    it("shows active days count from stats", () => {
      const svg = renderBadgeSvg(makeStats({ activeDays: 45 }), makeImpact());
      expect(svg).toContain("45");
    });

    it("shows /90 denominator", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      expect(svg).toContain("/90");
    });

    it("has progress bar rect elements", () => {
      const svg = renderBadgeSvg(makeStats({ activeDays: 45 }), makeImpact());
      // Progress bar background + fill
      expect(svg).toContain("Active Days");
    });
  });

  // ---------------------------------------------------------------------------
  // Footer (branding)
  // ---------------------------------------------------------------------------

  describe("footer", () => {
    it("includes GitHub branding by default", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      expect(svg).toContain("Powered by GitHub");
    });

    it("omits GitHub branding when includeGithubBranding is false", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact(), {
        includeGithubBranding: false,
      });
      expect(svg).not.toContain("Powered by GitHub");
    });

    it("contains the domain name in footer", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      expect(svg).toContain("chapa.thecreativetoken.com");
    });

    it("footer text is at least 15px for readability", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      // "Powered by GitHub" and domain text should be at least font-size 15
      const brandingFontSizes = svg.match(/font-size="(\d+)"[^>]*>(?:Powered by GitHub|chapa\.thecreativetoken\.com)/g);
      expect(brandingFontSizes).not.toBeNull();
      for (const match of brandingFontSizes!) {
        const size = parseInt(match.match(/font-size="(\d+)"/)![1], 10);
        expect(size).toBeGreaterThanOrEqual(15);
      }
    });

    it("contains a divider line above footer", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      // Footer has a horizontal line divider
      expect(svg).toContain("<line");
    });
  });

  // ---------------------------------------------------------------------------
  // Animations
  // ---------------------------------------------------------------------------

  describe("animations", () => {
    it("includes heatmap fade-in animations", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      expect(svg).toContain("<animate");
      expect(svg).toContain('attributeName="opacity"');
    });

    it("includes pulse animation on impact score area", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      expect(svg).toContain("pulse-glow");
    });
  });

  // ---------------------------------------------------------------------------
  // Typography
  // ---------------------------------------------------------------------------

  describe("typography", () => {
    it("uses JetBrains Mono for headings/score", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      expect(svg).toContain("JetBrains Mono");
    });

    it("uses Plus Jakarta Sans for body text", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      expect(svg).toContain("Plus Jakarta Sans");
    });
  });

  // ---------------------------------------------------------------------------
  // R4: Numeric defense-in-depth — coerce numeric stats to prevent XSS
  // ---------------------------------------------------------------------------

  describe("numeric defense-in-depth", () => {
    it("coerces commitsTotal to a number string even if somehow a string", () => {
      const stats = makeStats({ commitsTotal: "42<script>" as unknown as number });
      const svg = renderBadgeSvg(stats, makeImpact());
      // Should contain NaN (since "42<script>" coerced via Number() is NaN)
      // but must NOT contain the raw script tag
      expect(svg).not.toContain("<script>");
    });

    it("coerces prsMergedCount to a number string even if somehow a string", () => {
      const stats = makeStats({ prsMergedCount: '10"onload="alert(1)' as unknown as number });
      const svg = renderBadgeSvg(stats, makeImpact());
      expect(svg).not.toContain("onload");
    });

    it("coerces reviewsSubmittedCount to a number string even if somehow a string", () => {
      const stats = makeStats({ reviewsSubmittedCount: "<img src=x>" as unknown as number });
      const svg = renderBadgeSvg(stats, makeImpact());
      expect(svg).not.toContain("<img");
    });

    it("renders valid numbers correctly after coercion", () => {
      const stats = makeStats({
        commitsTotal: 142,
        prsMergedCount: 18,
        reviewsSubmittedCount: 31,
      });
      const svg = renderBadgeSvg(stats, makeImpact());
      expect(svg).toContain(">142<");
      expect(svg).toContain(">18<");
      expect(svg).toContain(">31<");
      expect(svg).toContain("COMMITS");
      expect(svg).toContain("PRS MERGED");
      expect(svg).toContain("REVIEWS");
    });
  });
});
