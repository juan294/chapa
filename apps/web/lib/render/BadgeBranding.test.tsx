import { describe, it, expect } from "vitest";
import { renderBadgeBranding } from "./BadgeBranding";

describe("renderBadgeBranding", () => {
  it("returns SVG markup with branding text (opacity contrast tspans)", () => {
    const svg = renderBadgeBranding(60, 585, 1140, ["github"]);
    expect(svg).toContain("Forged from ");
    expect(svg).toContain("purpose");
    expect(svg).toContain("Driven by ");
    expect(svg).toContain("curiosity");
    // Opacity contrast: connecting words at 0.5, key words at 0.9
    expect(svg).toContain('opacity="0.5">Forged from ');
    expect(svg).toContain('opacity="0.9">purpose');
    expect(svg).toContain('opacity="0.9">curiosity');
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

  it("renders GitLab logo when gitlab is in platforms", () => {
    const svg = renderBadgeBranding(60, 585, 1140, ["github", "gitlab"]);
    expect(svg).toContain("m23.6004");
  });

  it("renders all 4 logos when all platforms provided", () => {
    const svg = renderBadgeBranding(60, 585, 1140, [
      "github",
      "bitbucket",
      "codeberg",
      "gitlab",
    ]);
    expect(svg).toContain("M12 0C5.37");    // GitHub
    expect(svg).toContain("M.778 1.211");   // Bitbucket
    expect(svg).toContain("M11.955.49");    // Codeberg
    expect(svg).toContain("m23.6004");      // GitLab
  });

  it("sorts gitlab last in canonical order (after codeberg)", () => {
    const svg = renderBadgeBranding(60, 585, 1140, [
      "gitlab",
      "codeberg",
      "github",
    ]);
    const ghIdx = svg.indexOf("M12 0C5.37");
    const cbIdx = svg.indexOf("M11.955.49");
    const glIdx = svg.indexOf("m23.6004");
    expect(ghIdx).toBeLessThan(cbIdx);
    expect(cbIdx).toBeLessThan(glIdx);
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

  it("renders logos before text (icons leading)", () => {
    const svg = renderBadgeBranding(60, 585, 1140, ["github"]);
    const logoIdx = svg.indexOf("M12 0C5.37"); // GitHub path
    const textIdx = svg.indexOf("Forged from ");
    expect(logoIdx).toBeGreaterThan(-1);
    expect(textIdx).toBeGreaterThan(-1);
    expect(logoIdx).toBeLessThan(textIdx);
  });

  it("renders grouped pill container around logos", () => {
    const svg = renderBadgeBranding(60, 585, 1140, ["github", "bitbucket"]);
    // Pill is a rounded rect with purple tint
    expect(svg).toContain('fill="rgba(139,92,246,0.08)"');
    expect(svg).toContain('stroke="rgba(139,92,246,0.15)"');
  });
});
