import { describe, it, expect } from "vitest";
import { renderBadgeSvg } from "./BadgeSvg";
import type { StatsData, ImpactV6Result } from "@chapa/shared";
import { accentTint } from "./theme";
import {
  makeStats as _makeStats,
  makeImpact,
} from "../test-helpers/fixtures";

// ---------------------------------------------------------------------------
// Local wrapper — badge tests need a populated heatmap to test animations
// ---------------------------------------------------------------------------

function makeStats(overrides: Partial<StatsData> = {}): StatsData {
  return _makeStats({
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
    heatmapData: Array.from({ length: 91 }, (_, i) => ({
      date: `2025-01-${String((i % 28) + 1).padStart(2, "0")}`,
      count: i % 5,
    })),
    ...overrides,
  });
}

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

    it("labels metrics as public when no verification seal exists", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      expect(svg).toContain("Public metrics");
      expect(svg).not.toContain("Verified metrics");
      expect(svg).not.toContain("M12 1L3 5v6");
    });

    it("labels metrics as verified only when a verification seal exists", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact(), {
        verificationHash: "abc12345",
        verificationDate: "2026-08-10",
      });
      expect(svg).toContain("Verified metrics");
      expect(svg).toContain('aria-label="Verification seal"');
      expect(svg).toContain("/verify/abc12345");
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
      expect(parseInt(match![1]!, 10)).toBeGreaterThanOrEqual(22);
    });

    it("Chapa_ logo opacity is at least 0.65 for readability", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      const match = svg.match(/opacity="([0-9.]+)"[^>]*>Chapa/);
      expect(match).not.toBeNull();
      expect(parseFloat(match![1]!)).toBeGreaterThanOrEqual(0.65);
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

    it("falls back to Chapa shield icon when no avatarDataUri and no avatarUrl", () => {
      const svg = renderBadgeSvg(
        makeStats({ avatarUrl: undefined }),
        makeImpact(),
      );
      expect(svg).toContain("<circle");
      // Shield outline path
      expect(svg).toContain("M14 0.875L25.375 5.25");
      // Chevron inside shield
      expect(svg).toContain("M8.75 17.5L14 10.5L19.25 17.5");
      // No Octocat path
      expect(svg).not.toContain("M14 0C6.27");
    });

    it("falls back to Chapa shield icon when avatarUrl exists but avatarDataUri is not provided", () => {
      const svg = renderBadgeSvg(
        makeStats({ avatarUrl: "https://avatars.githubusercontent.com/u/123" }),
        makeImpact(),
      );
      // Shield outline path (not Octocat)
      expect(svg).toContain("M14 0.875L25.375 5.25");
      expect(svg).not.toContain("M14 0C6.27");
      expect(svg).not.toContain("https://avatars.githubusercontent.com/u/123");
    });
  });

  // ---------------------------------------------------------------------------
  // Verified icon (icon only, no text)
  // ---------------------------------------------------------------------------

  describe("verified icon", () => {
    it("contains a shield/checkmark icon in non-demo mode", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact(), {
        verificationHash: "abc12345",
        verificationDate: "2026-08-10",
      });
      expect(svg).toContain("M12 1L3 5v6");
    });

    it("does NOT contain the word 'Verified' as text", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      expect(svg).not.toContain(">Verified<");
    });

    it("verified icon has low opacity", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact(), {
        verificationHash: "abc12345",
        verificationDate: "2026-08-10",
      });
      expect(svg).toMatch(/opacity="0\.4"/);
    });

    it("shield icon appears just before 'Verified metrics' text in SVG", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact(), {
        verificationHash: "abc12345",
        verificationDate: "2026-08-10",
      });
      const shieldIdx = svg.indexOf("M12 1L3 5v6");
      const subtitleIdx = svg.indexOf("Verified metrics");
      expect(shieldIdx).toBeGreaterThan(-1);
      expect(subtitleIdx).toBeGreaterThan(-1);
      // Shield should appear just before the subtitle in SVG source order
      expect(shieldIdx).toBeLessThan(subtitleIdx);
      expect(subtitleIdx - shieldIdx).toBeLessThan(400);
    });

    it("hides shield icon in demo mode (no duplicate shields)", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact(), { demoMode: true });
      // The verified shield path should NOT appear (avatar already has a shield)
      expect(svg).not.toContain("M12 1L3 5v6");
      expect(svg).toContain("Simulated metrics");
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

    it("shows repos, watch, fork, star as labeled pills with counts and dot separators", () => {
      const svg = renderBadgeSvg(
        makeStats({ reposContributed: 7, totalWatchers: 80, totalForks: 25, totalStars: 142 }),
        makeImpact(),
      );
      expect(svg).toContain("80");
      expect(svg).toContain("25");
      expect(svg).toContain("142");
      // Each metric should have its label word
      expect(svg).toContain("Repos");
      expect(svg).toContain("Watch");
      expect(svg).toContain("Fork");
      expect(svg).toContain("Star");
      // Dot separators between pills (at least 4: archetype·repos·watch·fork·star)
      const dots = svg.match(/\u00B7/g);
      expect(dots).not.toBeNull();
      expect(dots!.length).toBeGreaterThanOrEqual(4);
    });

    it("repos pill appears before watch pill in SVG order", () => {
      const svg = renderBadgeSvg(
        makeStats({ reposContributed: 5 }),
        makeImpact(),
      );
      const reposIdx = svg.indexOf("Repos");
      const watchIdx = svg.indexOf("Watch");
      expect(reposIdx).toBeGreaterThan(-1);
      expect(watchIdx).toBeGreaterThan(-1);
      expect(reposIdx).toBeLessThan(watchIdx);
    });

    it("shows reposContributed count in repos pill", () => {
      const svg = renderBadgeSvg(
        makeStats({ reposContributed: 12 }),
        makeImpact(),
      );
      expect(svg).toContain("12 Repos");
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
      // At least 5 pill rects: 1 archetype + 4 metrics (Repos, Watch, Fork, Star)
      const pillRects = svg.match(/rx="17"/g);
      expect(pillRects).not.toBeNull();
      expect(pillRects!.length).toBeGreaterThanOrEqual(5);
    });

    it("contains a radar chart with polygon", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      expect(svg).toContain("fill-opacity");
      expect(svg).toContain("<polygon");
    });

    it("radar chart shows dimension labels", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      expect(svg).toContain(">Delivery<");
      expect(svg).toContain(">Quality<");
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
      expect(parseInt(match![1]!, 10)).toBe(52);
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
      // Background track: circle with dim accent stroke, no fill. Built from
      // accentTint so the palette conversion in #1225 could not leave this
      // assertion pinned to a colour the badge no longer uses.
      const trackStroke = `stroke="${accentTint(0.1)}"`;
      const trackCircle = svg
        .split("<circle")
        .find((element) => element.includes(trackStroke));
      expect(trackCircle).toBeDefined();
      expect(trackCircle).toContain('stroke-width="4"');
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
      const offset = parseFloat(match![1]!);
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
    it("includes branding text by default", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      expect(svg).toContain("Forged from ");
      expect(svg).toContain("purpose");
      expect(svg).toContain("curiosity");
    });

    it("omits branding when includeBranding is false", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact(), {
        includeBranding: false,
      });
      expect(svg).not.toContain("Forged from ");
      expect(svg).not.toContain("chapa.thecreativetoken.com");
    });

    it("contains the domain name in footer", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      expect(svg).toContain("chapa.thecreativetoken.com");
    });

    it("footer text is at least 17px for readability", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      const brandingFontSizes = svg.match(/font-size="(\d+)"[^>]*>(?:<tspan[^>]*>Forged from |chapa\.thecreativetoken\.com)/g);
      expect(brandingFontSizes).not.toBeNull();
      for (const match of brandingFontSizes!) {
        const size = parseInt(match.match(/font-size="(\d+)"/)![1]!, 10);
        expect(size).toBeGreaterThanOrEqual(17);
      }
    });

    it("footer domain text opacity is at least 0.75 for readability", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      const opacityMatches = [...svg.matchAll(/opacity="([0-9.]+)"[^>]*>chapa\.thecreativetoken\.com/g)];
      expect(opacityMatches.length).toBeGreaterThanOrEqual(1);
      for (const match of opacityMatches) {
        expect(parseFloat(match[1]!)).toBeGreaterThanOrEqual(0.75);
      }
    });

    it("contains a divider line above footer", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      expect(svg).toContain("<line");
    });

    it("shows only GitHub logo when no linkedPlatforms", () => {
      const svg = renderBadgeSvg(makeStats({ linkedPlatforms: undefined }), makeImpact());
      expect(svg).toContain("M12 0C5.37");    // GitHub logo
      expect(svg).not.toContain("M.778 1.211"); // No Bitbucket
      expect(svg).not.toContain("M11.955.49");  // No Codeberg
    });

    it("shows GitHub + Bitbucket logos when bitbucket is linked", () => {
      const svg = renderBadgeSvg(makeStats({ linkedPlatforms: ["bitbucket"] }), makeImpact());
      expect(svg).toContain("M12 0C5.37");    // GitHub
      expect(svg).toContain("M.778 1.211");   // Bitbucket
      expect(svg).not.toContain("M11.955.49"); // No Codeberg
    });

    it("shows all 3 platform logos when both linked", () => {
      const svg = renderBadgeSvg(
        makeStats({ linkedPlatforms: ["bitbucket", "codeberg"] }),
        makeImpact(),
      );
      expect(svg).toContain("M12 0C5.37");   // GitHub
      expect(svg).toContain("M.778 1.211");  // Bitbucket
      expect(svg).toContain("M11.955.49");   // Codeberg
    });

    it("shows GitHub + GitLab logos when gitlab is linked", () => {
      const svg = renderBadgeSvg(makeStats({ linkedPlatforms: ["gitlab"] }), makeImpact());
      expect(svg).toContain("M12 0C5.37");   // GitHub
      expect(svg).toContain("m23.6004");     // GitLab
      expect(svg).not.toContain("M.778 1.211"); // No Bitbucket
    });

    it("shows all 4 platform logos in demo mode regardless of linkedPlatforms", () => {
      const svg = renderBadgeSvg(makeStats({ linkedPlatforms: undefined }), makeImpact(), {
        demoMode: true,
      });
      expect(svg).toContain("M12 0C5.37");   // GitHub
      expect(svg).toContain("M.778 1.211");  // Bitbucket
      expect(svg).toContain("M11.955.49");   // Codeberg
      expect(svg).toContain("m23.6004");     // GitLab
    });
  });

  // ---------------------------------------------------------------------------
  // Font size parity
  // ---------------------------------------------------------------------------

  describe("font size parity", () => {
    it("subtitle font-size is at least 19 to display at ~14px", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      const match = svg.match(/font-size="(\d+)"[^>]*>Public metrics/);
      expect(match).not.toBeNull();
      expect(parseInt(match![1]!, 10)).toBeGreaterThanOrEqual(19);
    });

    it("archetype pill text font-size is at least 17", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact({ archetype: "Builder" }));
      const match = svg.match(/font-size="(\d+)"[^>]*font-weight="600"[^>]*>Builder</);
      expect(match).not.toBeNull();
      expect(parseInt(match![1]!, 10)).toBeGreaterThanOrEqual(17);
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

    // #760 — badges embedded via <img> don't run SMIL <animate>, so heatmap
    // cells can render permanently invisible. disableAnimation renders static cells.
    it("renders static heatmap cells when disableAnimation is true", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact(), {
        disableAnimation: true,
      });
      // No SMIL animate on the heatmap cells, and cells are fully opaque
      expect(svg).not.toContain("<animate");
      expect(svg).not.toContain('opacity="0"');
      // Heatmap rects still present
      expect(svg).toContain('rx="4"');
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
  // Pentagon radar (craft dimension)
  // ---------------------------------------------------------------------------

  describe("pentagon radar (craft dimension)", () => {
    it("renders pentagon radar with Craft label when craft dimension is present", () => {
      const svg = renderBadgeSvg(
        makeStats(),
        makeImpact({ dimensions: { delivery: 72, quality: 55, consistency: 68, breadth: 48, craft: 60 } }),
      );
      expect(svg).toContain(">Craft<");
      expect(svg).toContain(">Delivery<");
      expect(svg).toContain(">Quality<");
      expect(svg).toContain(">Consistency<");
      expect(svg).toContain(">Breadth<");
    });

    it("renders diamond radar without Craft label when craft dimension is absent", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      expect(svg).not.toContain(">Craft<");
      expect(svg).toContain(">Delivery<");
      expect(svg).toContain(">Quality<");
      expect(svg).toContain(">Consistency<");
      expect(svg).toContain(">Breadth<");
    });

    it("does not contain AI Craft pill in output (removed in v3)", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      expect(svg).not.toContain("AI Craft");
    });

    it("does not contain AI Craft pill even when craft dimension is present", () => {
      const svg = renderBadgeSvg(
        makeStats(),
        makeImpact({ dimensions: { delivery: 72, quality: 55, consistency: 68, breadth: 48, craft: 60 } }),
      );
      expect(svg).not.toContain("AI Craft");
    });

    it("badge dimensions remain 1200x630 with pentagon radar", () => {
      const svg = renderBadgeSvg(
        makeStats(),
        makeImpact({ dimensions: { delivery: 72, quality: 55, consistency: 68, breadth: 48, craft: 60 } }),
      );
      expect(svg).toContain('viewBox="0 0 1200 630"');
    });
  });

  // ---------------------------------------------------------------------------
  // Archetype display
  // ---------------------------------------------------------------------------

  describe("archetype display", () => {
    it("shows each archetype type correctly", () => {
      const archetypes = ["Builder", "Quality Champion", "Marathoner", "Polymath", "Balanced", "Emerging"] as const;
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
        archetype: 'Builder<script>alert("xss")</script>' as unknown as ImpactV6Result["archetype"],
      });
      const svg = renderBadgeSvg(makeStats(), maliciousImpact);
      expect(svg).not.toContain('<script>');
      expect(svg).toContain('&lt;script&gt;');
    });

    it("escapes special XML characters in tier", () => {
      const maliciousImpact = makeImpact({
        tier: 'Elite"onload="alert(1)' as unknown as ImpactV6Result["tier"],
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

  // ---------------------------------------------------------------------------
  // Badge branding integration (avatar + footer combined scenarios)
  // ---------------------------------------------------------------------------

  describe("badge branding integration", () => {
    it("new user, no photo: Chapa shield avatar + GitHub-only footer", () => {
      const svg = renderBadgeSvg(makeStats({ avatarUrl: undefined }), makeImpact());
      // Avatar: Chapa shield (not Octocat)
      expect(svg).toContain("M14 0.875L25.375 5.25");
      expect(svg).not.toContain("M14 0C6.27");
      // Footer: branding text + GitHub logo only
      expect(svg).toContain("Forged from ");
      expect(svg).toContain("purpose");
      expect(svg).toContain("M12 0C5.37");     // GitHub
      expect(svg).not.toContain("M.778 1.211"); // No Bitbucket
    });

    it("user with photo: embedded image avatar + GitHub-only footer", () => {
      const dataUri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";
      const svg = renderBadgeSvg(makeStats(), makeImpact(), { avatarDataUri: dataUri });
      // Avatar: embedded image
      expect(svg).toContain("<image");
      expect(svg).toContain(dataUri);
      // Footer: branding text + GitHub only
      expect(svg).toContain("Forged from ");
      expect(svg).toContain("curiosity");
      expect(svg).toContain("M12 0C5.37");
    });

    it("user + Bitbucket: Chapa shield + GitHub + Bitbucket footer logos", () => {
      const svg = renderBadgeSvg(
        makeStats({ avatarUrl: undefined, linkedPlatforms: ["bitbucket"] }),
        makeImpact(),
      );
      expect(svg).toContain("M14 0.875L25.375 5.25"); // Shield avatar
      expect(svg).toContain("M12 0C5.37");    // GitHub logo
      expect(svg).toContain("M.778 1.211");   // Bitbucket logo
      expect(svg).not.toContain("M11.955.49"); // No Codeberg
    });

    it("user + all platforms: photo avatar + all 3 footer logos", () => {
      const dataUri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";
      const svg = renderBadgeSvg(
        makeStats({ linkedPlatforms: ["bitbucket", "codeberg"] }),
        makeImpact(),
        { avatarDataUri: dataUri },
      );
      expect(svg).toContain("<image");        // Photo avatar
      expect(svg).toContain("M12 0C5.37");   // GitHub
      expect(svg).toContain("M.778 1.211");  // Bitbucket
      expect(svg).toContain("M11.955.49");   // Codeberg
    });

    it("demo badge: Chapa shield + all 3 logos regardless of linkedPlatforms", () => {
      const svg = renderBadgeSvg(
        makeStats({ avatarUrl: undefined, linkedPlatforms: undefined }),
        makeImpact(),
        { demoMode: true },
      );
      expect(svg).toContain("M14 0.875L25.375 5.25"); // Shield
      expect(svg).toContain("Simulated metrics");
      expect(svg).toContain("M12 0C5.37");   // GitHub
      expect(svg).toContain("M.778 1.211");  // Bitbucket
      expect(svg).toContain("M11.955.49");   // Codeberg
    });

    it("branding disabled: Chapa shield avatar + no footer at all", () => {
      const svg = renderBadgeSvg(
        makeStats({ avatarUrl: undefined }),
        makeImpact(),
        { includeBranding: false },
      );
      expect(svg).toContain("M14 0.875L25.375 5.25"); // Shield still shown
      expect(svg).not.toContain("Forged from ");
      expect(svg).not.toContain("chapa.thecreativetoken.com");
    });
  });

  // ---------------------------------------------------------------------------
  // Reduced motion (#1168 UX-M6)
  // ---------------------------------------------------------------------------

  describe("prefers-reduced-motion guard", () => {
    it("contains a prefers-reduced-motion media block disabling the infinite pulse-glow", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      expect(svg).toMatch(/@media \(prefers-reduced-motion:\s*reduce\)/);
      // The media block must target the pulse-glow animation and turn it off.
      const mediaMatch = svg.match(/@media \(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\}\s*\}/);
      expect(mediaMatch).not.toBeNull();
      expect(mediaMatch![0]).toContain("animation: none");
    });

    it("does not disable the finite ring-draw reveal in the reduced-motion block", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      const mediaMatch = svg.match(/@media \(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\}\s*\}/);
      expect(mediaMatch).not.toBeNull();
      expect(mediaMatch![0]).not.toContain("ring-draw");
      // ring-draw's own keyframe + inline animation reference must still exist untouched.
      expect(svg).toContain("@keyframes ring-draw");
      expect(svg).toContain("animation: ring-draw 1.2s ease-out 0.5s both");
    });

    it("still includes the pulse-glow keyframe and applies it to the score (unchanged when motion is not reduced)", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      expect(svg).toContain("@keyframes pulse-glow");
      expect(svg).toMatch(/pulse-glow 3s ease-in-out infinite/);
    });
  });

  // ---------------------------------------------------------------------------
  // Accessible name (#1168 UX-L5) — gated to the route-served (disableAnimation)
  // variant so it doesn't collide with the share page's aria-labelledby wrapper
  // or the portal-tooltip convention on inline-embedded badges.
  // ---------------------------------------------------------------------------

  describe("accessible name (role/title/desc)", () => {
    it("adds role=img, <title>, and <desc> when disableAnimation is true (route-served variant)", () => {
      const svg = renderBadgeSvg(makeStats({ handle: "octocat" }), makeImpact(), {
        disableAnimation: true,
      });
      expect(svg).toContain('role="img"');
      expect(svg).toMatch(/<svg[^>]*>\s*<title>/);
      expect(svg).toContain("<desc>");
      expect(svg).toContain("octocat");
    });

    it("does NOT add role=img/<title>/<desc> for the inline in-DOM variant (default)", () => {
      // Inline embeds (share page, demo badges) already have an external
      // aria-labelledby / BadgeOverlay tooltip convention — a native <title>
      // tooltip here would collide with it, and role=img here would be
      // redundant with the wrapping role=img div.
      const svg = renderBadgeSvg(makeStats(), makeImpact());
      expect(svg).not.toContain('role="img"');
      expect(svg).not.toContain("<title>");
      expect(svg).not.toContain("<desc>");
    });

    it("escapes user-controlled text in the accessible name (XSS)", () => {
      const svg = renderBadgeSvg(
        makeStats({ handle: "user<script>alert(1)</script>" }),
        makeImpact(),
        { disableAnimation: true },
      );
      expect(svg).not.toContain("<script>");
      expect(svg).toContain("&lt;script&gt;");
    });

    it("<title> content mentions the score and archetype", () => {
      const svg = renderBadgeSvg(
        makeStats({ handle: "octocat" }),
        makeImpact({ adjustedComposite: 74, archetype: "Builder", tier: "High" }),
        { disableAnimation: true },
      );
      const titleMatch = svg.match(/<title>([\s\S]*?)<\/title>/);
      expect(titleMatch).not.toBeNull();
      expect(titleMatch![1]).toContain("74");
      expect(titleMatch![1]).toContain("Builder");
    });
  });

  // ---------------------------------------------------------------------------
  // Verified signal color (#1168 UX-M10) — single coral signal, not purple+coral
  // ---------------------------------------------------------------------------

  describe("verified signal uses a single coral color, not purple + coral", () => {
    it("renders the verified shield in coral (#E05A47), not the purple brand accent", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact(), {
        verificationHash: "abc12345",
        verificationDate: "2026-08-10",
      });
      const shieldIdx = svg.indexOf("M12 1L3 5v6");
      expect(shieldIdx).toBeGreaterThan(-1);
      const shieldTagStart = svg.lastIndexOf("<path", shieldIdx);
      const shieldTagEnd = svg.indexOf("/>", shieldIdx);
      const shieldTag = svg.slice(shieldTagStart, shieldTagEnd);
      expect(shieldTag).toContain('fill="#E05A47"');
      expect(shieldTag).not.toContain('fill="#8B5CF6"');
    });
  });

  // ---------------------------------------------------------------------------
  // Locale-aware strings (#1181 UX-H3) — renderBadgeSvg stays a pure,
  // deterministic function. Locale resolution (getServerT, ?lang=) happens at
  // the call site (badge.svg route); resolved strings are passed in via the
  // `strings` option. Omitting `strings` entirely must reproduce the exact
  // current English output (backward compatible with every existing caller:
  // share page, og-image route, warm-cache cron, demo/archetype pages).
  // ---------------------------------------------------------------------------

  describe("locale-aware strings (#1181)", () => {
    it("defaults to English metrics/tier/radar/verification text when no strings option is given", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact({ tier: "High" }), {
        verificationHash: "abc12345",
        verificationDate: "2026-08-10",
      });
      expect(svg).toContain("Verified metrics");
      expect(svg).toContain(">High<");
      expect(svg).toContain(">Delivery<");
      expect(svg).toContain(">Quality<");
      expect(svg).toContain(">Consistency<");
      expect(svg).toContain(">Breadth<");
    });

    it("uses translated metrics label (public) when strings option is provided", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact(), {
        strings: { metricsPublic: "Métricas públicas" },
      });
      expect(svg).toContain("Métricas públicas");
      expect(svg).not.toContain("Public metrics");
    });

    it("uses translated metrics label (verified) when strings option is provided", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact(), {
        verificationHash: "abc12345",
        verificationDate: "2026-08-10",
        strings: { metricsVerified: "Métricas verificadas" },
      });
      expect(svg).toContain("Métricas verificadas");
      expect(svg).not.toContain("Verified metrics");
    });

    it("uses translated metrics label (simulated/demo) when strings option is provided", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact(), {
        demoMode: true,
        strings: { metricsSimulated: "Métricas simuladas" },
      });
      expect(svg).toContain("Métricas simuladas");
      expect(svg).not.toContain("Simulated metrics");
    });

    it("uses a translated tier label when provided, without altering the raw archetype", () => {
      const svg = renderBadgeSvg(
        makeStats(),
        makeImpact({ archetype: "Builder", tier: "Solid" }),
        { strings: { tierLabel: "Sólido" } },
      );
      expect(svg).toContain(">Sólido<");
      expect(svg).not.toContain(">Solid<");
      // Archetype names are deliberately untranslated brand terms.
      expect(svg).toContain("Builder");
    });

    it("uses translated radar dimension labels when provided", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact(), {
        strings: {
          radarLabels: {
            delivery: "Entrega",
            quality: "Calidad",
            consistency: "Constancia",
            breadth: "Alcance",
            craft: "Oficio",
          },
        },
      });
      expect(svg).toContain(">Entrega<");
      expect(svg).toContain(">Calidad<");
      expect(svg).toContain(">Constancia<");
      expect(svg).toContain(">Alcance<");
      expect(svg).not.toContain(">Delivery<");
    });

    it("uses translated radar empty-state text when provided", () => {
      const svg = renderBadgeSvg(
        makeStats(),
        makeImpact({ dimensions: { delivery: 0, quality: 0, consistency: 0, breadth: 0 } }),
        { strings: { radarNoData: "aún sin datos" } },
      );
      expect(svg).toContain(">aún sin datos<");
      expect(svg).not.toContain(">no data yet<");
    });

    it("uses a translated verified strip label when provided", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact(), {
        verificationHash: "abc12345",
        verificationDate: "2026-08-10",
        strings: { verifiedLabel: "VERIFICADO" },
      });
      expect(svg).toContain("VERIFICADO");
    });

    it("uses a translated sample disclosure when provided (demo mode)", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact(), {
        demoMode: true,
        strings: { sampleDisclosure: "MUESTRA · NO ES UNA CHAPA REAL · SOLO PARA ILUSTRACIÓN" },
      });
      expect(svg).toContain("MUESTRA · NO ES UNA CHAPA REAL · SOLO PARA ILUSTRACIÓN");
    });

    it("still escapes the translated tier label (XSS boundary preserved)", () => {
      const svg = renderBadgeSvg(makeStats(), makeImpact(), {
        strings: { tierLabel: '"onload="alert(1)' },
      });
      expect(svg).not.toContain('"onload=');
      expect(svg).toContain("&quot;onload=");
    });
  });

});
