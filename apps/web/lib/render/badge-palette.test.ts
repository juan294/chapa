import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { WARM_AMBER, accentTint, BADGE_ACCENT_RGB } from "./theme";

/**
 * #1225 — the badge kept the pre-Jade violet after the app moved to Jade in
 * #1206. That was recorded as intentional while Studio previewed a separate
 * DOM badge. Once #1191 made Studio render the real SVG, the same badge could
 * not be jade on the page and violet when embedded, so convergence became
 * required rather than optional.
 *
 * The violet was not confined to `theme.ts`: it was spelled out as 28 literals
 * across six files, which is how it survived the rebrand in the first place.
 * These tests pin the accent to ONE definition and fail if a literal reappears
 * anywhere on the render path.
 */
const RENDER_PATH_FILES = [
  "apps/web/lib/render/theme.ts",
  "apps/web/lib/render/BadgeSvg.tsx",
  "apps/web/lib/render/BadgeBranding.tsx",
  "apps/web/lib/render/badge-effects.ts",
  "apps/web/lib/render/heatmap.ts",
  "apps/web/lib/render/RadarChart.ts",
  "apps/web/lib/render/VerificationStrip.ts",
  "apps/web/app/og-image/route.ts",
  "apps/web/app/u/[handle]/badge.svg/route.ts",
];

const REPO_ROOT = resolve(__dirname, "../../../..");

describe("the badge renders in the Jade palette (#1225)", () => {
  it("defines the accent once, as the app's dark-half jade token", () => {
    // globals.css: --color-amber dark half is oklch(.76 .16 163) -> #1BD093.
    // The badge always renders dark, so it takes the dark half.
    expect(WARM_AMBER.accent).toBe("#1BD093");
    expect(BADGE_ACCENT_RGB).toBe("27, 208, 147");
  });

  it("derives every accent tint from that one definition", () => {
    expect(accentTint(0.12)).toBe("rgba(27, 208, 147, 0.12)");
    expect(accentTint(0.5)).toBe("rgba(27, 208, 147, 0.5)");
    expect(WARM_AMBER.stroke).toBe(accentTint(0.12));
    for (const step of WARM_AMBER.heatmap) {
      expect(step).toContain(BADGE_ACCENT_RGB);
    }
  });

  it.each(RENDER_PATH_FILES)("has no violet literal left in %s", (file) => {
    const source = readFileSync(resolve(REPO_ROOT, file), "utf8");
    expect(source).not.toMatch(/139\s*,\s*92\s*,\s*246/);
    expect(source.toUpperCase()).not.toContain("#8B5CF6");
    expect(source.toUpperCase()).not.toContain("#A78BFA");
  });

  it("keeps the verification coral, which is not part of the accent", () => {
    // #1168/#1183: coral is the badge's one "verified" colour and is
    // deliberately NOT the brand accent. Converging the accent must not
    // sweep it up.
    const source = readFileSync(
      resolve(REPO_ROOT, "apps/web/lib/badge-visual-metadata.ts"),
      "utf8",
    );
    expect(source).toContain("#E05A47");
  });
});
