import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "page.tsx"),
  "utf-8",
);

// #1104: most of this file's former source-text assertions are now covered
// by real render+invocation assertions — h1 presence/text/locale-swap in
// SharePageLocaleContent.test.tsx, h2 text/styling in SharePageH2.test.tsx,
// generateMetadata's real title/description/OG-image/Twitter/canonical
// output and the JSON-LD payload's privacy boundary in
// share-page.render.test.tsx, and the fallback badge <img>'s
// fetchPriority/embed wiring in the same file's "SharePageContent" tests.
// What remains here has no runtime-observable equivalent: negative
// import-boundary checks (an accidental unused import wouldn't change
// anything observable at render time), Next.js route-segment config, and a
// full Suspense-streaming proof (which would need a real DOM render with a
// deliberately-stalled async dependency — out of proportion to add here
// given the harness this file's render sibling already has).
describe("SharePage — non-renderable architecture checks", () => {
  describe("config-aware badge rendering", () => {
    // #1191 changed what this constraint means. The share page now DOES render
    // the owner's configured badge — that is the point of "one badge artifact",
    // and this page writes to the same cache slot the badge route reads, so
    // rendering the default here would overwrite a configured badge.
    //
    // What must stay true: the config is resolved through the shared helper
    // (never read ad hoc), and only on the RENDER path. A read before the
    // cached-SVG check would put a Supabase round-trip on every share-page view.
    it("resolves badge config through the shared helper, not ad hoc", () => {
      expect(SOURCE).toContain("resolveBadgeConfig");
      expect(SOURCE).not.toContain("cacheGet<BadgeConfig>");
      expect(SOURCE).not.toContain("dbGetStudioConfig");
    });

    it("resolves config only after the cached-SVG check, never before it", () => {
      const cacheCheck = SOURCE.indexOf("!cachedSvg");
      const configRead = SOURCE.indexOf("resolveBadgeConfig(handle)");
      expect(cacheCheck).toBeGreaterThan(-1);
      expect(configRead).toBeGreaterThan(cacheCheck);
    });

    it("does not import the Studio-coupled share preview runtime", () => {
      expect(SOURCE).not.toContain("ShareBadgePreview");
      expect(SOURCE).not.toContain("@/app/studio/BadgePreviewCard");
    });
  });

  describe("owner content delegation", () => {
    it("delegates owner/visitor sections to SharePageOwnerContent", () => {
      expect(SOURCE).toContain("SharePageOwnerContent");
    });
  });

  describe("toolbar with share + customize", () => {
    it("uses BadgeToolbar component", () => {
      expect(SOURCE).toContain("BadgeToolbar");
    });
  });

  // #234 — archetype heading is now rendered inside ImpactDashboard (HeroScoreZone)
  describe("archetype heading delegation", () => {
    it("does not render archetype heading directly (delegated to ImpactDashboard)", () => {
      // The archetype heading was moved into HeroScoreZone via ImpactDashboard
      expect(SOURCE).not.toMatch(/<h3[^>]*>\s*\{impact\.archetype\}\s*<\/h3>/);
    });
  });

  // #1066 (FE-H2) — the route was declaring `revalidate = 3600` (ISR) while
  // both generateMetadata and the page component unconditionally awaited
  // searchParams, which already opted the route out of static rendering
  // entirely (confirmed via .next/prerender-manifest.json: no ISR entry).
  // The route now commits to dynamic rendering instead of paying every ISR
  // trade-off for a route that was never actually static.
  describe("dynamic rendering (#1066)", () => {
    it("does NOT export revalidate (the route is genuinely dynamic, not ISR)", () => {
      expect(SOURCE).not.toContain("export const revalidate");
    });

    it("imports headers from next/headers to resolve the requester's session", () => {
      expect(SOURCE).toMatch(/from ["']next\/headers["']/);
      expect(SOURCE).toMatch(/\bheaders\(\)/);
    });

    // #1165 (FE-H2) — the route is confirmed dynamic (not ISR, see the two
    // tests above), so it can use the server Navbar variant (session sourced
    // via headers(), rendered synchronously, no client round trip) instead
    // of the client NavbarClient variant reserved for ISR pages. Using
    // NavbarClient here forced three downstream client components to
    // re-derive ownership via a redundant `/api/auth/session` fetch.
    // #1194 — the server-vs-client Navbar choice moved into
    // DynamicRouteShell, which renders the server variant. What this route
    // must still never do is reach for the ISR client variant (FE-H2).
    it("uses the dynamic-route shell, not the client NavbarClient variant", () => {
      expect(SOURCE).toMatch(/from ["']@\/components\/DynamicRouteShell["']/);
      expect(SOURCE).not.toContain("NavbarClient");
    });
  });

  // #635 — Suspense boundary for streaming
  describe("Suspense streaming", () => {
    it("imports Suspense from react", () => {
      expect(SOURCE).toContain('import { Suspense }');
    });

    it("wraps content in Suspense with BadgeSkeleton fallback", () => {
      expect(SOURCE).toContain("<Suspense");
      expect(SOURCE).toContain("BadgeSkeleton");
    });

    it("extracts data-dependent content into SharePageContent", () => {
      expect(SOURCE).toContain("SharePageContent");
    });
  });

  // #1167 (UX-B1, launch blocker) — CommandBarHint mounts GlobalCommandBarLazy
  // (fixed bottom-0) once summoned via the "/" shortcut. A bottom spacer
  // between SiteFooter and the end of the page keeps that from occluding the
  // footer's last line — same pattern as the [locale] content pages'
  // pb-16/pb-24 spacer (see footer-command-bar-spacing.test.ts).
  describe("SiteFooter bottom spacer (#1167 / UX-B1)", () => {
    it("wraps SiteFooter in a bottom-padding spacer", () => {
      expect(SOURCE).toContain("<SiteFooter");
      const footerIndex = SOURCE.indexOf("<SiteFooter");
      const windowStart = Math.max(0, footerIndex - 200);
      const region = SOURCE.slice(windowStart, footerIndex);
      expect(region).toMatch(/pb-16|pb-24|h-16|h-24/);
    });
  });
});
