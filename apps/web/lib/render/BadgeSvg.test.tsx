import { describe, it, expect } from "vitest";
import { renderBadgeSvg } from "./BadgeSvg";
import { escapeXml } from "./escape";
import type { StatsData, ImpactV4Result } from "@chapa/shared";

// ---------------------------------------------------------------------------
// Helpers — reusable test fixtures
// ---------------------------------------------------------------------------

function makeStats(overrides: Partial<StatsData> = {}): StatsData {
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
    profileType: "collaborative",
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

    it("contains 'Last 12 months' subtitle", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      expect(svg).toContain("Last 12 months");
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
  // Body layout: heatmap + radar chart + archetype (no cards, no labels)
  // ---------------------------------------------------------------------------

  describe("body layout", () => {
    it("does NOT contain section labels (ACTIVITY, DEVELOPER PROFILE)", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      expect(svg).not.toContain(">ACTIVITY<");
      expect(svg).not.toContain(">DEVELOPER PROFILE<");
    });

    it("does NOT contain dimension cards (BUILDING, GUARDING, etc.)", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      expect(svg).not.toContain(">BUILDING<");
      expect(svg).not.toContain(">GUARDING<");
      expect(svg).not.toContain(">CONSISTENCY<");
      expect(svg).not.toContain(">BREADTH<");
    });

    it("contains the archetype label", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact({ archetype: "Builder" }));
      expect(svg).toContain("Builder");
    });

    it("contains a star icon in the archetype pill", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      expect(svg).toMatch(/[\u2605\u2606]|star/i);
    });

    it("contains a radar chart with polygon", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      expect(svg).toContain("fill-opacity");
      expect(svg).toContain("<polygon");
    });

    it("radar chart shows dimension labels", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      expect(svg).toContain(">Building<");
      expect(svg).toContain(">Guarding<");
      expect(svg).toContain(">Consistency<");
      expect(svg).toContain(">Breadth<");
    });
  });

  // ---------------------------------------------------------------------------
  // Hero composite score
  // ---------------------------------------------------------------------------

  describe("hero composite score", () => {
    it("contains the composite score as text", () => {
      const svg = renderBadgeSvg(
        makeStats(),
        makeImpact({ adjustedComposite: 58 }),
      );
      expect(svg).toContain(">58<");
    });

    it("hero score font-size is 52px (fits inside ring)", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      const match = svg.match(/font-size="(\d+)"[^>]*>58</);
      expect(match).not.toBeNull();
      expect(parseInt(match![1], 10)).toBe(52);
    });

    it("always shows tier label below the score ring", () => {
      const svgWithDifferentTier = renderBadgeSvg(
        makeStats(),
        makeImpact({ archetype: "Builder", tier: "Elite" }),
      );
      expect(svgWithDifferentTier).toContain(">Elite<");

      // Tier label is always shown, even when tier === archetype
      const svgSameTier = renderBadgeSvg(
        makeStats(),
        makeImpact({ archetype: "Emerging", tier: "Emerging" }),
      );
      expect(svgSameTier).toMatch(/>Emerging<\/text>/);
    });

    it("does NOT contain a separate confidence text", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact({ confidence: 85 }));
      expect(svg).not.toContain("% Confidence");
    });

    it("contains a score ring track circle", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      // Background track: circle with dim stroke, no fill
      expect(svg).toMatch(/stroke="rgba\(124,106,239,0\.10\)"[^/]*stroke-width="4"/);
    });

    it("contains a score ring arc with stroke-dasharray", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      expect(svg).toContain("stroke-dasharray");
    });

    it("score ring arc offset is proportional to score", () => {
      const svg = renderBadgeSvg(
        makeStats(),
        makeImpact({ adjustedComposite: 50 }),
      );
      // circumference = 2π × 46 ≈ 289.03, offset = 289.03 × (1 - 50/100) ≈ 144.51
      const match = svg.match(/stroke-dashoffset="([0-9.]+)"/);
      expect(match).not.toBeNull();
      const offset = parseFloat(match![1]);
      expect(offset).toBeCloseTo(289.03 * 0.5, 0);
    });

    it("score ring arc has stroke-linecap round", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      expect(svg).toContain('stroke-linecap="round"');
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
  // Font size parity
  // ---------------------------------------------------------------------------

  describe("font size parity", () => {
    it("subtitle font-size is at least 19 to display at ~14px", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      const match = svg.match(/font-size="(\d+)"[^>]*>Last 12 months/);
      expect(match).not.toBeNull();
      expect(parseInt(match![1], 10)).toBeGreaterThanOrEqual(19);
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
