import { describe, it, expect } from "vitest";
import { escapeXml, renderBadgeSvg } from "./BadgeSvg";
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
// renderBadgeSvg
// ---------------------------------------------------------------------------

describe("renderBadgeSvg", () => {
  it("returns a string starting with <svg", () => {
    const svg = renderBadgeSvg(makeStats(), makeImpact());
    expect(svg.trimStart().startsWith("<svg")).toBe(true);
  });

  it("contains the escaped handle", () => {
    const svg = renderBadgeSvg(
      makeStats({ handle: "user<xss>" }),
      makeImpact(),
    );
    expect(svg).toContain("@user&lt;xss&gt;");
    expect(svg).not.toContain("user<xss>");
  });

  it("contains the score value", () => {
    const svg = renderBadgeSvg(makeStats(), makeImpact({ adjustedScore: 61 }));
    expect(svg).toContain("61");
  });

  it("contains the tier label", () => {
    const svg = renderBadgeSvg(makeStats(), makeImpact({ tier: "Elite" }));
    expect(svg).toContain("ELITE");
  });

  it("contains the confidence percentage", () => {
    const svg = renderBadgeSvg(makeStats(), makeImpact({ confidence: 85 }));
    expect(svg).toContain("85%");
  });

  it("contains commit/PR/review counts", () => {
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

  it("returns valid SVG (no unclosed tags)", () => {
    const svg = renderBadgeSvg(makeStats(), makeImpact());
    // Every opening tag that is not self-closing should have a matching close.
    // A simple structural check: starts with <svg and ends with </svg>.
    expect(svg.trimStart().startsWith("<svg")).toBe(true);
    expect(svg.trimEnd().endsWith("</svg>")).toBe(true);
  });

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
});
