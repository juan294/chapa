import { describe, it, expect } from "vitest";
import { badgeStatusState, renderBadgeStatusSvg, buildBadgeStatusStrings, buildBadgeUnavailableStrings } from "./badge-state";
import type { ScoringStatus } from "@/lib/collection/scoring-status";
import { interpolate } from "@/lib/i18n/interpolate";

function collecting(hasPriorReceipt: boolean, percent = 42): ScoringStatus {
  return { kind: "collecting", percent, sources: [], hasPriorReceipt };
}

function actionNeeded(hasPriorReceipt: boolean): ScoringStatus {
  return { kind: "action_needed", sources: [], hasPriorReceipt };
}

describe("badgeStatusState", () => {
  it("returns null for a null status (authority read failed)", () => {
    expect(badgeStatusState(null)).toBeNull();
  });

  it("returns null for a ready status", () => {
    expect(badgeStatusState({ kind: "ready", receiptDate: "2026-09-23", updating: false })).toBeNull();
  });

  it("returns 'unregistered' for an unregistered status", () => {
    expect(badgeStatusState({ kind: "unregistered" })).toBe("unregistered");
  });

  it("returns 'collecting' when collecting with no prior receipt", () => {
    expect(badgeStatusState(collecting(false))).toBe("collecting");
  });

  it("returns null when collecting WITH a prior receipt (render the stale receipt instead)", () => {
    expect(badgeStatusState(collecting(true))).toBeNull();
  });

  it("returns 'action_needed' when paused with no prior receipt", () => {
    expect(badgeStatusState(actionNeeded(false))).toBe("action_needed");
  });

  it("returns null when paused WITH a prior receipt", () => {
    expect(badgeStatusState(actionNeeded(true))).toBeNull();
  });
});

describe("renderBadgeStatusSvg", () => {
  it("returns well-formed SVG", () => {
    const svg = renderBadgeStatusSvg("collecting", { handle: "octocat", percent: 10 });
    expect(svg.trimStart().startsWith("<svg")).toBe(true);
    expect(svg.trimEnd().endsWith("</svg>")).toBe(true);
    expect(svg).toContain('viewBox="0 0 1200 630"');
  });

  describe("collecting", () => {
    it("carries data-chapa-state=collecting", () => {
      const svg = renderBadgeStatusSvg("collecting", { handle: "octocat", percent: 42 });
      expect(svg).toContain('data-chapa-state="collecting"');
    });

    it("shows 'Scoring in progress, n%' with the given percent", () => {
      const svg = renderBadgeStatusSvg("collecting", { handle: "octocat", percent: 42 });
      expect(svg).toContain("Scoring in progress, 42%");
    });

    it("shows the identity header (handle) but no score/radar elements", () => {
      const svg = renderBadgeStatusSvg("collecting", { handle: "octocat", percent: 5 });
      expect(svg).toContain("@octocat");
      expect(svg).not.toContain('data-element="score"');
      expect(svg).not.toContain('data-element="dimensions"');
      expect(svg).not.toContain('data-element="activity"');
    });

    it("clamps percent to [0, 99]", () => {
      const over = renderBadgeStatusSvg("collecting", { handle: "octocat", percent: 150 });
      expect(over).toContain("Scoring in progress, 99%");
      const under = renderBadgeStatusSvg("collecting", { handle: "octocat", percent: -5 });
      expect(under).toContain("Scoring in progress, 0%");
    });

    it("prefers a locale-resolved heading over the English default", () => {
      const svg = renderBadgeStatusSvg("collecting", {
        handle: "octocat",
        percent: 42,
        strings: { collectingHeading: "Puntuación en curso, 42%" },
      });
      expect(svg).toContain("Puntuación en curso, 42%");
      expect(svg).not.toContain("Scoring in progress");
    });
  });

  describe("action_needed", () => {
    it("carries data-chapa-state=action_needed and the English default heading", () => {
      const svg = renderBadgeStatusSvg("action_needed", { handle: "octocat" });
      expect(svg).toContain('data-chapa-state="action_needed"');
      expect(svg).toContain("Scoring paused: action needed");
    });
  });

  describe("unregistered", () => {
    it("carries data-chapa-state=unregistered, 'Not on Chapa yet' and the domain", () => {
      const svg = renderBadgeStatusSvg("unregistered", { handle: "octocat" });
      expect(svg).toContain('data-chapa-state="unregistered"');
      expect(svg).toContain("Not on Chapa yet");
      expect(svg).toContain("chapa.thecreativetoken.com");
    });
  });

  // #1335 phase 4 fix — a failed `readScoringStatus` authority read (the
  // read itself failed, not "no receipt") reuses this exact placeholder path
  // rather than falling through to a legacy v6 render. See badge.svg/
  // og-image/page.tsx: this is drawn ONLY when the normal pipeline's own
  // independent receipt lookup also failed to find a real v7.2 receipt.
  describe("unavailable (authority read failed)", () => {
    it("carries data-chapa-state=unavailable and the English default heading", () => {
      const svg = renderBadgeStatusSvg("unavailable", { handle: "octocat" });
      expect(svg).toContain('data-chapa-state="unavailable"');
      expect(svg).toContain("Scoring status unavailable");
    });

    it("shows the identity header but no score/radar/heatmap elements", () => {
      const svg = renderBadgeStatusSvg("unavailable", { handle: "octocat" });
      expect(svg).toContain("@octocat");
      expect(svg).not.toContain('data-element="score"');
      expect(svg).not.toContain('data-element="dimensions"');
      expect(svg).not.toContain('data-element="activity"');
    });

    it("prefers a locale-resolved heading over the English default", () => {
      const svg = renderBadgeStatusSvg("unavailable", {
        handle: "octocat",
        strings: { unavailableHeading: "Estado de la puntuación no disponible" },
      });
      expect(svg).toContain("Estado de la puntuación no disponible");
      expect(svg).not.toContain("Scoring status unavailable");
    });
  });

  describe("XSS boundary", () => {
    it("escapes a hostile handle", () => {
      const svg = renderBadgeStatusSvg("unregistered", { handle: "user<script>alert(1)</script>" });
      expect(svg).not.toContain("<script>alert(1)</script>");
      expect(svg).toContain("&lt;script&gt;");
    });

    it("escapes a hostile locale-resolved string", () => {
      const svg = renderBadgeStatusSvg("action_needed", {
        handle: "octocat",
        strings: { actionNeededHeading: '<script>alert(1)</script>' },
      });
      expect(svg).not.toContain("<script>alert(1)</script>");
      expect(svg).toContain("&lt;script&gt;");
    });
  });

  describe("accessible name", () => {
    it("includes a <title> only when disableAnimation is set (route-served variant)", () => {
      const routeSvg = renderBadgeStatusSvg("unregistered", { handle: "octocat", disableAnimation: true });
      expect(routeSvg).toContain("<title>");
      const inlineSvg = renderBadgeStatusSvg("unregistered", { handle: "octocat" });
      expect(inlineSvg).not.toContain("<title>");
    });
  });
});

describe("buildBadgeStatusStrings", () => {
  const t = (key: string) => `[${key}]`;

  it("interpolates the collecting heading with a clamped percent", () => {
    const strings = buildBadgeStatusStrings(t, { kind: "collecting", percent: 142, sources: [], hasPriorReceipt: false }, (template, values) => {
      const literal = template.replace("[scoring.status.badgeCollecting]", "Scoring in progress, {percent}%");
      return interpolate(literal, values);
    });
    expect(strings.collectingHeading).toBe("Scoring in progress, 99%");
  });

  it("resolves the action_needed heading", () => {
    const strings = buildBadgeStatusStrings(t, { kind: "action_needed", sources: [], hasPriorReceipt: false }, interpolate);
    expect(strings.actionNeededHeading).toBe("[scoring.status.badgeActionNeeded]");
  });

  it("resolves the unregistered heading and domain", () => {
    const strings = buildBadgeStatusStrings(t, { kind: "unregistered" }, interpolate);
    expect(strings.unregisteredHeading).toBe("[scoring.status.badgeUnregistered]");
    expect(strings.unregisteredDomain).toBe("[scoring.status.badgeUnregisteredDomain]");
  });
});

describe("buildBadgeUnavailableStrings", () => {
  it("resolves the unavailable heading", () => {
    const strings = buildBadgeUnavailableStrings((key) => `[${key}]`);
    expect(strings.unavailableHeading).toBe("[scoring.status.badgeUnavailable]");
  });
});
