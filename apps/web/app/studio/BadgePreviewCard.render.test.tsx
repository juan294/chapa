// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { BadgeConfig, StatsData, ImpactV6Result } from "@chapa/shared";
import { DEFAULT_BADGE_CONFIG } from "@chapa/shared";
import { renderBadgeSvg } from "@/lib/render/BadgeSvg";
import { buildBadgeI18nStrings } from "@/lib/render/badge-i18n-strings";
import { resolveTranslation } from "@/lib/i18n/resolve";
import { __getFallbackDictionary } from "@/lib/i18n/fallback-dictionary";
import { BadgePreviewCard } from "./BadgePreviewCard";

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

/**
 * #1191 step 6 — the whole point of the one-artifact work. Studio used to
 * preview `BadgeContent`, a parallel DOM implementation, so a customization
 * could look one way in Studio and another in the README. The preview now
 * renders the same string `renderBadgeSvg` produces for the badge route, so
 * the two cannot disagree.
 */
describe("BadgePreviewCard renders the real badge artifact (#1191)", () => {
  // Mirror the translator the component actually sees. With no
  // LanguageProvider, `useTranslation()` falls back to resolving against the
  // English dictionary that `vitest.setup.ts` injects, so building the
  // expectation any other way compares English markup against raw key names.
  const t = (key: string) => {
    const dictionary = __getFallbackDictionary();
    return dictionary ? resolveTranslation(key, dictionary) : key;
  };

  /**
   * The expected markup, put through the same DOM round-trip the preview's
   * own injected markup goes through. `innerHTML` returns serialized DOM, not
   * the string that was assigned, so comparing the preview against the raw
   * `renderBadgeSvg` output would fail on normalization alone (attribute
   * quoting, entity encoding, self-closing tags) and prove nothing.
   */
  function expectedSvg(config: BadgeConfig) {
    const host = document.createElement("div");
    host.innerHTML = renderBadgeSvg(stats, impact, {
      config,
      strings: buildBadgeI18nStrings(t, impact.tier),
    });
    return host.innerHTML;
  }

  it("renders exactly what renderBadgeSvg produces for the default config", () => {
    render(
      <BadgePreviewCard
        config={DEFAULT_BADGE_CONFIG}
        stats={stats}
        impact={impact}
      />,
    );
    const preview = screen.getByTestId("badge-preview");
    expect(preview.innerHTML).toBe(expectedSvg(DEFAULT_BADGE_CONFIG));
  });

  it.each([
    ["background", { background: "aurora" }],
    ["cardStyle", { cardStyle: "frost" }],
    ["border", { border: "gradient-rotating" }],
    ["scoreEffect", { scoreEffect: "holographic" }],
    ["heatmapAnimation", { heatmapAnimation: "ripple" }],
    ["tierTreatment", { tierTreatment: "enhanced" }],
  ])("stays byte-identical to the badge when %s changes", (_name, patch) => {
    const config = { ...DEFAULT_BADGE_CONFIG, ...patch } as BadgeConfig;
    render(<BadgePreviewCard config={config} stats={stats} impact={impact} />);
    expect(screen.getByTestId("badge-preview").innerHTML).toBe(
      expectedSvg(config),
    );
  });

  it("changing a category changes the rendered output", () => {
    const { rerender } = render(
      <BadgePreviewCard
        config={DEFAULT_BADGE_CONFIG}
        stats={stats}
        impact={impact}
      />,
    );
    const before = screen.getByTestId("badge-preview").innerHTML;
    rerender(
      <BadgePreviewCard
        config={{ ...DEFAULT_BADGE_CONFIG, background: "aurora" }}
        stats={stats}
        impact={impact}
      />,
    );
    expect(screen.getByTestId("badge-preview").innerHTML).not.toBe(before);
  });

  it("renders a single SVG element, not a DOM lookalike", () => {
    render(
      <BadgePreviewCard
        config={DEFAULT_BADGE_CONFIG}
        stats={stats}
        impact={impact}
      />,
    );
    const preview = screen.getByTestId("badge-preview");
    expect(preview.children).toHaveLength(1);
    expect(preview.firstElementChild?.tagName.toLowerCase()).toBe("svg");
  });

  // These wrappers applied background, border and card style in the DOM. The
  // SVG applies all three now, so leaving them would double every crossing
  // effect — an aurora behind an aurora, a border around a border.
  it("no longer layers the DOM effect wrappers over the badge", () => {
    render(
      <BadgePreviewCard
        config={{
          ...DEFAULT_BADGE_CONFIG,
          background: "aurora",
          border: "gradient-rotating",
          cardStyle: "frost",
        }}
        stats={stats}
        impact={impact}
      />,
    );
    const preview = screen.getByTestId("badge-preview");
    for (const selector of [
      '[data-effect="aurora"]',
      '[data-effect="particles"]',
      '[data-effect="gradient-border"]',
      '[data-testid="badge-card"]',
    ]) {
      expect(preview.querySelector(selector), selector).toBeNull();
    }
  });
});

describe("BadgePreviewCard verification and identity", () => {
  it("passes the verification code through to the SVG's own strip", () => {
    const verification = { hash: "abc123def456", date: "2026-08-30" };
    render(
      <BadgePreviewCard
        config={DEFAULT_BADGE_CONFIG}
        stats={stats}
        impact={impact}
        verification={verification}
      />,
    );
    expect(screen.getByTestId("badge-preview").innerHTML).toContain(
      "abc123def456",
    );
  });

  // PreviewFooter used to draw its own platform row, host and verification
  // line beside the SVG's. One artifact means one footer.
  it("renders no second footer beside the SVG's own", () => {
    render(
      <BadgePreviewCard
        config={DEFAULT_BADGE_CONFIG}
        stats={stats}
        impact={impact}
        verification={{ hash: "abc123def456", date: "2026-08-30" }}
      />,
    );
    expect(document.querySelector("footer")).toBeNull();
  });

  it("threads the avatar data URI into the badge", () => {
    const avatarDataUri = "data:image/png;base64,AAAA";
    render(
      <BadgePreviewCard
        config={DEFAULT_BADGE_CONFIG}
        stats={stats}
        impact={impact}
        avatarDataUri={avatarDataUri}
      />,
    );
    expect(screen.getByTestId("badge-preview").innerHTML).toContain(
      avatarDataUri,
    );
  });
});
