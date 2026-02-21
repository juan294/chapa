import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const SRC = readFileSync(resolve(__dirname, "BadgeOverlay.tsx"), "utf-8");

describe("BadgeOverlay (source-reading a11y)", () => {
  it("outer div with aria-label also has role='group' (#308)", () => {
    // A div with aria-label but no role is ignored by screen readers.
    // The outer container should have role="group" so aria-label is announced.
    expect(SRC).toContain('role="group"');
  });

  it("has aria-label for the overlay container", () => {
    expect(SRC).toContain("aria-label");
  });
});

describe("BadgeOverlay hotspot elements", () => {
  it("hotspots use <div> with tabIndex to avoid nested <button> hydration error", () => {
    // Hotspots contain InfoTooltip which renders a <button>. Using <button> for
    // the hotspot would create nested buttons — invalid HTML that causes React
    // hydration errors. Use <div tabIndex={0}> instead.
    const hotspotSection = SRC.match(/Hotspot regions[\s\S]*$/)?.[0];
    expect(hotspotSection).toBeDefined();
    expect(hotspotSection).not.toMatch(/<button[\s\n]/);
    expect(hotspotSection).toContain("tabIndex={0}");
    expect(hotspotSection).toContain('role="group"');
  });

  it("hotspots are keyboard accessible with aria-label", () => {
    const hotspotSection = SRC.match(/Hotspot regions[\s\S]*$/)?.[0];
    expect(hotspotSection).toBeDefined();
    expect(hotspotSection).toContain("aria-label");
    expect(hotspotSection).toContain("onFocus");
    expect(hotspotSection).toContain("onBlur");
  });
});

describe("BadgeOverlay hover-reveal behavior", () => {
  it("uses group/badge on the container for hover-reveal", () => {
    // The parent container needs group/badge so child info icons
    // can respond to parent hover via group-hover/badge:*
    expect(SRC).toContain("group/badge");
  });

  it("InfoTooltip icons are hidden by default (opacity-0)", () => {
    // Info icons should be invisible until the badge is hovered
    expect(SRC).toContain("opacity-0");
    expect(SRC).toContain("group-hover/badge:opacity-100");
  });
});

describe("BadgeOverlay GitHub disclaimer hotspot", () => {
  it("includes a hotspot for the Powered by GitHub area", () => {
    expect(SRC).toContain("badge-github");
  });

  it("has a disclaimer that GitHub is not affiliated", () => {
    expect(SRC).toMatch(/github.*not affiliated/i);
  });
});

describe("BadgeOverlay leader lines", () => {
  it("every hotspot has a leaderLine config", () => {
    // All hotspots should use leader lines on desktop
    const hotspotIds = [
      "badge-archetype",
      "badge-watchers",
      "badge-forks",
      "badge-stars",
      "badge-heatmap",
      "badge-radar",
      "badge-score",
      "badge-tier",
      "badge-verification",
      "badge-github",
    ];
    for (const id of hotspotIds) {
      // Each hotspot definition should be followed by a leaderLine config
      expect(SRC).toMatch(
        new RegExp(`id:\\s*"${id}"[\\s\\S]*?leaderLine`),
      );
    }
  });

  it("renders an SVG layer for leader line paths", () => {
    expect(SRC).toContain("leader-lines-svg");
  });

  it("uses stroke-dashoffset for line draw animation", () => {
    expect(SRC).toContain("strokeDashoffset");
    expect(SRC).toContain("strokeDasharray");
  });

  it("SVG layer is pointer-events-none so hotspots stay clickable", () => {
    expect(SRC).toMatch(/leader-lines-svg[\s\S]*?pointer-events-none/);
  });

  it("all tooltip texts are present in the source", () => {
    expect(SRC).toContain("Times others forked your repositories");
    expect(SRC).toContain("Stars received on your repos");
    expect(SRC).toContain("People watching your repositories");
    expect(SRC).toContain("developer archetype");
    expect(SRC).toContain("Contribution activity");
    expect(SRC).toContain("four-dimension profile");
    expect(SRC).toContain("composite impact score");
    expect(SRC).toContain("Impact tier");
    expect(SRC).toContain("Cryptographic seal");
    expect(SRC).toMatch(/github.*not affiliated/i);
  });
});

describe("BadgeOverlay lazy rendering (#323)", () => {
  it("does NOT pre-render all hotspot paths via HOTSPOTS.map inside SVG", () => {
    // The SVG layer should NOT iterate all hotspots — only the active one renders.
    // Old pattern: HOTSPOTS.map((h) => { ... <path ... }) inside the SVG.
    // New pattern: activeHotspot && (() => { ... <path ... })()
    // The source should NOT contain a .map() call between leader-lines-svg and </svg>.
    const svgSection = SRC.match(
      /id="leader-lines-svg"[\s\S]*?<\/svg>/,
    )?.[0];
    expect(svgSection).toBeDefined();
    expect(svgSection).not.toMatch(/HOTSPOTS\.map/);
  });

  it("does NOT pre-render all annotation panels via HOTSPOTS.map", () => {
    // The panel layer should NOT iterate all hotspots — only the active one renders.
    // Match the section between "hidden md:contents" and "Hotspot regions".
    const panelSection = SRC.match(
      /hidden md:contents[\s\S]*?Hotspot regions/,
    )?.[0];
    expect(panelSection).toBeDefined();
    expect(panelSection).not.toMatch(/HOTSPOTS\.map/);
  });

  it("uses activeHotspot for conditional rendering", () => {
    expect(SRC).toContain("activeHotspot");
    // Should find the hotspot from the array based on activeLeaderLine state
    expect(SRC).toMatch(/HOTSPOTS\.find/);
  });
});

describe("BadgeOverlay CSS variable colors (#331)", () => {
  it("does NOT use hardcoded #7C6AEF in SVG elements", () => {
    // The accent color should come from CSS variables, not hardcoded hex.
    // Check the SVG rendering section specifically (not the HOTSPOTS data).
    const svgSection = SRC.match(
      /id="leader-lines-svg"[\s\S]*?<\/svg>/,
    )?.[0];
    expect(svgSection).toBeDefined();
    expect(svgSection).not.toContain("#7C6AEF");
  });

  it("uses var(--color-amber) for stroke and fill", () => {
    expect(SRC).toContain('stroke="var(--color-amber)"');
    expect(SRC).toContain('fill="var(--color-amber)"');
  });
});

describe("BadgeOverlay aria-describedby resolves to visible content (#363)", () => {
  it("desktop panel container does NOT have aria-hidden='true'", () => {
    // The panel container wrapping tooltip content is referenced by aria-describedby
    // on hotspot regions. If the container has aria-hidden="true", the referenced
    // content is removed from the accessibility tree, making aria-describedby
    // resolve to nothing for screen reader users.
    // Match the panel section between "leader line annotation panel" comment and "Hotspot regions" comment.
    const panelSection = SRC.match(
      /leader line annotation panel[\s\S]*?Hotspot regions/,
    )?.[0];
    expect(panelSection).toBeDefined();
    expect(panelSection).not.toContain('aria-hidden="true"');
  });

  it("hotspot regions use aria-describedby pointing to panel IDs", () => {
    // Verify the linkage exists — hotspots reference panels via aria-describedby
    expect(SRC).toContain("aria-describedby");
    expect(SRC).toContain("-panel");
  });

  it("aria-describedby is only set when the panel is rendered (active hotspot)", () => {
    // The panel only exists on desktop when the hotspot is active.
    // aria-describedby should be conditional to avoid referencing a non-existent element.
    expect(SRC).toMatch(/aria-describedby=\{activeLeaderLine === hotspot\.id/);
  });
});

describe("BadgeOverlay mobile fallback", () => {
  it("leader line SVG and panels are hidden on small screens (md breakpoint)", () => {
    // Leader line visuals should be desktop-only
    expect(SRC).toMatch(/leader-lines-svg[\s\S]*?hidden\s+md:block/);
  });

  it("InfoTooltip is always rendered for leader line hotspots", () => {
    // On mobile, InfoTooltip serves as the fallback for leader line hotspots.
    // InfoTooltip should be rendered for every hotspot (not conditionally skipped).
    // The md:hidden class hides it on desktop where leader lines take over.
    expect(SRC).toContain("md:hidden");
  });

  it("InfoTooltip is visible on mobile for all hotspots", () => {
    // All hotspots render InfoTooltip. On leader-line hotspots, it has md:hidden
    // to hide on desktop. On non-leader-line hotspots it shows normally.
    // Either way, InfoTooltip is always in the DOM.
    expect(SRC).toContain("<InfoTooltip");
  });
});
