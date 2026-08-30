// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { StatsData, ImpactV6Result } from "@chapa/shared";
import { renderBadgeSvg } from "@/lib/render/BadgeSvg";
import { buildBadgeI18nStrings } from "@/lib/render/badge-i18n-strings";
import { resolveTranslation } from "@/lib/i18n/resolve";
import { __getFallbackDictionary } from "@/lib/i18n/fallback-dictionary";
import { BadgeContent } from "./BadgeContent";

afterEach(cleanup);

const stats = {
  handle: "testuser",
  displayName: "Test User",
  avatarUrl: null,
  totalCommits: 500,
  totalPrs: 120,
  totalStars: 45,
  totalForks: 12,
  totalWatchers: 8,
  reposContributed: 9,
  heatmapData: Array.from({ length: 371 }, (_, i) => i % 5),
  linkedPlatforms: ["github"],
} as unknown as StatsData;

const impact = {
  dimensions: { delivery: 72, quality: 64, consistency: 81, breadth: 58 },
  archetype: "builder",
  compositeScore: 65,
  adjustedComposite: 65,
  tier: "Solid",
  confidence: 90,
} as unknown as ImpactV6Result;

const t = (key: string) => {
  const dictionary = __getFallbackDictionary();
  return dictionary ? resolveTranslation(key, dictionary) : key;
};

/**
 * #1191 step 6 — `BadgeContent` was a 405-line React DOM reimplementation of
 * the badge interior: its own heatmap, radar, tier treatment and footer, all
 * maintained in parallel with the SVG renderer's. It is now a thin wrapper
 * over `renderBadgeSvg`, so there is one badge implementation rather than two.
 *
 * Its only remaining callers are the flag-gated `/experiments/*` prototypes,
 * every one of which renders it as `<BadgeContent stats impact />`.
 */
describe("BadgeContent wraps the one badge renderer (#1191)", () => {
  function expectedSvg() {
    const host = document.createElement("div");
    host.innerHTML = renderBadgeSvg(stats, impact, {
      strings: buildBadgeI18nStrings(t, impact.tier),
    });
    return host.innerHTML;
  }

  it("renders exactly what renderBadgeSvg produces", () => {
    render(<BadgeContent stats={stats} impact={impact} />);
    expect(screen.getByTestId("badge-content").innerHTML).toBe(expectedSvg());
  });

  it("renders one SVG rather than a DOM lookalike", () => {
    render(<BadgeContent stats={stats} impact={impact} />);
    const host = screen.getByTestId("badge-content");
    expect(host.children).toHaveLength(1);
    expect(host.firstElementChild?.tagName.toLowerCase()).toBe("svg");
  });

  it("forwards className and style to the host element", () => {
    render(
      <BadgeContent
        stats={stats}
        impact={impact}
        className="custom-class"
        style={{ opacity: 0.5 }}
      />,
    );
    const host = screen.getByTestId("badge-content");
    expect(host.className).toContain("custom-class");
    expect(host.style.opacity).toBe("0.5");
  });

  it("escapes user-controlled text through the renderer's own boundary", () => {
    render(
      <BadgeContent
        stats={{ ...stats, displayName: '<script>alert(1)</script>' } as StatsData}
        impact={impact}
      />,
    );
    const host = screen.getByTestId("badge-content");
    expect(host.querySelector("script")).toBeNull();
    expect(host.innerHTML).toContain("&lt;script&gt;");
  });

  it("no longer reimplements the badge in the DOM", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const source = fs.readFileSync(
      path.resolve(__dirname, "BadgeContent.tsx"),
      "utf8",
    );
    const imports = source
      .split("\n")
      .filter((line) => /^\s*import\b/.test(line));
    for (const line of imports) {
      expect(line).not.toMatch(/effects\/heatmap/);
      expect(line).not.toMatch(/effects\/text/);
      expect(line).not.toMatch(/effects\/tier/);
    }
    expect(source.split("\n").length).toBeLessThan(90);
  });
});
