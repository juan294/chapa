import { describe, it, expect } from "vitest";
import { renderBadgeBranding } from "./BadgeBranding";

describe("renderBadgeBranding", () => {
  it("returns SVG markup with branding text", () => {
    const svg = renderBadgeBranding(60, 585, 1140, ["github"]);
    expect(svg).toContain("Built from your commitment");
  });

  it("contains the domain text", () => {
    const svg = renderBadgeBranding(60, 585, 1140, ["github"]);
    expect(svg).toContain("chapa.thecreativetoken.com");
  });

  it("renders GitHub logo path when github is in platforms", () => {
    const svg = renderBadgeBranding(60, 585, 1140, ["github"]);
    expect(svg).toContain("M12 0C5.37");
  });

  it("renders Bitbucket logo when bitbucket is in platforms", () => {
    const svg = renderBadgeBranding(60, 585, 1140, ["github", "bitbucket"]);
    expect(svg).toContain("M.778 1.211");
  });

  it("renders Codeberg logo when codeberg is in platforms", () => {
    const svg = renderBadgeBranding(60, 585, 1140, ["github", "codeberg"]);
    expect(svg).toContain("M11.955.49");
  });

  it("renders all 3 logos when all platforms provided", () => {
    const svg = renderBadgeBranding(60, 585, 1140, ["github", "bitbucket", "codeberg"]);
    expect(svg).toContain("M12 0C5.37");    // GitHub
    expect(svg).toContain("M.778 1.211");   // Bitbucket
    expect(svg).toContain("M11.955.49");    // Codeberg
  });

  it("renders only GitHub logo when only github provided", () => {
    const svg = renderBadgeBranding(60, 585, 1140, ["github"]);
    expect(svg).toContain("M12 0C5.37");
    expect(svg).not.toContain("M.778 1.211");
    expect(svg).not.toContain("M11.955.49");
  });

  it("sorts platforms in canonical order (github, bitbucket, codeberg)", () => {
    // Even if passed out of order, logos should appear in canonical order
    const svg = renderBadgeBranding(60, 585, 1140, ["codeberg", "github", "bitbucket"]);
    const ghIdx = svg.indexOf("M12 0C5.37");
    const bbIdx = svg.indexOf("M.778 1.211");
    const cbIdx = svg.indexOf("M11.955.49");
    expect(ghIdx).toBeLessThan(bbIdx);
    expect(bbIdx).toBeLessThan(cbIdx);
  });

  it("contains SVG path elements for logos", () => {
    const svg = renderBadgeBranding(60, 585, 1140, ["github"]);
    expect(svg).toContain("<path d=");
  });
});
