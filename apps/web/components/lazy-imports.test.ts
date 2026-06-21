/**
 * Bundle-reduction invariants. These tests assert that heavy client-only
 * subtrees stay out of the initial JS bundle for public routes.
 *
 * Context: audit issues #719/#798/#729 measured ~700KB+ First Load JS via
 * `route-bundle-stats.json`. That diagnostic sums ALL reachable chunks for
 * a route, including dynamically-loaded ones — so the metric overstates what
 * users actually download. The CI per-file 500KB budget (bundle-size.yml) is
 * the authoritative bundle gate. Even so, deferring owner-only and PostHog
 * client init from the initial render is a real win for share-page TTFB.
 *
 * If you remove a check here, also re-measure share-page chunks vs homepage
 * chunks via `pnpm --filter @chapa/web build` and inspect
 * `.next/diagnostics/route-bundle-stats.json` to confirm the share-only
 * delta hasn't regressed.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const read = (rel: string): string =>
  fs.readFileSync(path.resolve(__dirname, "..", rel), "utf-8");

describe("lazy imports — bundle-reduction invariants", () => {
  describe("share page (#798): owner content is client-only via next/dynamic", () => {
    it("share page does NOT statically import SharePageOwnerContent", () => {
      // A static import here would pull ImpactDashboard + DataSources +
      // CopyButton + useOwnerCacheWarm into the share page initial bundle.
      const sharePage = read("app/u/[handle]/page.tsx");
      expect(sharePage).not.toMatch(
        /^import\s*\{\s*SharePageOwnerContent\s*\}\s*from/m,
      );
    });

    it("share page imports the lazy wrapper instead", () => {
      const sharePage = read("app/u/[handle]/page.tsx");
      expect(sharePage).toMatch(/SharePageOwnerContentLazy/);
    });

    it("lazy wrapper uses next/dynamic", () => {
      const wrapper = read("components/SharePageOwnerContentLazy.tsx");
      expect(wrapper).toMatch(/from\s+["']next\/dynamic["']/);
    });

    it("lazy wrapper allows SSR so public share content is present before hydration", () => {
      const wrapper = read("components/SharePageOwnerContentLazy.tsx");
      expect(wrapper).not.toMatch(/ssr:\s*false/);
    });

    it("lazy wrapper imports SharePageOwnerContent inside the dynamic() factory", () => {
      const wrapper = read("components/SharePageOwnerContentLazy.tsx");
      expect(wrapper).toMatch(
        /dynamic\(\s*\(\)\s*=>\s*import\(["']\.\/SharePageOwnerContent["']\)/,
      );
    });
  });

  describe("PostHog (#719): client init is dynamic with ssr: false", () => {
    it("ClientInstrumentation does NOT statically import PostHogInit", () => {
      // The component itself is small (~50 LOC) and posthog-js is already
      // lazy-loaded inside its useEffect — this guard just keeps the
      // component code off the initial render path.
      const instrumentation = read("components/ClientInstrumentation.tsx");
      expect(instrumentation).not.toMatch(
        /^import\s*\{\s*PostHogInit\s*\}\s*from/m,
      );
    });

    it("ClientInstrumentation uses next/dynamic with ssr: false for PostHog", () => {
      const instrumentation = read("components/ClientInstrumentation.tsx");
      expect(instrumentation).toMatch(/from\s+["']next\/dynamic["']/);
      expect(instrumentation).toMatch(/ssr:\s*false/);
    });
  });
});
