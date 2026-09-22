import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "globals.css"),
  "utf-8",
);

// #1167 (UX-B1/UX-H1/UX-M3) — source-content assertions for CSS invariants
// that can't be observed through a jsdom render (jsdom does not load or
// apply this stylesheet). Mirrors the SOURCE-read pattern already used in
// components/InfoTooltip.test.tsx and app/LandingContent.test.ts.
describe("globals.css", () => {
  describe("complement-dark token (#1167 / UX-H1)", () => {
    it("defines --color-complement-dark for white-text-on-solid-fill verification CTAs", () => {
      // #1206 — Jade authors this token in oklch; the guard is that the token
      // exists as a real opaque color, not which notation expresses it.
      expect(SOURCE).toMatch(
        /--color-complement-dark:\s*(#[0-9A-Fa-f]{6}|oklch\([^)]+\))/,
      );
    });

    it("pins the --color-amber token value (accidental drift shifts the whole brand hue)", () => {
      // Pin the approved vermilion/coral pair against accidental brand drift.
      expect(SOURCE).toContain(
        "--color-amber: light-dark(#ed4930, #ff795f);",
      );
    });
  });

  describe("nav active-link style (#1167 / UX-M3)", () => {
    it("styles [aria-current=page] inside a <nav> element", () => {
      expect(SOURCE).toMatch(/nav\s+\[aria-current(?:=|\*=)["']page["']\]/);
    });

    it("also styles [aria-current=page] inside a role=navigation region (MobileNav's panel)", () => {
      expect(SOURCE).toMatch(
        /\[role=["']navigation["']\]\s+\[aria-current(?:=|\*=)["']page["']\]/,
      );
    });

    it("active nav style is not amber (would be indistinguishable from the amber/50 '/' prefix already inside every link)", () => {
      const match = SOURCE.match(
        /nav \[aria-current="page"\][^{]*\{([^}]*)\}/,
      );
      expect(match).not.toBeNull();
      expect(match![1]).not.toContain("--color-amber)");
    });
  });
});

describe("browser font delivery", () => {
  it("retains explicit browser badge font loaders alongside the raster assets", () => {
    // Next 16.3.3 emits these literal family names in the compiled CSS.
    // Browser verification checks document.fonts; avoid duplicate TTF faces.
    const layout = fs.readFileSync(path.resolve(__dirname, "../app/layout.tsx"), "utf-8");
    for (const [loader, variable, weights] of [
      ["Plus_Jakarta_Sans", "--font-plus-jakarta", ["400", "500", "600", "700"]],
      ["JetBrains_Mono", "--font-jetbrains-mono", ["400", "500", "700", "800"]],
    ] as const) {
      const definition = layout.match(new RegExp(`${loader}\\(\\{([\\s\\S]*?)\\}\\)`))?.[1];
      expect(definition).toContain(`variable: "${variable}"`);
      for (const weight of weights) expect(definition).toContain(`"${weight}"`);
    }
    for (const file of [
      "PlusJakartaSans-Regular.ttf",
      "PlusJakartaSans-SemiBold.ttf",
      "JetBrainsMono-Regular.ttf",
      "JetBrainsMono-Bold.ttf",
    ]) {
      expect(fs.statSync(path.resolve(__dirname, `../lib/render/fonts/${file}`)).size).toBeGreaterThan(0);
    }
    expect(SOURCE).not.toContain('src: url("/fonts/');
  });

  it("keeps body, expressive and technical fonts separate", () => {
    expect(SOURCE).toContain('--font-body: var(--font-manrope), system-ui, sans-serif;');
    expect(SOURCE).toContain('--font-display: var(--font-barlow-condensed), sans-serif;');
    expect(SOURCE).toContain('--font-heading: var(--font-jetbrains-mono)');
    expect(SOURCE).toContain('--font-terminal: var(--font-jetbrains-mono)');
  });
});
