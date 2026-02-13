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
    totalForks: 0,
    totalWatchers: 0,
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

    it("contains 'Verified metrics' subtitle", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      expect(svg).toContain("Verified metrics");
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

    it("shield icon appears just before 'Verified metrics' text in SVG", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      const shieldIdx = svg.indexOf("M12 1L3 5v6");
      const subtitleIdx = svg.indexOf("Verified metrics");
      expect(shieldIdx).toBeGreaterThan(-1);
      expect(subtitleIdx).toBeGreaterThan(-1);
      // Shield should appear just before the subtitle in SVG source order
      expect(shieldIdx).toBeLessThan(subtitleIdx);
      expect(subtitleIdx - shieldIdx).toBeLessThan(400);
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

    it("contains the archetype label above the heatmap", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact({ archetype: "Builder" }));
      expect(svg).toContain("Builder");
      // Archetype pill should appear before the heatmap rects in SVG order
      const archetypeIdx = svg.indexOf("Builder");
      const firstHeatmapRect = svg.indexOf('rx="4"');
      expect(archetypeIdx).toBeLessThan(firstHeatmapRect);
    });

    it("contains a code-brackets icon in the archetype pill (not a star)", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact({ archetype: "Builder" }));
      // Code brackets icon rendered as SVG <path> near the archetype text
      const builderIdx = svg.indexOf(">Builder<");
      expect(builderIdx).toBeGreaterThan(-1);
      const pillArea = svg.slice(Math.max(0, builderIdx - 400), builderIdx);
      expect(pillArea).toContain("<path");
      // ★ should NOT appear before the archetype name in the pill
      expect(pillArea).not.toContain("\u2605");
    });

    it("shows watch, fork, star as labeled pills with counts and dot separators", () => {
      const svg = renderBadgeSvg(
        makeStats({ totalWatchers: 80, totalForks: 25, totalStars: 142 }),
        makeImpact(),
      );
      expect(svg).toContain("80");
      expect(svg).toContain("25");
      expect(svg).toContain("142");
      // Each metric should have its label word
      expect(svg).toContain("Watch");
      expect(svg).toContain("Fork");
      expect(svg).toContain("Star");
      // Dot separators between pills (at least 3: archetype·watch·fork·star)
      const dots = svg.match(/\u00B7/g);
      expect(dots).not.toBeNull();
      expect(dots!.length).toBeGreaterThanOrEqual(3);
    });

    it("formats large counts with compact notation", () => {
      const svg = renderBadgeSvg(
        makeStats({ totalWatchers: 1005, totalForks: 31800, totalStars: 188000 }),
        makeImpact(),
      );
      expect(svg).toContain("1k");
      expect(svg).toContain("31.8k");
      expect(svg).toContain("188k");
    });

    it("defaults watch/fork to 0 when fields are missing from stats data", () => {
      // Simulate old cached data that doesn't have totalWatchers/totalForks
      const oldStats = makeStats();
      delete (oldStats as unknown as Record<string, unknown>).totalWatchers;
      delete (oldStats as unknown as Record<string, unknown>).totalForks;
      const svg = renderBadgeSvg(oldStats, makeImpact());
      // Should render "0" instead of "undefined"
      expect(svg).not.toContain("undefined");
    });

    it("metric pills have individual rect backgrounds", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      // At least 4 pill rects: 1 archetype + 3 metrics (Watch, Fork, Star)
      const pillRects = svg.match(/rx="17"/g);
      expect(pillRects).not.toBeNull();
      expect(pillRects!.length).toBeGreaterThanOrEqual(4);
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

    it("score ring arc has a draw-in animation from 0 to score", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      // Should contain a ring-draw keyframe animation
      expect(svg).toContain("@keyframes ring-draw");
      // The arc circle should reference the animation
      expect(svg).toContain("animation: ring-draw");
    });

    it("ring-draw animation starts from full circumference (empty ring)", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      // circumference ≈ 289.03 — animation should start from this value
      expect(svg).toMatch(/ring-draw[\s\S]*stroke-dashoffset:\s*289/);
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
      const match = svg.match(/font-size="(\d+)"[^>]*>Verified metrics/);
      expect(match).not.toBeNull();
      expect(parseInt(match![1], 10)).toBeGreaterThanOrEqual(19);
    });

    it("archetype pill text font-size is at least 17", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact({ archetype: "Builder" }));
      const match = svg.match(/font-size="(\d+)"[^>]*font-weight="600"[^>]*>Builder</);
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

  // ---------------------------------------------------------------------------
  // SVG XSS prevention
  // ---------------------------------------------------------------------------

  describe("SVG XSS prevention", () => {
    it("escapes special XML characters in archetype", () => {
      const maliciousImpact = makeImpact({
        archetype: 'Builder<script>alert("xss")</script>' as unknown as ImpactV4Result["archetype"],
      });
      const svg = renderBadgeSvg(makeStats(), maliciousImpact);
      expect(svg).not.toContain('<script>');
      expect(svg).toContain('&lt;script&gt;');
    });

    it("escapes special XML characters in tier", () => {
      const maliciousImpact = makeImpact({
        tier: 'Elite"onload="alert(1)' as unknown as ImpactV4Result["tier"],
      });
      const svg = renderBadgeSvg(makeStats(), maliciousImpact);
      expect(svg).not.toContain('"onload=');
      expect(svg).toContain('&quot;onload=');
    });

    it("escapes special XML characters in avatarDataUri", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact(), {
        avatarDataUri: 'data:image/png;base64,abc"onload="alert(1)',
      });
      expect(svg).not.toContain('"onload="alert(1)"');
      expect(svg).toContain('&quot;onload=');
    });
  });

});
