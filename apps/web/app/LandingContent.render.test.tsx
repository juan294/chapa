// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { getServerT } from "@/lib/i18n/server";
import { LANDING_IMPACT } from "@/lib/render/landing-demo-data";
import type { LeaderboardPlace } from "@/lib/profile/leaderboard";
import { LandingContent } from "./LandingContent";

vi.mock("@/components/BadgeOverlay", () => ({ BadgeOverlay: () => <div data-testid="badge-overlay" /> }));
vi.mock("@/components/NavbarClient", () => ({ NavbarClient: () => <nav data-testid="navbar" /> }));
vi.mock("@/components/SiteFooter", () => ({ SiteFooter: () => <footer data-testid="footer" /> }));
vi.mock("@/components/LoginCtaButton", () => ({ LoginCtaButton: () => <button type="button">login</button> }));
vi.mock("@/components/landing/LandingCopyButton", () => ({ LandingCopyButton: () => <button type="button">copy</button> }));
vi.mock("./LandingTerminal", () => ({ LandingTerminal: () => <div data-testid="landing-terminal" /> }));
vi.mock("./LandingUrlEffects", () => ({ LandingUrlEffects: () => null }));

afterEach(cleanup);

const TOP_SCORED: LeaderboardPlace[] = [
  { rank: 1, score: 91, tier: "Elite", handles: ["juan294"] },
  { rank: 2, score: 84, tier: "High", handles: ["cdnkr", "octocat"] },
];

function renderLanding() {
  return render(
    <LandingContent
      demoBadgeSvg="<svg></svg>"
      readmeBadgeSvg="<svg></svg>"
      demoImpact={LANDING_IMPACT}
      topScored={TOP_SCORED}
      t={getServerT("en")}
    />,
  );
}

/**
 * Lighthouse target-size flagged the leaderboard handle links on `/`,
 * `/about` and `/about/scoring` at 59x16 and 40x16 px, eight pixels from the
 * medal pill and the score (LE-8-3). The design system's floor for a control
 * is a 44x44 hit area; the link box itself has to carry it, because the
 * audit (and a thumb) measures the element, not a decorative overlay.
 */
describe("LandingContent — leaderboard links carry a 44px tap area (LE-8-3)", () => {
  it("every handle link in the strip is at least 44px tall and wide", () => {
    renderLanding();
    const links = screen.getAllByRole("link", { name: /^@/ });
    expect(links).toHaveLength(3);
    for (const link of links) {
      expect(link.className).toContain("min-h-11");
      expect(link.className).toContain("min-w-11");
      expect(link.className).toContain("inline-flex");
    }
  });
});
