import { describe, it, expect } from "vitest";
import { renderBadgeSvg } from "./BadgeSvg";
import { escapeXml } from "./escape";
import type { Stats90d, ImpactV4Result } from "@chapa/shared";

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
    totalStars: 0,
    heatmapData: Array.from({ length: 91 }, (_, i) => ({
      date: `2025-01-${String((i % 28) + 1).padStart(2, "0")}`,
      count: i % 5,
    })),
    fetchedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeImpact(overrides: Partial<ImpactV4Result> = {}): ImpactV4Result {
  return {
    handle: "testuser",
    dimensions: {
      building: 72,
      guarding: 55,
      consistency: 68,
      breadth: 48,
    },
    archetype: "Builder",
    compositeScore: 61,
    confidence: 85,
    confidencePenalties: [],
    adjustedComposite: 58,
    tier: "Solid",
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
      expect(svg).not.toContain("https://avatars.githubusercontent.com/u/123");
    });

    it("falls back to octocat icon when no avatarDataUri and no avatarUrl", () => {
      const svg = renderBadgeSvg(
        makeStats({ avatarUrl: undefined }),
        makeImpact(),
      );
      expect(svg).toContain("<circle");
      expect(svg).toContain("M14 0C6.27");
    });

    it("falls back to octocat icon when avatarUrl exists but avatarDataUri is not provided", () => {
      const svg = renderBadgeSvg(
        makeStats({ avatarUrl: "https://avatars.githubusercontent.com/u/123" }),
        makeImpact(),
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
      expect(svg).toContain("M12 1L3 5v6");
    });

    it("does NOT contain the word 'Verified' as text", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      expect(svg).not.toContain(">Verified<");
    });

    it("verified icon has low opacity", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      expect(svg).toMatch(/opacity="0\.4"/);
    });
  });

  // ---------------------------------------------------------------------------
  // Two-column body: heatmap + developer profile
  // ---------------------------------------------------------------------------

  describe("body layout", () => {
    it("contains 'ACTIVITY' section label", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      expect(svg).toContain("ACTIVITY");
    });

    it("contains 'DEVELOPER PROFILE' section label", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      expect(svg).toContain("DEVELOPER PROFILE");
    });

    it("contains the archetype label", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact({ archetype: "Builder" }));
      expect(svg).toContain("Builder");
    });

    it("contains the composite score", () => {
      const svg = renderBadgeSvg(
        makeStats(),
        makeImpact({ adjustedComposite: 58 }),
      );
      expect(svg).toContain(">58<");
    });

    it("contains the tier label", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact({ tier: "Elite" }));
      expect(svg).toContain("Elite");
    });

    it("contains a star icon in the archetype pill", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      expect(svg).toMatch(/[\u2605\u2606]|star/i);
    });

    it("contains the confidence percentage", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact({ confidence: 85 }));
      expect(svg).toContain("85% Confidence");
    });

    it("contains a radar chart with polygon", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      // Radar chart data shape
      expect(svg).toContain("fill-opacity");
      expect(svg).toContain("<polygon");
    });

    it("radar chart shows dimension labels", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      expect(svg).toContain("Building");
      expect(svg).toContain("Guarding");
      expect(svg).toContain("Consistency");
      expect(svg).toContain("Breadth");
    });
  });

  // ---------------------------------------------------------------------------
  // Stars display
  // ---------------------------------------------------------------------------

  describe("stars display", () => {
    it("contains a star symbol (★)", () => {
      const svg = renderBadgeSvg(makeStats({ totalStars: 42 }), makeImpact());
      expect(svg).toContain("\u2605");
    });

    it("shows formatted star count", () => {
      const svg = renderBadgeSvg(makeStats({ totalStars: 1234 }), makeImpact());
      expect(svg).toContain("1.2k");
    });

    it("shows 'stars' label text", () => {
      const svg = renderBadgeSvg(makeStats({ totalStars: 50 }), makeImpact());
      expect(svg).toContain("stars");
    });

    it("shows 0 stars when totalStars is 0", () => {
      const svg = renderBadgeSvg(makeStats({ totalStars: 0 }), makeImpact());
      expect(svg).toContain("\u2605");
      expect(svg).toMatch(/★.*0/);
    });
  });

  // ---------------------------------------------------------------------------
  // Dimension cards (4 across: Building, Guarding, Consistency, Breadth)
  // ---------------------------------------------------------------------------

  describe("dimension cards", () => {
    it("contains all 4 dimension scores", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact({
        dimensions: { building: 72, guarding: 55, consistency: 68, breadth: 48 },
      }));
      expect(svg).toContain(">72<");
      expect(svg).toContain(">55<");
      expect(svg).toContain(">68<");
      expect(svg).toContain(">48<");
    });

    it("has card labels for all 4 dimensions", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      expect(svg).toContain("BUILDING");
      expect(svg).toContain("GUARDING");
      expect(svg).toContain("CONSISTENCY");
      expect(svg).toContain("BREADTH");
    });

    it("has card rectangles for dimension blocks", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      // At least 4 card rectangles
      const cardRects = [...svg.matchAll(/fill="rgba\(255,255,255,0\.04\)"/g)];
      expect(cardRects.length).toBeGreaterThanOrEqual(4);
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
      const brandingFontSizes = svg.match(/font-size="(\d+)"[^>]*>(?:Powered by GitHub|chapa\.thecreativetoken\.com)/g);
      expect(brandingFontSizes).not.toBeNull();
      for (const match of brandingFontSizes!) {
        const size = parseInt(match.match(/font-size="(\d+)"/)![1], 10);
        expect(size).toBeGreaterThanOrEqual(17);
      }
    });

    it("footer text opacity is at least 0.75 for readability", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      const opacityMatches = [...svg.matchAll(/opacity="([0-9.]+)"[^>]*>(?:Powered by GitHub|chapa\.thecreativetoken\.com)/g)];
      expect(opacityMatches.length).toBeGreaterThanOrEqual(1);
      for (const match of opacityMatches) {
        expect(parseFloat(match[1])).toBeGreaterThanOrEqual(0.75);
      }
    });

    it("contains a divider line above footer", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      expect(svg).toContain("<line");
    });
  });

  // ---------------------------------------------------------------------------
  // Font size and contrast parity
  // ---------------------------------------------------------------------------

  describe("font size and contrast parity", () => {
    it("section labels use textPrimary color for contrast", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      const activityMatch = svg.match(/fill="([^"]+)"[^>]*>ACTIVITY/);
      const profileMatch = svg.match(/fill="([^"]+)"[^>]*>DEVELOPER PROFILE/);
      expect(activityMatch).not.toBeNull();
      expect(profileMatch).not.toBeNull();
      expect(activityMatch![1]).toBe("#E6EDF3");
      expect(profileMatch![1]).toBe("#E6EDF3");
    });

    it("dimension card labels font-size is at least 13", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      for (const label of ["BUILDING", "GUARDING", "CONSISTENCY", "BREADTH"]) {
        const regex = new RegExp(`font-size="(\\d+)"[^>]*>${label}`);
        const match = svg.match(regex);
        expect(match).not.toBeNull();
        const size = parseInt(match![1], 10);
        expect(size).toBeGreaterThanOrEqual(13);
      }
    });

    it("subtitle font-size is at least 19 to display at ~14px", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      const match = svg.match(/font-size="(\d+)"[^>]*>Last 90 days/);
      expect(match).not.toBeNull();
      expect(parseInt(match![1], 10)).toBeGreaterThanOrEqual(19);
    });

    it("confidence text font-size is at least 15", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      const match = svg.match(/font-size="(\d+)"[^>]*>\d+% Confidence/);
      expect(match).not.toBeNull();
      expect(parseInt(match![1], 10)).toBeGreaterThanOrEqual(15);
    });

    it("archetype pill text font-size is at least 17", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      const match = svg.match(/font-size="(\d+)"[^>]*font-weight="600"[^>]*text-anchor="middle"[^>]*>★/);
      expect(match).not.toBeNull();
      expect(parseInt(match![1], 10)).toBeGreaterThanOrEqual(17);
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

    it("includes pulse animation on composite score area", () => {
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
  // Numeric defense-in-depth — coerce dimension scores to prevent XSS
  // ---------------------------------------------------------------------------

  describe("numeric defense-in-depth", () => {
    it("coerces dimension scores to number strings even if somehow strings", () => {
      const impact = makeImpact({
        dimensions: {
          building: '42<script>' as unknown as number,
          guarding: 55,
          consistency: 68,
          breadth: 48,
        },
      });
      const svg = renderBadgeSvg(makeStats(), impact);
      expect(svg).not.toContain("<script>");
    });

    it("renders valid dimension numbers correctly after coercion", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact({
        dimensions: { building: 72, guarding: 55, consistency: 68, breadth: 48 },
      }));
      expect(svg).toContain(">72<");
      expect(svg).toContain(">55<");
      expect(svg).toContain(">68<");
      expect(svg).toContain(">48<");
      expect(svg).toContain("BUILDING");
      expect(svg).toContain("GUARDING");
      expect(svg).toContain("CONSISTENCY");
      expect(svg).toContain("BREADTH");
    });
  });

  // ---------------------------------------------------------------------------
  // Archetype display
  // ---------------------------------------------------------------------------

  describe("archetype display", () => {
    it("shows each archetype type correctly", () => {
      const archetypes = ["Builder", "Guardian", "Marathoner", "Polymath", "Balanced", "Emerging"] as const;
      for (const archetype of archetypes) {
        const svg = renderBadgeSvg(makeStats(), makeImpact({ archetype }));
        expect(svg).toContain(archetype);
      }
    });
  });
});
