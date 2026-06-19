import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "layout.tsx"),
  "utf-8",
);

describe("RootLayout", () => {
  describe("client shell baseline", () => {
    it("does not mount analytics providers around every route", () => {
      expect(SOURCE).not.toContain("<PostHogProvider>");
      expect(SOURCE).not.toContain("<ClientAnalytics />");
    });

    it("does not mount keyboard shortcuts globally", () => {
      expect(SOURCE).not.toContain("<KeyboardShortcutsListener />");
    });

    it("uses a deferred instrumentation island instead of global providers", () => {
      expect(SOURCE).toContain("ClientInstrumentation");
    });

    it("does not preconnect to analytics hosts from the root document", () => {
      expect(SOURCE).not.toContain("eu.i.posthog.com");
    });
  });

  describe("skip-to-main-content link (WCAG 2.4.1, #506)", () => {
    it("has a skip link targeting #main-content", () => {
      expect(SOURCE).toMatch(/href="#main-content"/);
    });

    it("has the correct visible text", () => {
      expect(SOURCE).toContain("Skip to main content");
    });

    it("is visually hidden by default with sr-only", () => {
      // The link must be sr-only so it's invisible until focused
      expect(SOURCE).toMatch(/className="sr-only/);
    });

    it("becomes visible on focus with not-sr-only", () => {
      expect(SOURCE).toMatch(/focus:not-sr-only/);
    });

    it("uses a high z-index to appear above all other elements", () => {
      expect(SOURCE).toMatch(/focus:z-\[9999\]/);
    });

    it("uses design system tokens for styling (bg-amber, text-white, rounded-lg)", () => {
      // Primary button style per design system: bg-amber, text-white, rounded-lg
      expect(SOURCE).toMatch(/focus:bg-amber[\s"]/);
      expect(SOURCE).toMatch(/focus:text-white/);
      expect(SOURCE).toMatch(/focus:rounded-lg/);
    });

    it("is the first interactive element inside <body>", () => {
      // The skip link <a> must appear immediately after the <body> tag
      // (allowing non-interactive elements like <script> between them)
      const bodyIndex = SOURCE.indexOf("<body");
      const skipLinkIndex = SOURCE.indexOf('href="#main-content"');
      expect(bodyIndex).toBeGreaterThan(-1);
      expect(skipLinkIndex).toBeGreaterThan(-1);
      expect(skipLinkIndex).toBeGreaterThan(bodyIndex);

      // No other <a> or <button> between <body> and the skip link
      const between = SOURCE.slice(bodyIndex, skipLinkIndex);
      const interactiveBeforeSkip = between.match(/<(a |button )/g);
      // The only <a in between should be the skip link's own opening tag
      expect(interactiveBeforeSkip?.length ?? 0).toBeLessThanOrEqual(1);
    });
  });

  describe("feature flags", () => {
    it("resolves the Studio flag synchronously (ISR-safe — no DB fetch in layout)", () => {
      // Layout uses isStudioEnabledSync (env-var only) instead of async DB-backed
      // isStudioEnabled, to prevent Upstash Redis fetch(no-store) from forcing
      // every page in the app into dynamic rendering.
      expect(SOURCE).toContain("isStudioEnabledSync");
      expect(SOURCE).toContain("const studioEnabled = isStudioEnabledSync()");
    });

    it("hydrates client navigation with the server-resolved Studio flag", () => {
      expect(SOURCE).toContain("ClientFeatureFlagsProvider");
      expect(SOURCE).toContain("studioEnabled={studioEnabled}");
    });
  });
});
