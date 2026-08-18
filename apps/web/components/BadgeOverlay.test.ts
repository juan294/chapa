import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const SRC = readFileSync(resolve(__dirname, "BadgeOverlay.tsx"), "utf-8");
// The landing page badge-preview markup lives in the (server-rendered, since
// #1023) LandingContent component; #982 made app/[locale]/page.tsx a thin
// static wrapper delegating to it.
const PAGE_SRC = readFileSync(resolve(__dirname, "../app/LandingContent.tsx"), "utf-8");
const EN_DICT = readFileSync(
  resolve(__dirname, "../lib/i18n/dictionaries/en.ts"),
  "utf-8",
);

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
  it("hotspots use a plain <div>, not a nested <button>", () => {
    // Hotspots contain InfoTooltip which renders a <button>. Using <button> for
    // the hotspot would create nested buttons — invalid HTML that causes React
    // hydration errors. Use a plain <div> instead.
    const hotspotSection = SRC.match(/Hotspot regions[\s\S]*$/)?.[0];
    expect(hotspotSection).toBeDefined();
    expect(hotspotSection).not.toMatch(/<button[\s\n]/);
    expect(hotspotSection).toContain('role="group"');
  });

  // #1116 (UX-L2): these 11 hotspots are structural annotation regions, not
  // widgets — they perform no action. tabIndex={0} put them all in the
  // keyboard tab order as silent, non-actionable stops before the page's
  // real actions (toolbar, embed snippet). Their content is already exposed
  // to assistive tech via the always-present sr-only description (below),
  // which is reachable in natural reading order without requiring focus at
  // all — so the hotspots themselves must NOT be focusable.
  it("hotspots are NOT in the tab order (#1116)", () => {
    const hotspotSection = SRC.match(/Hotspot regions[\s\S]*$/)?.[0];
    expect(hotspotSection).toBeDefined();
    expect(hotspotSection).not.toContain("tabIndex");
  });

  // The onFocus/onBlur handlers previously drove the desktop leader-line
  // reveal for keyboard users. Once the hotspot is no longer focusable those
  // handlers can never fire — removed as dead code (#1116). Hover
  // (onMouseEnter/onMouseLeave) remains as the reveal mechanism for sighted
  // mouse users; the mobile InfoTooltip fallback and the always-present
  // sr-only description remain unaffected.
  it("no longer wires onFocus/onBlur on hotspots (dead code once unfocusable, #1116)", () => {
    const hotspotSection = SRC.match(/Hotspot regions[\s\S]*$/)?.[0];
    expect(hotspotSection).toBeDefined();
    expect(hotspotSection).not.toContain("onFocus");
    expect(hotspotSection).not.toContain("onBlur");
  });

  it("hotspots remain labeled with aria-label and still respond to hover", () => {
    const hotspotSection = SRC.match(/Hotspot regions[\s\S]*$/)?.[0];
    expect(hotspotSection).toBeDefined();
    expect(hotspotSection).toContain("aria-label");
    expect(hotspotSection).toContain("onMouseEnter");
    expect(hotspotSection).toContain("onMouseLeave");
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
    // The disclaimer is now in the en.ts dictionary (badgeOverlay.github key)
    expect(EN_DICT).toMatch(/github.*not affiliated/i);
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

  it("all tooltip texts are present in the English dictionary", () => {
    // Tooltip strings are now in the en.ts dictionary (badgeOverlay.* keys)
    // and resolved at runtime via t(h.dictKey) in the component
    expect(EN_DICT).toContain("Times others forked your repositories");
    expect(EN_DICT).toContain("Stars received on your repos");
    expect(EN_DICT).toContain("People watching your repositories");
    expect(EN_DICT).toContain("developer archetype");
    expect(EN_DICT).toContain("Contribution activity");
    expect(EN_DICT).toContain("four-dimension profile");
    expect(EN_DICT).toContain("composite impact score");
    expect(EN_DICT).toContain("Impact tier");
    expect(EN_DICT).toContain("Cryptographic seal");
    expect(EN_DICT).toMatch(/github.*not affiliated/i);
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
    // Match the section between the panel comment and "Hotspot regions".
    const panelSection = SRC.match(
      /leader line annotation panel[\s\S]*?Hotspot regions/,
    )?.[0];
    expect(panelSection).toBeDefined();
    expect(panelSection).not.toMatch(/HOTSPOTS\.map/);
  });

  it("uses activeBase for conditional rendering (lazy render of active hotspot)", () => {
    expect(SRC).toContain("activeBase");
    // Should find the hotspot data from HOTSPOT_BASES based on activeLeaderLine state
    expect(SRC).toMatch(/HOTSPOT_BASES\.find/);
  });
});

describe("BadgeOverlay CSS variable colors (#331)", () => {
  it("does NOT use hardcoded #8B5CF6 in SVG elements", () => {
    // The accent color should come from CSS variables, not hardcoded hex.
    // Check the SVG rendering section specifically (not the HOTSPOTS data).
    const svgSection = SRC.match(
      /id="leader-lines-svg"[\s\S]*?<\/svg>/,
    )?.[0];
    expect(svgSection).toBeDefined();
    expect(svgSection).not.toContain("#8B5CF6");
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

  it("hotspot regions use aria-describedby pointing to sr-only description IDs", () => {
    // Verify the linkage exists — hotspots reference sr-only description spans via
    // aria-describedby. The description element is always present in the DOM (not
    // lazily rendered), so screen readers can resolve the reference immediately on focus.
    expect(SRC).toContain("aria-describedby");
    expect(SRC).toContain("-desc");
  });

  it("aria-describedby always points to the sr-only description, not the conditional panel (W5)", () => {
    // Fix for W5: the panel is lazily rendered only when a hotspot is active, so
    // aria-describedby must NOT point to the panel ID (which may not exist yet).
    // Instead it always points to a permanently-present sr-only <span>.
    expect(SRC).toMatch(/aria-describedby=\{`\$\{hotspot\.id\}-desc`\}/);
    // The old conditional pattern must be gone
    expect(SRC).not.toMatch(/aria-describedby=\{activeLeaderLine === hotspot\.id/);
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

// FE-L1 (#962): BadgeOverlay absolute positioning clip risk audit
describe("BadgeOverlay clip risk audit (#962)", () => {
  it("outer overlay div has overflow: visible (not clipped)", () => {
    // The overlay container must not clip annotation panels that extend
    // above or below the badge boundary (panelTop: '-14%' etc.).
    expect(SRC).toContain('overflow: "visible"');
  });

  it("landing page badge section has no overflow-hidden on the relative wrapper", () => {
    // The .relative parent of BadgeOverlay in page.tsx must NOT have
    // overflow-hidden — that would clip above-anchored annotation panels.
    // The overflow-hidden on the sibling image div is intentional (border-radius),
    // but the wrapper div itself must remain unclipped.
    //
    // This test extracts the badge-preview section and checks that the innermost
    // .relative wrapper does NOT carry overflow-hidden directly.
    const badgeSection = PAGE_SRC.match(
      /badge-preview[\s\S]*?<\/section>/,
    )?.[0];
    expect(badgeSection).toBeDefined();
    // The .relative wrapper directly containing BadgeOverlay must not be clipped.
    // Pattern: <div className="relative"> without overflow-hidden on the same div.
    expect(badgeSection).toContain('className="relative"');
    // Confirm overflow-hidden is NOT on the direct .relative parent (it may appear
    // on the sibling image container but not the wrapper).
    const relativeWrapperLine = badgeSection
      ?.split("\n")
      .find((l) => l.includes('className="relative"'));
    expect(relativeWrapperLine).toBeDefined();
    expect(relativeWrapperLine).not.toContain("overflow-hidden");
  });
});
