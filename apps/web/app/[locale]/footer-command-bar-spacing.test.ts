import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

// #1167 (UX-B1) — GlobalCommandBarLazy renders fixed bottom-0. Every page
// that now renders both SiteFooter and GlobalCommandBarLazy needs a bottom
// spacer between them so scrolling to the true bottom of the page clears
// the fixed bar instead of it occluding the footer's last line. Source-
// content check (not render-observable in jsdom, which doesn't compute
// fixed-position overlap).
const PAGES_WITH_FOOTER_AND_COMMAND_BAR = [
  "about/page.tsx",
  "about/scoring/ScoringMethodologyContent.tsx",
  "about/verification/VerificationPageContent.tsx",
  "privacy/page.tsx",
  "terms/page.tsx",
  "archetypes/_components/ArchetypePageContent.tsx",
];

describe("footer / GlobalCommandBar spacing (#1167 / UX-B1)", () => {
  for (const relativePath of PAGES_WITH_FOOTER_AND_COMMAND_BAR) {
    it(`${relativePath} renders SiteFooter before GlobalCommandBarLazy with a bottom spacer between them`, () => {
      const source = fs.readFileSync(
        path.resolve(__dirname, relativePath),
        "utf-8",
      );
      expect(source).toContain("<SiteFooter");
      expect(source).toContain("<GlobalCommandBarLazy");

      const footerIndex = source.indexOf("<SiteFooter");
      const commandBarIndex = source.indexOf("<GlobalCommandBarLazy");
      expect(footerIndex).toBeGreaterThan(-1);
      expect(footerIndex).toBeLessThan(commandBarIndex);

      // A spacer (padding/height utility) must wrap or immediately precede
      // SiteFooter, in the region before GlobalCommandBarLazy — regardless
      // of whether the spacer class sits on a wrapper opened just before
      // <SiteFooter or somewhere else in that neighborhood.
      const windowStart = Math.max(0, footerIndex - 200);
      const region = source.slice(windowStart, commandBarIndex);
      expect(region).toMatch(/pb-16|pb-24|h-16|h-24/);
    });
  }
});
