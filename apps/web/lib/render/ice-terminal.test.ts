import { describe, it, expect } from "vitest";
import { BADGE_CONFIG_OPTIONS, DEFAULT_BADGE_CONFIG } from "@chapa/shared";
import { renderBadgeSvg } from "./BadgeSvg";
import { DEMO_STATS } from "./demoData";
import { DEMO_SCORING, DEMO_SCORING_ZERO } from "./__fixtures__/demo-scoring";
import { badgeTheme, WARM_AMBER } from "./theme";
import { contrastRatio, compositeColor } from "../test-helpers/css-tokens";
import { renderScoreEffect } from "./badge-effects";
import { VERIFICATION_CORAL } from "../badge-visual-metadata";
import { BADGE_RENDER_VARIANT } from "./badge-render-variant";

describe("Ice Terminal artifact", () => {
  it("uses the versioned Ice palette by default and preserves explicit Jade", () => {
    expect(BADGE_RENDER_VARIANT).toBe("ice-terminal-v2");
    expect(badgeTheme()).toBe(WARM_AMBER);
    expect(badgeTheme().palette).toBe("ice");
    expect(badgeTheme()).toMatchObject({ bg: "#0C141B", card: "#14222D", accent: "#BAD9E8", accentLight: "#DFEDF4", textPrimary: "#F1EEE7", textSecondary: "#ABBAC3" });
    expect(badgeTheme().stroke).toBe(badgeTheme().tint(.22));
    expect(badgeTheme("jade")).toMatchObject({ bg: "#0C0D14", card: "#13141E", accent: "#1BD093", textPrimary: "#E6EDF3", textSecondary: "#9AA4B2" });
  });

  it("renders approved geometry directly for every palette", () => {
    for (const colorPalette of BADGE_CONFIG_OPTIONS.colorPalette) {
      const svg = renderBadgeSvg(DEMO_STATS, { scoring: DEMO_SCORING, config: { ...DEFAULT_BADGE_CONFIG, colorPalette } });
      expect(svg).toContain('data-badge-design="ice-terminal-v2"');
      expect(svg).toContain('rx="4"');
      expect(svg).toContain('rx="3"');
      expect(svg).toContain('data-element="activity" transform="translate(60 246) scale(0.86)"');
      expect(svg).toMatch(/data-element="score"[^>]*x="930" y="466"/);
      expect(svg).toMatch(/data-element="name"[^>]*font-family="'JetBrains Mono', monospace"[^>]*font-size="32" font-weight="700"/);
      expect(svg).toContain('01 / ACTIVITY');
      expect(svg).toContain('13 WEEKS × 7 DAYS');
      expect(svg).toContain('02 / IMPACT');
      expect(svg).not.toContain('+ PROFILE');
    }
  });

  it("escapes caller-supplied headings, provenance and sample/verification labels", () => {
    const attack = '<script>&"';
    for (const demoMode of [true, false]) {
      const svg = renderBadgeSvg(DEMO_STATS, { scoring: DEMO_SCORING, demoMode, verificationHash: "abc", verificationDate: "2026-09-05", strings: { activityHeading: attack, heatmapCaption: attack, impactHeading: attack, metricsSimulated: attack, metricsVerified: attack, sampleDisclosure: attack, verifiedLabel: attack, radarLabels: { delivery: attack }, radarNoData: attack } });
      expect(svg).not.toContain(attack);
      expect(svg.match(/&lt;script&gt;&amp;&quot;/g)!.length).toBeGreaterThanOrEqual(5);
    }
  });

  it("escapes the empty radar message with zero Craft present", () => {
    const svg = renderBadgeSvg(DEMO_STATS, { scoring: DEMO_SCORING_ZERO, strings: { radarNoData: "<empty>&" } });
    expect(svg).toContain('data-role="radar-empty-marker"');
    expect(svg).toContain("&lt;empty&gt;&amp;");
    expect(svg).not.toContain("<empty>");
  });

  it("fits a long identity before the wordmark without dropping its full text", () => {
    const displayName = "Long developer identity ".repeat(5);
    const svg = renderBadgeSvg({ ...DEMO_STATS, displayName }, { scoring: DEMO_SCORING });
    expect(svg).toMatch(/data-element="name"[^>]*textLength="820" lengthAdjust="spacingAndGlyphs"/);
    expect(svg).toContain(displayName);
  });

  it("keeps stable score glyph discovery and resting ring with animation disabled", () => {
    const svg = renderBadgeSvg(DEMO_STATS, { scoring: DEMO_SCORING, disableAnimation: true });
    expect(svg).toMatch(/data-element="score"[^>]*>82<\/text>/);
    expect(svg).not.toContain('class="badge-score-pulse"');
    expect(svg).not.toContain('style="animation: ring-draw');
    expect(svg).not.toMatch(/<animate(?:Transform)?\b/);
  });
});

describe("score treatment contrast", () => {
  for (const palette of BADGE_CONFIG_OPTIONS.colorPalette) {
    it(`${palette}: score paints clear 3:1 at their darkest displayed state`, () => {
      const theme = badgeTheme(palette);
      for (const scoreEffect of BADGE_CONFIG_OPTIONS.scoreEffect) {
        const ctx = { width: 1200, height: 630, theme, disableAnimation: false, textPrimary: theme.textPrimary };
        const effect = renderScoreEffect(scoreEffect, ctx);
        const paints = effect.fill.startsWith("#")
          ? [effect.fill]
          : [...effect.defs.matchAll(/stop-color="(#[a-f\d]+)"/gi)].map(match => match[1]!);
        expect(paints.length).toBeGreaterThan(0);
        for (const paint of paints) {
          const opacity = scoreEffect === "standard" ? .7 : 1;
          expect(contrastRatio(compositeColor(paint, theme.bg, opacity), theme.bg), `${scoreEffect} ${paint}`).toBeGreaterThanOrEqual(3);
        }
        const svg = renderBadgeSvg(DEMO_STATS, { scoring: DEMO_SCORING, config: { ...DEFAULT_BADGE_CONFIG, colorPalette: palette, scoreEffect } });
        const score = svg.match(/<text data-element="score"[^>]*>/)![0];
        if (scoreEffect === "standard") expect(score).toContain('class="badge-score-pulse"');
        else expect(score).not.toContain('class="badge-score-pulse"');
      }
    });
  }
});

describe("score contrast on combined background effects", () => {
  it.each(BADGE_CONFIG_OPTIONS.colorPalette)("%s isolates the score paint from aurora and crystal sheen", (colorPalette) => {
    const theme = badgeTheme(colorPalette);
    const config = { ...DEFAULT_BADGE_CONFIG, colorPalette, background: "aurora" as const, cardStyle: "crystal" as const, scoreEffect: "gold-leaf" as const };
    const svg = renderBadgeSvg(DEMO_STATS, { scoring: DEMO_SCORING, config });
    const backing = `<circle cx="930" cy="466" r="46" fill="${theme.bg}"`;
    const backingAt = svg.indexOf(backing);
    expect(backingAt).toBeGreaterThan(svg.indexOf('fill="url(#badge-bg-aurora)"'));
    expect(backingAt).toBeGreaterThan(svg.indexOf('fill="url(#badge-card-sheen)"'));
    expect(backingAt).toBeLessThan(svg.indexOf('data-element="score"'));
    expect(backingAt).toBeGreaterThan(-1);
    const paints = renderScoreEffect(config.scoreEffect, { width: 1200, height: 630, theme, disableAnimation: false, textPrimary: theme.textPrimary });
    for (const [, paint] of paints.defs.matchAll(/stop-color="(#[a-f\d]+)"/gi)) {
      expect(contrastRatio(paint!, theme.bg)).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("verification contrast on combined effects", () => {
  it.each(BADGE_CONFIG_OPTIONS.colorPalette)("%s keeps both seal and sample readable", (colorPalette) => {
    const theme = badgeTheme(colorPalette);
    for (const demoMode of [true, false]) {
      const svg = renderBadgeSvg(DEMO_STATS, {
        scoring: DEMO_SCORING,
        demoMode, verificationHash: "fixture-seal", verificationDate: "2026-09-05",
        config: { ...DEFAULT_BADGE_CONFIG, colorPalette, background: "aurora", cardStyle: "crystal" },
      });
      expect(contrastRatio(VERIFICATION_CORAL, theme.bg)).toBeGreaterThanOrEqual(4.5);
      const strip = svg.slice(svg.indexOf('<g data-element="verification">'));
      expect(strip).toContain(`<rect x="1145" y="30" width="45" height="570" fill="${theme.bg}"/>`);
      expect(strip.indexOf('<rect')).toBeLessThan(strip.indexOf('<text'));
    }
  });
});
