import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BADGE_PLATFORM_LOGOS,
  BADGE_PLATFORM_ORDER,
  VERIFICATION_CORAL,
  orderBadgePlatforms,
} from "./badge-visual-metadata";

describe("badge visual metadata", () => {
  it("keeps the canonical platform order and removes duplicate inputs", () => {
    expect(
      orderBadgePlatforms([
        "gitlab",
        "github",
        "codeberg",
        "github",
        "bitbucket",
      ]),
    ).toEqual(["github", "bitbucket", "codeberg", "gitlab"]);
    expect(BADGE_PLATFORM_ORDER).toEqual([
      "github",
      "bitbucket",
      "codeberg",
      "gitlab",
    ]);
  });

  it("preserves the visual constants shared by preview and SVG rendering", () => {
    expect(BADGE_PLATFORM_LOGOS.github).toMatch(/^M12 0C5\.37/);
    expect(BADGE_PLATFORM_LOGOS.bitbucket).toMatch(/^M\.778 1\.211/);
    expect(BADGE_PLATFORM_LOGOS.codeberg).toMatch(/^M11\.955\.49/);
    expect(BADGE_PLATFORM_LOGOS.gitlab).toMatch(/^m23\.6004/);
    expect(VERIFICATION_CORAL).toBe("#E05A47");
  });

  it("is client-safe and exposes metadata without renderer implementations", () => {
    const source = readFileSync(
      resolve(__dirname, "badge-visual-metadata.ts"),
      "utf8",
    );

    const runtimeImports = source
      .split("\n")
      .filter((line) => /^\s*import\s+(?!type\b)/.test(line));

    expect(runtimeImports).toEqual([]);
    expect(source).not.toMatch(/lib\/render|\.\/render/);
    expect(source).not.toMatch(/renderBadge|renderVerification/);
  });

  it("keeps the Studio client on the neutral metadata boundary", () => {
    const source = readFileSync(
      resolve(__dirname, "../app/studio/PreviewFooter.tsx"),
      "utf8",
    );

    expect(source).toContain('from "@/lib/badge-visual-metadata"');
    expect(source).not.toMatch(/from ["']@\/lib\/render\//);
  });
});
