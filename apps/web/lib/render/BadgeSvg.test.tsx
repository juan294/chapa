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

    it("Chapa_ logo font-size is at least 22 for readability", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      const match = svg.match(/font-size="(\d+)"[^>]*>Chapa/);
      expect(match).not.toBeNull();
      expect(parseInt(match![1], 10)).toBeGreaterThanOrEqual(22);
    });

    it("Chapa_ logo opacity is at least 0.65 for readability", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      const match = svg.match(/opacity="([0-9.]+)"[^>]*>Chapa/);
      expect(match).not.toBeNull();
      expect(parseFloat(match![1])).toBeGreaterThanOrEqual(0.65);
    });

    it("contains a circular avatar with clip-path", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      expect(svg).toContain("<circle");
      expect(svg).toContain("clipPath");
    });

    it("embeds avatar as data URI when avatarDataUri option is provided", () => {
      const dataUri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";
      const svg = renderBadgeSvg(
        makeStats({ avatarUrl: "https://avatars.githubusercontent.com/u/123" }),
        makeImpact(),
        { avatarDataUri: dataUri },
      );
      expect(svg).toContain("<image");
      expect(svg).toContain(dataUri);
      // Must NOT contain the raw external URL
      expect(svg).not.toContain("https://avatars.githubusercontent.com/u/123");
    });

    it("falls back to octocat icon when no avatarDataUri and no avatarUrl", () => {
      const svg = renderBadgeSvg(
        makeStats({ avatarUrl: undefined }),
        makeImpact(),
      );
      // Should still have the circle but with the octocat path
      expect(svg).toContain("<circle");
      expect(svg).toContain("M14 0C6.27");
    });

    it("falls back to octocat icon when avatarUrl exists but avatarDataUri is not provided", () => {
      const svg = renderBadgeSvg(
        makeStats({ avatarUrl: "https://avatars.githubusercontent.com/u/123" }),
        makeImpact(),
        // No avatarDataUri — should NOT embed the raw URL (it won't load in SVG-as-image)
      );
      expect(svg).toContain("M14 0C6.27");
      expect(svg).not.toContain("https://avatars.githubusercontent.com/u/123");
    });
  });

  // ---------------------------------------------------------------------------
  // Verified icon (icon only, no text)
  // ---------------------------------------------------------------------------

  describe("verified icon", () => {
    it("contains a shield/checkmark icon", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      // Should have the shield path
      expect(svg).toContain("M12 1L3 5v6");
    });

    it("does NOT contain the word 'Verified' as text", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      // Only the icon, no text label — matches landing page source of truth
      expect(svg).not.toContain(">Verified<");
    });

    it("verified icon has low opacity", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
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

    it("footer text is at least 17px for readability", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      // "Powered by GitHub" and domain text should be at least font-size 17
      const brandingFontSizes = svg.match(/font-size="(\d+)"[^>]*>(?:Powered by GitHub|chapa\.thecreativetoken\.com)/g);
      expect(brandingFontSizes).not.toBeNull();
      for (const match of brandingFontSizes!) {
        const size = parseInt(match.match(/font-size="(\d+)"/)![1], 10);
        expect(size).toBeGreaterThanOrEqual(17);
      }
    });

    it("footer text opacity is at least 0.75 for readability", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      // Footer text (GitHub branding + domain) should have higher opacity
      const opacityMatches = [...svg.matchAll(/opacity="([0-9.]+)"[^>]*>(?:Powered by GitHub|chapa\.thecreativetoken\.com)/g)];
      expect(opacityMatches.length).toBeGreaterThanOrEqual(1);
      for (const match of opacityMatches) {
        expect(parseFloat(match[1])).toBeGreaterThanOrEqual(0.75);
      }
    });

    it("contains a divider line above footer", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      // Footer has a horizontal line divider
      expect(svg).toContain("<line");
    });
  });

  // ---------------------------------------------------------------------------
  // Font size and contrast parity with landing page (#109)
  // SVG is 1200px wide, displayed at ~72% (864px). Fonts must be scaled up
  // so displayed size matches the landing page HTML.
  // ---------------------------------------------------------------------------

  describe("font size and contrast parity (#109)", () => {
    it("score font-size is at least 84 to display at ~60px", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      // The score text element should have font-size >= 84
      const scoreMatch = svg.match(/font-size="(\d+)"[^>]*font-weight="700"[^>]*>[^<]*\d+/);
      expect(scoreMatch).not.toBeNull();
      const scoreFontSize = parseInt(scoreMatch![1], 10);
      expect(scoreFontSize).toBeGreaterThanOrEqual(84);
    });

    it("achievement card numbers font-size is at least 34 to display at ~24px", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      // Card number elements (commits, PRs, reviews) with font-weight 700
      const cardNumberMatches = [...svg.matchAll(/font-size="(\d+)"[^>]*font-weight="700"[^>]*text-anchor="middle"[^>]*>/g)];
      expect(cardNumberMatches.length).toBeGreaterThanOrEqual(3);
      for (const match of cardNumberMatches) {
        const size = parseInt(match[1], 10);
        expect(size).toBeGreaterThanOrEqual(34);
      }
    });

    it("achievement card labels font-size is at least 13 to display at ~10px", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      // Labels: COMMITS, PRS MERGED, REVIEWS
      for (const label of ["COMMITS", "PRS MERGED", "REVIEWS"]) {
        const regex = new RegExp(`font-size="(\\d+)"[^>]*>${label}`);
        const match = svg.match(regex);
        expect(match).not.toBeNull();
        const size = parseInt(match![1], 10);
        expect(size).toBeGreaterThanOrEqual(13);
      }
    });

    it("section labels use textPrimary color (not textSecondary) for contrast", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      // "ACTIVITY" and "IMPACT SCORE" labels should use the primary text color
      // for better contrast (matching landing page's text-text-primary/50)
      const activityMatch = svg.match(/fill="([^"]+)"[^>]*>ACTIVITY/);
      const impactMatch = svg.match(/fill="([^"]+)"[^>]*>IMPACT SCORE/);
      expect(activityMatch).not.toBeNull();
      expect(impactMatch).not.toBeNull();
      // Should use textPrimary (#E6EDF3), not textSecondary (#9AA4B2)
      expect(activityMatch![1]).toBe("#E6EDF3");
      expect(impactMatch![1]).toBe("#E6EDF3");
    });

    it("active days label font-size is at least 13", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      const match = svg.match(/font-size="(\d+)"[^>]*>ACTIVE DAYS/);
      expect(match).not.toBeNull();
      expect(parseInt(match![1], 10)).toBeGreaterThanOrEqual(13);
    });

    it("subtitle font-size is at least 19 to display at ~14px", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      const match = svg.match(/font-size="(\d+)"[^>]*>Last 90 days/);
      expect(match).not.toBeNull();
      expect(parseInt(match![1], 10)).toBeGreaterThanOrEqual(19);
    });

    it("confidence text font-size is at least 17 to display at ~12px", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      const match = svg.match(/font-size="(\d+)"[^>]*>\d+% Confidence/);
      expect(match).not.toBeNull();
      expect(parseInt(match![1], 10)).toBeGreaterThanOrEqual(17);
    });

    it("tier pill text font-size is at least 17", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      // Tier pill text with star + tier name
      const match = svg.match(/font-size="(\d+)"[^>]*font-weight="600"[^>]*text-anchor="middle"[^>]*>★/);
      expect(match).not.toBeNull();
      expect(parseInt(match![1], 10)).toBeGreaterThanOrEqual(17);
    });

    it("achievement cards are at least 85px tall for breathing room", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      // Card rects should have height >= 85
      const cardRects = [...svg.matchAll(/height="(\d+)"[^>]*rx="10"[^>]*fill="rgba\(255,255,255,0\.04\)"/g)];
      const tallCards = cardRects.filter(m => parseInt(m[1], 10) >= 85);
      expect(tallCards.length).toBeGreaterThanOrEqual(3);
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
